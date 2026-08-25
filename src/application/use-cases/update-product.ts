import { randomUUID } from 'node:crypto';
import { Money } from '../../domain/value-objects.js';
import { EstablishmentNotFoundError, EstablishmentRequiredError, ProductNotFoundError, SkuAlreadyExistsError } from '../../domain/errors.js';
import { UnitOfWork, EstablishmentRepository } from '../ports.js';
import { ProductDetailDTO, UpdateProductInput } from '../dtos.js';

export class UpdateProductUseCase {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly establishments: EstablishmentRepository,
  ) {}

  async execute(input: UpdateProductInput): Promise<ProductDetailDTO> {
    return this.uow.execute(async (repos) => {
      const product = await repos.products.findById(input.id);
      if (!product || !product.belongsToOrganization(input.organizationId)) throw new ProductNotFoundError();

      if (input.sku !== undefined && input.sku !== product.sku) {
        const existing = await repos.products.findBySku(input.organizationId, input.sku ?? '');
        if (existing && existing.id !== input.id) throw new SkuAlreadyExistsError();
      }

      let establishmentIds: string[] | undefined;
      if (input.establishmentIds !== undefined) {
        establishmentIds = await this.validateEstablishments(input.organizationId, input.establishmentIds);
        await repos.productEstablishments.replaceForProduct(product.id, establishmentIds);
      } else {
        establishmentIds = (await repos.productEstablishments.listByProduct(product.id)).map(
          (pe) => pe.establishmentId,
        );
      }

      product.updateDetails({
        name: input.name,
        sku: input.sku,
        description: input.description,
        type: input.type,
        categoryId: input.categoryId,
        unitId: input.unitId,
        priceIncludesTax: input.priceIncludesTax,
        trackStock: input.trackStock,
        allowNegativeStock: input.allowNegativeStock,
        valuationMethod: input.valuationMethod,
        status: input.status,
        metadata: input.metadata,
      });

      if (input.price !== undefined && input.currencyCode !== undefined) {
        const money = Money.fromDecimalString(input.price, input.currencyCode);
        product.updatePrice(money.toCents(), input.currencyCode);
      }

      await repos.products.save(product);

      const taxes = await repos.productTaxes.findByProduct(product.id);
      const images = await repos.productImages.listByProduct(product.id);
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
          trackStock: product.trackStock,
          allowNegativeStock: product.allowNegativeStock,
          valuationMethod: product.valuationMethod,
          establishmentIds,
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
        allowNegativeStock: product.allowNegativeStock,
        valuationMethod: product.valuationMethod,
        establishmentIds,
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

  private async validateEstablishments(organizationId: string, establishmentIds: string[]): Promise<string[]> {
    if (!establishmentIds || establishmentIds.length === 0) {
      throw new EstablishmentRequiredError();
    }
    const unique = [...new Set(establishmentIds)];
    const orgEstablishments = await this.establishments.listByOrganization(organizationId);
    const validIds = new Set(orgEstablishments.map((e) => e.id));
    for (const id of unique) {
      if (!validIds.has(id)) throw new EstablishmentNotFoundError();
    }
    return unique;
  }
}
