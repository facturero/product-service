import { Op, Transaction } from 'sequelize';
import { sequelize } from './sequelize.js';
import { CountCache } from './count-cache.js';
import {
  CategoryModel,
  OutboxModel,
  ProductEstablishmentModel,
  ProductImageModel,
  ProductModel,
  ProductTaxModel,
  UnitModel,
} from './models.js';
import {
  Category,
  Product,
  ProductEstablishment,
  ProductImage,
  ProductTax,
  Unit,
} from '../../domain/entities.js';
import {
  CategoryRepository,
  DomainEvent,
  ListProductsFilters,
  OutboxRepository,
  ProductEstablishmentRepository,
  ProductImageRepository,
  ProductRepository,
  ProductTaxRepository,
  Repositories,
  TaxRateReadModelRepository,
  UnitRepository,
} from '../../domain/repositories.js';
import { UnitOfWork } from '../../application/ports.js';
import { withActor } from '@facturero/outbox-relay';

// ── Mappers ─────────────────────────────────────────────────────────────────

function toCategory(m: CategoryModel): Category {
  return Category.fromPersistence({
    id: m.id,
    organizationId: m.organization_id,
    name: m.name,
    description: m.description,
    parentId: m.parent_id,
    status: m.status,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  });
}

function toUnit(m: UnitModel): Unit {
  return Unit.fromPersistence({
    id: m.id,
    organizationId: m.organization_id,
    code: m.code,
    name: m.name,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  });
}

function toProduct(m: ProductModel): Product {
  return Product.fromPersistence({
    id: m.id,
    organizationId: m.organization_id,
    sku: m.sku,
    name: m.name,
    description: m.description,
    type: m.type,
    categoryId: m.category_id,
    unitId: m.unit_id,
    priceCents: Number(m.price_cents),
    currencyCode: m.currency_code,
    priceIncludesTax: m.price_includes_tax,
    trackStock: m.track_stock,
    allowNegativeStock: m.allow_negative_stock,
    valuationMethod: m.valuation_method,
    status: m.status,
    metadata: m.metadata as Record<string, unknown> | null,
    createdAt: m.created_at,
    updatedAt: m.updated_at,
  });
}

function toProductTax(m: ProductTaxModel): ProductTax {
  return ProductTax.fromPersistence({
    id: m.id,
    productId: m.product_id,
    taxRateId: m.tax_rate_id,
    kind: m.kind,
  });
}

function toProductImage(m: ProductImageModel): ProductImage {
  return ProductImage.fromPersistence({
    id: m.id,
    productId: m.product_id,
    organizationId: m.organization_id,
    fileId: m.file_id,
    alt: m.alt,
    isPrimary: m.is_primary,
    position: m.position,
    createdAt: m.created_at,
  });
}

function toProductEstablishment(m: ProductEstablishmentModel): ProductEstablishment {
  return ProductEstablishment.fromPersistence({
    productId: m.product_id,
    establishmentId: m.establishment_id,
  });
}

// ── Repositories ────────────────────────────────────────────────────────────

// Total del listado de productos: cacheado unos segundos (ver count-cache.ts). El
// COUNT(*) de una organización con decenas de miles de productos cuesta ~90 ms de
// MySQL por petición y limitaba GET /products a ~41 RPS. 0 desactiva el caché.
const productCountCache = new CountCache(Number(process.env.PRODUCT_COUNT_CACHE_TTL_MS ?? 5000));

function productRepository(tx?: Transaction): ProductRepository {
  return {
    async findById(id) {
      const m = await ProductModel.findByPk(id, { transaction: tx });
      return m ? toProduct(m) : null;
    },
    async findBySku(organizationId, sku) {
      const m = await ProductModel.findOne({
        where: { organization_id: organizationId, sku },
        transaction: tx,
      });
      return m ? toProduct(m) : null;
    },
    async list(organizationId, filters: ListProductsFilters) {
      const where: Record<string, unknown> = { organization_id: organizationId };
      if (filters.status) where.status = filters.status;
      if (filters.type) where.type = filters.type;
      if (filters.categoryId) where.category_id = filters.categoryId;
      if (filters.search) {
        where[Op.or as unknown as string] = [
          { name: { [Op.like]: `%${filters.search}%` } },
          { sku: { [Op.like]: `%${filters.search}%` } },
        ];
      }
      const include = filters.establishmentId
        ? [{
            model: ProductEstablishmentModel,
            as: 'establishments',
            where: { establishment_id: filters.establishmentId },
            required: true,
            attributes: [],
          }]
        : undefined;
      const rows = await ProductModel.findAll({
        where,
        include,
        transaction: tx,
        order: [['created_at', 'DESC'], ['id', 'DESC']],
        limit: filters.limit,
        offset: filters.offset,
      });
      // Dentro de una transacción se cuenta siempre (debe ver sus propias escrituras).
      const total = tx
        ? await ProductModel.count({ where, include, transaction: tx })
        : await productCountCache.get(
            organizationId,
            JSON.stringify([filters.status, filters.type, filters.categoryId, filters.search, filters.establishmentId]),
            () => ProductModel.count({ where, include }),
          );
      return { items: rows.map(toProduct), total };
    },
    async save(product) {
      const p = product.toPersistence();
      // El total de esta organización cambia: se descarta lo cacheado (los demas
      // procesos lo veran cuando venza el TTL).
      productCountCache.invalidate(p.organizationId);
      await ProductModel.upsert(
        {
          id: p.id,
          organization_id: p.organizationId,
          sku: p.sku,
          name: p.name,
          description: p.description,
          type: p.type,
          category_id: p.categoryId,
          unit_id: p.unitId,
          price_cents: p.priceCents,
          currency_code: p.currencyCode,
          price_includes_tax: p.priceIncludesTax,
          track_stock: p.trackStock,
          allow_negative_stock: p.allowNegativeStock,
          valuation_method: p.valuationMethod,
          status: p.status,
          metadata: p.metadata,
          created_at: p.createdAt,
          updated_at: new Date(),
        },
        { transaction: tx },
      );
    },
  };
}

function categoryRepository(tx?: Transaction): CategoryRepository {
  return {
    async findById(id) {
      const m = await CategoryModel.findByPk(id, { transaction: tx });
      return m ? toCategory(m) : null;
    },
    async findByName(organizationId, name, parentId?) {
      const where: Record<string, unknown> = { organization_id: organizationId, name };
      if (parentId !== undefined) where.parent_id = parentId;
      const m = await CategoryModel.findOne({ where, transaction: tx });
      return m ? toCategory(m) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await CategoryModel.findAll({
        where: { organization_id: organizationId },
        transaction: tx,
        order: [['name', 'ASC']],
      });
      return rows.map(toCategory);
    },
    async save(category) {
      const p = category.toPersistence();
      await CategoryModel.upsert(
        {
          id: p.id,
          organization_id: p.organizationId,
          name: p.name,
          description: p.description,
          parent_id: p.parentId,
          status: p.status,
          created_at: p.createdAt,
          updated_at: new Date(),
        },
        { transaction: tx },
      );
    },
    async delete(id) {
      await CategoryModel.destroy({ where: { id }, transaction: tx });
    },
    async countProductsByCategory(categoryId) {
      return ProductModel.count({ where: { category_id: categoryId, status: 'active' }, transaction: tx });
    },
  };
}

function unitRepository(tx?: Transaction): UnitRepository {
  return {
    async findById(id) {
      const m = await UnitModel.findByPk(id, { transaction: tx });
      return m ? toUnit(m) : null;
    },
    async findByCode(organizationId, code) {
      const m = await UnitModel.findOne({
        where: { organization_id: organizationId, code },
        transaction: tx,
      });
      return m ? toUnit(m) : null;
    },
    async listByOrganization(organizationId) {
      const rows = await UnitModel.findAll({
        where: { organization_id: organizationId },
        transaction: tx,
        order: [['code', 'ASC']],
      });
      return rows.map(toUnit);
    },
    async save(unit) {
      const p = unit.toPersistence();
      await UnitModel.upsert(
        {
          id: p.id,
          organization_id: p.organizationId,
          code: p.code,
          name: p.name,
          created_at: p.createdAt,
          updated_at: new Date(),
        },
        { transaction: tx },
      );
    },
  };
}

function productTaxRepository(tx?: Transaction): ProductTaxRepository {
  return {
    async findByProduct(productId) {
      const rows = await ProductTaxModel.findAll({
        where: { product_id: productId },
        transaction: tx,
      });
      return rows.map(toProductTax);
    },
    async findByProducts(productIds) {
      if (productIds.length === 0) return [];
      const rows = await ProductTaxModel.findAll({
        where: { product_id: productIds },
        transaction: tx,
      });
      return rows.map(toProductTax);
    },
    async save(productTax) {
      const p = productTax.toPersistence();
      await ProductTaxModel.upsert(
        {
          id: p.id,
          product_id: p.productId,
          tax_rate_id: p.taxRateId,
          kind: p.kind,
        },
        { transaction: tx },
      );
    },
    async deleteByProduct(productId) {
      await ProductTaxModel.destroy({ where: { product_id: productId }, transaction: tx });
    },
  };
}

function productEstablishmentRepository(tx?: Transaction): ProductEstablishmentRepository {
  return {
    async listByProduct(productId) {
      const rows = await ProductEstablishmentModel.findAll({
        where: { product_id: productId },
        transaction: tx,
      });
      return rows.map(toProductEstablishment);
    },
    async listProductIdsByEstablishment(establishmentId) {
      const rows = await ProductEstablishmentModel.findAll({
        where: { establishment_id: establishmentId },
        attributes: ['product_id'],
        transaction: tx,
      });
      return rows.map((r) => r.product_id);
    },
    async replaceForProduct(productId, establishmentIds) {
      // Diff mínimo en vez de destroy+bulkCreate totales: tocar solo las filas
      // que cambian reduce la superficie de gap-locks sobre el índice de
      // establishment_id, principal fuente de ER_LOCK_DEADLOCK bajo concurrencia.
      const current = await ProductEstablishmentModel.findAll({
        where: { product_id: productId },
        attributes: ['establishment_id'],
        transaction: tx,
      });
      const currentSet = new Set(current.map((r) => r.establishment_id));
      const targetSet = new Set(establishmentIds);
      const toDelete = [...currentSet].filter((id) => !targetSet.has(id));
      const toAdd = establishmentIds.filter((id) => !currentSet.has(id));
      if (toDelete.length > 0) {
        await ProductEstablishmentModel.destroy({
          where: { product_id: productId, establishment_id: { [Op.in]: toDelete } },
          transaction: tx,
        });
      }
      if (toAdd.length > 0) {
        await ProductEstablishmentModel.bulkCreate(
          toAdd.map((establishmentId) => ({
            product_id: productId,
            establishment_id: establishmentId,
            created_at: new Date(),
          })),
          { transaction: tx },
        );
      }
    },
  };
}

function productImageRepository(tx?: Transaction): ProductImageRepository {
  return {
    async findById(id) {
      const m = await ProductImageModel.findByPk(id, { transaction: tx });
      return m ? toProductImage(m) : null;
    },
    async listByProduct(productId) {
      const rows = await ProductImageModel.findAll({
        where: { product_id: productId },
        transaction: tx,
        order: [['position', 'ASC']],
      });
      return rows.map(toProductImage);
    },
    async save(image) {
      const p = image.toPersistence();
      await ProductImageModel.upsert(
        {
          id: p.id,
          product_id: p.productId,
          organization_id: p.organizationId,
          file_id: p.fileId,
          alt: p.alt,
          is_primary: p.isPrimary,
          position: p.position,
          created_at: p.createdAt,
        },
        { transaction: tx },
      );
    },
    async delete(id) {
      await ProductImageModel.destroy({ where: { id }, transaction: tx });
    },
    async clearPrimary(productId) {
      await ProductImageModel.update(
        { is_primary: false },
        { where: { product_id: productId, is_primary: true }, transaction: tx },
      );
    },
    async findPrimary(productId) {
      const m = await ProductImageModel.findOne({
        where: { product_id: productId, is_primary: true },
        transaction: tx,
      });
      return m ? toProductImage(m) : null;
    },
    async findPrimariesByProductIds(productIds) {
      // Carga la imagen primaria de N productos con UNA query (el listado de
      // productos resolvía antes una query por producto → N+1).
      if (productIds.length === 0) return new Map<string, ProductImage>();
      const rows = await ProductImageModel.findAll({
        where: { product_id: { [Op.in]: productIds }, is_primary: true },
        transaction: tx,
      });
      const result = new Map<string, ProductImage>();
      for (const row of rows) {
        const img = toProductImage(row);
        if (!result.has(img.productId)) result.set(img.productId, img);
      }
      return result;
    },
  };
}

function outboxRepository(tx?: Transaction): OutboxRepository {
  return {
    async add(event: DomainEvent) {
      await OutboxModel.create(
        {
          id: event.eventId,
          aggregate_type: event.aggregateType,
          aggregate_id: event.aggregateId,
          type: event.type,
          // Inyecta actor/ip/request-id desde el contexto de la petición.
          // Sin esto la bitácora de auditoría no sabe QUIÉN hizo cada cosa: el
          // `userId` que ya llevan algunos payloads es el usuario AFECTADO.
          payload: withActor(event.payload as Record<string, unknown>),
          occurred_at: event.occurredAt,
          processed_at: null,
        },
        { transaction: tx },
      );
    },
  };
}

export function buildRepositories(tx: Transaction | undefined, taxRatesOverride: TaxRateReadModelRepository): Repositories {
  return {
    products: productRepository(tx),
    categories: categoryRepository(tx),
    units: unitRepository(tx),
    productTaxes: productTaxRepository(tx),
    productEstablishments: productEstablishmentRepository(tx),
    productImages: productImageRepository(tx),
    taxRates: taxRatesOverride,
    outbox: outboxRepository(tx),
  };
}

export class SequelizeUnitOfWork implements UnitOfWork {
  constructor(
    private readonly taxRatesOverride: TaxRateReadModelRepository,
    private readonly onCommit?: (tx: Transaction) => void,
  ) {}

  async execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    // Los deadlocks de InnoDB (1213) y lock-wait-timeout (1205) son retryables
    // por diseño: InnoDB elige y mata a una víctima en cada ciclo. Reintentar
    // la transacción completa absorbe el choque en vez de devolver un 500.
    // El hook onCommit usa tx.afterCommit, así que un reintento fallido no
    // publica nada: el outbox sale solo en el commit que prospera.
    return withTransactionRetry(5, () =>
      sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        async (tx) => {
          this.onCommit?.(tx);
          return work(buildRepositories(tx, this.taxRatesOverride));
        },
      ),
    );
  }
}

const RETRYABLE_CODES = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const parent = (error as Error & { parent?: { code?: string } }).parent;
  const code = parent?.code ?? (error as Error & { code?: string }).code;
  return typeof code === 'string' && RETRYABLE_CODES.has(code);
}

async function withTransactionRetry<T>(attempts: number, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === attempts || !isRetryableError(error)) throw error;
      // Backoff corto con jitter: evita que los reintentos de transacciones
      // concurrentes que chocaron por el mismo gap-lock se re-sincronicen.
      const delay = 25 + Math.floor(Math.random() * 50) * attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error('withTransactionRetry: attempts must be >= 1');
}
