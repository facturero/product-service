import { Context } from 'hono';
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
import { ContextVariables } from './middlewares.js';

// ── Products ────────────────────────────────────────────────────────────────

export function createProductController(useCase: CreateProductUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const countryCode = c.get('countryCode') || 'EC';
    const body = c.req.valid('json' as never) as {
      name: string;
      type: 'good' | 'service';
      price: string;
      currencyCode: string;
      sku?: string;
      description?: string;
      categoryId?: string;
      unitId?: string;
      taxRateIds?: string[];
      priceIncludesTax?: boolean;
      metadata?: Record<string, unknown>;
    };
    const result = await useCase.execute({
      organizationId,
      countryCode,
      name: body.name,
      type: body.type,
      price: body.price,
      currencyCode: body.currencyCode,
      sku: body.sku,
      description: body.description,
      categoryId: body.categoryId,
      unitId: body.unitId,
      taxRateIds: body.taxRateIds,
      priceIncludesTax: body.priceIncludesTax,
      metadata: body.metadata,
    });
    return c.json(result, 201);
  };
}

export function listProductsController(useCase: ListProductsUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const search = c.req.query('search');
    const status = c.req.query('status');
    const type = c.req.query('type');
    const categoryId = c.req.query('categoryId');
    const result = await useCase.execute({ organizationId, search, status, type, categoryId });
    return c.json(result, 200);
  };
}

export function getProductController(useCase: GetProductUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const id = c.req.param('id') ?? '';
    const result = await useCase.execute(organizationId, id);
    return c.json(result, 200);
  };
}

export function updateProductController(useCase: UpdateProductUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const countryCode = c.get('countryCode') || 'EC';
    const id = c.req.param('id') ?? '';
    const body = c.req.valid('json' as never) as {
      name?: string;
      sku?: string | null;
      description?: string | null;
      type?: 'good' | 'service';
      categoryId?: string | null;
      unitId?: string | null;
      price?: string;
      currencyCode?: string;
      priceIncludesTax?: boolean;
      status?: 'active' | 'inactive';
      metadata?: Record<string, unknown> | null;
    };
    const result = await useCase.execute({
      organizationId,
      countryCode,
      id,
      name: body.name,
      sku: body.sku,
      description: body.description,
      type: body.type,
      categoryId: body.categoryId,
      unitId: body.unitId,
      price: body.price,
      currencyCode: body.currencyCode,
      priceIncludesTax: body.priceIncludesTax,
      status: body.status,
      metadata: body.metadata,
    });
    return c.json(result, 200);
  };
}

export function disableProductController(useCase: DisableProductUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const id = c.req.param('id') ?? '';
    await useCase.execute(organizationId, id);
    return c.body(null, 204);
  };
}

export function updateProductTaxesController(useCase: UpdateProductTaxesUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const countryCode = c.get('countryCode') || 'EC';
    const productId = c.req.param('id') ?? '';
    const body = c.req.valid('json' as never) as { taxRateIds: string[] };
    const result = await useCase.execute({ organizationId, productId, countryCode, taxRateIds: body.taxRateIds });
    return c.json(result, 200);
  };
}

// ── Images ──────────────────────────────────────────────────────────────────

export function listImagesController(useCase: ListImagesUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const productId = c.req.param('id') ?? '';
    const result = await useCase.execute(organizationId, productId);
    return c.json(result, 200);
  };
}

export function addImageController(useCase: AddProductImageUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const productId = c.req.param('id') ?? '';
    const body = c.req.valid('json' as never) as {
      fileId: string;
      alt?: string;
      position?: number;
      isPrimary?: boolean;
    };
    const result = await useCase.execute({
      organizationId,
      productId,
      fileId: body.fileId,
      alt: body.alt,
      position: body.position,
      isPrimary: body.isPrimary,
    });
    return c.json(result, 201);
  };
}

export function removeImageController(useCase: RemoveProductImageUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const productId = c.req.param('id') ?? '';
    const imageId = c.req.param('imageId') ?? '';
    await useCase.execute(organizationId, productId, imageId);
    return c.body(null, 204);
  };
}

export function setPrimaryImageController(useCase: SetPrimaryImageUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const productId = c.req.param('id') ?? '';
    const imageId = c.req.param('imageId') ?? '';
    await useCase.execute(organizationId, productId, imageId);
    return c.body(null, 204);
  };
}

// ── Categories ──────────────────────────────────────────────────────────────

export function listCategoriesController(useCase: ListCategoriesUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const result = await useCase.execute(organizationId);
    return c.json(result, 200);
  };
}

export function createCategoryController(useCase: CreateCategoryUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const body = c.req.valid('json' as never) as {
      name: string;
      description?: string;
      parentId?: string;
    };
    const result = await useCase.execute({
      organizationId,
      name: body.name,
      description: body.description,
      parentId: body.parentId,
    });
    return c.json(result, 201);
  };
}

export function updateCategoryController(useCase: UpdateCategoryUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const id = c.req.param('id') ?? '';
    const body = c.req.valid('json' as never) as {
      name?: string;
      description?: string | null;
      status?: 'active' | 'inactive';
    };
    const result = await useCase.execute({ organizationId, id, ...body });
    return c.json(result, 200);
  };
}

export function deleteCategoryController(useCase: DeleteCategoryUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const id = c.req.param('id') ?? '';
    await useCase.execute(organizationId, id);
    return c.body(null, 204);
  };
}

// ── Units ───────────────────────────────────────────────────────────────────

export function listUnitsController(useCase: ListUnitsUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const result = await useCase.execute(organizationId);
    return c.json(result, 200);
  };
}

export function createUnitController(useCase: CreateUnitUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const body = c.req.valid('json' as never) as { code: string; name: string };
    const result = await useCase.execute({ organizationId, code: body.code, name: body.name });
    return c.json(result, 201);
  };
}

export function updateUnitController(useCase: UpdateUnitUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const organizationId = c.get('organizationId');
    const id = c.req.param('id') ?? '';
    const body = c.req.valid('json' as never) as { name?: string };
    const result = await useCase.execute({ organizationId, id, name: body.name });
    return c.json(result, 200);
  };
}

// ── Tax Rates ───────────────────────────────────────────────────────────────

export function listTaxRatesController(useCase: ListTaxRatesUseCase) {
  return async (c: Context<{ Variables: ContextVariables }>) => {
    const countryCode = c.get('countryCode') || 'EC';
    const result = await useCase.execute(countryCode);
    return c.json(result, 200);
  };
}
