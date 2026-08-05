import { requireAuthenticatedDatabaseIdentity } from '@/auth/server';
import { getServerEnvironment } from '@/env/server';

import { createAuthenticatedNeonApplicationRepository } from './neon-application-repository';
import type { ApplicationRepository } from './application-repository';
import { demoApplicationRepository } from './demo-application-repository';

async function getRepository(): Promise<ApplicationRepository> {
  const environment = getServerEnvironment();
  if (environment.dataSource === 'demo') return demoApplicationRepository;

  const identity = await requireAuthenticatedDatabaseIdentity();
  return createAuthenticatedNeonApplicationRepository({
    authenticatedDatabaseUrl: environment.authenticatedDatabaseUrl,
    databaseToken: identity.databaseToken,
  });
}

// Demo selection is explicit and cannot silently activate in production. Authenticated
// repositories are intentionally request-local so a Clerk JWT or owner scope is never cached
// across users in a long-lived Next.js process.
export const applicationRepository: ApplicationRepository = {
  async listApplications() {
    return (await getRepository()).listApplications();
  },
  async getApplicationById(id) {
    return (await getRepository()).getApplicationById(id);
  },
  getReferenceDate() {
    const environment = getServerEnvironment();
    return environment.dataSource === 'demo'
      ? demoApplicationRepository.getReferenceDate()
      : new Date();
  },
};
