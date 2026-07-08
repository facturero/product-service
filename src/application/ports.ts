import { Repositories } from '../domain/repositories.js';

export interface UnitOfWork {
  execute<T>(work: (repos: Repositories) => Promise<T>): Promise<T>;
}
