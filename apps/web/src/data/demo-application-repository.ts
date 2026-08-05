import type { Application } from '@wip/domain';

import type { ApplicationRepository } from './application-repository';
import { demoApplications, demoReferenceDate } from '@wip/fixtures';

function cloneApplication(application: Application): Application {
  return structuredClone(application);
}

export const demoApplicationRepository: ApplicationRepository = {
  async listApplications() {
    return demoApplications.map(cloneApplication);
  },

  async getApplicationById(id) {
    const application = demoApplications.find((candidate) => candidate.id === id);
    return application ? cloneApplication(application) : undefined;
  },

  getReferenceDate() {
    return new Date(demoReferenceDate);
  },
};
