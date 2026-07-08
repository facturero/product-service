import { randomUUID } from 'node:crypto';

export type ProductType = 'good' | 'service';
export type ProductStatus = 'active' | 'inactive';
export type CategoryStatus = 'active' | 'inactive';
export type TaxKind = 'vat' | 'withholding_iva' | 'withholding_rent' | 'special';

// ── Category ────────────────────────────────────────────────────────────────

export interface CategoryProps {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  parentId: string | null;
  status: CategoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class Category {
  private constructor(private props: CategoryProps) {}

  static create(params: {
    organizationId: string;
    name: string;
    description?: string | null;
    parentId?: string | null;
  }): Category {
    const now = new Date();
    return new Category({
      id: randomUUID(),
      organizationId: params.organizationId,
      name: params.name,
      description: params.description ?? null,
      parentId: params.parentId ?? null,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: CategoryProps): Category {
    return new Category({ ...props });
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get name(): string { return this.props.name; }
  get description(): string | null { return this.props.description; }
  get parentId(): string | null { return this.props.parentId; }
  get status(): CategoryStatus { return this.props.status; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  belongsToOrganization(organizationId: string): boolean {
    return this.props.organizationId === organizationId;
  }

  update(params: { name?: string; description?: string | null; status?: CategoryStatus }): void {
    if (params.name !== undefined) this.props.name = params.name;
    if (params.description !== undefined) this.props.description = params.description;
    if (params.status !== undefined) this.props.status = params.status;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.status = 'inactive';
    this.props.updatedAt = new Date();
  }

  toPersistence(): CategoryProps {
    return { ...this.props };
  }
}

// ── Unit ────────────────────────────────────────────────────────────────────

export interface UnitProps {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Unit {
  private constructor(private props: UnitProps) {}

  static create(params: { organizationId: string; code: string; name: string }): Unit {
    const now = new Date();
    return new Unit({
      id: randomUUID(),
      organizationId: params.organizationId,
      code: params.code,
      name: params.name,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: UnitProps): Unit {
    return new Unit({ ...props });
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get code(): string { return this.props.code; }
  get name(): string { return this.props.name; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  belongsToOrganization(organizationId: string): boolean {
    return this.props.organizationId === organizationId;
  }

  update(params: { name?: string }): void {
    if (params.name !== undefined) this.props.name = params.name;
    this.props.updatedAt = new Date();
  }

  toPersistence(): UnitProps {
    return { ...this.props };
  }
}

// ── Product ─────────────────────────────────────────────────────────────────

export interface ProductProps {
  id: string;
  organizationId: string;
  sku: string | null;
  name: string;
  description: string | null;
  type: ProductType;
  categoryId: string | null;
  unitId: string | null;
  priceCents: number;
  currencyCode: string;
  priceIncludesTax: boolean;
  trackStock: boolean;
  status: ProductStatus;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Product {
  private constructor(private props: ProductProps) {}

  static create(params: {
    organizationId: string;
    name: string;
    type: ProductType;
    priceCents: number;
    currencyCode: string;
    sku?: string | null;
    description?: string | null;
    categoryId?: string | null;
    unitId?: string | null;
    priceIncludesTax?: boolean;
    trackStock?: boolean;
    metadata?: Record<string, unknown> | null;
  }): Product {
    const now = new Date();
    return new Product({
      id: randomUUID(),
      organizationId: params.organizationId,
      sku: params.sku ?? null,
      name: params.name,
      description: params.description ?? null,
      type: params.type,
      categoryId: params.categoryId ?? null,
      unitId: params.unitId ?? null,
      priceCents: params.priceCents,
      currencyCode: params.currencyCode,
      priceIncludesTax: params.priceIncludesTax ?? false,
      trackStock: params.trackStock ?? false,
      status: 'active',
      metadata: params.metadata ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  static fromPersistence(props: ProductProps): Product {
    return new Product({ ...props });
  }

  get id(): string { return this.props.id; }
  get organizationId(): string { return this.props.organizationId; }
  get sku(): string | null { return this.props.sku; }
  get name(): string { return this.props.name; }
  get description(): string | null { return this.props.description; }
  get type(): ProductType { return this.props.type; }
  get categoryId(): string | null { return this.props.categoryId; }
  get unitId(): string | null { return this.props.unitId; }
  get priceCents(): number { return this.props.priceCents; }
  get currencyCode(): string { return this.props.currencyCode; }
  get priceIncludesTax(): boolean { return this.props.priceIncludesTax; }
  get trackStock(): boolean { return this.props.trackStock; }
  get status(): ProductStatus { return this.props.status; }
  get metadata(): Record<string, unknown> | null { return this.props.metadata; }
  get createdAt(): Date { return this.props.createdAt; }
  get updatedAt(): Date { return this.props.updatedAt; }

  belongsToOrganization(organizationId: string): boolean {
    return this.props.organizationId === organizationId;
  }

  updateDetails(params: {
    name?: string;
    description?: string | null;
    sku?: string | null;
    categoryId?: string | null;
    unitId?: string | null;
    type?: ProductType;
    priceIncludesTax?: boolean;
    trackStock?: boolean;
    metadata?: Record<string, unknown> | null;
    status?: ProductStatus;
  }): void {
    if (params.name !== undefined) this.props.name = params.name;
    if (params.description !== undefined) this.props.description = params.description;
    if (params.sku !== undefined) this.props.sku = params.sku;
    if (params.categoryId !== undefined) this.props.categoryId = params.categoryId;
    if (params.unitId !== undefined) this.props.unitId = params.unitId;
    if (params.type !== undefined) this.props.type = params.type;
    if (params.priceIncludesTax !== undefined) this.props.priceIncludesTax = params.priceIncludesTax;
    if (params.trackStock !== undefined) this.props.trackStock = params.trackStock;
    if (params.metadata !== undefined) this.props.metadata = params.metadata;
    if (params.status !== undefined) this.props.status = params.status;
    this.props.updatedAt = new Date();
  }

  updatePrice(priceCents: number, currencyCode: string): void {
    this.props.priceCents = priceCents;
    this.props.currencyCode = currencyCode;
    this.props.updatedAt = new Date();
  }

  disable(): void {
    this.props.status = 'inactive';
    this.props.updatedAt = new Date();
  }

  toPersistence(): ProductProps {
    return { ...this.props };
  }
}

// ── ProductTax ──────────────────────────────────────────────────────────────

export interface ProductTaxProps {
  id: string;
  productId: string;
  taxRateId: string;
  kind: TaxKind;
}

export class ProductTax {
  private constructor(private props: ProductTaxProps) {}

  static create(params: { productId: string; taxRateId: string; kind: TaxKind }): ProductTax {
    return new ProductTax({
      id: randomUUID(),
      productId: params.productId,
      taxRateId: params.taxRateId,
      kind: params.kind,
    });
  }

  static fromPersistence(props: ProductTaxProps): ProductTax {
    return new ProductTax({ ...props });
  }

  get id(): string { return this.props.id; }
  get productId(): string { return this.props.productId; }
  get taxRateId(): string { return this.props.taxRateId; }
  get kind(): TaxKind { return this.props.kind; }

  toPersistence(): ProductTaxProps {
    return { ...this.props };
  }
}

// ── ProductImage ────────────────────────────────────────────────────────────

export interface ProductImageProps {
  id: string;
  productId: string;
  organizationId: string;
  fileId: string;
  alt: string | null;
  isPrimary: boolean;
  position: number;
  createdAt: Date;
}

export class ProductImage {
  private constructor(private props: ProductImageProps) {}

  static create(params: {
    productId: string;
    organizationId: string;
    fileId: string;
    alt?: string | null;
    isPrimary?: boolean;
    position?: number;
  }): ProductImage {
    return new ProductImage({
      id: randomUUID(),
      productId: params.productId,
      organizationId: params.organizationId,
      fileId: params.fileId,
      alt: params.alt ?? null,
      isPrimary: params.isPrimary ?? false,
      position: params.position ?? 0,
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: ProductImageProps): ProductImage {
    return new ProductImage({ ...props });
  }

  get id(): string { return this.props.id; }
  get productId(): string { return this.props.productId; }
  get organizationId(): string { return this.props.organizationId; }
  get fileId(): string { return this.props.fileId; }
  get alt(): string | null { return this.props.alt; }
  get isPrimary(): boolean { return this.props.isPrimary; }
  get position(): number { return this.props.position; }
  get createdAt(): Date { return this.props.createdAt; }

  setPrimary(): void {
    this.props.isPrimary = true;
  }

  unsetPrimary(): void {
    this.props.isPrimary = false;
  }

  toPersistence(): ProductImageProps {
    return { ...this.props };
  }
}

// ── TaxRate (read-model) ────────────────────────────────────────────────────

export interface TaxRateProps {
  id: string;
  countryCode: string;
  code: string;
  name: string | null;
  percentage: string;
  kind: TaxKind;
  isDefault: boolean;
}

export class TaxRate {
  private constructor(private props: TaxRateProps) {}

  static fromPersistence(props: TaxRateProps): TaxRate {
    return new TaxRate({ ...props });
  }

  get id(): string { return this.props.id; }
  get countryCode(): string { return this.props.countryCode; }
  get code(): string { return this.props.code; }
  get name(): string | null { return this.props.name; }
  get percentage(): string { return this.props.percentage; }
  get kind(): TaxKind { return this.props.kind; }
  get isDefault(): boolean { return this.props.isDefault; }

  matchesCountry(countryCode: string): boolean {
    return this.props.countryCode === countryCode;
  }

  toPersistence(): TaxRateProps {
    return { ...this.props };
  }
}
