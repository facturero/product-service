import { Money } from '../../domain/value-objects.js';
import { ProductNotFoundError } from '../../domain/errors.js';
import { Repositories } from '../../domain/repositories.js';
import { ProductDetailDTO } from '../dtos.js';

export class GetProductUseCase {
  constructor(private readonly repos: Repositories) {}

  async execute(organizationId: string, id: string): Promise<ProductDetailDTO> {
    const product = await this.repos.products.findById(id);
    if (!product || !product.belongsToOrganization(organizationId)) throw new ProductNotFoundError();

    const [taxes, images] = await Promise.all([
      this.repos.productTaxes.findByProduct(id),
      this.repos.productImages.listByProduct(id),
    ]);

    const money = Money.fromCents(product.priceCents, product.currencyCode);
    const primaryImage = images.find((i) => i.isPrimary);

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
  }
}
