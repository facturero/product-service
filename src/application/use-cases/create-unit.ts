import { randomUUID } from 'node:crypto';
import { Unit } from '../../domain/entities.js';
import { UnitCodeExistsError } from '../../domain/errors.js';
import { Repositories } from '../../domain/repositories.js';
import { CreateUnitInput, UnitDTO } from '../dtos.js';

export class CreateUnitUseCase {
  constructor(private readonly repos: Repositories) {}

  async execute(input: CreateUnitInput): Promise<UnitDTO> {
    const existing = await this.repos.units.findByCode(input.organizationId, input.code);
    if (existing) throw new UnitCodeExistsError();

    const unit = Unit.create({
      organizationId: input.organizationId,
      code: input.code,
      name: input.name,
    });

    await this.repos.units.save(unit);

    // Catálogo de la organización: crear/editar/borrar una categoría o unidad
    // cambia cómo se clasifican los productos y tiene que quedar auditado.
    await this.repos.outbox.add({
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
  }
}
