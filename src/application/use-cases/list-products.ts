import { ProductRepository, ProductImageRepository } from '../../domain/repositories.js';
import { Money } from '../../domain/value-objects.js';
import { ListProductsInput, ProductListDTO, ProductSummaryDTO } from '../dtos.js';

const MAX_PAGE_SIZE = 500;

export class ListProductsUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly imageRepo: ProductImageRepository,
  ) {}

  async execute(input: ListProductsInput): Promise<ProductListDTO> {
    // El listado debe paginar SIEMPRE: sin límite, findAll devolvía todo el
    // catálogo del org y serializar miles de filas disparaba la RAM de Node
    // (vistas de 127s con 4k productos).
    const page = Math.max(1, input.page ?? 1);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, input.pageSize ?? 50));

    const { items, total } = await this.productRepo.list(input.organizationId, {
      search: input.search,
      status: input.status,
      type: input.type,
      categoryId: input.categoryId,
      establishmentId: input.establishmentId,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    });

    // Imagen primaria de todos los productos de la página en UNA query
    // (antes: una query por producto → N+1 en el listado).
    const primaries = items.length > 0
      ? await this.imageRepo.findPrimariesByProductIds(items.map((p) => p.id))
      : new Map();

    const result: ProductSummaryDTO[] = items.map((p) => {
      const money = Money.fromCents(p.priceCents, p.currencyCode);
      const primary = primaries.get(p.id);
      return {
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
      };
    });

    return { items: result, total, page, pageSize };
  }
}
