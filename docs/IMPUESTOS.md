# Impuestos por producto — modelo y hoja de ruta

> Documento vivo. Explica **cómo se modelan los impuestos por producto** en este servicio y cuál es el plan para agregar retenciones, ICE y otros tipos en el futuro. Aplica primero a **Ecuador (SRI)**, con diseño extensible a PE / CO / MX.

## TL;DR

- Un producto puede tener **hasta una tasa por cada `kind`** de impuesto — nunca dos del mismo tipo.
- Hoy la UI solo captura **IVA** (`kind: vat`); el resto están en la hoja de ruta.
- La tabla `product_taxes` es M:N para soportar los otros tipos (retenciones, ICE) cuando lleguen. Ya está lista; solo hay que agregar los selectores en el front.

---

## Tipos de impuesto (`kind`)

| `kind` | Nombre común | ¿Grava o retiene? | Ejemplos (Ecuador) | Máximo por producto |
|---|---|---|---|---|
| `vat` | IVA | Grava la venta | IVA 15%, IVA 0%, No objeto de IVA | **1** |
| `withholding_iva` | Retención de IVA | Retiene | 30%, 70%, 100% del IVA | **1** |
| `withholding_rent` | Retención en la fuente (renta) | Retiene | Códigos SRI 303, 304, 312, 332… | **1** |
| `special` | ICE (Impuesto a los Consumos Especiales) | Grava adicional | Cerveza, cigarrillos, licor, vehículos | **1** |

**Regla invariable:** máximo **una** tasa por `kind`. No tiene sentido fiscal ni operacional aplicar dos tasas del mismo tipo simultáneamente.

## Por qué la tabla es M:N (`product_taxes`)

Podríamos haber puesto `vat_rate_id`, `withholding_iva_rate_id`, etc. como columnas fijas en `products`. Descartado por:

1. **Extensibilidad multipaís.** En PE hay `IGV` + `ISC`; en CO `IVA` + `INC`; en MX `IVA` + `IEPS` + `ISH`. Nombres y cantidades cambian por país. Con M:N + `kind` denormalizado, cada país usa los `kind` que necesita sin migraciones.
2. **Datos de facturación limpios.** Al emitir factura, billing lee `product_taxes` y ya sabe qué aplicar. No hay que hacer 4 JOINs.
3. **Historia futura.** Cuando aparezca un impuesto nuevo (ej. impuesto verde, impuesto digital), solo se agrega un `kind` — cero cambios de esquema.

La validación de unicidad por `kind` la aplica el servicio en `CreateProduct` y `UpdateProductTaxes` (error `MULTIPLE_TAX_KIND`, HTTP 422).

## Fase 1 — IVA (actual)

**Alcance:** el usuario configura solo el IVA del producto.

**UI:**
- Un selector simple `v-select` etiquetado **"IVA"**, filtrado por `kind: vat`.
- El backend recibe `taxRateIds: [ivaId]` (siempre 1 elemento o vacío).

**Backend:**
- `CreateProduct` / `UpdateProductTaxes` aceptan `taxRateIds[]` y validan unicidad por `kind`.
- Si se envía `taxRateIds` con dos IVA → `422 MULTIPLE_TAX_KIND`.
- Si se envía una tasa que no existe o no es del país → `422 TAX_RATE_NOT_FOUND`.

**Ejemplo válido:**
```json
{ "taxes": [{ "taxRateId": "uuid-iva-15", "kind": "vat" }] }
```

## Fase 2 — Retenciones e ICE

Cuando el negocio lo requiera. **No modificar el esquema** — el modelo M:N ya lo soporta.

### 2.1 ICE (Impuesto a los Consumos Especiales)

Aplica a productos específicos: cerveza, cigarrillos, licores, vehículos de lujo, etc.

**UI:**
- Un segundo `v-select` etiquetado **"ICE"** que aparece **solo si el país tiene tasas ICE disponibles** (`kind: special`).
- Opcional (la mayoría de productos no tiene ICE).

**Backend:** ya soportado. Solo agregar `taxRateIds: [ivaId, iceId]`.

### 2.2 Retención de IVA

Aplica cuando la organización actúa como **agente de retención**. La retención **no depende solo del producto** — depende de la relación proveedor / cliente. Por eso hay dos enfoques posibles:

**Opción A (recomendada):** modelar la retención al momento de **emitir el documento de retención**, no en el catálogo del producto. La retención vive en `billing-service`, no en `product-service`.

**Opción B (alternativa):** dejar en el producto una **retención sugerida por defecto**, que el usuario puede sobrescribir al emitir. En este caso se agrega un tercer selector "Retención IVA" filtrado por `kind: withholding_iva`.

**Decisión pendiente:** discutir cuando se construya billing-service. Mi recomendación es **A** — el catálogo del producto queda limpio y las retenciones se configuran donde se aplican.

### 2.3 Retención de renta (fuente)

Mismo dilema que retención de IVA. Códigos SRI (303, 304, 312…) dependen del tipo de servicio y del tercero. Recomiendo también **modelar en billing**, no en el catálogo del producto.

## Fase 3 — Extensión multipaís

Cuando se agregue PE / CO / MX:

1. **tax-service** publica las tasas del país nuevo con sus `kind` correspondientes.
2. **product-service** las recibe en el read-model `tax_rates` (ya soportado por el consumer de `tax.tax_rate.upserted`).
3. **UI del formulario de producto** filtra por país (usa `X-Country-Code` del contexto):
   - EC: IVA + [ICE opcional]
   - PE: IGV + [ISC opcional]
   - CO: IVA + [INC opcional]
   - MX: IVA + [IEPS opcional]

El código del selector es prácticamente el mismo: filtrar por `kind` según el país. Un solo componente `<TaxSelectors>` puede manejar los cuatro países.

## Reglas de negocio (invariantes)

1. **Máximo una tasa por `kind` por producto.** Enforce en backend con `MultipleTaxKindError`.
2. **La tasa debe pertenecer al `country_code` del contexto.** Enforce con `TaxRateNotFoundError`.
3. **El `kind` no lo envía el cliente** — se copia del read-model al asignar. El cliente solo envía `taxRateId`.
4. **La lista `taxRateIds` reemplaza el conjunto completo** — no es incremental. `PUT /products/:id/taxes` semántica de "estos son los impuestos ahora".
5. **`price_includes_tax` aplica solo al IVA.** Las retenciones y el ICE se calculan sobre la base imponible; su comportamiento no se ve afectado por el flag.

## Cambios pendientes (checklist)

- [x] Frontend: selector único de IVA (filtrado `kind: vat`)
- [x] Backend: validación de unicidad por `kind` en `CreateProduct`
- [x] Backend: validación de unicidad por `kind` en `UpdateProductTaxes`
- [x] Nuevo error `MULTIPLE_TAX_KIND` (HTTP 422)
- [ ] Tests: `CreateProduct` con dos IVA → 422
- [ ] Tests: `UpdateProductTaxes` con dos IVA → 422
- [ ] Documentar en `openapi.yaml` el error `MULTIPLE_TAX_KIND`
- [ ] Decidir dónde vive la retención (producto vs. facturación) al empezar billing-service
- [ ] Extender UI cuando exista un país con ICE aplicable
