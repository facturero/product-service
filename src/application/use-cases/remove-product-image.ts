import { randomUUID } from 'node:crypto';
import { ProductNotFoundError, ImageNotFoundError } from '../../domain/errors.js';
import { UnitOfWork } from '../ports.js';

export class RemoveProductImageUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(organizationId: string, productId: string, imageId: string): Promise<void> {
    return this.uow.execute(async (repos) => {
      const product = await repos.products.findById(productId);
      if (!product || !product.belongsToOrganization(organizationId)) throw new ProductNotFoundError();

      const image = await repos.productImages.findById(imageId);
      if (!image || image.productId !== productId) throw new ImageNotFoundError();

      await repos.productImages.delete(imageId);

      if (image.isPrimary) {
        const remaining = await repos.productImages.listByProduct(productId);
        if (remaining.length > 0) {
          const next = remaining.sort((a, b) => a.position - b.position)[0];
          next.setPrimary();
          await repos.productImages.save(next);
        }
      }

      const primaryImage = await repos.productImages.findPrimary(productId);
      const taxes = await repos.productTaxes.findByProduct(productId);

      await repos.outbox.add({
        eventId: randomUUID(),
        organizationId: product.organizationId,
        type: 'product.product.updated',
        aggregateType: 'product',
        aggregateId: productId,
        payload: {
          productId: product.id,
          organizationId: product.organizationId,
          sku: product.sku,
          name: product.name,
          type: product.type,
          priceCents: product.priceCents,
          currencyCode: product.currencyCode,
          priceIncludesTax: product.priceIncludesTax,
          status: product.status,
          taxes: taxes.map((t) => ({ taxRateId: t.taxRateId, kind: t.kind })),
          imageFileId: primaryImage?.fileId ?? null,
        },
        occurredAt: new Date(),
      });
    });
  }
}
