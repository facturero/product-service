import { UnitRepository } from '../../domain/repositories.js';
import { UnitDTO } from '../dtos.js';

export class ListUnitsUseCase {
  constructor(private readonly unitRepo: UnitRepository) {}

  async execute(organizationId: string): Promise<UnitDTO[]> {
    const units = await this.unitRepo.listByOrganization(organizationId);
    return units.map((u) => ({
      id: u.id,
      organizationId: u.organizationId,
      code: u.code,
      name: u.name,
    }));
  }
}
