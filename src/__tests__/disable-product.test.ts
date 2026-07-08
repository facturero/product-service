import { describe, it, expect } from 'vitest';
import { CreateProductUseCase } from '../application/use-cases/create-product.js';
import { DisableProductUseCase } from '../application/use-cases/disable-product.js';
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

describe('DisableProductUseCase', () => {
  it('desactiva un producto y cambia su estado a inactive', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new DisableProductUseCase(uow);
    await useCase.execute('org-1', product.id);

    const getProduct = new GetProductUseCase(repos);
    const result = await getProduct.execute('org-1', product.id);
    expect(result.status).toBe('inactive');
  });

  it('emite evento product.product.disabled', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new DisableProductUseCase(uow);
    await useCase.execute('org-1', product.id);

    expect(repos.outbox.events.length).toBe(2);
    expect(repos.outbox.events[1].type).toBe('product.product.disabled');
    expect(repos.outbox.events[1].eventId).toBeDefined();
    expect(repos.outbox.events[1].organizationId).toBe('org-1');
    expect(repos.outbox.events[1].payload).toEqual({
      productId: product.id,
      organizationId: 'org-1',
    });
  });

  it('lanza ProductNotFoundError si el producto pertenece a otra org', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new DisableProductUseCase(uow);
    await expect(useCase.execute('org-2', product.id)).rejects.toThrow(ProductNotFoundError);
  });
});
