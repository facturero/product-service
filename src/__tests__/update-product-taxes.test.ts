import { describe, it, expect } from 'vitest';
import { CreateProductUseCase } from '../application/use-cases/create-product.js';
import { UpdateProductTaxesUseCase } from '../application/use-cases/update-product-taxes.js';
import { GetProductUseCase } from '../application/use-cases/get-product.js';
import { createInMemoryRepositories } from './helpers.js';
import { ProductNotFoundError, TaxRateNotFoundError } from '../domain/errors.js';
import { TaxKind } from '../domain/entities.js';
import { UnitOfWork } from '../application/ports.js';
import { Repositories } from '../domain/repositories.js';

class InMemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly repos: Repositories) {}

  async execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return work(this.repos);
  }
}

async function createTestProduct(repos: Repositories, uow: UnitOfWork) {
  const create = new CreateProductUseCase(uow);
  return create.execute({
    organizationId: 'org-1',
    countryCode: 'EC',
    name: 'Test Product',
    type: 'good',
    price: '10.00',
    currencyCode: 'USD',
  });
}

function seedTaxRate(repos: Repositories, overrides: Partial<{ id: string; countryCode: string; code: string; name: string | null; percentage: string; kind: TaxKind; isDefault: boolean }> = {}) {
  const rate = {
    id: 'tax-rate-1',
    countryCode: 'EC',
    code: 'IVA15',
    name: 'IVA 15%',
    percentage: '15.00',
    kind: 'vat' as TaxKind,
    isDefault: true,
    ...overrides,
  };
  repos.taxRates.upsert(rate);
}

describe('UpdateProductTaxesUseCase', () => {
  it('actualiza los impuestos de un producto correctamente', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);
    seedTaxRate(repos, { id: 'tax-rate-1', code: 'IVA15', kind: 'vat' });
    seedTaxRate(repos, { id: 'tax-rate-2', code: 'IVA5', kind: 'vat' });

    const useCase = new UpdateProductTaxesUseCase(uow);
    const result = await useCase.execute({
      organizationId: 'org-1',
      productId: product.id,
      countryCode: 'EC',
      taxRateIds: ['tax-rate-1', 'tax-rate-2'],
    });

    expect(result.taxes.length).toBe(2);
    expect(result.taxes.map((t) => t.taxRateId)).toContain('tax-rate-1');
    expect(result.taxes.map((t) => t.kind)).toEqual(['vat', 'vat']);
  });

  it('reemplaza los impuestos anteriores al actualizar', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);
    seedTaxRate(repos, { id: 'tax-rate-1', code: 'IVA15', kind: 'vat' });
    seedTaxRate(repos, { id: 'tax-rate-2', code: 'IVA5', kind: 'vat' });

    const useCase = new UpdateProductTaxesUseCase(uow);
    await useCase.execute({
      organizationId: 'org-1',
      productId: product.id,
      countryCode: 'EC',
      taxRateIds: ['tax-rate-1'],
    });

    const result = await useCase.execute({
      organizationId: 'org-1',
      productId: product.id,
      countryCode: 'EC',
      taxRateIds: ['tax-rate-2'],
    });

    expect(result.taxes.length).toBe(1);
    expect(result.taxes[0].taxRateId).toBe('tax-rate-2');
  });

  it('lanza TaxRateNotFoundError si la tasa no existe en el país', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);
    seedTaxRate(repos, { id: 'tax-rate-1', countryCode: 'PE', kind: 'vat' });

    const useCase = new UpdateProductTaxesUseCase(uow);
    await expect(useCase.execute({
      organizationId: 'org-1',
      productId: product.id,
      countryCode: 'EC',
      taxRateIds: ['tax-rate-1'],
    })).rejects.toThrow(TaxRateNotFoundError);
  });

  it('lanza ProductNotFoundError si el producto no pertenece a la org', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new UpdateProductTaxesUseCase(uow);
    await expect(useCase.execute({
      organizationId: 'org-2',
      productId: product.id,
      countryCode: 'EC',
      taxRateIds: [],
    })).rejects.toThrow(ProductNotFoundError);
  });

  it('emite evento product.product.updated con payload completo', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);
    seedTaxRate(repos, { id: 'tax-rate-1', code: 'IVA15', kind: 'vat' });

    const useCase = new UpdateProductTaxesUseCase(uow);
    await useCase.execute({
      organizationId: 'org-1',
      productId: product.id,
      countryCode: 'EC',
      taxRateIds: ['tax-rate-1'],
    });

    const event = repos.outbox.events[1];
    expect(event.type).toBe('product.product.updated');
    expect(event.eventId).toBeDefined();
    expect(event.organizationId).toBe('org-1');
    expect(event.payload.taxes).toEqual([{ taxRateId: 'tax-rate-1', kind: 'vat' }]);
    expect(event.payload.productId).toBe(product.id);
    expect(event.payload.status).toBe('active');
    expect(event.payload.priceCents).toBe(1000);
    expect(event.payload.currencyCode).toBe('USD');
  });
});
