import { randomUUID } from 'node:crypto';
import { CategoryNotFoundError, CategoryNameExistsError } from '../../domain/errors.js';
import { UnitOfWork } from '../ports.js';
import { CategoryDTO, UpdateCategoryInput } from '../dtos.js';

export class UpdateCategoryUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: UpdateCategoryInput): Promise<CategoryDTO> {
    // Todo en UNA transacción: el cambio y su evento de auditoría se confirman juntos o ninguno. Fuera de ella, un fallo entre
    // ambos pierde el evento (o publica uno de algo que no quedó guardado), y el relé no se entera hasta su siguiente barrido.
    return this.uow.execute(async (repos) => {
      const category = await repos.categories.findById(input.id);
      if (!category || !category.belongsToOrganization(input.organizationId)) throw new CategoryNotFoundError();

      if (input.name !== undefined && input.name !== category.name) {
        const existing = await repos.categories.findByName(input.organizationId, input.name, category.parentId);
        if (existing && existing.id !== input.id) throw new CategoryNameExistsError();
      }

      category.update({
        name: input.name,
        description: input.description,
        status: input.status,
      });

      await repos.categories.save(category);

      // Catálogo de la organización: crear/editar/borrar una categoría o unidad
      // cambia cómo se clasifican los productos y tiene que quedar auditado.
      await repos.outbox.add({
        eventId: randomUUID(),
        organizationId: category.organizationId,
        type: 'product.category.updated',
        aggregateType: 'category',
        aggregateId: category.id,
        payload: {
          organizationId: category.organizationId,
          categoryId: category.id,
          name: category.name,
          status: category.status,
        },
        occurredAt: new Date(),
      });

      return {
        id: category.id,
        organizationId: category.organizationId,
        name: category.name,
        description: category.description,
        parentId: category.parentId,
        status: category.status,
      };
    });
  }
}
