import { serve } from '@hono/node-server';
import { config } from './infrastructure/config.js';
import { sequelize } from './infrastructure/persistence/sequelize.js';
import './infrastructure/persistence/models';
import { buildRepositories, SequelizeUnitOfWork } from './infrastructure/persistence/repositories.js';
import { startConsumers } from './infrastructure/messaging/consumer.js';
import { CreateProductUseCase } from './application/use-cases/create-product.js';
import { GetProductUseCase } from './application/use-cases/get-product.js';
import { ListProductsUseCase } from './application/use-cases/list-products.js';
import { UpdateProductUseCase } from './application/use-cases/update-product.js';
import { DisableProductUseCase } from './application/use-cases/disable-product.js';
import { UpdateProductTaxesUseCase } from './application/use-cases/update-product-taxes.js';
import { AddProductImageUseCase } from './application/use-cases/add-product-image.js';
import { RemoveProductImageUseCase } from './application/use-cases/remove-product-image.js';
import { SetPrimaryImageUseCase } from './application/use-cases/set-primary-image.js';
import { ListImagesUseCase } from './application/use-cases/list-images.js';
import { CreateCategoryUseCase } from './application/use-cases/create-category.js';
import { UpdateCategoryUseCase } from './application/use-cases/update-category.js';
import { DeleteCategoryUseCase } from './application/use-cases/delete-category.js';
import { ListCategoriesUseCase } from './application/use-cases/list-categories.js';
import { CreateUnitUseCase } from './application/use-cases/create-unit.js';
import { UpdateUnitUseCase } from './application/use-cases/update-unit.js';
import { ListUnitsUseCase } from './application/use-cases/list-units.js';
import { ListTaxRatesUseCase } from './application/use-cases/list-tax-rates.js';
import { createApp } from './interface/http/app.js';

async function main(): Promise<void> {
  await sequelize.authenticate();

  const repos = buildRepositories();
  const uow = new SequelizeUnitOfWork();

  const getProductUseCase = new GetProductUseCase(repos);

  const app = createApp({
    useCases: {
      createProduct: new CreateProductUseCase(uow),
      listProducts: new ListProductsUseCase(repos.products, repos.productImages),
      getProduct: getProductUseCase,
      updateProduct: new UpdateProductUseCase(uow),
      disableProduct: new DisableProductUseCase(uow),
      updateProductTaxes: new UpdateProductTaxesUseCase(uow),
      addProductImage: new AddProductImageUseCase(uow),
      removeProductImage: new RemoveProductImageUseCase(uow),
      setPrimaryImage: new SetPrimaryImageUseCase(uow),
      listImages: new ListImagesUseCase(repos),
      createCategory: new CreateCategoryUseCase(repos),
      updateCategory: new UpdateCategoryUseCase(repos),
      deleteCategory: new DeleteCategoryUseCase(repos),
      listCategories: new ListCategoriesUseCase(repos.categories),
      createUnit: new CreateUnitUseCase(repos),
      updateUnit: new UpdateUnitUseCase(repos),
      listUnits: new ListUnitsUseCase(repos.units),
      listTaxRates: new ListTaxRatesUseCase(repos.taxRates),
    },
    corsOrigin: config.CORS_ORIGIN,
  });

  await startConsumers();

  serve({ fetch: app.fetch, port: config.PORT });
  console.log(`[product-service] corriendo en puerto ${config.PORT}`);
}

main().catch((err) => {
  console.error('[product-service] error al iniciar:', err);
  process.exit(1);
});
