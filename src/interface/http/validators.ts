import { zValidator } from '@hono/zod-validator';
import { z, ZodSchema } from 'zod';
import { ValidationError } from '../../domain/errors.js';

export const createProductSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.').max(255),
  type: z.enum(['good', 'service']),
  price: z.string().min(1, 'El precio es obligatorio.').regex(/^\d+(\.\d{1,2})?$/, 'El precio debe ser un número válido con hasta 2 decimales.'),
  currencyCode: z.string().length(3, 'El código de moneda debe tener 3 caracteres.'),
  sku: z.string().max(64).optional(),
  description: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  unitId: z.string().uuid().optional(),
  taxRateIds: z.array(z.string().uuid()).optional(),
  priceIncludesTax: z.boolean().default(false),
  metadata: z.record(z.unknown()).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().max(255).optional(),
  sku: z.string().max(64).optional().nullable(),
  description: z.string().optional().nullable(),
  type: z.enum(['good', 'service']).optional(),
  categoryId: z.string().uuid().optional().nullable(),
  unitId: z.string().uuid().optional().nullable(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/, 'El precio debe ser un número válido con hasta 2 decimales.').optional(),
  currencyCode: z.string().length(3).optional(),
  priceIncludesTax: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  metadata: z.record(z.unknown()).optional().nullable(),
});

export const updateTaxesSchema = z.object({
  taxRateIds: z.array(z.string().uuid()),
});

export const createCategorySchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio.').max(255),
  description: z.string().max(255).optional(),
  parentId: z.string().uuid().optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().max(255).optional(),
  description: z.string().max(255).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
});

export const createUnitSchema = z.object({
  code: z.string().min(1, 'El código es obligatorio.').max(20),
  name: z.string().min(1, 'El nombre es obligatorio.').max(100),
});

export const updateUnitSchema = z.object({
  name: z.string().max(100).optional(),
});

export const addImageSchema = z.object({
  fileId: z.string().uuid('El fileId no es válido.'),
  alt: z.string().max(255).optional(),
  position: z.number().int().default(0),
  isPrimary: z.boolean().default(false),
});

export function validateJson<T extends ZodSchema>(schema: T) {
  return zValidator('json', schema, (result) => {
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.') || '(root)',
        message: i.message,
      }));
      throw new ValidationError(details);
    }
  });
}
