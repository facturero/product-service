import { randomUUID } from 'node:crypto';
import { Money } from '../../domain/value-objects.js';
import { ProductNotFoundError, TaxRateNotFoundError } from '../../domain/errors.js';
import { ProductTax } from '../../domain/entities.js';
import { UnitOfWork } from '../ports.js';
import { ProductDetailDTO } from '../dtos.js';

export class UpdateProductTaxesUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: { organizationId: string; productId: string; countryCode: string; taxRateIds: string[] }): Promise<ProductDetailDTO> {
    return this.uow.execute(async (repos) => {
      const product = await repos.products.findById(input.productId);
      if (!product || !product.belongsToOrganization(input.organizationId)) throw new ProductNotFoundError();

      await repos.productTaxes.deleteByProduct(input.productId);

      for (const taxRateId of input.taxRateIds) {
        const rate = await repos.taxRates.findByIdAndCountry(taxRateId, input.countryCode);
        if (!rate) throw new TaxRateNotFoundError();
        const pt = ProductTax.create({ productId: input.productId, taxRateId, kind: rate.kind });
        await repos.productTaxes.save(pt);
      }

      const taxes = await repos.productTaxes.findByProduct(input.productId);
      const images = await repos.productImages.listByProduct(input.productId);
      const primaryImage = images.find((i) => i.isPrimary);
      const money = Money.fromCents(product.priceCents, product.currencyCode);

      await repos.outbox.add({
        eventId: randomUUID(),
        organizationId: product.organizationId,
        type: 'product.product.updated',
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
