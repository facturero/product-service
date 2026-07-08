import { TaxKind } from '../domain/entities.js';

// ── Product ─────────────────────────────────────────────────────────────────

export interface ProductSummaryDTO {
  id: string;
  organizationId: string;
  sku: string | null;
  name: string;
  type: 'good' | 'service';
  categoryId: string | null;
  unitId: string | null;
  status: 'active' | 'inactive';
  price: string;
  priceCents: number;
  currencyCode: string;
  priceIncludesTax: boolean;
  imageFileId: string | null;
}

export interface ProductDetailDTO extends ProductSummaryDTO {
  description: string | null;
  trackStock: boolean;
  taxes: ProductTaxDTO[];
  images: ProductImageDTO[];
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductTaxDTO {
  id: string;
  taxRateId: string;
  kind: TaxKind;
}

export interface ProductImageDTO {
  id: string;
  productId: string;
  fileId: string;
  alt: string | null;
  isPrimary: boolean;
  position: number;
}

// ── Category ────────────────────────────────────────────────────────────────

export interface CategoryDTO {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  parentId: string | null;
  status: 'active' | 'inactive';
}

// ── Unit ────────────────────────────────────────────────────────────────────

export interface UnitDTO {
  id: string;
  organizationId: string;
  code: string;
  name: string;
}

// ── TaxRate ─────────────────────────────────────────────────────────────────

export interface TaxRateDTO {
  id: string;
  countryCode: string;
  code: string;
  name: string | null;
  percentage: string;
  kind: TaxKind;
  isDefault: boolean;
}

// ── Inputs ──────────────────────────────────────────────────────────────────

export interface CreateProductInput {
  organizationId: string;
  name: string;
  type: 'good' | 'service';
  price: string;
  currencyCode: string;
  sku?: string | null;
  description?: string | null;
  categoryId?: string | null;
  unitId?: string | null;
  taxRateIds?: string[];
  priceIncludesTax?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateProductInput {
  organizationId: string;
  id: string;
  countryCode: string;
  name?: string;
  sku?: string | null;
  description?: string | null;
  type?: 'good' | 'service';
  categoryId?: string | null;
  unitId?: string | null;
  price?: string;
  currencyCode?: string;
  priceIncludesTax?: boolean;
  trackStock?: boolean;
  status?: 'active' | 'inactive';
  metadata?: Record<string, unknown> | null;
}

export interface UpdateProductTaxesInput {
  organizationId: string;
  productId: string;
  countryCode: string;
  taxRateIds: string[];
}

export interface CreateCategoryInput {
  organizationId: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
}

export interface UpdateCategoryInput {
  organizationId: string;
  id: string;
  name?: string;
  description?: string | null;
  status?: 'active' | 'inactive';
}

export interface CreateUnitInput {
  organizationId: string;
  code: string;
  name: string;
}

export interface UpdateUnitInput {
  organizationId: string;
  id: string;
  name?: string;
}

export interface AddProductImageInput {
  organizationId: string;
  productId: string;
  fileId: string;
  alt?: string | null;
  isPrimary?: boolean;
  position?: number;
}

export interface ListProductsInput {
  organizationId: string;
  search?: string;
  status?: string;
  type?: string;
  categoryId?: string;
}
