import type { Application, ContactRecord, DocumentRecord, TimelineEventKind } from '@wip/domain';
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ContactRound,
  ExternalLink,
  FileText,
  Hash,
  Link2,
  MapPin,
  MessageSquareText,
  NotebookPen,
  Pencil,
} from 'lucide-react';
import Link from 'next/link';

import { formatDate, formatDateTime, initials } from '@/lib/format';

import { StageBadge } from './stage-badge';
import {
  DeleteApplication,
  NextActionsManager,
  NotesManager,
  StageChangeForm,
} from './application-management';
import { ContactsManager, DocumentsManager } from './metadata-management';

const timelineIcons: Record<TimelineEventKind, typeof ClipboardList> = {
  application: ClipboardList,
  assessment: NotebookPen,
  document: FileText,
  employer: MessageSquareText,
  'follow-up': Link2,
  interview: ContactRound,
  offer: CheckCircle2,
  status: BriefcaseBusiness,
};

function sourceHostname(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname;
  } catch {
    return 'Source not provided';
  }
}

export function ApplicationDetail({
  application,
  canManage = false,
  availableContacts = [],
  availableDocuments = [],
  successMessage,
  timeZone = 'UTC',
}: {
  application: Application;
  canManage?: boolean;
  availableContacts?: ContactRecord[];
  availableDocuments?: DocumentRecord[];
  successMessage?: string;
  timeZone?: string;
}) {
  const timeline = [...application.timeline].sort((left, right) => {
    const occurrence = new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime();
    if (occurrence !== 0) return occurrence;
    const creation =
      new Date(left.createdAt ?? left.occurredAt).getTime() -
      new Date(right.createdAt ?? right.occurredAt).getTime();
    return creation || left.id.localeCompare(right.id);
  });

  return (
    <div className="detail-stack">
      <Link className="back-link" href="/applications">
        <ArrowLeft aria-hidden="true" size={17} />
        All applications
      </Link>

      {successMessage && (
        <div className="form-alert form-alert-success" role="status">
          {successMessage}
        </div>
      )}

      <header className="detail-hero">
        <div className="detail-title-row">
          <span className="company-mark company-mark-large" aria-hidden="true">
            {initials(application.company)}
          </span>
          <div>
            <div className="detail-company-line">
              <span>{application.company}</span>
              <StageBadge stage={application.stage} />
            </div>
            <h1>{application.role}</h1>
            <p>
              <MapPin aria-hidden="true" size={16} />
              {[application.location, application.workplace].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="detail-hero-actions">
          {canManage && (
            <Link className="button button-secondary" href={`/applications/${application.id}/edit`}>
              <Pencil aria-hidden="true" size={16} />
              Edit facts
            </Link>
          )}
          {application.sourceUrl && (
            <a
              className="button button-secondary"
              href={application.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              View source
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          )}
        </div>
      </header>

      <div className="detail-layout">
        <div className="detail-main">
          <section className="panel detail-section" aria-labelledby="timeline-heading">
            <div className="panel-heading">
              <span className="panel-icon panel-icon-lilac" aria-hidden="true">
                <ClipboardList size={19} />
              </span>
              <div>
                <p className="section-kicker">Oldest to newest</p>
                <h2 id="timeline-heading">Hiring timeline</h2>
              </div>
              <span className="count-badge">{timeline.length}</span>
            </div>
            <ol className="timeline">
              {timeline.map((timelineEvent, index) => {
                const Icon = timelineIcons[timelineEvent.kind];
                return (
                  <li key={timelineEvent.id}>
                    <span className="timeline-marker" aria-hidden="true">
                      <Icon size={17} />
                    </span>
                    {index < timeline.length - 1 && (
                      <span className="timeline-line" aria-hidden="true" />
                    )}
                    <div className="timeline-content">
                      <div>
                        <h3>{timelineEvent.title}</h3>
                        <time dateTime={timelineEvent.occurredAt}>
                          Effective {formatDateTime(timelineEvent.occurredAt, timeZone)}
                        </time>
                        {timelineEvent.createdAt && (
                          <small>
                            Recorded {formatDateTime(timelineEvent.createdAt, timeZone)}
                          </small>
                        )}
                      </div>
                      {timelineEvent.details && <p>{timelineEvent.details}</p>}
                      <span className="source-label">
                        {timelineEvent.source}
                        {timelineEvent.confirmationState
                          ? ` · ${timelineEvent.confirmationState.replace('_', ' ')}`
                          : ''}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          <section className="panel detail-section" aria-labelledby="snapshot-heading">
            <div className="panel-heading panel-heading-spread">
              <span className="panel-icon panel-icon-blue" aria-hidden="true">
                <FileText size={19} />
              </span>
              <div>
                <p className="section-kicker">Saved evidence</p>
                <h2 id="snapshot-heading">Job-description snapshot</h2>
              </div>
              <span className="snapshot-state">
                {application.snapshot ? 'Semantic snapshot' : 'Not saved'}
              </span>
            </div>
            {application.snapshot ? (
              <>
                <dl className="snapshot-metadata">
                  <div>
                    <dt>Captured</dt>
                    <dd>{formatDateTime(application.snapshot.capturedAt, timeZone)}</dd>
                  </div>
                  <div>
                    <dt>Provenance</dt>
                    <dd>{application.snapshot.provenance}</dd>
                  </div>
                  <div>
                    <dt>Extractor</dt>
                    <dd>{application.snapshot.extractorVersion}</dd>
                  </div>
                  <div>
                    <dt>Content hash</dt>
                    <dd title={application.snapshot.contentHash}>
                      {application.snapshot.contentHash.slice(0, 22)}…
                    </dd>
                  </div>
                </dl>
                <article
                  className="snapshot-content"
                  dangerouslySetInnerHTML={{ __html: application.snapshot.html }}
                />
              </>
            ) : (
              <div className="section-empty">
                <p>No job-description snapshot was saved when this application was added.</p>
              </div>
            )}
          </section>

          <div className="two-column-detail">
            <section className="panel detail-section" aria-labelledby="documents-heading">
              <div className="panel-heading">
                <span className="panel-icon panel-icon-green" aria-hidden="true">
                  <FileText size={19} />
                </span>
                <div>
                  <p className="section-kicker">Metadata only</p>
                  <h2 id="documents-heading">Documents used</h2>
                </div>
              </div>
              {canManage ? (
                <DocumentsManager
                  application={application}
                  availableDocuments={availableDocuments}
                />
              ) : (
                <div className="document-list">
                  {application.documents.map((document) => (
                    <div className="document-card" key={`${document.kind}-${document.version}`}>
                      <div>
                        <span>{document.kind}</span>
                        <strong>{document.label}</strong>
                        <small>{document.filename}</small>
                      </div>
                      <span className="version-chip">{document.version}</span>
                    </div>
                  ))}
                  {application.documents.length === 0 && (
                    <p className="muted">No document metadata linked yet.</p>
                  )}
                </div>
              )}
            </section>

            <section className="panel detail-section" aria-labelledby="contacts-heading">
              <div className="panel-heading">
                <span className="panel-icon panel-icon-coral" aria-hidden="true">
                  <ContactRound size={19} />
                </span>
                <div>
                  <p className="section-kicker">People in the process</p>
                  <h2 id="contacts-heading">Contacts</h2>
                </div>
              </div>
              {canManage ? (
                <ContactsManager application={application} availableContacts={availableContacts} />
              ) : (
                <div className="contact-list">
                  {application.contacts.map((contact) => (
                    <div className="contact-card" key={contact.id}>
                      <span className="contact-avatar" aria-hidden="true">
                        {initials(contact.name)}
                      </span>
                      <div>
                        <strong>{contact.name}</strong>
                        <span>{contact.relationship}</span>
                        {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
                      </div>
                    </div>
                  ))}
                  {application.contacts.length === 0 && (
                    <p className="muted">No contacts linked yet.</p>
                  )}
                </div>
              )}
            </section>
          </div>

          <section className="panel detail-section" aria-labelledby="notes-heading">
            <div className="panel-heading">
              <span className="panel-icon panel-icon-yellow" aria-hidden="true">
                <MessageSquareText size={19} />
              </span>
              <div>
                <p className="section-kicker">Private context</p>
                <h2 id="notes-heading">Notes</h2>
              </div>
            </div>
            {canManage ? (
              <NotesManager application={application} timeZone={timeZone} />
            ) : (
              <div className="notes-list">
                {application.notes.map((note) => (
                  <blockquote key={note.id}>
                    <p>{note.body}</p>
                    <footer>Added {formatDate(note.createdAt, timeZone)}</footer>
                  </blockquote>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="detail-sidebar" aria-label="Application summary and next action">
          {canManage ? (
            <NextActionsManager application={application} timeZone={timeZone} />
          ) : (
            <section className="next-action-card">
              <div className="next-action-icon" aria-hidden="true">
                <CalendarClock size={21} />
              </div>
              <p className="section-kicker">Next action</p>
              {application.nextAction ? (
                <>
                  <h2>{application.nextAction.title}</h2>
                  <time dateTime={application.nextAction.dueAt}>
                    {formatDateTime(application.nextAction.dueAt, timeZone)}
                  </time>
                  {application.nextAction.details && <p>{application.nextAction.details}</p>}
                  <span className="prototype-action">Read-only fictional demo</span>
                </>
              ) : (
                <>
                  <h2>No next action</h2>
                  <p>This application has reached a terminal outcome.</p>
                </>
              )}
            </section>
          )}

          {canManage && <StageChangeForm application={application} />}

          <section className="panel facts-card" aria-labelledby="facts-heading">
            <h2 id="facts-heading">Application facts</h2>
            <dl>
              <div>
                <dt>
                  <Hash aria-hidden="true" size={15} /> Requisition
                </dt>
                <dd>{application.requisitionId || 'Not provided'}</dd>
              </div>
              <div>
                <dt>
                  <MapPin aria-hidden="true" size={15} /> Location
                </dt>
                <dd>{application.location || 'Not provided'}</dd>
              </div>
              <div>
                <dt>
                  <BriefcaseBusiness aria-hidden="true" size={15} /> Workplace
                </dt>
                <dd>{application.workplace}</dd>
              </div>
              <div>
                <dt>
                  <CalendarClock aria-hidden="true" size={15} /> Applied
                </dt>
                <dd>
                  {application.dateApplied
                    ? formatDate(application.dateApplied, timeZone)
                    : 'Not yet'}
                </dd>
              </div>
              <div>
                <dt>
                  <Link2 aria-hidden="true" size={15} /> Source
                </dt>
                <dd>
                  {application.sourceUrl ? (
                    <a href={application.sourceUrl} target="_blank" rel="noreferrer">
                      {sourceHostname(application.sourceUrl)}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
      {canManage && <DeleteApplication application={application} />}
    </div>
  );
}
