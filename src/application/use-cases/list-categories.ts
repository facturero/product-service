import { CategoryRepository } from '../../domain/repositories.js';
import { CategoryDTO } from '../dtos.js';

export class ListCategoriesUseCase {
  constructor(private readonly categoryRepo: CategoryRepository) {}

  async execute(organizationId: string): Promise<CategoryDTO[]> {
    const categories = await this.categoryRepo.listByOrganization(organizationId);
    return categories.map((c) => ({
      id: c.id,
      organizationId: c.organizationId,
      name: c.name,
      description: c.description,
      parentId: c.parentId,
      status: c.status,
    }));
  }
}
