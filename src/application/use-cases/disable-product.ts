import { randomUUID } from 'node:crypto';
import { ProductNotFoundError } from '../../domain/errors.js';
import { UnitOfWork } from '../ports.js';

export class DisableProductUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(organizationId: string, id: string): Promise<void> {
    return this.uow.execute(async (repos) => {
      const product = await repos.products.findById(id);
      if (!product || !product.belongsToOrganization(organizationId)) throw new ProductNotFoundError();

      product.disable();
      await repos.products.save(product);

      await repos.outbox.add({
        eventId: randomUUID(),
        organizationId: product.organizationId,
        type: 'product.product.disabled',
        aggregateType: 'product',
        aggregateId: product.id,
        payload: {
          productId: product.id,
          organizationId: product.organizationId,
        },
        occurredAt: new Date(),
      });
    });
  }
}
