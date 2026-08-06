'use client';

import { Download, FileJson, FileSpreadsheet, ShieldCheck, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { apiMutation, ApiResponseError } from '@/api/client';
import { TRACKER_DELETION_PHRASE } from '@wip/schemas';

export function DataPrivacySettings({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function removeTrackerData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await apiMutation({
        url: '/api/v1/tracker',
        method: 'DELETE',
        body: { confirmation },
      });
      router.push('/applications?trackerDeleted=1');
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiResponseError
          ? caught.message
          : 'Wip could not delete your tracker data.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="settings-stack">
      <section className="panel settings-card" aria-labelledby="export-heading">
        <div className="panel-heading">
          <span className="panel-icon panel-icon-blue" aria-hidden="true">
            <Download size={19} />
          </span>
          <div>
            <p className="section-kicker">Your information</p>
            <h2 id="export-heading">Export tracker data</h2>
          </div>
        </div>
        <p>
          JSON is the complete, versioned export. CSV contains one spreadsheet-safe row per
          application and is easier to open in Sheets or Excel.
        </p>
        <div className="settings-actions">
          <a
            className={`button button-secondary${canManage ? '' : ' is-disabled'}`}
            href={canManage ? '/api/v1/tracker/export?format=json' : undefined}
            aria-disabled={!canManage}
            download
          >
            <FileJson aria-hidden="true" size={17} /> Download JSON
          </a>
          <a
            className={`button button-secondary${canManage ? '' : ' is-disabled'}`}
            href={canManage ? '/api/v1/tracker/export?format=csv' : undefined}
            aria-disabled={!canManage}
            download
          >
            <FileSpreadsheet aria-hidden="true" size={17} /> Download applications CSV
          </a>
        </div>
        <small>
          Export format: <code>wip.tracker.export</code>, version 1. Exports are generated on
          request, sent only to your authenticated session, and are not retained by Wip.
        </small>
      </section>

      <section className="panel settings-card" aria-labelledby="account-heading">
        <div className="panel-heading">
          <span className="panel-icon panel-icon-green" aria-hidden="true">
            <ShieldCheck size={19} />
          </span>
          <div>
            <p className="section-kicker">Account boundary</p>
            <h2 id="account-heading">Clerk account</h2>
          </div>
        </div>
        <p>
          Your Clerk identity controls sign-in. Deleting Wip tracker data below does not delete that
          authentication account, end its sessions, or change its provider settings.
        </p>
        <p className="muted">
          Clerk-account deletion is intentionally separate and is not implemented in this milestone.
        </p>
      </section>

      <section className="panel settings-card danger-zone" aria-labelledby="delete-tracker-heading">
        <div className="panel-heading">
          <span className="panel-icon panel-icon-coral" aria-hidden="true">
            <Trash2 size={19} />
          </span>
          <div>
            <p className="section-kicker">Permanent action</p>
            <h2 id="delete-tracker-heading">Delete all Wip tracker data</h2>
          </div>
        </div>
        <p>
          This permanently removes your applications, timelines, snapshots, notes, actions,
          contacts, document metadata, versions, and associations from the active database. It does
          not delete your Clerk account.
        </p>
        <p className="privacy-hint">
          There is no recovery screen. Deleted bytes may remain in provider backups until their
          configured retention period expires.
        </p>
        <form className="deletion-form" onSubmit={removeTrackerData}>
          <label>
            <span>
              Type <strong>{TRACKER_DELETION_PHRASE}</strong> to continue
            </span>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              disabled={!canManage || busy}
              required
            />
          </label>
          <button
            className="button button-danger"
            type="submit"
            disabled={!canManage || busy || confirmation !== TRACKER_DELETION_PHRASE}
          >
            <Trash2 aria-hidden="true" size={17} />
            {busy ? 'Deleting tracker data…' : 'Permanently delete tracker data'}
          </button>
        </form>
        {error && (
          <div className="form-alert form-alert-error" role="alert">
            {error}
          </div>
        )}
        {!canManage && (
          <p className="form-status">The fictional demo cannot export or delete data.</p>
        )}
      </section>
    </div>
  );
}
