'use client';

import type {
  Application,
  Contact,
  ContactRecord,
  DocumentRecord,
  DocumentVersion,
} from '@wip/domain';
import { Link2, Plus, Save, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState, type FormEvent } from 'react';

import { apiMutation, ApiResponseError } from '@/api/client';

const relationshipLabels = {
  recruiter: 'Recruiter',
  referrer: 'Referrer',
  interviewer: 'Interviewer',
  hiring_manager: 'Hiring manager',
  other: 'Other',
} as const;

const documentKindOptions = [
  ['resume', 'Resume'],
  ['cover_letter', 'Cover letter'],
  ['portfolio', 'Portfolio'],
  ['other', 'Other'],
] as const;

function documentKindValue(kind: DocumentVersion['kind'] | DocumentRecord['kind']) {
  return kind === 'Cover letter' ? 'cover_letter' : kind.toLocaleLowerCase();
}

function statusMessage(error: unknown): string {
  return error instanceof ApiResponseError ? error.message : 'Wip could not save that change.';
}

function optionalIso(value: FormDataEntryValue | null): string | undefined {
  const text = String(value ?? '').trim();
  return text ? new Date(text).toISOString() : undefined;
}

function contactCommand(form: FormData) {
  return {
    name: String(form.get('name') ?? ''),
    relationship: String(form.get('relationship') ?? 'other'),
    organization: String(form.get('organization') ?? '') || undefined,
    roleTitle: String(form.get('roleTitle') ?? '') || undefined,
    email: String(form.get('email') ?? '') || undefined,
    phone: String(form.get('phone') ?? '') || undefined,
    profileUrl: String(form.get('profileUrl') ?? '') || undefined,
  };
}

function ContactEditor({
  applicationId,
  contact,
  busy,
  onStatus,
}: {
  applicationId: string;
  contact: Contact;
  busy: boolean;
  onStatus(message: string): void;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<'save' | 'remove'>();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contact.associationId) return;
    setPending('save');
    try {
      await apiMutation({
        url: `/api/v1/applications/${applicationId}/contacts/${contact.associationId}`,
        method: 'PATCH',
        body: {
          ...contactCommand(new FormData(event.currentTarget)),
          expectedVersion: contact.version ?? 1,
        },
      });
      onStatus('Contact updated.');
      router.refresh();
    } catch (error) {
      onStatus(statusMessage(error));
    } finally {
      setPending(undefined);
    }
  }

  async function remove() {
    if (!contact.associationId) return;
    setPending('remove');
    try {
      await apiMutation({
        url: `/api/v1/applications/${applicationId}/contacts/${contact.associationId}`,
        method: 'DELETE',
      });
      onStatus('Contact removed from this application.');
      router.refresh();
    } catch (error) {
      onStatus(statusMessage(error));
    } finally {
      setPending(undefined);
    }
  }

  return (
    <form className="editable-card metadata-editor" onSubmit={save}>
      <div className="form-grid form-grid-two">
        <label>
          <span>Name</span>
          <input name="name" defaultValue={contact.name} maxLength={160} required />
        </label>
        <label>
          <span>Relationship</span>
          <select name="relationship" defaultValue={contact.relationship}>
            {Object.entries(relationshipLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Organization</span>
          <input name="organization" defaultValue={contact.organization} maxLength={160} />
        </label>
        <label>
          <span>Role or title</span>
          <input name="roleTitle" defaultValue={contact.roleTitle} maxLength={160} />
        </label>
        <label>
          <span>Email</span>
          <input name="email" type="email" defaultValue={contact.email} maxLength={320} />
        </label>
        <label>
          <span>Phone</span>
          <input name="phone" type="tel" defaultValue={contact.phone} maxLength={80} />
        </label>
        <label className="form-grid-span-two">
          <span>Profile URL</span>
          <input
            name="profileUrl"
            type="url"
            defaultValue={contact.profileUrl}
            maxLength={2048}
            placeholder="https://…"
          />
        </label>
      </div>
      <div className="editable-card-footer">
        <small>Contact details are private and excluded from Hiring Pulse.</small>
        <span>
          <button className="text-button" type="submit" disabled={busy || Boolean(pending)}>
            <Save aria-hidden="true" size={14} /> {pending === 'save' ? 'Saving…' : 'Save'}
          </button>
          <button
            className="text-button danger-text"
            type="button"
            disabled={busy || Boolean(pending)}
            onClick={remove}
          >
            <Trash2 aria-hidden="true" size={14} />
            {pending === 'remove' ? 'Removing…' : 'Remove'}
          </button>
        </span>
      </div>
    </form>
  );
}

export function ContactsManager({
  application,
  availableContacts,
}: {
  application: Application;
  availableContacts: ContactRecord[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'link'>('create');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const linkedContactIds = useMemo(
    () => new Set(application.contacts.map((contact) => contact.id)),
    [application.contacts],
  );
  const linkable = availableContacts.filter((contact) => !linkedContactIds.has(contact.id));

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setStatus(undefined);
    try {
      const body =
        mode === 'link'
          ? {
              mode,
              contactId: String(form.get('contactId')),
              relationship: String(form.get('relationship')),
            }
          : { mode, ...contactCommand(form) };
      await apiMutation({
        url: `/api/v1/applications/${application.id}/contacts`,
        method: 'POST',
        body,
      });
      formElement.reset();
      setStatus(mode === 'link' ? 'Contact linked.' : 'Contact added.');
      router.refresh();
    } catch (error) {
      setStatus(statusMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="metadata-manager">
      <form className="metadata-create-form" onSubmit={add}>
        <label>
          <span>Add contact</span>
          <select
            aria-label="Contact action"
            value={mode}
            onChange={(event) => setMode(event.target.value as 'create' | 'link')}
          >
            <option value="create">Create a new contact</option>
            <option value="link" disabled={linkable.length === 0}>
              Link an existing contact
            </option>
          </select>
        </label>
        <div className="form-grid form-grid-two">
          {mode === 'link' ? (
            <label>
              <span>Existing contact</span>
              <select name="contactId" required>
                <option value="">Choose a contact</option>
                {linkable.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                <span>Name</span>
                <input name="name" maxLength={160} required />
              </label>
              <label>
                <span>Email</span>
                <input name="email" type="email" maxLength={320} />
              </label>
              <label>
                <span>Organization</span>
                <input name="organization" maxLength={160} />
              </label>
              <label>
                <span>Role or title</span>
                <input name="roleTitle" maxLength={160} />
              </label>
              <label>
                <span>Phone</span>
                <input name="phone" type="tel" maxLength={80} />
              </label>
              <label>
                <span>Profile URL</span>
                <input name="profileUrl" type="url" maxLength={2048} placeholder="https://…" />
              </label>
            </>
          )}
          <label>
            <span>Relationship</span>
            <select name="relationship" defaultValue="recruiter">
              {Object.entries(relationshipLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="button button-secondary button-compact" type="submit" disabled={busy}>
          <Plus aria-hidden="true" size={15} /> {busy ? 'Adding…' : 'Add contact'}
        </button>
      </form>
      <div className="editable-list">
        {application.contacts.map((contact) => (
          <ContactEditor
            key={contact.associationId ?? contact.id}
            applicationId={application.id}
            contact={contact}
            busy={busy}
            onStatus={setStatus}
          />
        ))}
        {application.contacts.length === 0 && (
          <p className="muted">
            No contacts yet. Add a recruiter, referrer, or interviewer when helpful.
          </p>
        )}
      </div>
      {status && (
        <p className="form-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}

function versionFields(form: FormData) {
  return {
    versionLabel: String(form.get('versionLabel') ?? ''),
    filename: String(form.get('filename') ?? '') || undefined,
    contentSha256: String(form.get('contentSha256') ?? '') || undefined,
    externalReference: String(form.get('externalReference') ?? '') || undefined,
    purpose: String(form.get('purpose') ?? 'submitted'),
    usedAt: optionalIso(form.get('usedAt')),
  };
}

export function DocumentsManager({
  application,
  availableDocuments,
}: {
  application: Application;
  availableDocuments: DocumentRecord[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'add_version' | 'link_version'>('create');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>();
  const allVersions = availableDocuments.flatMap((document) =>
    document.versions.map((version) => ({ document, version })),
  );

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setBusy(true);
    setStatus(undefined);
    try {
      const common = versionFields(form);
      const body =
        mode === 'create'
          ? {
              mode,
              kind: String(form.get('kind')),
              title: String(form.get('title')),
              ...common,
            }
          : mode === 'add_version'
            ? { mode, documentId: String(form.get('documentId')), ...common }
            : {
                mode,
                documentVersionId: String(form.get('documentVersionId')),
                purpose: common.purpose,
                usedAt: common.usedAt,
              };
      await apiMutation({
        url: `/api/v1/applications/${application.id}/documents`,
        method: 'POST',
        body,
      });
      formElement.reset();
      setStatus('Document metadata linked.');
      router.refresh();
    } catch (error) {
      setStatus(statusMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function update(document: DocumentVersion, form: FormData) {
    if (!document.documentId) return;
    setBusy(true);
    try {
      await apiMutation({
        url: `/api/v1/applications/${application.id}/documents/${document.documentId}`,
        method: 'PATCH',
        body: {
          expectedVersion: document.documentVersion ?? 1,
          kind: String(form.get('kind')),
          title: String(form.get('title')),
        },
      });
      setStatus('Document name updated. The saved version is unchanged.');
      router.refresh();
    } catch (error) {
      setStatus(statusMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove(document: DocumentVersion) {
    if (!document.useId) return;
    setBusy(true);
    try {
      await apiMutation({
        url: `/api/v1/applications/${application.id}/document-uses/${document.useId}`,
        method: 'DELETE',
      });
      setStatus('Document use removed from this application. The version remains immutable.');
      router.refresh();
    } catch (error) {
      setStatus(statusMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="metadata-manager">
      <form className="metadata-create-form" onSubmit={add}>
        <label>
          <span>Add document metadata</span>
          <select
            aria-label="Document action"
            value={mode}
            onChange={(event) => setMode(event.target.value as typeof mode)}
          >
            <option value="create">Create a document and first version</option>
            <option value="add_version" disabled={availableDocuments.length === 0}>
              Add a version to an existing document
            </option>
            <option value="link_version" disabled={allVersions.length === 0}>
              Link an existing version
            </option>
          </select>
        </label>
        <div className="form-grid form-grid-two">
          {mode === 'create' && (
            <>
              <label>
                <span>Document name</span>
                <input name="title" maxLength={160} required />
              </label>
              <label>
                <span>Kind</span>
                <select name="kind" defaultValue="resume">
                  {documentKindOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          {mode === 'add_version' && (
            <label className="form-grid-span-two">
              <span>Document</span>
              <select name="documentId" required>
                <option value="">Choose a document</option>
                {availableDocuments.map((document) => (
                  <option key={document.id} value={document.id}>
                    {document.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {mode === 'link_version' ? (
            <label className="form-grid-span-two">
              <span>Saved version</span>
              <select name="documentVersionId" required>
                <option value="">Choose a version</option>
                {allVersions.map(({ document, version }) => (
                  <option key={version.id} value={version.id}>
                    {document.label} · {version.version}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label>
                <span>Version label</span>
                <input name="versionLabel" maxLength={120} placeholder="2026-08 product" required />
              </label>
              <label>
                <span>Original filename</span>
                <input name="filename" maxLength={255} placeholder="resume-product.pdf" />
              </label>
              <label>
                <span>SHA-256 hash</span>
                <input name="contentSha256" pattern="[0-9a-f]{64}" maxLength={64} />
              </label>
              <label>
                <span>External reference</span>
                <input
                  name="externalReference"
                  type="url"
                  maxLength={2048}
                  placeholder="https://…"
                />
              </label>
            </>
          )}
          <label>
            <span>How it was used</span>
            <select name="purpose" defaultValue="submitted">
              <option value="submitted">Submitted</option>
              <option value="prepared">Prepared</option>
              <option value="shared">Shared</option>
              <option value="requested">Requested</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label>
            <span>Used at</span>
            <input name="usedAt" type="datetime-local" />
          </label>
        </div>
        <p className="privacy-hint">
          Metadata only. Wip does not upload or store the file contents.
        </p>
        <button className="button button-secondary button-compact" type="submit" disabled={busy}>
          <Link2 aria-hidden="true" size={15} /> {busy ? 'Linking…' : 'Save document metadata'}
        </button>
      </form>

      <div className="editable-list">
        {application.documents.map((document) => (
          <form
            className="editable-card metadata-editor"
            key={document.useId ?? `${document.kind}-${document.version}`}
            onSubmit={(event) => {
              event.preventDefault();
              void update(document, new FormData(event.currentTarget));
            }}
          >
            <div className="form-grid form-grid-two">
              <label>
                <span>Document name</span>
                <input name="title" defaultValue={document.label} maxLength={160} required />
              </label>
              <label>
                <span>Kind</span>
                <select name="kind" defaultValue={documentKindValue(document.kind)}>
                  {documentKindOptions.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="document-version-summary">
              <strong>{document.version}</strong>
              <span>{document.filename}</span>
              <span>
                {document.purpose
                  ? `Used as ${document.purpose.replace('_', ' ')}`
                  : 'Usage recorded'}
              </span>
            </div>
            <div className="editable-card-footer">
              <small>Version metadata is append-only.</small>
              <span>
                <button className="text-button" type="submit" disabled={busy}>
                  <Save aria-hidden="true" size={14} /> Save name
                </button>
                <button
                  className="text-button danger-text"
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(document)}
                >
                  <Trash2 aria-hidden="true" size={14} /> Remove use
                </button>
              </span>
            </div>
          </form>
        ))}
        {application.documents.length === 0 && (
          <p className="muted">
            No document metadata yet. Record the resume or cover letter version you used.
          </p>
        )}
      </div>
      {status && (
        <p className="form-status" role="status" aria-live="polite">
          {status}
        </p>
      )}
    </div>
  );
}
