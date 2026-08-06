'use client';

import { applicationStages, stageLabels, type Application } from '@wip/domain';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

import { apiMutation, ApiResponseError, createIdempotencyKey } from '@/api/client';

type WorkplaceValue = 'hybrid' | 'on_site' | 'remote' | 'unspecified';

function workplaceValue(application?: Application): WorkplaceValue {
  if (application?.workplace === 'Hybrid') return 'hybrid';
  if (application?.workplace === 'On-site') return 'on_site';
  if (application?.workplace === 'Remote') return 'remote';
  return 'unspecified';
}

function localDateToIso(value: string): string | undefined {
  return value ? new Date(`${value}T12:00:00`).toISOString() : undefined;
}

function localDateTimeToIso(value: string): string | undefined {
  return value ? new Date(value).toISOString() : undefined;
}

export function ApplicationForm({
  mode,
  application,
}: {
  mode: 'create' | 'edit';
  application?: Application;
}) {
  const router = useRouter();
  const idempotencyKey = useRef(createIdempotencyKey('application-create'));
  const submissionInFlight = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiResponseError | undefined>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionInFlight.current) return;
    submissionInFlight.current = true;
    setSubmitting(true);
    setError(undefined);

    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? '').trim();
    const base = {
      company: value('company'),
      role: value('role'),
      sourceUrl: value('sourceUrl') || undefined,
      sourceName: value('sourceName') || undefined,
      location: value('location') || undefined,
      workplace: value('workplace') as WorkplaceValue,
      requisitionId: value('requisitionId') || undefined,
    };

    try {
      let saved: Application | undefined;
      if (mode === 'create') {
        const actionTitle = value('nextActionTitle');
        const actionDueAt = localDateTimeToIso(value('nextActionDueAt'));
        if ((actionTitle && !actionDueAt) || (!actionTitle && actionDueAt)) {
          throw new ApiResponseError(
            'Add both a next-action title and due date, or leave both blank.',
            'validation_error',
            400,
          );
        }
        saved = await apiMutation<Application>({
          url: '/api/v1/applications',
          method: 'POST',
          idempotencyKey: idempotencyKey.current,
          body: {
            ...base,
            stage: value('stage'),
            appliedAt: localDateToIso(value('appliedAt')),
            jobDescriptionText: value('jobDescriptionText') || undefined,
            ...(actionTitle && actionDueAt
              ? {
                  nextAction: {
                    kind: value('nextActionKind'),
                    title: actionTitle,
                    dueAt: actionDueAt,
                  },
                }
              : {}),
          },
        });
      } else {
        saved = await apiMutation<Application>({
          url: `/api/v1/applications/${application!.id}`,
          method: 'PATCH',
          body: { ...base, expectedVersion: application!.version ?? 1 },
        });
      }

      if (!saved) throw new Error('The API returned no application.');
      router.push(`/applications/${saved.id}?${mode === 'create' ? 'created' : 'updated'}=1`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiResponseError
          ? caught
          : new ApiResponseError('Wip could not save this application.', 'unknown_error', 500),
      );
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="form-page-stack">
      <Link
        className="back-link"
        href={application ? `/applications/${application.id}` : '/applications'}
      >
        <ArrowLeft aria-hidden="true" size={17} />
        {application ? 'Back to application' : 'All applications'}
      </Link>
      <header className="form-page-heading">
        <p className="eyebrow">
          {mode === 'create' ? 'Start a clear record' : 'Application facts'}
        </p>
        <h1>{mode === 'create' ? 'Add an application' : 'Edit application'}</h1>
        <p>
          {mode === 'create'
            ? 'Company and role are enough to begin. Everything else can be filled in when you know it.'
            : 'Stage and timeline history are managed separately so editing facts never rewrites what happened.'}
        </p>
      </header>

      <form className="application-form panel" onSubmit={submit}>
        {error && (
          <div className="form-alert form-alert-error" role="alert">
            <strong>Couldn’t save the application</strong>
            <p>{error.message}</p>
            {error.fields && (
              <ul>
                {Object.entries(error.fields).flatMap(([field, messages]) =>
                  messages.map((message) => <li key={`${field}-${message}`}>{message}</li>),
                )}
              </ul>
            )}
          </div>
        )}

        <fieldset>
          <legend>Role</legend>
          <div className="form-grid form-grid-two">
            <label>
              <span>
                Company <strong aria-hidden="true">*</strong>
              </span>
              <input name="company" required maxLength={120} defaultValue={application?.company} />
            </label>
            <label>
              <span>
                Role or title <strong aria-hidden="true">*</strong>
              </span>
              <input name="role" required maxLength={160} defaultValue={application?.role} />
            </label>
            {mode === 'create' && (
              <label>
                <span>Current stage</span>
                <select name="stage" defaultValue="saved">
                  {applicationStages.map((stage) => (
                    <option key={stage} value={stage}>
                      {stageLabels[stage]}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {mode === 'create' && (
              <label>
                <span>Date applied</span>
                <input name="appliedAt" type="date" />
              </label>
            )}
          </div>
        </fieldset>

        <fieldset>
          <legend>Location and source</legend>
          <div className="form-grid form-grid-two">
            <label>
              <span>Location</span>
              <input name="location" maxLength={160} defaultValue={application?.location} />
            </label>
            <label>
              <span>Work arrangement</span>
              <select name="workplace" defaultValue={workplaceValue(application)}>
                <option value="unspecified">Not specified</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on_site">On-site</option>
              </select>
            </label>
            <label>
              <span>Source URL</span>
              <input
                name="sourceUrl"
                type="url"
                maxLength={2048}
                defaultValue={application?.sourceUrl}
                placeholder="https://…"
              />
            </label>
            <label>
              <span>Source name</span>
              <input
                name="sourceName"
                maxLength={120}
                defaultValue={application?.sourceName}
                placeholder="Employer site, referral…"
              />
            </label>
            <label>
              <span>Requisition ID</span>
              <input
                name="requisitionId"
                maxLength={120}
                defaultValue={application?.requisitionId}
              />
            </label>
          </div>
        </fieldset>

        {mode === 'create' && (
          <fieldset>
            <legend>Optional next action</legend>
            <div className="form-grid form-grid-three">
              <label>
                <span>Action</span>
                <input
                  name="nextActionTitle"
                  maxLength={200}
                  placeholder="Follow up with recruiter"
                />
              </label>
              <label>
                <span>Kind</span>
                <select name="nextActionKind" defaultValue="follow_up">
                  <option value="follow_up">Follow-up</option>
                  <option value="assessment">Assessment</option>
                  <option value="interview">Interview</option>
                  <option value="prepare">Prepare</option>
                  <option value="decision">Decision</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                <span>Due</span>
                <input name="nextActionDueAt" type="datetime-local" />
              </label>
            </div>
          </fieldset>
        )}

        {mode === 'create' && (
          <fieldset>
            <legend>Optional job-description snapshot</legend>
            <label>
              <span>Pasted job-description text</span>
              <textarea name="jobDescriptionText" maxLength={200000} rows={12} />
              <small>
                Paste employer-authored job content only. Wip normalizes it, escapes markup, and
                saves an immutable semantic snapshot.
              </small>
            </label>
          </fieldset>
        )}

        <div className="form-actions">
          <Link
            className="button button-secondary"
            href={application ? `/applications/${application.id}` : '/applications'}
          >
            Cancel
          </Link>
          <button className="button button-primary" type="submit" disabled={submitting}>
            <Save aria-hidden="true" size={17} />
            {submitting ? 'Saving…' : mode === 'create' ? 'Add application' : 'Save facts'}
          </button>
        </div>
      </form>
    </div>
  );
}
