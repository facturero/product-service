/**
 * Caché en memoria de conteos (`COUNT(*)`) por organización, con TTL corto.
 *
 * Por qué existe: GET /products devuelve `total` (el frontend pagina en servidor con
 * él) y calcularlo recorre todas las filas de la organización en cada petición. Con
 * ~85 mil productos son ~90 ms de MySQL por petición mientras la página en sí tarda
 * 1-3 ms: a 41 RPS son casi 4 núcleos de MySQL solo contando. El total puede tolerar
 * unos segundos de retraso; la página nunca se cachea.
 *
 * - Las cargas simultáneas de la misma clave comparten una sola consulta.
 * - `invalidate(org)` descarta los conteos de esa organización (al escribir un
 *   producto). Una carga que estaba en vuelo durante la invalidación NO se guarda
 *   (podría ser anterior a la escritura), aunque sí se le entrega a quien la pidió.
 * - Un error no se cachea.
 * - Acotado: como la clave incluye el texto de búsqueda, hay un tope de claves por
 *   organización para que no crezca sin límite.
 */
const MAX_KEYS_PER_ORG = 200;

interface Entry {
  value: number;
  expiresAt: number;
}

export class CountCache {
  private readonly byOrg = new Map<string, Map<string, Entry>>();
  private readonly generation = new Map<string, number>();
  private readonly inflight = new Map<string, Promise<number>>();

  /** ttlMs <= 0 desactiva el caché: siempre se consulta. */
  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async get(organizationId: string, key: string, load: () => Promise<number>): Promise<number> {
    if (this.ttlMs <= 0) return load();

    const cached = this.byOrg.get(organizationId)?.get(key);
    if (cached && cached.expiresAt > this.now()) return cached.value;

    const gen = this.generation.get(organizationId) ?? 0;
    const flightKey = `${organizationId}\u0000${gen}\u0000${key}`;
    const pending = this.inflight.get(flightKey);
    if (pending) return pending;

    const promise = load()
      .then((value) => {
        // Solo se guarda si nadie invalidó la organización mientras se contaba.
        if ((this.generation.get(organizationId) ?? 0) === gen) this.store(organizationId, key, value);
        return value;
      })
      .finally(() => {
        this.inflight.delete(flightKey);
      });
    this.inflight.set(flightKey, promise);
    return promise;
  }

  /** Descarta los conteos cacheados de una organización (llamar tras escribir). */
  invalidate(organizationId: string): void {
    this.byOrg.delete(organizationId);
    this.generation.set(organizationId, (this.generation.get(organizationId) ?? 0) + 1);
  }

  private store(organizationId: string, key: string, value: number): void {
    let entries = this.byOrg.get(organizationId);
    if (!entries) {
      entries = new Map();
      this.byOrg.set(organizationId, entries);
    }
    if (entries.size >= MAX_KEYS_PER_ORG) {
      const t = this.now();
      for (const [k, e] of entries) if (e.expiresAt <= t) entries.delete(k);
      if (entries.size >= MAX_KEYS_PER_ORG) entries.clear();
    }
    entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
  }
}
