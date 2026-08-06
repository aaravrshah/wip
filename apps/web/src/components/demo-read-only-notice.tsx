import { ArrowLeft, LockKeyhole } from 'lucide-react';
import Link from 'next/link';

export function DemoReadOnlyNotice() {
  return (
    <div className="empty-state standalone-empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        <LockKeyhole size={22} />
      </span>
      <h1>The fictional demo is read-only</h1>
      <p>
        Switch to Clerk + Neon mode to create or change applications. Demo records are never
        modified or copied into an account.
      </p>
      <Link className="button button-secondary" href="/applications">
        <ArrowLeft aria-hidden="true" size={17} />
        Back to applications
      </Link>
    </div>
  );
}
