import { randomUUID } from 'node:crypto';
import { Category } from '../../domain/entities.js';
import { CategoryNameExistsError } from '../../domain/errors.js';
import { UnitOfWork } from '../ports.js';
import { CategoryDTO, CreateCategoryInput } from '../dtos.js';

export class CreateCategoryUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: CreateCategoryInput): Promise<CategoryDTO> {
    // Todo en UNA transacción: el cambio y su evento de auditoría se confirman juntos o ninguno. Fuera de ella, un fallo entre
    // ambos pierde el evento (o publica uno de algo que no quedó guardado), y el relé no se entera hasta su siguiente barrido.
    return this.uow.execute(async (repos) => {
      const existing = await repos.categories.findByName(input.organizationId, input.name, input.parentId ?? null);
      if (existing) throw new CategoryNameExistsError();

      const category = Category.create({
        organizationId: input.organizationId,
        name: input.name,
        description: input.description ?? null,
        parentId: input.parentId ?? null,
      });

      await repos.categories.save(category);

      // Catálogo de la organización: crear/editar/borrar una categoría o unidad
      // cambia cómo se clasifican los productos y tiene que quedar auditado.
      await repos.outbox.add({
        eventId: randomUUID(),
        organizationId: category.organizationId,
        type: 'product.category.created',
        aggregateType: 'category',
        aggregateId: category.id,
        payload: {
          organizationId: category.organizationId,
          categoryId: category.id,
          name: category.name,
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
