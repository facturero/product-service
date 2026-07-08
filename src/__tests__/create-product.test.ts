import { describe, it, expect } from 'vitest';
import { CreateProductUseCase } from '../application/use-cases/create-product.js';
import { GetProductUseCase } from '../application/use-cases/get-product.js';
import { createInMemoryRepositories } from './helpers.js';
import { SkuAlreadyExistsError, CategoryNotFoundError, UnitNotFoundError, TaxRateNotFoundError } from '../domain/errors.js';
import { UnitOfWork } from '../application/ports.js';
import { Repositories } from '../domain/repositories.js';

class InMemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly repos: Repositories) {}

  async execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return work(this.repos);
  }
}

describe('CreateProductUseCase', () => {
  it('crea un producto con priceCents=1999 desde "19.99"', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const useCase = new CreateProductUseCase(uow);

    const result = await useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Laptop',
      type: 'good',
      price: '19.99',
      currencyCode: 'USD',
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Laptop');
    expect(result.price).toBe('19.99');
    expect(result.priceCents).toBe(1999);
    expect(result.currencyCode).toBe('USD');
    expect(result.status).toBe('active');
    expect(result.imageFileId).toBeNull();
  });

  it('lanza SkuAlreadyExistsError si el SKU está duplicado', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const useCase = new CreateProductUseCase(uow);

    await useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto 1',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      sku: 'SKU-001',
    });

    await expect(useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto 2',
      type: 'good',
      price: '20.00',
      currencyCode: 'USD',
      sku: 'SKU-001',
    })).rejects.toThrow(SkuAlreadyExistsError);
  });

  it('lanza CategoryNotFoundError si la categoría no existe', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const useCase = new CreateProductUseCase(uow);

    await expect(useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      categoryId: 'nonexistent-id',
    })).rejects.toThrow(CategoryNotFoundError);
  });

  it('lanza UnitNotFoundError si la unidad no existe', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const useCase = new CreateProductUseCase(uow);

    await expect(useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      unitId: 'nonexistent-id',
    })).rejects.toThrow(UnitNotFoundError);
  });

  it('lanza TaxRateNotFoundError si la tasa no existe en el país', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const useCase = new CreateProductUseCase(uow);

    await expect(useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      taxRateIds: ['nonexistent-id'],
    })).rejects.toThrow(TaxRateNotFoundError);
  });

  it('emite evento product.product.created', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const useCase = new CreateProductUseCase(uow);

    await useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Test',
      type: 'good',
      price: '5.00',
      currencyCode: 'USD',
    });

    expect(repos.outbox.events.length).toBe(1);
    expect(repos.outbox.events[0].type).toBe('product.product.created');
  });
});

describe('GetProductUseCase', () => {
  it('retorna 404 si el producto no pertenece a la org', async () => {
    const repos = createInMemoryRepositories();
    const useCase = new GetProductUseCase(repos);

    const { CreateProductUseCase } = await import('../application/use-cases/create-product');
    const uow = new InMemoryUnitOfWork(repos);
    const create = new CreateProductUseCase(uow);

    const product = await create.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Test',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
    });

    await expect(useCase.execute('org-2', product.id)).rejects.toThrow('Producto no encontrado.');
  });
});
