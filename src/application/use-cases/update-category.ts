import { CategoryNotFoundError, CategoryNameExistsError } from '../../domain/errors.js';
import { Repositories } from '../../domain/repositories.js';
import { CategoryDTO, UpdateCategoryInput } from '../dtos.js';

export class UpdateCategoryUseCase {
  constructor(private readonly repos: Repositories) {}

  async execute(input: UpdateCategoryInput): Promise<CategoryDTO> {
    const category = await this.repos.categories.findById(input.id);
    if (!category || !category.belongsToOrganization(input.organizationId)) throw new CategoryNotFoundError();

    if (input.name !== undefined && input.name !== category.name) {
      const existing = await this.repos.categories.findByName(input.organizationId, input.name, category.parentId);
      if (existing && existing.id !== input.id) throw new CategoryNameExistsError();
    }

    category.update({
      name: input.name,
      description: input.description,
      status: input.status,
    });

    await this.repos.categories.save(category);

    return {
      id: category.id,
      organizationId: category.organizationId,
      name: category.name,
      description: category.description,
      parentId: category.parentId,
      status: category.status,
    };
  }
}
