import { Op, Transaction } from 'sequelize';
import { sequelize } from './sequelize.js';
import {
  CategoryModel,
  OutboxModel,
  ProductImageModel,
  ProductModel,
  ProductTaxModel,
  TaxRateModel,
  UnitModel,
} from './models.js';
import {
  Category,
  Product,
  ProductImage,
  ProductTax,
  TaxRate,
  Unit,
} from '../../domain/entities.js';
import {
  CategoryRepository,
  DomainEvent,
  ListProductsFilters,
  OutboxRepository,
  ProductImageRepository,
  ProductRepository,
  ProductTaxRepository,
  Repositories,
  TaxRateReadModelRepository,
  UnitRepository,
} from '../../domain/repositories.js';
import { UnitOfWork } from '../../application/ports.js';

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

function toTaxRate(m: TaxRateModel): TaxRate {
  return TaxRate.fromPersistence({
    id: m.id,
    countryCode: m.country_code,
    code: m.code,
    name: m.name,
    percentage: m.percentage,
    kind: m.kind,
    isDefault: m.is_default,
  });
}

// ── Repositories ────────────────────────────────────────────────────────────

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
      const rows = await ProductModel.findAll({
        where,
        transaction: tx,
        order: [['created_at', 'DESC']],
      });
      return rows.map(toProduct);
    },
    async save(product) {
      const p = product.toPersistence();
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
  };
}

function taxRateReadModelRepository(tx?: Transaction): TaxRateReadModelRepository {
  return {
    async findById(id) {
      const m = await TaxRateModel.findByPk(id, { transaction: tx });
      return m ? toTaxRate(m) : null;
    },
    async findByIdAndCountry(id, countryCode) {
      const m = await TaxRateModel.findOne({
        where: { id, country_code: countryCode },
        transaction: tx,
      });
      return m ? toTaxRate(m) : null;
    },
    async listByCountry(countryCode) {
      const rows = await TaxRateModel.findAll({
        where: { country_code: countryCode },
        transaction: tx,
        order: [['code', 'ASC']],
      });
      return rows.map(toTaxRate);
    },
    async upsert(rate) {
      const p = rate.toPersistence();
      await TaxRateModel.upsert(
        {
          id: p.id,
          country_code: p.countryCode,
          code: p.code,
          name: p.name,
          percentage: p.percentage,
          kind: p.kind,
          is_default: p.isDefault,
          created_at: new Date(),
          updated_at: new Date(),
        },
        { transaction: tx },
      );
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
          payload: event.payload,
          occurred_at: event.occurredAt,
          processed_at: null,
        },
        { transaction: tx },
      );
    },
  };
}

export function buildRepositories(tx?: Transaction): Repositories {
  return {
    products: productRepository(tx),
    categories: categoryRepository(tx),
    units: unitRepository(tx),
    productTaxes: productTaxRepository(tx),
    productImages: productImageRepository(tx),
    taxRates: taxRateReadModelRepository(tx),
    outbox: outboxRepository(tx),
  };
}

export class SequelizeUnitOfWork implements UnitOfWork {
  async execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return sequelize.transaction(async (tx) => work(buildRepositories(tx)));
  }
}
