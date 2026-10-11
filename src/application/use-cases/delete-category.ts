import { randomUUID } from 'node:crypto';
import { CategoryNotFoundError, CannotDeleteCategoryWithProductsError } from '../../domain/errors.js';
import { UnitOfWork } from '../ports.js';

export class DeleteCategoryUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(organizationId: string, id: string): Promise<void> {
    // Todo en UNA transacción: el cambio y su evento de auditoría se confirman juntos o ninguno. Fuera de ella, un fallo entre
    // ambos pierde el evento (o publica uno de algo que no quedó guardado), y el relé no se entera hasta su siguiente barrido.
    await this.uow.execute(async (repos) => {
      const category = await repos.categories.findById(id);
      if (!category || !category.belongsToOrganization(organizationId)) throw new CategoryNotFoundError();

      const activeProducts = await repos.categories.countProductsByCategory(id);
      if (activeProducts > 0) throw new CannotDeleteCategoryWithProductsError();

      await repos.categories.delete(id);

      // Después del borrado, no antes: si `delete` falla, no queremos una fila de
      // auditoría diciendo que se borró algo que sigue ahí.
      await repos.outbox.add({
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
    });
  }
}
