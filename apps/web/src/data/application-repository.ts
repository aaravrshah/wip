import type { Application } from '@wip/domain';

export interface ApplicationRepository {
  listApplications(): Promise<Application[]>;
  getApplicationById(id: string): Promise<Application | undefined>;
  getReferenceDate(): Date;
}
