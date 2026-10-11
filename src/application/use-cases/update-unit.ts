import { randomUUID } from 'node:crypto';
import { UnitNotFoundError } from '../../domain/errors.js';
import { UnitOfWork } from '../ports.js';
import { UnitDTO, UpdateUnitInput } from '../dtos.js';

export class UpdateUnitUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: UpdateUnitInput): Promise<UnitDTO> {
    // Todo en UNA transacción: el cambio y su evento de auditoría se confirman juntos o ninguno. Fuera de ella, un fallo entre
    // ambos pierde el evento (o publica uno de algo que no quedó guardado), y el relé no se entera hasta su siguiente barrido.
    return this.uow.execute(async (repos) => {
      const unit = await repos.units.findById(input.id);
      if (!unit || !unit.belongsToOrganization(input.organizationId)) throw new UnitNotFoundError();

      unit.update({ name: input.name });
      await repos.units.save(unit);

      // Catálogo de la organización: crear/editar/borrar una categoría o unidad
      // cambia cómo se clasifican los productos y tiene que quedar auditado.
      await repos.outbox.add({
        eventId: randomUUID(),
        organizationId: unit.organizationId,
        type: 'product.unit.updated',
        aggregateType: 'unit',
        aggregateId: unit.id,
        payload: {
          organizationId: unit.organizationId,
          unitId: unit.id,
          code: unit.code,
          name: unit.name,
        },
        occurredAt: new Date(),
      });

      return {
        id: unit.id,
        organizationId: unit.organizationId,
        code: unit.code,
        name: unit.name,
      };
    });
  }
}
