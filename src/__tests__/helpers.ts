import { Category, Product, ProductImage, ProductTax, TaxKind, Unit } from '../domain/entities.js';
import { DomainEvent, Repositories, ProductRepository, CategoryRepository, UnitRepository, ProductTaxRepository, ProductImageRepository, TaxRateReadModelRepository, OutboxRepository } from '../domain/repositories.js';

// ── In-memory repositories ──────────────────────────────────────────────────

export class InMemoryProductRepository implements ProductRepository {
  items: Product[] = [];

  async findById(id: string): Promise<Product | null> {
    return this.items.find((p) => p.id === id) ?? null;
  }

  async findBySku(organizationId: string, sku: string): Promise<Product | null> {
    return this.items.find((p) => p.organizationId === organizationId && p.sku === sku) ?? null;
  }

  async list(organizationId: string, filters: { search?: string; status?: string; type?: string; categoryId?: string }): Promise<Product[]> {
    let result = this.items.filter((p) => p.organizationId === organizationId);
    if (filters.status) result = result.filter((p) => p.status === filters.status);
    if (filters.type) result = result.filter((p) => p.type === filters.type);
    if (filters.categoryId) result = result.filter((p) => p.categoryId === filters.categoryId);
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(s) || (p.sku && p.sku.toLowerCase().includes(s)));
    }
    return result;
  }

  async save(product: Product): Promise<void> {
    const idx = this.items.findIndex((p) => p.id === product.id);
    if (idx >= 0) this.items[idx] = product;
    else this.items.push(product);
  }
}

export class InMemoryCategoryRepository implements CategoryRepository {
  items: Category[] = [];
  productsRef: InMemoryProductRepository | null = null;

  async findById(id: string): Promise<Category | null> {
    return this.items.find((c) => c.id === id) ?? null;
  }

  async findByName(organizationId: string, name: string, parentId?: string | null): Promise<Category | null> {
    return this.items.find((c) => c.organizationId === organizationId && c.name === name && c.parentId === (parentId ?? null)) ?? null;
  }

  async listByOrganization(organizationId: string): Promise<Category[]> {
    return this.items.filter((c) => c.organizationId === organizationId);
  }

  async save(category: Category): Promise<void> {
    const idx = this.items.findIndex((c) => c.id === category.id);
    if (idx >= 0) this.items[idx] = category;
    else this.items.push(category);
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((c) => c.id !== id);
  }

  async countProductsByCategory(categoryId: string): Promise<number> {
    if (!this.productsRef) return 0;
    return this.productsRef.items.filter((p) => p.categoryId === categoryId && p.status === 'active').length;
  }
}

export class InMemoryUnitRepository implements UnitRepository {
  items: Unit[] = [];

  async findById(id: string): Promise<Unit | null> {
    return this.items.find((u) => u.id === id) ?? null;
  }

  async findByCode(organizationId: string, code: string): Promise<Unit | null> {
    return this.items.find((u) => u.organizationId === organizationId && u.code === code) ?? null;
  }

  async listByOrganization(organizationId: string): Promise<Unit[]> {
    return this.items.filter((u) => u.organizationId === organizationId);
  }

  async save(unit: Unit): Promise<void> {
    const idx = this.items.findIndex((u) => u.id === unit.id);
    if (idx >= 0) this.items[idx] = unit;
    else this.items.push(unit);
  }
}

export class InMemoryProductTaxRepository implements ProductTaxRepository {
  items: ProductTax[] = [];

  async findByProduct(productId: string): Promise<ProductTax[]> {
    return this.items.filter((t) => t.productId === productId);
  }

  async save(productTax: ProductTax): Promise<void> {
    this.items.push(productTax);
  }

  async deleteByProduct(productId: string): Promise<void> {
    this.items = this.items.filter((t) => t.productId !== productId);
  }
}

export class InMemoryProductImageRepository implements ProductImageRepository {
  items: ProductImage[] = [];

  async findById(id: string): Promise<ProductImage | null> {
    return this.items.find((i) => i.id === id) ?? null;
  }

  async listByProduct(productId: string): Promise<ProductImage[]> {
    return this.items.filter((i) => i.productId === productId).sort((a, b) => a.position - b.position);
  }

  async save(image: ProductImage): Promise<void> {
    const idx = this.items.findIndex((i) => i.id === image.id);
    if (idx >= 0) this.items[idx] = image;
    else this.items.push(image);
  }

  async delete(id: string): Promise<void> {
    this.items = this.items.filter((i) => i.id !== id);
  }

  async clearPrimary(productId: string): Promise<void> {
    for (const img of this.items) {
      if (img.productId === productId && img.isPrimary) {
        img.unsetPrimary();
      }
    }
  }

  async findPrimary(productId: string): Promise<ProductImage | null> {
    return this.items.find((i) => i.productId === productId && i.isPrimary) ?? null;
  }
}

export class InMemoryTaxRateReadModelRepository implements TaxRateReadModelRepository {
  items: { id: string; countryCode: string; code: string; name: string | null; percentage: string; kind: TaxKind; isDefault: boolean }[] = [];

  async findById(id: string): Promise<any> {
    return this.items.find((r) => r.id === id) ?? null;
  }

  async findByIdAndCountry(id: string, countryCode: string): Promise<any> {
    return this.items.find((r) => r.id === id && r.countryCode === countryCode) ?? null;
  }

  async listByCountry(countryCode: string): Promise<any[]> {
    return this.items.filter((r) => r.countryCode === countryCode);
  }

  async upsert(rate: any): Promise<void> {
    const idx = this.items.findIndex((r) => r.id === rate.id);
    if (idx >= 0) this.items[idx] = rate;
    else this.items.push(rate);
  }
}

export class InMemoryOutboxRepository implements OutboxRepository {
  events: DomainEvent[] = [];

  async add(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }
}

export function createInMemoryRepositories(): Repositories {
  const products = new InMemoryProductRepository();
  const categories = new InMemoryCategoryRepository();
  const units = new InMemoryUnitRepository();
  const productTaxes = new InMemoryProductTaxRepository();
  const productImages = new InMemoryProductImageRepository();
  const taxRates = new InMemoryTaxRateReadModelRepository();
  categories.productsRef = products;
  return {
    products,
    categories,
    units,
    productTaxes,
    productImages,
    taxRates,
    outbox: new InMemoryOutboxRepository(),
  };
}
