import { randomUUID } from 'node:crypto';
import { Unit } from '../../domain/entities.js';
import { UnitCodeExistsError } from '../../domain/errors.js';
import { UnitOfWork } from '../ports.js';
import { CreateUnitInput, UnitDTO } from '../dtos.js';

export class CreateUnitUseCase {
  constructor(private readonly uow: UnitOfWork) {}

  async execute(input: CreateUnitInput): Promise<UnitDTO> {
    // Todo en UNA transacción: el cambio y su evento de auditoría se confirman juntos o ninguno. Fuera de ella, un fallo entre
    // ambos pierde el evento (o publica uno de algo que no quedó guardado), y el relé no se entera hasta su siguiente barrido.
    return this.uow.execute(async (repos) => {
      const existing = await repos.units.findByCode(input.organizationId, input.code);
      if (existing) throw new UnitCodeExistsError();

      const unit = Unit.create({
        organizationId: input.organizationId,
        code: input.code,
        name: input.name,
      });

      await repos.units.save(unit);

      // Catálogo de la organización: crear/editar/borrar una categoría o unidad
      // cambia cómo se clasifican los productos y tiene que quedar auditado.
      await repos.outbox.add({
        eventId: randomUUID(),
        organizationId: unit.organizationId,
        type: 'product.unit.created',
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
