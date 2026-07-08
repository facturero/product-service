import { TaxRateReadModelRepository } from '../../domain/repositories.js';
import { TaxRateDTO } from '../dtos.js';

export class ListTaxRatesUseCase {
  constructor(private readonly taxRateRepo: TaxRateReadModelRepository) {}

  async execute(countryCode: string): Promise<TaxRateDTO[]> {
    const rates = await this.taxRateRepo.listByCountry(countryCode);
    return rates.map((r) => ({
      id: r.id,
      countryCode: r.countryCode,
      code: r.code,
      name: r.name,
      percentage: r.percentage,
      kind: r.kind,
      isDefault: r.isDefault,
    }));
  }
}
