import { randomUUID } from 'node:crypto';
import { Money } from '../../domain/value-objects.js';
import { CategoryNotFoundError, SkuAlreadyExistsError, TaxRateNotFoundError, UnitNotFoundError } from '../../domain/errors.js';
import { Product, ProductTax } from '../../domain/entities.js';
import { UnitOfWork } from '../ports.js';
import { CreateProductInput, ProductDetailDTO } from '../dtos.js';

export class CreateProductUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: CreateProductInput & { countryCode: string }): Promise<ProductDetailDTO> {
    return this.uow.execute(async (repos) => {
      const money = Money.fromDecimalString(input.price, input.currencyCode);

      if (input.sku) {
        const existing = await repos.products.findBySku(input.organizationId, input.sku);
        if (existing) throw new SkuAlreadyExistsError();
      }

      if (input.categoryId) {
        const cat = await repos.categories.findById(input.categoryId);
        if (!cat || !cat.belongsToOrganization(input.organizationId)) throw new CategoryNotFoundError();
      }

      if (input.unitId) {
        const unit = await repos.units.findById(input.unitId);
        if (!unit || !unit.belongsToOrganization(input.organizationId)) throw new UnitNotFoundError();
      }

      const product = Product.create({
        organizationId: input.organizationId,
        name: input.name,
        type: input.type,
        priceCents: money.toCents(),
        currencyCode: input.currencyCode,
        sku: input.sku ?? null,
        description: input.description ?? null,
        categoryId: input.categoryId ?? null,
        unitId: input.unitId ?? null,
        priceIncludesTax: input.priceIncludesTax ?? false,
        metadata: input.metadata ?? null,
      });

      await repos.products.save(product);

      if (input.taxRateIds && input.taxRateIds.length > 0) {
        for (const taxRateId of input.taxRateIds) {
          const rate = await repos.taxRates.findByIdAndCountry(taxRateId, input.countryCode);
          if (!rate) throw new TaxRateNotFoundError();
          const pt = ProductTax.create({ productId: product.id, taxRateId, kind: rate.kind });
          await repos.productTaxes.save(pt);
        }
      }

      const taxes = await repos.productTaxes.findByProduct(product.id);
      const images = await repos.productImages.listByProduct(product.id);
      const primaryImage = images.find((i) => i.isPrimary);

      await repos.outbox.add({
        eventId: randomUUID(),
        organizationId: product.organizationId,
        type: 'product.product.created',
        aggregateType: 'product',
        aggregateId: product.id,
        payload: {
          productId: product.id,
          organizationId: product.organizationId,
          sku: product.sku,
          name: product.name,
          type: product.type,
          priceCents: product.priceCents,
          currencyCode: product.currencyCode,
          priceIncludesTax: product.priceIncludesTax,
          taxes: taxes.map((t) => ({ taxRateId: t.taxRateId, kind: t.kind })),
          imageFileId: primaryImage?.fileId ?? null,
          status: product.status,
        },
        occurredAt: new Date(),
      });

      return {
        id: product.id,
        organizationId: product.organizationId,
        sku: product.sku,
        name: product.name,
        description: product.description,
        type: product.type,
        categoryId: product.categoryId,
        unitId: product.unitId,
        status: product.status,
        price: money.toDecimalString(),
        priceCents: money.toCents(),
        currencyCode: product.currencyCode,
        priceIncludesTax: product.priceIncludesTax,
        trackStock: product.trackStock,
        taxes: taxes.map((t) => ({ id: t.id, taxRateId: t.taxRateId, kind: t.kind })),
        images: images.map((i) => ({
          id: i.id,
          productId: i.productId,
          fileId: i.fileId,
          alt: i.alt,
          isPrimary: i.isPrimary,
          position: i.position,
        })),
        imageFileId: primaryImage?.fileId ?? null,
        metadata: product.metadata,
        createdAt: product.createdAt.toISOString(),
        updatedAt: product.updatedAt.toISOString(),
      };
    });
  }
}
