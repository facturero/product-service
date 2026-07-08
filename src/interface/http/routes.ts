import { Hono } from 'hono';
import { CreateProductUseCase } from '../../application/use-cases/create-product.js';
import { GetProductUseCase } from '../../application/use-cases/get-product.js';
import { ListProductsUseCase } from '../../application/use-cases/list-products.js';
import { UpdateProductUseCase } from '../../application/use-cases/update-product.js';
import { DisableProductUseCase } from '../../application/use-cases/disable-product.js';
import { UpdateProductTaxesUseCase } from '../../application/use-cases/update-product-taxes.js';
import { AddProductImageUseCase } from '../../application/use-cases/add-product-image.js';
import { RemoveProductImageUseCase } from '../../application/use-cases/remove-product-image.js';
import { SetPrimaryImageUseCase } from '../../application/use-cases/set-primary-image.js';
import { ListImagesUseCase } from '../../application/use-cases/list-images.js';
import { CreateCategoryUseCase } from '../../application/use-cases/create-category.js';
import { UpdateCategoryUseCase } from '../../application/use-cases/update-category.js';
import { DeleteCategoryUseCase } from '../../application/use-cases/delete-category.js';
import { ListCategoriesUseCase } from '../../application/use-cases/list-categories.js';
import { CreateUnitUseCase } from '../../application/use-cases/create-unit.js';
import { UpdateUnitUseCase } from '../../application/use-cases/update-unit.js';
import { ListUnitsUseCase } from '../../application/use-cases/list-units.js';
import { ListTaxRatesUseCase } from '../../application/use-cases/list-tax-rates.js';
import {
  createProductController,
  listProductsController,
  getProductController,
  updateProductController,
  disableProductController,
  updateProductTaxesController,
  listImagesController,
  addImageController,
  removeImageController,
  setPrimaryImageController,
  listCategoriesController,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
  listUnitsController,
  createUnitController,
  updateUnitController,
  listTaxRatesController,
} from './controllers.js';
import {
  addImageSchema,
  createCategorySchema,
  createProductSchema,
  createUnitSchema,
  updateCategorySchema,
  updateProductSchema,
  updateTaxesSchema,
  updateUnitSchema,
  validateJson,
} from './validators.js';
import { ContextVariables, requireOrganization, requirePermission } from './middlewares.js';

type Vars = { Variables: ContextVariables };

export interface AppDependencies {
  useCases: {
    createProduct: CreateProductUseCase;
    listProducts: ListProductsUseCase;
    getProduct: GetProductUseCase;
    updateProduct: UpdateProductUseCase;
    disableProduct: DisableProductUseCase;
    updateProductTaxes: UpdateProductTaxesUseCase;
    addProductImage: AddProductImageUseCase;
    removeProductImage: RemoveProductImageUseCase;
    setPrimaryImage: SetPrimaryImageUseCase;
    listImages: ListImagesUseCase;
    createCategory: CreateCategoryUseCase;
    updateCategory: UpdateCategoryUseCase;
    deleteCategory: DeleteCategoryUseCase;
    listCategories: ListCategoriesUseCase;
    createUnit: CreateUnitUseCase;
    updateUnit: UpdateUnitUseCase;
    listUnits: ListUnitsUseCase;
    listTaxRates: ListTaxRatesUseCase;
  };
  corsOrigin: string;
}

export function healthRoutes(): Hono {
  const r = new Hono();
  r.get('/health', (c) => c.json({ status: 'ok' }));
  return r;
}

export function productRoutes(deps: AppDependencies): Hono<Vars> {
  const r = new Hono<Vars>();
  const { useCases } = deps;

  r.get('/products',
    requireOrganization(),
    requirePermission('product:read'),
    listProductsController(useCases.listProducts));

  r.post('/products',
    requireOrganization(),
    requirePermission('product:create'),
    validateJson(createProductSchema),
    createProductController(useCases.createProduct));

  r.get('/products/:id',
    requireOrganization(),
    requirePermission('product:read'),
    getProductController(useCases.getProduct));

  r.patch('/products/:id',
    requireOrganization(),
    requirePermission('product:update'),
    validateJson(updateProductSchema),
    updateProductController(useCases.updateProduct));

  r.put('/products/:id/taxes',
    requireOrganization(),
    requirePermission('product:update'),
    validateJson(updateTaxesSchema),
    updateProductTaxesController(useCases.updateProductTaxes));

  r.post('/products/:id/disable',
    requireOrganization(),
    requirePermission('product:update'),
    disableProductController(useCases.disableProduct));

  r.get('/products/:id/images',
    requireOrganization(),
    requirePermission('product:read'),
    listImagesController(useCases.listImages));

  r.post('/products/:id/images',
    requireOrganization(),
    requirePermission('product:update'),
    validateJson(addImageSchema),
    addImageController(useCases.addProductImage));

  r.delete('/products/:id/images/:imageId',
    requireOrganization(),
    requirePermission('product:update'),
    removeImageController(useCases.removeProductImage));

  r.put('/products/:id/images/:imageId/primary',
    requireOrganization(),
    requirePermission('product:update'),
    setPrimaryImageController(useCases.setPrimaryImage));

  return r;
}

export function categoryRoutes(deps: AppDependencies): Hono<Vars> {
  const r = new Hono<Vars>();
  const { useCases } = deps;

  r.get('/categories',
    requireOrganization(),
    requirePermission('product:read'),
    listCategoriesController(useCases.listCategories));

  r.post('/categories',
    requireOrganization(),
    requirePermission('product:create'),
    validateJson(createCategorySchema),
    createCategoryController(useCases.createCategory));

  r.patch('/categories/:id',
    requireOrganization(),
    requirePermission('product:update'),
    validateJson(updateCategorySchema),
    updateCategoryController(useCases.updateCategory));

  r.delete('/categories/:id',
    requireOrganization(),
    requirePermission('product:delete'),
    deleteCategoryController(useCases.deleteCategory));

  return r;
}

export function unitRoutes(deps: AppDependencies): Hono<Vars> {
  const r = new Hono<Vars>();
  const { useCases } = deps;

  r.get('/units',
    requireOrganization(),
    requirePermission('product:read'),
    listUnitsController(useCases.listUnits));

  r.post('/units',
    requireOrganization(),
    requirePermission('product:create'),
    validateJson(createUnitSchema),
    createUnitController(useCases.createUnit));

  r.patch('/units/:id',
    requireOrganization(),
    requirePermission('product:update'),
    validateJson(updateUnitSchema),
    updateUnitController(useCases.updateUnit));

  return r;
}

export function catalogRoutes(deps: AppDependencies): Hono<Vars> {
  const r = new Hono<Vars>();
  const { useCases } = deps;

  r.get('/tax-rates',
    requireOrganization(),
    requirePermission('product:read'),
    listTaxRatesController(useCases.listTaxRates));

  return r;
}
