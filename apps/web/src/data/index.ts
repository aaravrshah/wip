import { createNeonApplicationRepository } from './neon-application-repository';
import type { ApplicationRepository } from './application-repository';
import { demoApplicationRepository } from './demo-application-repository';
import { getServerEnvironment } from '@/env/server';

let cachedRepository: ApplicationRepository | undefined;

function getRepository(): ApplicationRepository {
  if (cachedRepository) return cachedRepository;

  const environment = getServerEnvironment();
  cachedRepository =
    environment.dataSource === 'neon'
      ? createNeonApplicationRepository({
          databaseUrl: environment.databaseUrl,
          ownerId: environment.ownerId,
        })
      : demoApplicationRepository;

  return cachedRepository;
}

// Selection is explicit. Development/test default to the deterministic in-memory source;
// production rejects that source unless its separate demo-build override is deliberate.
export const applicationRepository: ApplicationRepository = {
  listApplications() {
    return getRepository().listApplications();
  },
  getApplicationById(id) {
    return getRepository().getApplicationById(id);
  },
  getReferenceDate() {
    return getRepository().getReferenceDate();
  },
};
