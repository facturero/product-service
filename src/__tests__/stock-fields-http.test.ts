import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createProductController, updateProductController } from '../interface/http/controllers.js';
import { createProductSchema, updateProductSchema, validateJson } from '../interface/http/validators.js';
import type { ContextVariables } from '../interface/http/middlewares.js';

/**
 * Regresión: el validador aceptaba `trackStock`, `allowNegativeStock` y `valuationMethod`, y el caso de uso los guardaba, pero los
 * controladores los DESCARTABAN al armar la entrada. Resultado: todo producto nacía sin control de stock y no había forma de
 * activarlo (ni por API ni por pantalla), así que inventario nunca registraba una entrada. Aquí se pasa por el validador y el
 * controlador REALES; el caso de uso es un espía que captura lo que le llega.
 */
function appWith<I>(spy: { input: I | null }) {
  const app = new Hono<{ Variables: ContextVariables }>();
  app.use('*', async (c, next) => {
    c.set('organizationId', 'org-1');
    c.set('countryCode', 'EC');
    await next();
  });
  const execute = async (input: I) => {
    spy.input = input;
    return { id: 'p-1' };
  };
  app.post('/products', validateJson(createProductSchema), createProductController({ execute } as never));
  app.put('/products/:id', validateJson(updateProductSchema), updateProductController({ execute } as never));
  return app;
}

const EST = '11111111-1111-4111-8111-111111111111';
const base = { name: 'Papel', type: 'good', price: '4.00', currencyCode: 'USD', establishmentIds: [EST] };
const send = (app: Hono<{ Variables: ContextVariables }>, method: 'POST' | 'PUT', path: string, body: unknown) =>
  app.request(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('campos de inventario del producto por HTTP', () => {
  it('crear: trackStock, allowNegativeStock y valuationMethod llegan al caso de uso', async () => {
    const spy = { input: null as Record<string, unknown> | null };
    const res = await send(appWith(spy), 'POST', '/products', { ...base, trackStock: true, allowNegativeStock: true, valuationMethod: 'fifo' });
    expect(res.status).toBe(201);
    expect(spy.input).toMatchObject({ trackStock: true, allowNegativeStock: true, valuationMethod: 'fifo' });
  });

  it('crear sin mandarlos: por defecto no lleva stock (un servicio, p. ej.)', async () => {
    const spy = { input: null as Record<string, unknown> | null };
    await send(appWith(spy), 'POST', '/products', base);
    expect(spy.input).toMatchObject({ trackStock: false, allowNegativeStock: false, valuationMethod: 'weighted_average' });
  });

  it('editar: activar el control de stock llega al caso de uso', async () => {
    const spy = { input: null as Record<string, unknown> | null };
    const res = await send(appWith(spy), 'PUT', '/products/p-1', { trackStock: true, valuationMethod: 'weighted_average' });
    expect(res.status).toBe(200);
    expect(spy.input).toMatchObject({ id: 'p-1', trackStock: true, valuationMethod: 'weighted_average' });
  });

  it('editar otra cosa NO toca el stock (no manda `trackStock`): no se apaga sin querer', async () => {
    const spy = { input: null as Record<string, unknown> | null };
    await send(appWith(spy), 'PUT', '/products/p-1', { name: 'Papel A4' });
    expect(spy.input?.trackStock).toBeUndefined();
    expect(spy.input?.allowNegativeStock).toBeUndefined();
  });

  it('un método de valuación inválido se rechaza con 422', async () => {
    const spy = { input: null as Record<string, unknown> | null };
    const res = await send(appWith(spy), 'POST', '/products', { ...base, valuationMethod: 'lifo' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(spy.input).toBeNull();
  });
});
