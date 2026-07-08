import { Category, Product, ProductImage, ProductTax, TaxRate, Unit } from './entities.js';

export interface DomainEvent {
  eventId: string;
  organizationId: string | null;
  type: string;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

export interface ListProductsFilters {
  search?: string;
  status?: string;
  type?: string;
  categoryId?: string;
}

export interface ProductRepository {
  findById(id: string): Promise<Product | null>;
  findBySku(organizationId: string, sku: string): Promise<Product | null>;
  list(organizationId: string, filters: ListProductsFilters): Promise<Product[]>;
  save(product: Product): Promise<void>;
}

export interface CategoryRepository {
  findById(id: string): Promise<Category | null>;
  findByName(organizationId: string, name: string, parentId?: string | null): Promise<Category | null>;
  listByOrganization(organizationId: string): Promise<Category[]>;
  save(category: Category): Promise<void>;
  delete(id: string): Promise<void>;
  countProductsByCategory(categoryId: string): Promise<number>;
}

export interface UnitRepository {
  findById(id: string): Promise<Unit | null>;
  findByCode(organizationId: string, code: string): Promise<Unit | null>;
  listByOrganization(organizationId: string): Promise<Unit[]>;
  save(unit: Unit): Promise<void>;
}

export interface ProductTaxRepository {
  findByProduct(productId: string): Promise<ProductTax[]>;
  save(productTax: ProductTax): Promise<void>;
  deleteByProduct(productId: string): Promise<void>;
}

export interface ProductImageRepository {
  findById(id: string): Promise<ProductImage | null>;
  listByProduct(productId: string): Promise<ProductImage[]>;
  save(image: ProductImage): Promise<void>;
  delete(id: string): Promise<void>;
  clearPrimary(productId: string): Promise<void>;
  findPrimary(productId: string): Promise<ProductImage | null>;
}

export interface TaxRateReadModelRepository {
  findById(id: string): Promise<TaxRate | null>;
  findByIdAndCountry(id: string, countryCode: string): Promise<TaxRate | null>;
  listByCountry(countryCode: string): Promise<TaxRate[]>;
  upsert(rate: TaxRate): Promise<void>;
}

export interface OutboxRepository {
  add(event: DomainEvent): Promise<void>;
}

export interface Repositories {
  products: ProductRepository;
  categories: CategoryRepository;
  units: UnitRepository;
  productTaxes: ProductTaxRepository;
  productImages: ProductImageRepository;
  taxRates: TaxRateReadModelRepository;
  outbox: OutboxRepository;
}
