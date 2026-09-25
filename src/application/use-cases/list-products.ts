import { ProductRepository, ProductImageRepository, ProductTaxRepository } from '../../domain/repositories.js';
import { Money } from '../../domain/value-objects.js';
import { ListProductsInput, ProductListDTO, ProductListItemDTO, ProductTaxDTO } from '../dtos.js';

const MAX_PAGE_SIZE = 500;

export class ListProductsUseCase {
  constructor(
    private readonly productRepo: ProductRepository,
    private readonly imageRepo: ProductImageRepository,
    private readonly taxRepo: ProductTaxRepository,
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

    // Impuestos de todos los productos de la página en UNA query (no una por producto):
    // el POS los necesita para calcular el IVA de cada línea, que es por producto.
    const taxRows = items.length > 0 ? await this.taxRepo.findByProducts(items.map((p) => p.id)) : [];
    const taxesByProduct = new Map<string, ProductTaxDTO[]>();
    for (const t of taxRows) {
      const list = taxesByProduct.get(t.productId) ?? [];
      list.push({ id: t.id, taxRateId: t.taxRateId, kind: t.kind });
      taxesByProduct.set(t.productId, list);
    }

    const result: ProductListItemDTO[] = items.map((p) => {
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
        taxes: taxesByProduct.get(p.id) ?? [],
      };
    });

    return { items: result, total, page, pageSize };
  }
}
