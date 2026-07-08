import { randomUUID } from 'node:crypto';
import { ProductImage } from '../../domain/entities.js';
import { ProductNotFoundError } from '../../domain/errors.js';
import { UnitOfWork } from '../ports.js';
import { ProductImageDTO, AddProductImageInput } from '../dtos.js';

export class AddProductImageUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: AddProductImageInput): Promise<ProductImageDTO> {
    return this.uow.execute(async (repos) => {
      const product = await repos.products.findById(input.productId);
      if (!product || !product.belongsToOrganization(input.organizationId)) throw new ProductNotFoundError();

      const existingImages = await repos.productImages.listByProduct(input.productId);
      const isFirst = existingImages.length === 0;

      const image = ProductImage.create({
        productId: input.productId,
        organizationId: input.organizationId,
        fileId: input.fileId,
        alt: input.alt ?? null,
        isPrimary: input.isPrimary ?? isFirst,
        position: input.position ?? existingImages.length,
      });

      if (image.isPrimary && !isFirst) {
        await repos.productImages.clearPrimary(input.productId);
      }

      await repos.productImages.save(image);

      const primaryImage = image.isPrimary ? image : existingImages.find((i) => i.isPrimary);
      const taxes = await repos.productTaxes.findByProduct(input.productId);

      await repos.outbox.add({
        eventId: randomUUID(),
        organizationId: product.organizationId,
        type: 'product.product.updated',
        aggregateType: 'product',
        aggregateId: input.productId,
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

      return {
        id: image.id,
        productId: image.productId,
        fileId: image.fileId,
        alt: image.alt,
        isPrimary: image.isPrimary,
        position: image.position,
      };
    });
  }
}
