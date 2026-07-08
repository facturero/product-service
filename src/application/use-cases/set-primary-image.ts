import { randomUUID } from 'node:crypto';
import { ProductNotFoundError, ImageNotFoundError } from '../../domain/errors.js';
import { UnitOfWork } from '../ports.js';

export class SetPrimaryImageUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(organizationId: string, productId: string, imageId: string): Promise<void> {
    return this.uow.execute(async (repos) => {
      const product = await repos.products.findById(productId);
      if (!product || !product.belongsToOrganization(organizationId)) throw new ProductNotFoundError();

      const image = await repos.productImages.findById(imageId);
      if (!image || image.productId !== productId) throw new ImageNotFoundError();

      await repos.productImages.clearPrimary(productId);
      image.setPrimary();
      await repos.productImages.save(image);

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
          imageFileId: image.fileId,
        },
        occurredAt: new Date(),
      });
    });
  }
}
