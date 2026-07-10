import { TaxRate } from '../../domain/entities.js';
import { TaxRateReadModelRepository } from '../../domain/repositories.js';

interface TaxRateResponse {
  id: string;
  countryCode: string;
  code: string;
  name: string | null;
  percentage: string;
  kind: 'vat' | 'withholding_iva' | 'withholding_rent' | 'special';
  isDefault: boolean;
}

export class TaxRateHttpRepository implements TaxRateReadModelRepository {
  constructor(
    private readonly baseUrl: string,
    private readonly systemUserId: string,
  ) {}

  async findById(id: string): Promise<TaxRate | null> {
    const rates = await this.fetchAll();
    const rate = rates.find((r) => r.id === id);
    return rate ?? null;
  }

  async findByIdAndCountry(id: string, countryCode: string): Promise<TaxRate | null> {
    const rates = await this.fetchByCountry(countryCode);
    const rate = rates.find((r) => r.id === id);
    return rate ?? null;
  }

  async listByCountry(countryCode: string): Promise<TaxRate[]> {
    return this.fetchByCountry(countryCode);
  }

  async upsert(_rate: TaxRate): Promise<void> {
    throw new Error('TaxRateHttpRepository.upsert no está soportado. Use tax-service directamente.');
  }

  private async fetchByCountry(countryCode: string): Promise<TaxRate[]> {
    const url = `${this.baseUrl}/countries/${countryCode}/tax-rates`;
    const response = await fetch(url, {
      headers: {
        'X-User-Id': this.systemUserId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener tasas de impuestos: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as TaxRateResponse[];
    return data.map((r) =>
      TaxRate.fromPersistence({
        id: r.id,
        countryCode: r.countryCode,
        code: r.code,
        name: r.name,
        percentage: r.percentage,
        kind: r.kind,
        isDefault: r.isDefault,
      }),
    );
  }

  private async fetchAll(): Promise<TaxRate[]> {
    const url = `${this.baseUrl}/countries`;
    const response = await fetch(url, {
      headers: {
        'X-User-Id': this.systemUserId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Error al obtener países: ${response.status} ${response.statusText}`);
    }

    const countries = (await response.json()) as Array<{ code: string }>;
    const results = await Promise.all(countries.map((c) => this.fetchByCountry(c.code)));
    return results.flat();
  }
}
