import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { AppDependencies, catalogRoutes, categoryRoutes, healthRoutes, productRoutes, unitRoutes } from './routes.js';
import { contextMiddleware, errorHandler } from './middlewares.js';

export function createApp(deps: AppDependencies): Hono {
  const app = new Hono();

  // OJO: @hono/otel se eliminó del path de requests. Su rastreo de métricas por
  // request (histogram.record + counter.add) bloqueaba TODAS las peticiones
  // durante la exportación del PeriodExportingMetricReader al otel-collector
  // (lock del SDK métricas + export lento) → /health pasaba de 19ms a 3.5s y el
  // RPS colapsaba a ~10 bajo concurrencia. Los TRACES siguen cubiertos por
  // HttpInstrumentation en infra/telemetry/otel.ts (otlptrace), que no tiene ese lock.
  app.use('*', logger());
  app.use('*', contextMiddleware());
  app.use(
    '*',
    cors({
      origin: deps.corsOrigin,
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization', 'X-Organization-Id', 'X-User-Id', 'X-Country-Code', 'X-Permissions'],
    }),
  );

  app.route('/', healthRoutes());
  app.route('/', productRoutes(deps));
  app.route('/', categoryRoutes(deps));
  app.route('/', unitRoutes(deps));
  app.route('/', catalogRoutes(deps));

  app.onError(errorHandler);
  app.notFound((c) => c.json({ code: 'NOT_FOUND', message: 'Recurso no encontrado.' }, 404));

  return app;
}
