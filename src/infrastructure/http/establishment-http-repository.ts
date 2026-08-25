import { EstablishmentRepository, EstablishmentInfo } from '../../application/ports.js';

interface EstablishmentResponse {
  id: string;
  code: string;
  status: 'active' | 'inactive';
}

// Read-model de organization-service: valida que los establecimientos a los
// que se asigna un producto existan y pertenezcan a la organización del
// contexto. Sigue el mismo patrón de TaxRateHttpRepository: llamada service a
// service usando las cabeceras de contexto (el gateway las propaga igual).
export class EstablishmentHttpRepository implements EstablishmentRepository {
  constructor(
    private readonly baseUrl: string,
    private readonly systemUserId: string,
  ) {}

  async listByOrganization(organizationId: string): Promise<EstablishmentInfo[]> {
    const url = `${this.baseUrl}/establishments`;
    const response = await fetch(url, {
      headers: {
        'X-Organization-Id': organizationId,
        'X-User-Id': this.systemUserId,
        'X-Permissions': 'establishment:read',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Error al obtener establecimientos: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as EstablishmentResponse[];
    return data.map((e) => ({
      id: e.id,
      code: e.code,
      status: e.status,
    }));
  }
}
