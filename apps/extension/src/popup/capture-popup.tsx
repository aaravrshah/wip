import { SignInButton, useAuth } from '@clerk/chrome-extension';
import { applicationStages, stageLabels, type ApplicationStage } from '@wip/domain';
import type { ExtensionCaptureCommand, ExtensionCaptureResponse } from '@wip/schemas';
import { useEffect, useMemo, useRef, useState } from 'react';

import { saveCapture } from '../api/capture-client';
import type { ExtensionConfig } from '../config';
import { captureActiveTab } from '../extraction/capture-active-tab';
import type { ExtractionDraft, ExtractionResult } from '../extraction/types';
import {
  clearCaptureDraft,
  loadCaptureDraft,
  saveCaptureDraft,
  type StoredCaptureDraft,
} from '../storage/capture-draft';

export interface PopupServices {
  extract(): Promise<ExtractionResult>;
  loadDraft(): Promise<StoredCaptureDraft | undefined>;
  saveDraft(value: StoredCaptureDraft): Promise<void>;
  clearDraft(): Promise<void>;
  save(input: Parameters<typeof saveCapture>[0]): ReturnType<typeof saveCapture>;
  open(url: string): Promise<void>;
}

const defaultServices: PopupServices = {
  extract: captureActiveTab,
  loadDraft: loadCaptureDraft,
  saveDraft: saveCaptureDraft,
  clearDraft: clearCaptureDraft,
  save: saveCapture,
  async open(url) {
    await chrome.tabs.create({ url });
  },
};

type ViewState =
  | { name: 'loading' }
  | { name: 'review' }
  | { name: 'unsupported'; reason: string; sourceUrl?: string }
  | { name: 'saving' }
  | { name: 'saved'; result: ExtensionCaptureResponse }
  | { name: 'cancelled' };

function confidenceHint(draft: ExtractionDraft, field: keyof ExtractionDraft['fieldEvidence']) {
  const value = draft.fieldEvidence[field];
  if (!value) return 'Not detected';
  return `${value.confidence} confidence · ${value.source.replace('_', ' ')}`;
}

function cleanOptional(value: string): string | undefined {
  return value.trim() || undefined;
}

export function CapturePopup({
  config,
  services = defaultServices,
}: {
  config: ExtensionConfig;
  services?: PopupServices;
}) {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [view, setView] = useState<ViewState>({ name: 'loading' });
  const [draft, setDraft] = useState<ExtractionDraft>();
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [error, setError] = useState<string>();
  const statusHeading = useRef<HTMLHeadingElement>(null);

  const initialize = async (forceExtract = false) => {
    setView({ name: 'loading' });
    setError(undefined);
    const stored = forceExtract ? undefined : await services.loadDraft();
    if (stored) {
      setDraft(stored.draft);
      setIdempotencyKey(stored.idempotencyKey);
      setView({ name: 'review' });
      return;
    }

    const extraction = await services.extract();
    if (extraction.status === 'unsupported') {
      setView({
        name: 'unsupported',
        reason: extraction.reason,
        ...(extraction.sourceUrl ? { sourceUrl: extraction.sourceUrl } : {}),
      });
      return;
    }
    const storedDraft = {
      draft: extraction.draft,
      idempotencyKey: `extension-capture:${crypto.randomUUID()}`,
    };
    await services.saveDraft(storedDraft);
    setDraft(storedDraft.draft);
    setIdempotencyKey(storedDraft.idempotencyKey);
    setView({ name: 'review' });
  };

  useEffect(() => {
    void initialize();
  }, []);

  useEffect(() => {
    if (['unsupported', 'saved'].includes(view.name) || error) statusHeading.current?.focus();
  }, [error, view]);

  const canSave = Boolean(
    draft?.company?.trim() &&
    draft.role?.trim() &&
    draft.descriptionText.trim() &&
    isLoaded &&
    isSignedIn &&
    view.name === 'review',
  );

  const authStatus = useMemo(() => {
    if (!isLoaded) return 'Checking your Wip session…';
    return isSignedIn ? 'Signed in to Wip' : 'Sign in before saving';
  }, [isLoaded, isSignedIn]);

  const update = <Key extends keyof ExtractionDraft>(field: Key, value: ExtractionDraft[Key]) => {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  };

  const persistReviewedDraft = async (current: ExtractionDraft) => {
    setDraft(current);
    await services.saveDraft({ draft: current, idempotencyKey });
  };

  const submit = async () => {
    if (!draft || !isSignedIn) return;
    setError(undefined);
    setView({ name: 'saving' });
    await persistReviewedDraft(draft);

    try {
      const token = await getToken({ skipCache: true });
      if (!token) throw new Error('Sign in to Wip before saving this job.');
      const command: ExtensionCaptureCommand = {
        company: draft.company?.trim() ?? '',
        role: draft.role?.trim() ?? '',
        stage: draft.stage ?? 'saved',
        sourceUrl: draft.sourceUrl,
        canonicalUrl: draft.canonicalUrl,
        pageTitle: draft.pageTitle,
        location: cleanOptional(draft.location ?? ''),
        workplace: draft.workplace,
        employmentType: cleanOptional(draft.employmentType ?? ''),
        salaryText: cleanOptional(draft.salaryText ?? ''),
        requisitionId: cleanOptional(draft.requisitionId ?? ''),
        descriptionHtml: draft.descriptionHtml,
        descriptionText: draft.descriptionText,
        extraction: {
          extractorVersion: draft.extractorVersion,
          selectedSource: draft.selectedSource,
          fieldEvidence: draft.fieldEvidence,
          warnings: draft.warnings,
        },
      };
      const result = await services.save({
        apiOrigin: config.apiOrigin,
        command,
        idempotencyKey,
        token,
      });
      await services.clearDraft();
      setView({ name: 'saved', result });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Wip could not save this job.');
      setView({ name: 'review' });
    }
  };

  const cancel = async () => {
    await services.clearDraft();
    setDraft(undefined);
    setError(undefined);
    setView({ name: 'cancelled' });
  };

  return (
    <main className="popup-shell">
      <header className="popup-header">
        <span className="wordmark">Wip</span>
        <span className={`auth-chip ${isSignedIn ? 'is-signed-in' : ''}`}>{authStatus}</span>
      </header>

      {view.name === 'loading' && (
        <section className="center-state" aria-live="polite">
          <span className="spinner" aria-hidden="true" />
          <h1>Reading this job page…</h1>
          <p>Nothing is sent until you review and choose Save.</p>
        </section>
      )}

      {view.name === 'unsupported' && (
        <section className="center-state">
          <h1 ref={statusHeading} tabIndex={-1}>
            This page needs a little help
          </h1>
          <p>{view.reason}</p>
          {view.sourceUrl && <p className="source-url">{view.sourceUrl}</p>}
          <button className="primary-button" type="button" onClick={() => void initialize(true)}>
            Try this page again
          </button>
          <button
            className="text-button"
            type="button"
            onClick={() => void services.open(`${config.apiOrigin}/applications/new`)}
          >
            Add manually in Wip
          </button>
        </section>
      )}

      {view.name === 'cancelled' && (
        <section className="center-state">
          <h1>Capture cleared</h1>
          <p>The temporary page content was removed from extension storage.</p>
          <button className="primary-button" type="button" onClick={() => void initialize(true)}>
            Extract current page
          </button>
        </section>
      )}

      {(view.name === 'review' || view.name === 'saving') && draft && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <section className="intro">
            <p className="eyebrow">Review before saving</p>
            <h1>Does this look right?</h1>
            <p>You control every field. Wip will sanitize and hash the description again.</p>
          </section>

          {draft.warnings.length > 0 && (
            <aside className="warning-card" aria-label="Extraction warnings">
              <strong>Worth checking</strong>
              <ul>
                {draft.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </aside>
          )}

          {error && (
            <div className="error-card" role="alert">
              <h2 ref={statusHeading} tabIndex={-1}>
                Couldn’t save yet
              </h2>
              <p>{error}</p>
            </div>
          )}
          <div className="field-grid">
            <label>
              Role <span aria-hidden="true">*</span>
              <input
                required
                value={draft.role ?? ''}
                onChange={(event) => update('role', event.target.value)}
              />
              <small>{confidenceHint(draft, 'role')}</small>
            </label>
            <label>
              Company <span aria-hidden="true">*</span>
              <input
                required
                value={draft.company ?? ''}
                onChange={(event) => update('company', event.target.value)}
              />
              <small>{confidenceHint(draft, 'company')}</small>
            </label>
            <label>
              Location <span className="optional">Optional</span>
              <input
                value={draft.location ?? ''}
                onChange={(event) => update('location', event.target.value)}
              />
              <small>{confidenceHint(draft, 'location')}</small>
            </label>
            <label>
              Stage
              <select
                value={draft.stage}
                onChange={(event) => update('stage', event.target.value as ApplicationStage)}
              >
                {applicationStages.map((stage) => (
                  <option key={stage} value={stage}>
                    {stageLabels[stage]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Workplace
              <select
                value={draft.workplace}
                onChange={(event) =>
                  update('workplace', event.target.value as ExtractionDraft['workplace'])
                }
              >
                <option value="unspecified">Not specified</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on_site">On-site</option>
              </select>
            </label>
            <label>
              Requisition ID <span className="optional">Optional</span>
              <input
                value={draft.requisitionId ?? ''}
                onChange={(event) => update('requisitionId', event.target.value)}
              />
            </label>
            <label>
              Employment type <span className="optional">Optional</span>
              <input
                value={draft.employmentType ?? ''}
                onChange={(event) => update('employmentType', event.target.value)}
              />
            </label>
            <label>
              Salary text <span className="optional">Optional</span>
              <input
                value={draft.salaryText ?? ''}
                onChange={(event) => update('salaryText', event.target.value)}
              />
            </label>
          </div>

          <section className="source-card" aria-labelledby="source-heading">
            <h2 id="source-heading">Exact source URL</h2>
            <p>{draft.sourceUrl}</p>
          </section>

          <details className="description-preview" open>
            <summary>Job-description preview</summary>
            <p className="preview-meta">{confidenceHint(draft, 'description')}</p>
            <pre>{draft.descriptionText}</pre>
          </details>

          {!isLoaded || !isSignedIn ? (
            <section className="signed-out-card" aria-label="Sign in to save">
              <h2>Sign in to save</h2>
              <p>
                Your reviewed draft stays only in this browser session. Native extension sign-in
                does not give Wip access to employer cookies.
              </p>
              <SignInButton mode="modal">
                <button className="primary-button" type="button">
                  Sign in securely
                </button>
              </SignInButton>
              <button
                className="text-button"
                type="button"
                onClick={() => void services.open(config.webSignInUrl)}
              >
                Open Wip web sign-in
              </button>
            </section>
          ) : null}

          <footer className="action-row">
            <button
              className="secondary-button"
              type="button"
              onClick={() => void cancel()}
              disabled={view.name === 'saving'}
            >
              Cancel and clear
            </button>
            <button
              className="primary-button"
              type="submit"
              disabled={!canSave || view.name === 'saving'}
            >
              {view.name === 'saving' ? 'Saving…' : 'Save to Wip'}
            </button>
          </footer>
        </form>
      )}

      {view.name === 'saved' && (
        <section className="center-state success-state">
          <span className="success-mark" aria-hidden="true">
            ✓
          </span>
          <h1 ref={statusHeading} tabIndex={-1}>
            {view.result.status === 'duplicate' ? 'Already in Wip' : 'Saved to Wip'}
          </h1>
          <p>
            {view.result.application.role} at {view.result.application.company}
          </p>
          {view.result.status === 'duplicate' && (
            <p>
              Wip found the same source URL or requisition ID and did not create another
              application.
            </p>
          )}
          <button
            className="primary-button"
            type="button"
            onClick={() => void services.open(`${config.apiOrigin}${view.result.application.path}`)}
          >
            Open application
          </button>
        </section>
      )}
    </main>
  );
}
