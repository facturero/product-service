import { describe, it, expect } from 'vitest';
import { CreateProductUseCase } from '../application/use-cases/create-product.js';
import { UpdateProductTaxesUseCase } from '../application/use-cases/update-product-taxes.js';
import { ListProductsUseCase } from '../application/use-cases/list-products.js';
import { createInMemoryRepositories, InMemoryEstablishmentRepository, uuid } from './helpers.js';
import { TaxKind } from '../domain/entities.js';
import { UnitOfWork } from '../application/ports.js';
import { Repositories } from '../domain/repositories.js';

class InMemoryUnitOfWork implements UnitOfWork {
  constructor(private readonly repos: Repositories) {}
  async execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T> {
    return work(this.repos);
  }
}

const EST = uuid(100);

function seedRate(repos: Repositories, id: string, code: string, percentage: string) {
  repos.taxRates.upsert({ id, countryCode: 'EC', code, name: code, percentage, kind: 'vat' as TaxKind, isDefault: false });
}

// El POS calcula el IVA de cada línea con los impuestos del PRODUCTO (cada producto
// tiene su propia tasa), y los recibe en el listado para no pedir un detalle por producto.
describe('ListProductsUseCase — impuestos por producto', () => {
  async function setup() {
    const repos = createInMemoryRepositories();
    const uow = new InMemoryUnitOfWork(repos);
    seedRate(repos, 'rate-15', 'IVA15', '15.00');
    seedRate(repos, 'rate-0', 'IVA0', '0.00');
    const create = new CreateProductUseCase(uow, new InMemoryEstablishmentRepository().with([EST]));
    const updateTaxes = new UpdateProductTaxesUseCase(uow);
    const mk = (name: string) => create.execute({ organizationId: 'org-1', countryCode: 'EC', name, type: 'good', price: '10.00', currencyCode: 'USD', establishmentIds: [EST] });
    return { repos, updateTaxes, mk, list: new ListProductsUseCase(repos.products, repos.productImages, repos.productTaxes) };
  }

  it('cada producto trae SU tasa, distinta entre productos', async () => {
    const { updateTaxes, mk, list } = await setup();
    const a = await mk('Con IVA 15');
    const b = await mk('Con IVA 0');
    await updateTaxes.execute({ organizationId: 'org-1', productId: a.id, countryCode: 'EC', taxRateIds: ['rate-15'] });
    await updateTaxes.execute({ organizationId: 'org-1', productId: b.id, countryCode: 'EC', taxRateIds: ['rate-0'] });

    const page = await list.execute({ organizationId: 'org-1' });
    const byName = new Map(page.items.map((p) => [p.name, p]));
    expect(byName.get('Con IVA 15')!.taxes.map((t) => t.taxRateId)).toEqual(['rate-15']);
    expect(byName.get('Con IVA 0')!.taxes.map((t) => t.taxRateId)).toEqual(['rate-0']);
    expect(byName.get('Con IVA 15')!.taxes[0]).toMatchObject({ kind: 'vat' });
  });

  it('un producto sin impuestos devuelve taxes: [] (no undefined)', async () => {
    const { mk, list } = await setup();
    await mk('Sin impuestos');
    const page = await list.execute({ organizationId: 'org-1' });
    expect(page.items[0].taxes).toEqual([]);
  });

  it('trae los impuestos de toda la pagina en UNA consulta, no una por producto', async () => {
    const { repos, updateTaxes, mk, list } = await setup();
    for (let i = 0; i < 5; i++) {
      const p = await mk(`Producto ${i}`);
      await updateTaxes.execute({ organizationId: 'org-1', productId: p.id, countryCode: 'EC', taxRateIds: ['rate-15'] });
    }
    let batch = 0;
    let single = 0;
    const origBatch = repos.productTaxes.findByProducts.bind(repos.productTaxes);
    const origSingle = repos.productTaxes.findByProduct.bind(repos.productTaxes);
    repos.productTaxes.findByProducts = async (ids) => { batch++; return origBatch(ids); };
    repos.productTaxes.findByProduct = async (id) => { single++; return origSingle(id); };

    const page = await list.execute({ organizationId: 'org-1' });
    expect(page.items).toHaveLength(5);
    expect(batch).toBe(1);
    expect(single).toBe(0);
  });

  it('sin productos no consulta impuestos', async () => {
    const { repos, list } = await setup();
    let batch = 0;
    repos.productTaxes.findByProducts = async () => { batch++; return []; };
    const page = await list.execute({ organizationId: 'org-1' });
    expect(page.items).toEqual([]);
    expect(batch).toBe(0);
  });
});
