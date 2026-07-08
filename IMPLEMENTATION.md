# product-service — Guía de implementación (para opencode)

> **Objetivo.** Construir `product-service` desde cero: catálogo de **productos y servicios** de cada organización — categorías, **unidades de medida**, impuestos M:N por producto e **imágenes**. Node + TS + Hono + Sequelize, **misma plantilla que `../customer-service/`**.
>
> **Fuente de diseño:** vault `servicios/product-service.md` + mejoras acordadas (Dinero.js v2 + centavos, imágenes por referencia).
>
> **Dinero.js v2 + centavos (BIGINT).** Precios almacenados como enteros en la unidad mínima de la moneda. Toda aritmética monetaria en la app usa `dinero.js`. Nunca `DECIMAL`/`FLOAT` para montos; solo para tasas/porcentajes.
>
> **Impuestos M:N.** Un producto puede tener varios impuestos (`product_taxes`): ej. IVA 15% + retención. No es un campo `tax_rate_id` en el producto; es una tabla join. El `kind` se copia del read-model de tasas al asignar.
>
> **Imágenes por referencia al files-service (crm-minio).** product **NO** toca MinIO ni recibe binarios. Existe un **servicio de archivos genérico** (`/files/*`) que gestiona subida (presigned), almacenamiento y descarga en MinIO, y emite un **`fileId`** por archivo — el mismo patrón que la foto de perfil (`auth.users.avatar_file_id`). product solo guarda **`file_id`** en `product_images`. La respuesta expone `imageFileId` (principal) y `images[].fileId`; **el front arma la URL** con el files-service (como hace con avatares). Si el producto no tiene imágenes, `imageFileId` es `null` y el front usa su placeholder por defecto.
>
> **Contrato:** `openapi.yaml` y `asyncapi.yaml` en esta carpeta son la fuente de verdad.

---

## Reglas de oro

1. **Imita `../customer-service/` archivo por archivo** (entidades + factories + `fromPersistence`/`toPersistence`, `AppError` lanzado, repos factory `(tx?)`, `Repositories` + `UnitOfWork`, modelos `timestamps:false`/`underscored:true`/`CHAR(36)`, controladores factory + `validateJson`, wiring solo en `main.ts`, Outbox).
2. **Base propia `product_db`.** Referencias externas por ID.
3. **NO verifica JWT.** Cabeceras del gateway: `X-Organization-Id`, `X-User-Id`, `X-Country-Code`, `X-Permissions`. Todo salvo `/health` exige `X-Organization-Id`.
4. **Aislamiento en TODA query.** Recurso de otra org → `404`.
5. **Dinero.js para toda aritmética monetaria.** Usa `multiply`, `add`, etc. — nunca `*`/`+` JS sobre centavos.
6. **Precios en centavos (BIGINT).** API recibe/devuelve como string (`"19.99"`); el caso de uso convierte con `Money.fromDecimalString`.
7. **`price_includes_tax`** indica si el precio capturado ya incluye IVA (billing lo usa para calcular base + impuesto). Por defecto `false`.
8. **Imágenes = solo `file_id`.** product NO sube binarios ni genera URLs; el front sube al files-service (presigned, category `product-image`) y luego registra el `fileId` aquí. `imageFileId` puede ser `null` si no hay imágenes.
9. **Eventos vía Outbox** (`product.*`, pasado). Relay pendiente. **Consume** `tax.tax_rate.upserted` (idempotente vía `processed_events`).
10. Tras cada fase: `npm run typecheck` y `npm test` verdes.

---

## Dependencias adicionales

```bash
npm install dinero.js @dinero.js/currencies
```

---

## Fase 1 — Bootstrap

Clona de `../customer-service/`: tsconfig, .sequelizerc, sequelize.config.cjs, .gitignore, Dockerfile, vitest.config. `package.json` con mismas deps + `dinero.js` + `@dinero.js/currencies`.

`.env.example`:
```
NODE_ENV=development
PORT=3006
DB_HOST=localhost
DB_PORT=3306
DB_USER=product_user
DB_PASSWORD=secret
DB_NAME=product_db
CORS_ORIGIN=http://localhost:5173
```

> No necesita credenciales de MinIO: las imágenes las gestiona el files-service; product solo guarda `file_id`.

Estructura: `src/{domain,application/use-cases,infrastructure/persistence,interface/http,shared,__tests__}` + `migrations/`.

- [ ] `npm install && npm run typecheck` OK.

---

## Fase 2 — Migración

`migrations/<ts>-create-product-tables.js`:

**`categories`**
```
id              char(36)  PK
organization_id char(36)  NN
name            varchar(255) NN
description     varchar(255) null
parent_id       char(36)  null FK→categories SET NULL
status          enum(active,inactive) def active
created_at      datetime
updated_at      datetime
UNIQUE (organization_id, name, parent_id)
```

**`units`** (unidades de medida)
```
id              char(36)  PK
organization_id char(36)  NN
code            varchar(20) NN   ← UND, KG, HORA, M2…
name            varchar(100) NN
created_at      datetime
updated_at      datetime
UNIQUE (organization_id, code)
```

**`products`**
```
id               char(36)   PK
organization_id  char(36)   NN            ← aislamiento
sku              varchar(64) null          ← único por org (NULL no colisiona)
name             varchar(255) NN
description      text        null
type             enum(good,service) NN def good
category_id      char(36)   null FK→categories SET NULL
unit_id          char(36)   null FK→units SET NULL
price_cents      bigint     NN def 0      ← precio en centavos (Dinero.js)
currency_code    char(3)    NN def 'USD'  ← ISO 4217
price_includes_tax boolean  NN def false  ← si el precio ya incluye IVA
track_stock      boolean    NN def false  ← flag para inventory-service (fase 2)
status           enum(active,inactive) NN def active
metadata         json       null
created_at       datetime
updated_at       datetime
UNIQUE (organization_id, sku)
```

**`product_taxes`** (M:N — un producto puede tener varios impuestos)
```
id           char(36)  PK
product_id   char(36)  NN FK→products CASCADE
tax_rate_id  char(36)  NN              ← ref lógica → read-model tax_rates
kind         varchar(30) NN            ← denormalizado al asignar: vat|withholding_iva|…
UNIQUE (product_id, tax_rate_id)
```

**`product_images`**
```
id              char(36)   PK
product_id      char(36)   NN FK→products CASCADE
organization_id char(36)   NN   ← denormalizado para aislar
file_id         char(36)   NN   ← referencia al files-service (crm-minio)
alt             varchar(255) null
is_primary      boolean    NN def false
position        int        NN def 0
created_at      datetime
UNIQUE (product_id, file_id)
INDEX (product_id, is_primary)
```

**`tax_rates`** (READ-MODEL de tax-service)
```
id           char(36)     PK
country_code char(2)      NN
code         varchar(20)  NN
name         varchar(100)
percentage   decimal(6,2) NN   ← porcentaje, NO centavos
kind         varchar(30)  NN
is_default   boolean      def false
UNIQUE (country_code, code)
```

**`outbox_messages`** + **`processed_events`**

Seed dev opcional: 3 tasas de EC en `tax_rates` (IVA15, IVA0, NO_OBJETO).

- [ ] `db:migrate` limpio; `undo` revierte.

---

## Fase 3 — Dominio (`src/domain/`)

### 3.1 Value objects (`value-objects.ts`)

**`Money`** — único punto donde vive Dinero.js:

```ts
import { dinero, add, subtract, multiply, toDecimal, toSnapshot } from 'dinero.js';
import { USD, PEN, COP, MXN } from '@dinero.js/currencies';

const CURRENCIES: Record<string, any> = { USD, PEN, COP, MXN };

export class Money {
  private constructor(private readonly d: Dinero<number>) {}

  static fromCents(cents: number, currencyCode: string): Money { … }

  /** Desde el string del API ("19.99") */
  static fromDecimalString(value: string, currencyCode: string): Money {
    const currency = CURRENCIES[currencyCode];
    if (!currency) throw new InvalidCurrencyError(currencyCode);
    const factor = Math.pow(10, currency.exponent);
    const cents = Math.round(parseFloat(value) * factor);
    if (isNaN(cents)) throw new InvalidMoneyAmountError();
    return new Money(dinero({ amount: cents, currency }));
  }

  add(other: Money): Money { … }
  subtract(other: Money): Money { … }
  toCents(): number { return toSnapshot(this.d).amount; }
  toCurrencyCode(): string { return toSnapshot(this.d).currency.code; }
  toDecimalString(): string { return toDecimal(this.d); }
}
```

### 3.2 Entidades (`entities.ts`)

- **`Category`** — `id, organizationId, name, description|null, parentId|null, status`. `create`, `update`, `deactivate`.
- **`Unit`** — `id, organizationId, code, name`. `create`, `update`.
- **`Product`** — `id, organizationId, sku|null, name, description|null, type, categoryId|null, unitId|null, price(Money), currencyCode, priceIncludesTax, trackStock, status, metadata|null, timestamps`. `create({ ..., priceCents, currencyCode })`, `updateDetails(...)`, `updatePrice(Money)`, `disable()`.
- **`ProductTax`** — `id, productId, taxRateId, kind`. `static create({ productId, taxRateId, kind })`.
- **`ProductImage`** — `id, productId, organizationId, fileId, alt|null, isPrimary, position`. `create`, `setPrimary`, `unsetPrimary`.

### 3.3 Errores (`errors.ts`)

`AppError` + `ValidationError(422)`, `OrganizationContextRequiredError(401)`, `ForbiddenError(403)`, `ProductNotFoundError(404)`, `CategoryNotFoundError(404)`, `UnitNotFoundError(404)`, `TaxRateNotFoundError(422)`, `ImageNotFoundError(404)`, `SkuAlreadyExistsError(409)`, `CategoryNameExistsError(409)`, `UnitCodeExistsError(409)`, `CannotDeleteCategoryWithProductsError(422)`, `InvalidCurrencyError(422)`, `InvalidMoneyAmountError(422)`.

### 3.4 Repositorios (`repositories.ts`)

```ts
ProductRepository: findById, findBySku(orgId,sku), list(orgId,filters), save
CategoryRepository: listByOrganization, findById, findByName(orgId,name,parentId?), save, delete
UnitRepository: listByOrganization, findById, findByCode(orgId,code), save
ProductTaxRepository: listByProduct(productId), save(productTax), deleteByProduct(productId)
ProductImageRepository: listByProduct, findById, save, delete, clearPrimary(productId)
TaxRateReadModelRepository: findById, findByIdAndCountry(id,country), listByCountry, upsert
OutboxRepository: add(DomainEvent)
```

Agregado `Repositories` + `UnitOfWork`.

- [ ] `typecheck` OK.

---

## Fase 4 — Persistencia (`src/infrastructure/persistence/`)

`sequelize.ts`, `models.ts` (asociaciones `Product.hasMany(ProductTax)`, `Product.hasMany(ProductImage)`, `Product.belongsTo(Category)`, `Product.belongsTo(Unit)`), `repositories.ts` (mappers, factories `(tx?)`, `buildRepositories`, `SequelizeUnitOfWork`).

Mapper clave para `Product`:
```ts
price: Money.fromCents(Number(m.price_cents), m.currency_code)
```

`save` de Product → `upsert` con `price_cents: product.price.toCents()`.

- [ ] `typecheck` OK.

---

## Fase 5 — Casos de uso (`src/application/use-cases/`)

`ports.ts`: `UnitOfWork`. `dtos.ts`: DTOs + mappers. El DTO de producto expone:
```ts
{
  id, organizationId, sku, name, description, type,
  categoryId, unitId, status, priceIncludesTax, trackStock,
  price: "19.99", priceCents: 1999, currencyCode: "USD",
  taxes: [{ id, taxRateId, kind }],
  imageFileId: "uuid" | null,   // fileId de la imagen principal; null si no hay
  images: [{ id, fileId, alt, isPrimary, position }],
  metadata, createdAt, updatedAt
}
```

> El front resuelve la imagen a partir del `fileId` usando el files-service (igual que los avatares). product no arma URLs.

### 5.1 `CreateProductUseCase`
`execute({ organizationId, name, type, price, currencyCode, sku?, categoryId?, unitId?, taxRateIds?, priceIncludesTax?, description?, metadata? })`:
1. `Money.fromDecimalString(price, currencyCode)`.
2. Si `sku`: duplicado → `SkuAlreadyExistsError`.
3. Si `categoryId`: existe y es de la org → `CategoryNotFoundError`.
4. Si `unitId`: existe y es de la org → `UnitNotFoundError`.
5. Si `taxRateIds[]`: cada uno existe en el read-model **para el `country_code` del contexto** → `TaxRateNotFoundError`. Lee el `kind` del read-model para denormalizarlo en `ProductTax`.
6. En `uow`: `Product.create(...)` → `save`. Crea un `ProductTax` por cada tasa. Emite `product.product.created`.

### 5.2 `UpdateProductTaxesUseCase`
`execute({ organizationId, productId, taxRateIds[] })` — **reemplaza** el set completo:
1. Valida pertenencia del producto.
2. `ProductTaxRepository.deleteByProduct(productId)`.
3. Crea nuevos `ProductTax` validando cada tasa contra el read-model. Emite `product.product.updated`.

### 5.3 Resto de casos de uso
- `GetProductUseCase(orgId, id)` — carga con `taxes[]` e `images[]`; expone `imageFileId` (el de la primary, o `null`).
- `ListProductsUseCase(orgId, filters)` — expone `imageFileId` por cada producto.
- `UpdateProductUseCase` — si cambia `price`, usa `Money.fromDecimalString`; emite `product.product.updated`.
- `DisableProductUseCase` — emite `product.product.disabled`.
- CRUD de `categories` (valida nombre único; no borrar con productos activos).
- CRUD de `units` (valida código único por org).
- **Imágenes:** `AddProductImageUseCase({ orgId, productId, fileId, alt?, isPrimary? })` — valida pertenencia del producto; **no** valida el archivo contra el files-service (confianza en el `fileId` que el front ya subió y confirmó); primera imagen → primary automática; si `isPrimary=true`, `clearPrimary` antes. `RemoveProductImageUseCase` (borrar primary → promover siguiente por position). `SetPrimaryImageUseCase` (`clearPrimary` → `setPrimary`). Todos emiten `product.product.updated`.

> **Regla de pertenencia obligatoria:** toda operación sobre `category`/`unit`/`image`/`productTax` verifica que pertenezca a la org del contexto → si no, `404`.

- [ ] Casos de uso implementados.

---

## Fase 6 — HTTP (`src/interface/http/`)

**`middlewares.ts`**: `contextMiddleware`, `requireOrganization` (401), `requirePermission(perm)` (403), `errorHandler`.

**`validators.ts`**: Zod + `validateJson`. Schemas:
- `createProductSchema { name, type, price, currencyCode, sku?, categoryId?, unitId?, taxRateIds?, priceIncludesTax?, description?, metadata? }`
- `updateProductSchema`, `updateTaxesSchema { taxRateIds: string[] }`
- `createCategorySchema`, `updateCategorySchema`
- `createUnitSchema { code, name }`, `updateUnitSchema`
- `addImageSchema { fileId, alt?, position?, isPrimary? }`

**`controllers.ts`**: factories; `organizationId` y `countryCode` del contexto.

**`routes.ts` + `app.ts`**: monta **exactamente** lo del `openapi.yaml`. CORS con `X-*`. `contextMiddleware` global.

- [ ] Rutas montadas según `openapi.yaml`.

---

## Fase 7 — Composition root + consumer

`main.ts` (puerto 3006): `sequelize.authenticate()`, `buildRepositories()` + `SequelizeUnitOfWork`. Consumer de `tax.tax_rate.upserted` (tras flag `RABBITMQ_URL`).

- [ ] `build` OK; `/health` responde.

---

## Fase 8 — Tests (`src/__tests__/`)

Repos fake en memoria. Cubrir:
- `CreateProduct`: `"19.99"` → `price_cents=1999`; SKU duplicado → 409; `taxRateId` de otro país → 422; categoría de otra org → 404.
- `UpdateProductTaxes`: reemplaza el set completo correctamente.
- `Money.fromDecimalString`: redondeo correcto; moneda inválida → error.
- Producto sin imágenes → `imageFileId = null`.
- Primera imagen → `isPrimary=true` automático; borrar primary → promueve siguiente.
- `DisableProduct` emite `product.product.disabled`.

- [ ] `npm test` verde.

---

## Definición de "hecho"

1. `db:migrate` crea las 7 tablas.
2. `POST /products { name, type, price: "19.99", currencyCode: "USD", taxRateIds: [...] }` crea el producto con `price_cents=1999` y sus `product_taxes` asociados.
3. `GET /products/:id` devuelve `{ price: "19.99", priceCents: 1999, taxes: [...], imageFileId: null }` si no tiene imágenes; con imágenes, el `fileId` de la principal.
4. `POST /products/:id/images { fileId }` registra la referencia; la primera queda primary; `PUT .../images/:imageId/primary` la cambia.
5. Imágenes: primera imagen es primary automáticamente; borrar primary promueve la siguiente.
6. SKU duplicado → 409; tasa de otro país → 422; cross-org → 404; sin permiso → 403; sin contexto → 401.
7. `npm test` + `npm run build` OK; contratos implementados fielmente.

---

## Fuera de alcance (no hacer)

- **Hablar con MinIO / recibir binarios / generar presigned URLs.** Eso es del **files-service (crm-minio)**; product solo guarda `file_id`. No implementes upload multipart.
- Relay de Outbox (infra compartida).
- Inventario/stock (fase 2, `track_stock` es solo el flag).
- Variantes de producto, listas de precios múltiples (fase posterior).
- Conversión de moneda (billing la maneja con tax-service).
