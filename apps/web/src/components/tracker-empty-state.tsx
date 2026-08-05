import { Inbox } from 'lucide-react';
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
        This account does not have any applications yet. Application editing arrives in the next
        milestone; no fictional demo records have been copied into your private workspace.
      </p>
      {context === 'applications' ? (
        <Link className="button button-secondary" href="/">
          Back to Today
        </Link>
      ) : (
        <Link className="button button-secondary" href="/applications">
          View applications
        </Link>
      )}
    </section>
  );
}
