import { describe, it, expect } from 'vitest';
import { CreateProductUseCase } from '../application/use-cases/create-product.js';
import { UpdateProductUseCase } from '../application/use-cases/update-product.js';
import { GetProductUseCase } from '../application/use-cases/get-product.js';
import { createInMemoryRepositories, InMemoryEstablishmentRepository, uuid } from './helpers.js';
import { ProductNotFoundError, EstablishmentRequiredError, EstablishmentNotFoundError } from '../domain/errors.js';
import { UnitOfWork } from '../application/ports.js';
import { Repositories } from '../domain/repositories.js';

class InMemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly repos: Repositories) {}

  async execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return work(this.repos);
  }
}

const EST1 = uuid(100);
const EST2 = uuid(101);

async function createTestProduct(repos: Repositories, uow: UnitOfWork) {
  const create = new CreateProductUseCase(uow, new InMemoryEstablishmentRepository().with([EST1, EST2]));
  return create.execute({
    organizationId: 'org-1',
    countryCode: 'EC',
    name: 'Test Product',
    type: 'good',
    price: '10.00',
    currencyCode: 'USD',
    establishmentIds: [EST1],
  });
}

describe('UpdateProductUseCase', () => {
  it('actualiza el precio a 0.00 correctamente', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new UpdateProductUseCase(uow, new InMemoryEstablishmentRepository().with([EST1, EST2]));
    const result = await useCase.execute({
      organizationId: 'org-1',
      id: product.id,
      countryCode: 'EC',
      price: '0.00',
      currencyCode: 'USD',
    });

    expect(result.price).toBe('0.00');
    expect(result.priceCents).toBe(0);
    expect(result.establishmentIds).toEqual([EST1]);
  });

  it('actualiza solo el nombre sin afectar otros campos', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new UpdateProductUseCase(uow, new InMemoryEstablishmentRepository().with([EST1, EST2]));
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

  it('reemplaza la asignación de establecimientos', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new UpdateProductUseCase(uow, new InMemoryEstablishmentRepository().with([EST1, EST2]));
    const result = await useCase.execute({
      organizationId: 'org-1',
      id: product.id,
      countryCode: 'EC',
      establishmentIds: [EST2],
    });

    expect(result.establishmentIds).toEqual([EST2]);
    expect(await repos.productEstablishments.listByProduct(product.id)).toHaveLength(1);
  });

  it('lanza EstablishmentRequiredError si se envía la lista vacía', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new UpdateProductUseCase(uow, new InMemoryEstablishmentRepository().with([EST1, EST2]));
    await expect(useCase.execute({
      organizationId: 'org-1',
      id: product.id,
      countryCode: 'EC',
      establishmentIds: [],
    })).rejects.toThrow(EstablishmentRequiredError);
  });

  it('lanza EstablishmentNotFoundError si el establecimiento no existe', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const useCase = new UpdateProductUseCase(uow, new InMemoryEstablishmentRepository().with([EST1, EST2]));
    await expect(useCase.execute({
      organizationId: 'org-1',
      id: product.id,
      countryCode: 'EC',
      establishmentIds: [uuid(999)],
    })).rejects.toThrow(EstablishmentNotFoundError);
  });

  it('lanza ProductNotFoundError si el producto no existe', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const useCase = new UpdateProductUseCase(uow, new InMemoryEstablishmentRepository().with([EST1, EST2]));

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

    const useCase = new UpdateProductUseCase(uow, new InMemoryEstablishmentRepository().with([EST1, EST2]));
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
