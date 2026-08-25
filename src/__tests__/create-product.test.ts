import { describe, it, expect } from 'vitest';
import { CreateProductUseCase } from '../application/use-cases/create-product.js';
import { GetProductUseCase } from '../application/use-cases/get-product.js';
import { createInMemoryRepositories, InMemoryEstablishmentRepository, uuid } from './helpers.js';
import { MultipleTaxKindError, SkuAlreadyExistsError, CategoryNotFoundError, UnitNotFoundError, TaxRateNotFoundError, EstablishmentRequiredError, EstablishmentNotFoundError } from '../domain/errors.js';
import { UnitOfWork } from '../application/ports.js';
import { Repositories } from '../domain/repositories.js';

class InMemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly repos: Repositories) {}

  async execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return work(this.repos);
  }
}

const EST = uuid(100);

function setup() {
  const repos = createInMemoryRepositories();
  const uow = new InMemoryUnitOfWork(repos);
  const establishments = new InMemoryEstablishmentRepository().with([EST, uuid(101), uuid(102)]);
  const useCase = new CreateProductUseCase(uow, establishments);
  return { repos, uow, establishments, useCase };
}

describe('CreateProductUseCase', () => {
  it('crea un producto con priceCents=1999 desde "19.99"', async () => {
    const { useCase } = setup();

    const result = await useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Laptop',
      type: 'good',
      price: '19.99',
      currencyCode: 'USD',
      establishmentIds: [EST],
    });

    expect(result.id).toBeDefined();
    expect(result.name).toBe('Laptop');
    expect(result.price).toBe('19.99');
    expect(result.priceCents).toBe(1999);
    expect(result.currencyCode).toBe('USD');
    expect(result.status).toBe('active');
    expect(result.imageFileId).toBeNull();
    expect(result.establishmentIds).toEqual([EST]);
  });

  it('lanza SkuAlreadyExistsError si el SKU está duplicado', async () => {
    const { useCase } = setup();

    await useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto 1',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      sku: 'SKU-001',
      establishmentIds: [EST],
    });

    await expect(useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto 2',
      type: 'good',
      price: '20.00',
      currencyCode: 'USD',
      sku: 'SKU-001',
      establishmentIds: [EST],
    })).rejects.toThrow(SkuAlreadyExistsError);
  });

  it('lanza CategoryNotFoundError si la categoría no existe', async () => {
    const { useCase } = setup();

    await expect(useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      categoryId: 'nonexistent-id',
      establishmentIds: [EST],
    })).rejects.toThrow(CategoryNotFoundError);
  });

  it('lanza UnitNotFoundError si la unidad no existe', async () => {
    const { useCase } = setup();

    await expect(useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      unitId: 'nonexistent-id',
      establishmentIds: [EST],
    })).rejects.toThrow(UnitNotFoundError);
  });

  it('lanza EstablishmentRequiredError si no se asigna ningún establecimiento', async () => {
    const { useCase } = setup();

    await expect(useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      establishmentIds: [],
    })).rejects.toThrow(EstablishmentRequiredError);
  });

  it('lanza EstablishmentNotFoundError si el establecimiento no pertenece a la org', async () => {
    const { useCase } = setup();

    await expect(useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      establishmentIds: [uuid(999)],
    })).rejects.toThrow(EstablishmentNotFoundError);
  });

  it('lanza MultipleTaxKindError si se envian dos tasas del mismo kind', async () => {
    const { repos, useCase } = setup();

    repos.taxRates.upsert({ id: 'vat-15', countryCode: 'EC', code: 'IVA15', name: 'IVA 15%', percentage: '15.00', kind: 'vat' as const, isDefault: true });
    repos.taxRates.upsert({ id: 'vat-0', countryCode: 'EC', code: 'IVA0', name: 'IVA 0%', percentage: '0.00', kind: 'vat' as const, isDefault: false });

    await expect(useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      establishmentIds: [EST],
      taxRateIds: ['vat-15', 'vat-0'],
    })).rejects.toThrow(MultipleTaxKindError);
  });

  it('lanza TaxRateNotFoundError si la tasa no existe en el país', async () => {
    const { useCase } = setup();

    await expect(useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Producto',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      establishmentIds: [EST],
      taxRateIds: ['nonexistent-id'],
    })).rejects.toThrow(TaxRateNotFoundError);
  });

  it('emite evento product.product.created con establishmentIds', async () => {
    const { repos, useCase } = setup();

    await useCase.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Test',
      type: 'good',
      price: '5.00',
      currencyCode: 'USD',
      establishmentIds: [EST],
    });

    expect(repos.outbox.events.length).toBe(1);
    expect(repos.outbox.events[0].type).toBe('product.product.created');
    expect((repos.outbox.events[0].payload as { establishmentIds: string[] }).establishmentIds).toEqual([EST]);
  });
});

describe('GetProductUseCase', () => {
  it('retorna 404 si el producto no pertenece a la org', async () => {
    const repos = createInMemoryRepositories();
    const useCase = new GetProductUseCase(repos);

    const { CreateProductUseCase } = await import('../application/use-cases/create-product');
    const uow = new InMemoryUnitOfWork(repos);
    const create = new CreateProductUseCase(uow, new InMemoryEstablishmentRepository().with([EST]));

    const product = await create.execute({
      organizationId: 'org-1',
      countryCode: 'EC',
      name: 'Test',
      type: 'good',
      price: '10.00',
      currencyCode: 'USD',
      establishmentIds: [EST],
    });

    await expect(useCase.execute('org-2', product.id)).rejects.toThrow('Producto no encontrado.');
  });
});
