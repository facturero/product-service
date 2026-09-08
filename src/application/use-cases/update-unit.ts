import { randomUUID } from 'node:crypto';
import { UnitNotFoundError } from '../../domain/errors.js';
import { Repositories } from '../../domain/repositories.js';
import { UnitDTO, UpdateUnitInput } from '../dtos.js';

export class UpdateUnitUseCase {
  constructor(private readonly repos: Repositories) {}

  async execute(input: UpdateUnitInput): Promise<UnitDTO> {
    const unit = await this.repos.units.findById(input.id);
    if (!unit || !unit.belongsToOrganization(input.organizationId)) throw new UnitNotFoundError();

    unit.update({ name: input.name });
    await this.repos.units.save(unit);

    // Catálogo de la organización: crear/editar/borrar una categoría o unidad
    // cambia cómo se clasifican los productos y tiene que quedar auditado.
    await this.repos.outbox.add({
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
  }
}
