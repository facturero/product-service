import { describe, expect, it } from 'vitest';
import { CreateCategoryUseCase } from '../application/use-cases/create-category.js';
import { UpdateCategoryUseCase } from '../application/use-cases/update-category.js';
import { DeleteCategoryUseCase } from '../application/use-cases/delete-category.js';
import { CreateUnitUseCase } from '../application/use-cases/create-unit.js';
import { UpdateUnitUseCase } from '../application/use-cases/update-unit.js';
import type { UnitOfWork } from '../application/ports.js';
import type { Repositories } from '../domain/repositories.js';
import { createInMemoryRepositories, InMemoryCategoryRepository, InMemoryOutboxRepository, InMemoryUnitRepository } from './helpers.js';

/**
 * Categorías y unidades: el cambio y su evento de auditoría van en UNA transacción. Antes estos casos de uso recibían los
 * repositorios sin transacción: un fallo entre guardar y publicar dejaba el cambio hecho y la bitácora sin enterarse.
 * Aquí la unidad de trabajo de mentira DESHACE los cambios si algo falla dentro, como una transacción real.
 */
class RollbackUnitOfWork implements UnitOfWork {
  constructor(private readonly repos: Repositories) {}

  async execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    const categories = this.repos.categories as InMemoryCategoryRepository;
    const units = this.repos.units as InMemoryUnitRepository;
    const outbox = this.repos.outbox as InMemoryOutboxRepository;
    // Los repositorios en memoria guardan el MISMO objeto y `update()` lo muta en sitio: restaurar solo la lista no basta, hay
    // que restaurar también el estado de cada entidad (lo que hace una transacción real con las filas).
    const estado = (entidades: object[]) => entidades.map((e) => ({ e, props: { ...(e as { props: object }).props } }));
    const before = {
      categories: [...categories.items],
      units: [...units.items],
      events: [...outbox.events],
      estados: [...estado(categories.items), ...estado(units.items)],
    };
    try {
      return await work(this.repos);
    } catch (error) {
      categories.items = before.categories;
      units.items = before.units;
      outbox.events = before.events;
      for (const { e, props } of before.estados) (e as { props: object }).props = props;
      throw error;
    }
  }
}

const ORG = 'org-1';

function setup() {
  const repos = createInMemoryRepositories();
  const uow = new RollbackUnitOfWork(repos);
  return {
    repos,
    uow,
    categories: repos.categories as InMemoryCategoryRepository,
    units: repos.units as InMemoryUnitRepository,
    outbox: repos.outbox as InMemoryOutboxRepository,
  };
}

/** El outbox falla: lo que estaba guardado dentro de la transacción tiene que desaparecer. */
function breakOutbox(outbox: InMemoryOutboxRepository): void {
  outbox.add = async () => {
    throw new Error('el outbox no está disponible');
  };
}

describe('categorías: el cambio y su evento se confirman juntos', () => {
  it('crear: guarda la categoría y publica product.category.created', async () => {
    const { uow, categories, outbox } = setup();
    await new CreateCategoryUseCase(uow).execute({ organizationId: ORG, name: 'Bebidas' });
    expect(categories.items).toHaveLength(1);
    expect(outbox.events.map((e) => e.type)).toEqual(['product.category.created']);
  });

  it('crear: si el outbox falla, la categoría NO queda guardada', async () => {
    const { uow, categories, outbox } = setup();
    breakOutbox(outbox);
    await expect(new CreateCategoryUseCase(uow).execute({ organizationId: ORG, name: 'Bebidas' })).rejects.toThrow('outbox');
    expect(categories.items).toHaveLength(0);
  });

  it('editar: si el outbox falla, el nombre no cambia', async () => {
    const { uow, categories, outbox } = setup();
    const creada = await new CreateCategoryUseCase(uow).execute({ organizationId: ORG, name: 'Bebidas' });
    breakOutbox(outbox);
    await expect(new UpdateCategoryUseCase(uow).execute({ organizationId: ORG, id: creada.id, name: 'Licores' })).rejects.toThrow('outbox');
    expect(categories.items[0].name).toBe('Bebidas');
  });

  it('editar: publica product.category.updated', async () => {
    const { uow, outbox } = setup();
    const creada = await new CreateCategoryUseCase(uow).execute({ organizationId: ORG, name: 'Bebidas' });
    await new UpdateCategoryUseCase(uow).execute({ organizationId: ORG, id: creada.id, name: 'Licores' });
    expect(outbox.events.map((e) => e.type)).toEqual(['product.category.created', 'product.category.updated']);
  });

  it('borrar: si el outbox falla, la categoría sigue ahí', async () => {
    const { uow, categories, outbox } = setup();
    const creada = await new CreateCategoryUseCase(uow).execute({ organizationId: ORG, name: 'Bebidas' });
    breakOutbox(outbox);
    await expect(new DeleteCategoryUseCase(uow).execute(ORG, creada.id)).rejects.toThrow('outbox');
    expect(categories.items).toHaveLength(1);
  });

  it('borrar: publica product.category.deleted', async () => {
    const { uow, categories, outbox } = setup();
    const creada = await new CreateCategoryUseCase(uow).execute({ organizationId: ORG, name: 'Bebidas' });
    await new DeleteCategoryUseCase(uow).execute(ORG, creada.id);
    expect(categories.items).toHaveLength(0);
    expect(outbox.events.at(-1)?.type).toBe('product.category.deleted');
  });
});

describe('unidades de medida: el cambio y su evento se confirman juntos', () => {
  it('crear: guarda la unidad y publica product.unit.created', async () => {
    const { uow, units, outbox } = setup();
    await new CreateUnitUseCase(uow).execute({ organizationId: ORG, code: 'KG', name: 'Kilogramo' });
    expect(units.items).toHaveLength(1);
    expect(outbox.events.map((e) => e.type)).toEqual(['product.unit.created']);
  });

  it('crear: si el outbox falla, la unidad NO queda guardada', async () => {
    const { uow, units, outbox } = setup();
    breakOutbox(outbox);
    await expect(new CreateUnitUseCase(uow).execute({ organizationId: ORG, code: 'KG', name: 'Kilogramo' })).rejects.toThrow('outbox');
    expect(units.items).toHaveLength(0);
  });

  it('editar: si el outbox falla, el nombre no cambia; si no falla, publica product.unit.updated', async () => {
    const { uow, units, outbox } = setup();
    const creada = await new CreateUnitUseCase(uow).execute({ organizationId: ORG, code: 'KG', name: 'Kilogramo' });
    const guardado = outbox.add;
    breakOutbox(outbox);
    await expect(new UpdateUnitUseCase(uow).execute({ organizationId: ORG, id: creada.id, name: 'Kilo' })).rejects.toThrow('outbox');
    expect(units.items[0].name).toBe('Kilogramo');

    outbox.add = guardado;
    await new UpdateUnitUseCase(uow).execute({ organizationId: ORG, id: creada.id, name: 'Kilo' });
    expect(units.items[0].name).toBe('Kilo');
    expect(outbox.events.at(-1)?.type).toBe('product.unit.updated');
  });
});
