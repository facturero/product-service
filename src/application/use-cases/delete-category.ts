import { CategoryNotFoundError, CannotDeleteCategoryWithProductsError } from '../../domain/errors.js';
import { Repositories } from '../../domain/repositories.js';

export class DeleteCategoryUseCase {
  constructor(private readonly repos: Repositories) {}

  async execute(organizationId: string, id: string): Promise<void> {
    const category = await this.repos.categories.findById(id);
    if (!category || !category.belongsToOrganization(organizationId)) throw new CategoryNotFoundError();

    const activeProducts = await this.repos.categories.countProductsByCategory(id);
    if (activeProducts > 0) throw new CannotDeleteCategoryWithProductsError();

    await this.repos.categories.delete(id);
  }
}
