import { randomUUID } from 'node:crypto';
import { CategoryNotFoundError, CannotDeleteCategoryWithProductsError } from '../../domain/errors.js';
import { Repositories } from '../../domain/repositories.js';

export class DeleteCategoryUseCase {
  constructor(private readonly repos: Repositories) {}

  async execute(organizationId: string, id: string): Promise<void> {
    const category = await this.repos.categories.findById(id);
    if (!category || !category.belongsToOrganization(organizationId)) throw new CategoryNotFoundError();

    const activeProducts = await this.repos.categories.countProductsByCategory(id);
    if (activeProducts > 0) throw new CannotDeleteCategoryWithProductsError();

    await this.repos.categories.delete(id);

    // Después del borrado, no antes: si `delete` falla, no queremos una fila de
    // auditoría diciendo que se borró algo que sigue ahí.
    await this.repos.outbox.add({
      eventId: randomUUID(),
      organizationId,
      type: 'product.category.deleted',
      aggregateType: 'category',
      aggregateId: id,
      payload: {
        organizationId,
        categoryId: id,
        name: category.name,
      },
      occurredAt: new Date(),
    });
  }
}
