import { describe, it, expect } from 'vitest';
import { AddProductImageUseCase } from '../application/use-cases/add-product-image.js';
import { RemoveProductImageUseCase } from '../application/use-cases/remove-product-image.js';
import { SetPrimaryImageUseCase } from '../application/use-cases/set-primary-image.js';
import { ListImagesUseCase } from '../application/use-cases/list-images.js';
import { CreateProductUseCase } from '../application/use-cases/create-product.js';
import { createInMemoryRepositories } from './helpers.js';
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

describe('Product images', () => {
  it('primera imagen es primary automáticamente', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const addImage = new AddProductImageUseCase(uow);
    const result = await addImage.execute({
      organizationId: 'org-1',
      productId: product.id,
      fileId: 'file-1',
      alt: 'Imagen frontal',
    });

    expect(result.isPrimary).toBe(true);
    expect(result.fileId).toBe('file-1');
  });

  it('segunda imagen no es primary automáticamente', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const addImage = new AddProductImageUseCase(uow);
    await addImage.execute({
      organizationId: 'org-1',
      productId: product.id,
      fileId: 'file-1',
    });

    const result2 = await addImage.execute({
      organizationId: 'org-1',
      productId: product.id,
      fileId: 'file-2',
    });

    expect(result2.isPrimary).toBe(false);
  });

  it('borrar primary promueve la siguiente por position', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const addImage = new AddProductImageUseCase(uow);
    const img1 = await addImage.execute({
      organizationId: 'org-1',
      productId: product.id,
      fileId: 'file-1',
    });
    await addImage.execute({
      organizationId: 'org-1',
      productId: product.id,
      fileId: 'file-2',
      position: 1,
    });

    const remove = new RemoveProductImageUseCase(uow);
    await remove.execute('org-1', product.id, img1.id);

    const listImages = new ListImagesUseCase(repos);
    const remaining = await listImages.execute('org-1', product.id);
    expect(remaining.length).toBe(1);
    expect(remaining[0].isPrimary).toBe(true);
    expect(remaining[0].fileId).toBe('file-2');
  });

  it('setPrimaryImage cambia la primary correctamente', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const addImage = new AddProductImageUseCase(uow);
    await addImage.execute({
      organizationId: 'org-1',
      productId: product.id,
      fileId: 'file-1',
    });
    const img2 = await addImage.execute({
      organizationId: 'org-1',
      productId: product.id,
      fileId: 'file-2',
    });

    const setPrimary = new SetPrimaryImageUseCase(uow);
    await setPrimary.execute('org-1', product.id, img2.id);

    const listImages = new ListImagesUseCase(repos);
    const images = await listImages.execute('org-1', product.id);
    expect(images.find((i: { isPrimary: boolean }) => i.isPrimary)!.fileId).toBe('file-2');
  });

  it('producto sin imágenes tiene imageFileId null', async () => {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    const product = await createTestProduct(repos, uow);

    const { GetProductUseCase } = await import('../application/use-cases/get-product');
    const getProduct = new GetProductUseCase(repos);
    const result = await getProduct.execute('org-1', product.id);

    expect(result.imageFileId).toBeNull();
    expect(result.images.length).toBe(0);
  });
});
