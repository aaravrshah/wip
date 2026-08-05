'use client';

import {
  applicationStages,
  queryApplications,
  stageLabels,
  type Application,
  type ApplicationSort,
  type ApplicationStage,
} from '@wip/domain';
import { ArrowDownAZ, ArrowRight, Search, SlidersHorizontal } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { formatDate, formatShortDate, initials } from '@/lib/format';

import { StageBadge } from './stage-badge';

interface ApplicationsExplorerProps {
  applications: Application[];
}

export function ApplicationsExplorer({ applications }: ApplicationsExplorerProps) {
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState<ApplicationStage | 'all'>('all');
  const [sort, setSort] = useState<ApplicationSort>('updated');

  const results = useMemo(
    () => queryApplications(applications, { search, stage, sort }),
    [applications, search, sort, stage],
  );

  return (
    <div className="applications-explorer">
      <form className="filter-bar" role="search" onSubmit={(event) => event.preventDefault()}>
        <label className="search-field">
          <span className="sr-only">Search applications</span>
          <Search aria-hidden="true" size={18} />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search company, role, or location"
          />
        </label>
        <label className="select-field">
          <SlidersHorizontal aria-hidden="true" size={17} />
          <span className="sr-only">Filter by stage</span>
          <select
            aria-label="Filter by stage"
            value={stage}
            onChange={(event) => setStage(event.target.value as ApplicationStage | 'all')}
          >
            <option value="all">All stages</option>
            {applicationStages.map((applicationStage) => (
              <option key={applicationStage} value={applicationStage}>
                {stageLabels[applicationStage]}
              </option>
            ))}
          </select>
        </label>
        <label className="select-field">
          <ArrowDownAZ aria-hidden="true" size={17} />
          <span className="sr-only">Sort applications</span>
          <select
            aria-label="Sort applications"
            value={sort}
            onChange={(event) => setSort(event.target.value as ApplicationSort)}
          >
            <option value="updated">Recently updated</option>
            <option value="date-applied">Date applied</option>
            <option value="company">Company A–Z</option>
            <option value="stage">Stage order</option>
          </select>
        </label>
      </form>

      <div className="results-heading">
        <p role="status" aria-live="polite">
          <strong>{results.length}</strong> {results.length === 1 ? 'application' : 'applications'}
        </p>
        {(search || stage !== 'all') && (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setSearch('');
              setStage('all');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {results.length > 0 ? (
        <div className="table-frame">
          <table className="application-table">
            <caption className="sr-only">Your job applications</caption>
            <thead>
              <tr>
                <th scope="col">Company & role</th>
                <th scope="col">Location</th>
                <th scope="col">Stage</th>
                <th scope="col">Date applied</th>
                <th scope="col">Last update</th>
                <th scope="col">Next action</th>
                <th scope="col">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((application) => (
                <tr key={application.id}>
                  <td data-label="Application" data-primary="true">
                    <div className="application-primary">
                      <span className="company-mark" aria-hidden="true">
                        {initials(application.company)}
                      </span>
                      <span>
                        <Link href={`/applications/${application.id}`}>
                          <strong>{application.company}</strong>
                          <span>{application.role}</span>
                        </Link>
                      </span>
                    </div>
                  </td>
                  <td data-label="Location">
                    <span>{application.location}</span>
                    <small>{application.workplace}</small>
                  </td>
                  <td data-label="Stage">
                    <StageBadge stage={application.stage} />
                  </td>
                  <td data-label="Date applied">{formatDate(application.dateApplied)}</td>
                  <td data-label="Last update">
                    <time dateTime={application.updatedAt}>
                      {formatShortDate(application.updatedAt)}
                    </time>
                  </td>
                  <td data-label="Next action">
                    {application.nextAction ? (
                      <span className="next-action-cell">
                        <strong>{application.nextAction.title}</strong>
                        <small>{formatShortDate(application.nextAction.dueAt)}</small>
                      </span>
                    ) : (
                      <span className="muted">No next action</span>
                    )}
                  </td>
                  <td data-label="Open" className="open-cell">
                    <Link
                      className="row-link"
                      href={`/applications/${application.id}`}
                      aria-label={`Open ${application.company} ${application.role}`}
                    >
                      <ArrowRight aria-hidden="true" size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-state-icon" aria-hidden="true">
            <Search size={22} />
          </span>
          <h2>No applications found</h2>
          <p>Try a different company, role, location, or stage.</p>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setSearch('');
              setStage('all');
            }}
          >
            Show all applications
          </button>
        </div>
      )}
    </div>
  );
}
