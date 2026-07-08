import { describe, it, expect } from 'vitest';
import { CreateProductUseCase } from '../application/use-cases/create-product.js';
import { UpdateProductUseCase } from '../application/use-cases/update-product.js';
import { GetProductUseCase } from '../application/use-cases/get-product.js';
import { createInMemoryRepositories } from './helpers.js';
import { ProductNotFoundError } from '../domain/errors.js';
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

describe('UpdateProductUseCase', () => {
  it('actualiza el precio a 0.00 correctamente', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new UpdateProductUseCase(uow);
    const result = await useCase.execute({
      organizationId: 'org-1',
      id: product.id,
      countryCode: 'EC',
      price: '0.00',
      currencyCode: 'USD',
    });

    expect(result.price).toBe('0.00');
    expect(result.priceCents).toBe(0);
  });

  it('actualiza solo el nombre sin afectar otros campos', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new UpdateProductUseCase(uow);
    const result = await useCase.execute({
      organizationId: 'org-1',
      id: product.id,
      countryCode: 'EC',
      name: 'Nuevo Nombre',
    });

    expect(result.name).toBe('Nuevo Nombre');
    expect(result.price).toBe('10.00');
    expect(result.type).toBe('good');
  });

  it('lanza ProductNotFoundError si el producto no existe', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const useCase = new UpdateProductUseCase(uow);

    await expect(useCase.execute({
      organizationId: 'org-1',
      id: 'nonexistent-id',
      countryCode: 'EC',
      name: 'Test',
    })).rejects.toThrow(ProductNotFoundError);
  });

  it('emite evento product.product.updated', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new UpdateProductUseCase(uow);
    await useCase.execute({
      organizationId: 'org-1',
      id: product.id,
      countryCode: 'EC',
      name: 'Actualizado',
    });

    expect(repos.outbox.events.length).toBe(2);
    expect(repos.outbox.events[1].type).toBe('product.product.updated');
    expect(repos.outbox.events[1].eventId).toBeDefined();
    expect(repos.outbox.events[1].organizationId).toBe('org-1');
  });
});
