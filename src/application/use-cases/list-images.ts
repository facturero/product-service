import { ProductNotFoundError } from '../../domain/errors.js';
import { Repositories } from '../../domain/repositories.js';
import { ProductImageDTO } from '../dtos.js';

export class ListImagesUseCase {
  constructor(private readonly repos: Repositories) {}

  async execute(organizationId: string, productId: string): Promise<ProductImageDTO[]> {
    const product = await this.repos.products.findById(productId);
    if (!product || !product.belongsToOrganization(organizationId)) throw new ProductNotFoundError();

    const images = await this.repos.productImages.listByProduct(productId);
    return images.map((i) => ({
      id: i.id,
      productId: i.productId,
      fileId: i.fileId,
      alt: i.alt,
      isPrimary: i.isPrimary,
      position: i.position,
    }));
  }
}
