import { SearchX } from 'lucide-react';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty-state standalone-empty-state">
      <span className="empty-state-icon" aria-hidden="true">
        <SearchX size={24} />
      </span>
      <h1>Application not found</h1>
      <p>This fictional record may have moved or never existed.</p>
      <Link className="button button-primary" href="/applications">
        Back to applications
      </Link>
    </div>
  );
}
