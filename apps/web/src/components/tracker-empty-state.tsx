import { Inbox, Plus } from 'lucide-react';
import Link from 'next/link';

export function TrackerEmptyState({ context }: { context: 'applications' | 'today' }) {
  return (
    <section className="empty-state standalone-empty-state" aria-labelledby="empty-heading">
      <span className="empty-state-icon" aria-hidden="true">
        <Inbox size={23} />
      </span>
      <p className="eyebrow">A fresh start</p>
      <h1 id="empty-heading">Your tracker is ready.</h1>
      <p>
        This account does not have any applications yet. Start with a company and role; no fictional
        demo records have been copied into your private workspace.
      </p>
      <Link className="button button-primary" href="/applications/new">
        <Plus aria-hidden="true" size={17} /> Add your first application
      </Link>
      {context === 'applications' && (
        <Link className="text-link" href="/">
          Back to Today
        </Link>
      )}
      <small>New accounts start empty. Fictional demo records are never copied here.</small>
    </section>
  );
}
