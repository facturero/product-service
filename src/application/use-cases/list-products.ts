import { ProductRepository, ProductImageRepository } from '../../domain/repositories.js';
import { Money } from '../../domain/value-objects.js';
import { ListProductsInput, ProductSummaryDTO } from '../dtos.js';

export class ListProductsUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly imageRepo: ProductImageRepository,
  ) {}

  async execute(input: ListProductsInput): Promise<ProductSummaryDTO[]> {
    const products = await this.productRepo.list(input.organizationId, {
      search: input.search,
      status: input.status,
      type: input.type,
      categoryId: input.categoryId,
    });

    const result: ProductSummaryDTO[] = [];
    for (const p of products) {
      const money = Money.fromCents(p.priceCents, p.currencyCode);
      const primary = await this.imageRepo.findPrimary(p.id);
      result.push({
        id: p.id,
        organizationId: p.organizationId,
        sku: p.sku,
        name: p.name,
        type: p.type,
        categoryId: p.categoryId,
        unitId: p.unitId,
        status: p.status,
        price: money.toDecimalString(),
        priceCents: money.toCents(),
        currencyCode: p.currencyCode,
        priceIncludesTax: p.priceIncludesTax,
        imageFileId: primary?.fileId ?? null,
      });
    }
    return result;
  }
}
