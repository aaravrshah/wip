import {
  applicationStages,
  daysSince,
  stageLabels,
  type Application,
  type ApplicationStage,
  type UpcomingItem,
} from '@wip/domain';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  MailQuestion,
  Sparkle,
} from 'lucide-react';
import Link from 'next/link';

import { formatDateTime, formatDayHeading, formatShortDate, initials } from '@/lib/format';

import { StageBadge } from './stage-badge';

interface TodayDashboardProps {
  applications: Application[];
  referenceDate: Date;
  stageCounts: Record<ApplicationStage, number>;
  upcoming: UpcomingItem[];
  overdue: Application[];
  awaiting: Application[];
  recent: Application[];
  canManage?: boolean;
  timeZone?: string;
}

function CompanyMark({ company }: { company: string }) {
  return (
    <span className="company-mark" aria-hidden="true">
      {initials(company)}
    </span>
  );
}

export function TodayDashboard({
  applications,
  referenceDate,
  stageCounts,
  upcoming,
  overdue,
  awaiting,
  recent,
  canManage = false,
  timeZone = 'UTC',
}: TodayDashboardProps) {
  const activeCount = applications.filter(
    (application) => !['accepted', 'rejected', 'withdrawn'].includes(application.stage),
  ).length;

  return (
    <div className="page-stack">
      <section className="today-hero" aria-labelledby="today-heading">
        <div>
          <p className="eyebrow">{formatDayHeading(referenceDate, timeZone)}</p>
          <h1 id="today-heading">Your search, one clear step at a time.</h1>
          <p className="hero-copy">
            You have {upcoming.length} upcoming conversations or assessments and {overdue.length}{' '}
            follow-ups ready for attention.
          </p>
        </div>
        <Link
          className="button button-primary"
          href={canManage ? '/applications/new' : '/applications'}
        >
          {canManage ? 'Add application' : 'View all applications'}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </section>

      <section className="summary-card" aria-labelledby="summary-heading">
        <div className="summary-intro">
          <span className="summary-icon" aria-hidden="true">
            <Sparkle size={19} />
          </span>
          <div>
            <p className="section-kicker">The big picture</p>
            <h2 id="summary-heading">{activeCount} active applications</h2>
          </div>
          <p className="summary-total">{applications.length} total</p>
        </div>
        <div className="stage-summary" aria-label="Application counts by stage">
          {applicationStages.map((stage) => (
            <div className="stage-summary-item" key={stage}>
              <span className="stage-summary-count">{stageCounts[stage]}</span>
              <span>{stageLabels[stage]}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="panel panel-wide" aria-labelledby="upcoming-heading">
          <div className="panel-heading">
            <span className="panel-icon panel-icon-lilac" aria-hidden="true">
              <CalendarClock size={19} />
            </span>
            <div>
              <p className="section-kicker">Next two weeks</p>
              <h2 id="upcoming-heading">Upcoming interviews & assessments</h2>
            </div>
            <span className="count-badge">{upcoming.length}</span>
          </div>
          <div className="item-list">
            {upcoming.map((item) => (
              <Link
                className="dashboard-item"
                href={`/applications/${item.applicationId}`}
                key={item.action.id}
              >
                <CompanyMark company={item.company} />
                <span className="dashboard-item-copy">
                  <strong>{item.action.title}</strong>
                  <span>
                    {item.company} · {item.role}
                  </span>
                </span>
                <time dateTime={item.action.dueAt}>
                  {formatDateTime(item.action.dueAt, timeZone)}
                </time>
                <ArrowRight className="item-arrow" aria-hidden="true" size={17} />
              </Link>
            ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="overdue-heading">
          <div className="panel-heading">
            <span className="panel-icon panel-icon-coral" aria-hidden="true">
              <CircleAlert size={19} />
            </span>
            <div>
              <p className="section-kicker">Worth a nudge</p>
              <h2 id="overdue-heading">Overdue follow-ups</h2>
            </div>
          </div>
          <div className="compact-list">
            {overdue.map((application) => (
              <Link
                href={`/applications/${application.id}`}
                key={application.id}
                className="compact-item"
              >
                <span>
                  <strong>{application.company}</strong>
                  <small>{application.nextAction?.title}</small>
                </span>
                <span className="overdue-label">
                  {daysSince(application.nextAction!.dueAt, referenceDate)}d late
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="panel" aria-labelledby="awaiting-heading">
          <div className="panel-heading">
            <span className="panel-icon panel-icon-blue" aria-hidden="true">
              <MailQuestion size={19} />
            </span>
            <div>
              <p className="section-kicker">Waiting on them</p>
              <h2 id="awaiting-heading">Awaiting responses</h2>
            </div>
          </div>
          <div className="compact-list">
            {awaiting.map((application) => (
              <Link
                href={`/applications/${application.id}`}
                key={application.id}
                className="compact-item"
              >
                <span>
                  <strong>{application.company}</strong>
                  <small>{application.role}</small>
                </span>
                <span className="waiting-label">
                  <Clock3 aria-hidden="true" size={14} />
                  {daysSince(application.updatedAt, referenceDate)}d
                </span>
              </Link>
            ))}
          </div>
          <p className="panel-note">
            Awaiting response is a neutral reminder, not a ghosting label.
          </p>
        </section>
      </div>

      <section className="panel" aria-labelledby="recent-heading">
        <div className="panel-heading panel-heading-spread">
          <span className="panel-icon panel-icon-green" aria-hidden="true">
            <CheckCircle2 size={19} />
          </span>
          <div>
            <p className="section-kicker">Your latest movement</p>
            <h2 id="recent-heading">Recently changed</h2>
          </div>
          <Link className="text-link" href="/applications?sort=updated">
            See all <ArrowRight aria-hidden="true" size={15} />
          </Link>
        </div>
        <div className="recent-grid">
          {recent.map((application) => (
            <Link
              className="recent-card"
              href={`/applications/${application.id}`}
              key={application.id}
            >
              <div className="recent-card-top">
                <CompanyMark company={application.company} />
                <StageBadge stage={application.stage} />
              </div>
              <strong>{application.company}</strong>
              <span>{application.role}</span>
              <time dateTime={application.updatedAt}>
                Updated {formatShortDate(application.updatedAt, timeZone)}
              </time>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
