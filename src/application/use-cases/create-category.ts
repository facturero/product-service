import { Category } from '../../domain/entities.js';
import { CategoryNameExistsError } from '../../domain/errors.js';
import { Repositories } from '../../domain/repositories.js';
import { CategoryDTO, CreateCategoryInput } from '../dtos.js';

export class CreateCategoryUseCase {
  constructor(private readonly repos: Repositories) {}

  async execute(input: CreateCategoryInput): Promise<CategoryDTO> {
    const existing = await this.repos.categories.findByName(input.organizationId, input.name, input.parentId ?? null);
    if (existing) throw new CategoryNameExistsError();

    const category = Category.create({
      organizationId: input.organizationId,
      name: input.name,
      description: input.description ?? null,
      parentId: input.parentId ?? null,
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
