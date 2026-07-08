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

    return {
      id: unit.id,
      organizationId: unit.organizationId,
      code: unit.code,
      name: unit.name,
    };
  }
}
