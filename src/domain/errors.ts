export interface ErrorDetail {
  field: string;
  message: string;
}

export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly details?: ErrorDetail[];

  constructor(message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  readonly code = 'VALIDATION_ERROR';
  readonly httpStatus = 422;
  constructor(details: ErrorDetail[], message = 'La petición no es válida.') {
    super(message, details);
  }
}

export class OrganizationContextRequiredError extends AppError {
  readonly code = 'ORG_CONTEXT_REQUIRED';
  readonly httpStatus = 401;
  constructor(message = 'Falta el contexto de organización.') { super(message); }
}

export class UserContextRequiredError extends AppError {
  readonly code = 'USER_CONTEXT_REQUIRED';
  readonly httpStatus = 401;
  constructor(message = 'Falta el contexto de usuario.') { super(message); }
}

export class ForbiddenError extends AppError {
  readonly code = 'FORBIDDEN';
  readonly httpStatus = 403;
  constructor(message = 'Permiso insuficiente.') { super(message); }
}

export class ProductNotFoundError extends AppError {
  readonly code = 'PRODUCT_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message = 'Producto no encontrado.') { super(message); }
}

export class CategoryNotFoundError extends AppError {
  readonly code = 'CATEGORY_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message = 'Categoría no encontrada.') { super(message); }
}

export class UnitNotFoundError extends AppError {
  readonly code = 'UNIT_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message = 'Unidad no encontrada.') { super(message); }
}

export class TaxRateNotFoundError extends AppError {
  readonly code = 'TAX_RATE_NOT_FOUND';
  readonly httpStatus = 422;
  constructor(message = 'La tasa de impuesto no existe o no pertenece al país del contexto.') { super(message); }
}

export class ImageNotFoundError extends AppError {
  readonly code = 'IMAGE_NOT_FOUND';
  readonly httpStatus = 404;
  constructor(message = 'Imagen no encontrada.') { super(message); }
}

export class SkuAlreadyExistsError extends AppError {
  readonly code = 'SKU_EXISTS';
  readonly httpStatus = 409;
  constructor(message = 'Ya existe un producto con ese SKU.') { super(message); }
}

export class CategoryNameExistsError extends AppError {
  readonly code = 'CATEGORY_NAME_EXISTS';
  readonly httpStatus = 409;
  constructor(message = 'Ya existe una categoría con ese nombre en el mismo nivel.') { super(message); }
}

export class UnitCodeExistsError extends AppError {
  readonly code = 'UNIT_CODE_EXISTS';
  readonly httpStatus = 409;
  constructor(message = 'Ya existe una unidad con ese código.') { super(message); }
}

export class CannotDeleteCategoryWithProductsError extends AppError {
  readonly code = 'CATEGORY_HAS_PRODUCTS';
  readonly httpStatus = 422;
  constructor(message = 'No se puede eliminar una categoría con productos activos.') { super(message); }
}

export class InvalidCurrencyError extends AppError {
  readonly code = 'INVALID_CURRENCY';
  readonly httpStatus = 422;
  constructor(currencyCode: string) {
    super(`Moneda no soportada: ${currencyCode}.`);
  }
}

export class InvalidMoneyAmountError extends AppError {
  readonly code = 'INVALID_MONEY_AMOUNT';
  readonly httpStatus = 422;
  constructor(message = 'El monto ingresado no es válido.') { super(message); }
}

/**
 * Un producto solo puede tener UNA tasa por cada tipo de impuesto (`kind`):
 * un IVA, una retención de IVA, una retención de renta, un ICE. Nunca dos IVA
 * al mismo tiempo (ej. 0% y 15%). Ver `docs/IMPUESTOS.md`.
 */
export class MultipleTaxKindError extends AppError {
  readonly code = 'MULTIPLE_TAX_KIND';
  readonly httpStatus = 422;
  constructor(kind: string) {
    super(`Un producto solo puede tener una tasa del tipo "${kind}".`);
  }
}
