import { Repositories } from '../domain/repositories.js';

export interface UnitOfWork {
  execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}

export interface EstablishmentInfo {
  id: string;
  code: string;
  status: 'active' | 'inactive';
}

// Read-model de organization-service: establecimientos de la organización.
// Se usa para validar que los `establishmentIds` de un producto existan y
// pertenezcan a la organización del contexto (patrón similar al de tax-service).
export interface EstablishmentRepository {
  listByOrganization(organizationId: string): Promise<EstablishmentInfo[]>;
}
