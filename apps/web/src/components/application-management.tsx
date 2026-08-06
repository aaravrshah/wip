'use client';

import { applicationStages, stageLabels, type Application, type NextAction } from '@wip/domain';
import { Check, Plus, RefreshCw, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';

import { apiMutation, ApiResponseError, createIdempotencyKey } from '@/api/client';
import { formatDate, formatDateTime } from '@/lib/format';

function localDateTime(value = new Date()): string {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function toInputDateTime(value: string): string {
  return localDateTime(new Date(value));
}

function message(error: unknown): string {
  return error instanceof ApiResponseError ? error.message : 'Wip could not save that change.';
}

export function StageChangeForm({ application }: { application: Application }) {
  const router = useRouter();
  const key = useRef(createIdempotencyKey('stage-event'));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus(undefined);
    const form = new FormData(event.currentTarget);
    try {
      const updated = await apiMutation<Application>({
        url: `/api/v1/applications/${application.id}/events`,
        method: 'POST',
        idempotencyKey: key.current,
        body: {
          stage: String(form.get('stage')),
          effectiveAt: new Date(String(form.get('effectiveAt'))).toISOString(),
        },
      });
      key.current = createIdempotencyKey('stage-event');
      setStatus(`Stage event recorded. Current projection: ${stageLabels[updated!.stage]}.`);
      router.refresh();
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel management-card" aria-labelledby="stage-change-heading">
      <h2 id="stage-change-heading">Record a stage change</h2>
      <p>Wip appends an event. Earlier timeline history is never rewritten.</p>
      <form onSubmit={submit} className="compact-form">
        <label>
          <span>Stage</span>
          <select name="stage" defaultValue={application.stage}>
            {applicationStages.map((stage) => (
              <option key={stage} value={stage}>
                {stageLabels[stage]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Effective date and time</span>
          <input name="effectiveAt" type="datetime-local" required defaultValue={localDateTime()} />
        </label>
        <button className="button button-primary button-compact" type="submit" disabled={busy}>
          <RefreshCw aria-hidden="true" size={15} />
          {busy ? 'Recording…' : 'Record event'}
        </button>
      </form>
      {status && (
        <p className="form-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </section>
  );
}

export function NotesManager({
  application,
  timeZone = 'UTC',
}: {
  application: Application;
  timeZone?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string>();
  const [status, setStatus] = useState<string>();

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get('body') ?? '').trim();
    if (!body) return;
    setBusy('new');
    try {
      await apiMutation({
        url: `/api/v1/applications/${application.id}/notes`,
        method: 'POST',
        body: { body },
      });
      form.reset();
      setStatus('Note added.');
      router.refresh();
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(undefined);
    }
  }

  async function update(noteId: string, version: number, body: string) {
    setBusy(noteId);
    try {
      await apiMutation({
        url: `/api/v1/applications/${application.id}/notes/${noteId}`,
        method: 'PATCH',
        body: { body, expectedVersion: version },
      });
      setStatus('Note updated.');
      router.refresh();
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(undefined);
    }
  }

  async function remove(noteId: string) {
    setBusy(noteId);
    try {
      await apiMutation({
        url: `/api/v1/applications/${application.id}/notes/${noteId}`,
        method: 'DELETE',
      });
      setStatus('Note removed.');
      router.refresh();
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="notes-manager">
      <p className="privacy-hint">
        Notes are editable private context, not timeline events. Don’t enter EEO, disability,
        veteran-status, Social Security number, or birthdate data.
      </p>
      <form className="note-compose" onSubmit={add}>
        <label>
          <span>Add a note</span>
          <textarea name="body" rows={4} maxLength={10000} required />
        </label>
        <button
          className="button button-secondary button-compact"
          type="submit"
          disabled={busy === 'new'}
        >
          <Plus aria-hidden="true" size={15} />
          {busy === 'new' ? 'Adding…' : 'Add note'}
        </button>
      </form>
      <div className="editable-list">
        {application.notes.map((note) => (
          <form
            key={note.id}
            className="editable-card"
            onSubmit={(event) => {
              event.preventDefault();
              void update(
                note.id,
                note.version ?? 1,
                String(new FormData(event.currentTarget).get('body') ?? ''),
              );
            }}
          >
            <label>
              <span className="sr-only">Note added {formatDate(note.createdAt, timeZone)}</span>
              <textarea name="body" rows={3} maxLength={10000} defaultValue={note.body} required />
            </label>
            <div className="editable-card-footer">
              <small>Added {formatDate(note.createdAt, timeZone)}</small>
              <span>
                <button className="text-button" type="submit" disabled={busy === note.id}>
                  <Save aria-hidden="true" size={14} />
                  Save
                </button>
                <button
                  className="text-button danger-text"
                  type="button"
                  disabled={busy === note.id}
                  onClick={() => void remove(note.id)}
                >
                  <Trash2 aria-hidden="true" size={14} />
                  Remove
                </button>
              </span>
            </div>
          </form>
        ))}
        {application.notes.length === 0 && <p className="muted">No private notes yet.</p>}
      </div>
      {status && (
        <p className="form-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}

function ActionEditor({
  action,
  busy,
  onSave,
  onRemove,
  timeZone,
}: {
  action: NextAction;
  busy: boolean;
  onSave(command: Record<string, unknown>): void;
  onRemove(): void;
  timeZone: string;
}) {
  return (
    <form
      className="editable-card action-editor"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSave({
          expectedVersion: action.version ?? 1,
          kind: String(form.get('kind')),
          title: String(form.get('title')),
          details: String(form.get('details') ?? '') || undefined,
          dueAt: new Date(String(form.get('dueAt'))).toISOString(),
          state: action.state ?? 'open',
        });
      }}
    >
      <label>
        <span>Action</span>
        <input name="title" maxLength={200} defaultValue={action.title} required />
      </label>
      <div className="form-grid form-grid-two">
        <label>
          <span>Kind</span>
          <select name="kind" defaultValue={action.kind.replace('-', '_')}>
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
          <input
            name="dueAt"
            type="datetime-local"
            defaultValue={toInputDateTime(action.dueAt)}
            required
          />
        </label>
      </div>
      <label>
        <span>Details</span>
        <textarea name="details" rows={2} maxLength={5000} defaultValue={action.details} />
      </label>
      <div className="editable-card-footer">
        <small>
          {action.state === 'completed'
            ? `Completed ${formatDate(action.completedAt, timeZone)}`
            : `Due ${formatDateTime(action.dueAt, timeZone)}`}
        </small>
        <span>
          {action.state !== 'completed' && (
            <button
              className="text-button"
              type="button"
              disabled={busy}
              onClick={(event) => {
                const form = event.currentTarget.form!;
                const data = new FormData(form);
                onSave({
                  expectedVersion: action.version ?? 1,
                  kind: String(data.get('kind')),
                  title: String(data.get('title')),
                  details: String(data.get('details') ?? '') || undefined,
                  dueAt: new Date(String(data.get('dueAt'))).toISOString(),
                  state: 'completed',
                });
              }}
            >
              <Check aria-hidden="true" size={14} />
              Complete
            </button>
          )}
          <button className="text-button" type="submit" disabled={busy}>
            <Save aria-hidden="true" size={14} />
            Save
          </button>
          <button
            className="text-button danger-text"
            type="button"
            disabled={busy}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" size={14} />
            Remove
          </button>
        </span>
      </div>
    </form>
  );
}

export function NextActionsManager({
  application,
  timeZone = 'UTC',
}: {
  application: Application;
  timeZone?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string>();
  const [status, setStatus] = useState<string>();
  const actions =
    application.nextActions ?? (application.nextAction ? [application.nextAction] : []);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy('new');
    try {
      await apiMutation({
        url: `/api/v1/applications/${application.id}/actions`,
        method: 'POST',
        body: {
          kind: String(data.get('kind')),
          title: String(data.get('title')),
          details: String(data.get('details') ?? '') || undefined,
          dueAt: new Date(String(data.get('dueAt'))).toISOString(),
        },
      });
      form.reset();
      setStatus('Next action added.');
      router.refresh();
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(undefined);
    }
  }

  async function save(actionId: string, command: Record<string, unknown>) {
    setBusy(actionId);
    try {
      await apiMutation({
        url: `/api/v1/applications/${application.id}/actions/${actionId}`,
        method: 'PATCH',
        body: command,
      });
      setStatus(command.state === 'completed' ? 'Next action completed.' : 'Next action updated.');
      router.refresh();
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(undefined);
    }
  }

  async function remove(actionId: string) {
    setBusy(actionId);
    try {
      await apiMutation({
        url: `/api/v1/applications/${application.id}/actions/${actionId}`,
        method: 'DELETE',
      });
      setStatus('Next action removed.');
      router.refresh();
    } catch (error) {
      setStatus(message(error));
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <section className="panel management-card" aria-labelledby="actions-heading">
      <h2 id="actions-heading">Next actions</h2>
      <p>Open actions appear on Today. Completed actions remain here for context.</p>
      <form className="compact-form action-compose" onSubmit={add}>
        <label>
          <span>Action</span>
          <input name="title" maxLength={200} required />
        </label>
        <div className="form-grid form-grid-two">
          <label>
            <span>Kind</span>
            <select name="kind" defaultValue="follow_up">
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
            <input name="dueAt" type="datetime-local" required />
          </label>
        </div>
        <label>
          <span>Details</span>
          <textarea name="details" rows={2} maxLength={5000} />
        </label>
        <button
          className="button button-secondary button-compact"
          type="submit"
          disabled={busy === 'new'}
        >
          <Plus aria-hidden="true" size={15} />
          {busy === 'new' ? 'Adding…' : 'Add action'}
        </button>
      </form>
      <div className="editable-list">
        {actions.map((action) => (
          <ActionEditor
            key={action.id}
            action={action}
            busy={busy === action.id}
            onSave={(command) => void save(action.id, command)}
            onRemove={() => void remove(action.id)}
            timeZone={timeZone}
          />
        ))}
        {actions.length === 0 && <p className="muted">No next actions yet.</p>}
      </div>
      {status && (
        <p className="form-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </section>
  );
}

export function DeleteApplication({ application }: { application: Application }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const matches =
    confirmation.trim() === application.company || confirmation.trim() === application.role;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches || busy) return;
    setBusy(true);
    try {
      await apiMutation({
        url: `/api/v1/applications/${application.id}`,
        method: 'DELETE',
        body: { confirmation: confirmation.trim() },
      });
      router.push('/applications?deleted=1');
      router.refresh();
    } catch (error) {
      setStatus(message(error));
      setBusy(false);
    }
  }

  return (
    <section className="danger-zone" aria-labelledby="delete-heading">
      <h2 id="delete-heading">Permanently delete application</h2>
      <p>
        This immediately removes the application, timeline, snapshots, notes, and actions. Wip has
        no recovery UI; provider backups may retain deleted bytes until their disclosed retention
        period expires.
      </p>
      <form onSubmit={submit} className="compact-form">
        <label>
          <span>
            Type <strong>{application.company}</strong> or <strong>{application.role}</strong> to
            confirm
          </span>
          <input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
          />
        </label>
        <button className="button button-danger" type="submit" disabled={!matches || busy}>
          <Trash2 aria-hidden="true" size={16} />
          {busy ? 'Deleting…' : 'Delete permanently'}
        </button>
      </form>
      {status && (
        <p className="form-status" role="alert">
          {status}
        </p>
      )}
    </section>
  );
}
