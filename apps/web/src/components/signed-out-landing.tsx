import { ArrowRight, CalendarCheck2, FileClock, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export function SignedOutLanding() {
  return (
    <div className="landing-stack">
      <section className="landing-hero" aria-labelledby="landing-heading">
        <div>
          <p className="eyebrow">Your job search, in progress</p>
          <h1 id="landing-heading">Keep every application and next step in one calm place.</h1>
          <p>
            Wip keeps a private timeline of what you applied to, what happened next, and which
            materials you used—without turning your search into another project to manage.
          </p>
          <div className="landing-actions">
            <Link className="button button-primary" href="/sign-up">
              Create your tracker
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
            <Link className="button button-secondary" href="/sign-in">
              Sign in
            </Link>
          </div>
        </div>
        <div className="landing-preview" aria-label="A preview of Wip's Today screen">
          <p className="section-kicker">Today</p>
          <strong>One clear next step at a time.</strong>
          <div>
            <span>Upcoming interview</span>
            <small>Tuesday · 2:00 PM</small>
          </div>
          <div>
            <span>Follow up with recruiter</span>
            <small>Due tomorrow</small>
          </div>
        </div>
      </section>

      <section className="landing-benefits" aria-label="What Wip helps you remember">
        <article>
          <CalendarCheck2 aria-hidden="true" size={22} />
          <h2>Know what needs attention</h2>
          <p>See interviews, assessments, overdue follow-ups, and applications awaiting replies.</p>
        </article>
        <article>
          <FileClock aria-hidden="true" size={22} />
          <h2>Keep the evidence</h2>
          <p>Preserve job-description snapshots and the metadata for documents you submitted.</p>
        </article>
        <article>
          <ShieldCheck aria-hidden="true" size={22} />
          <h2>Stay in control</h2>
          <p>Your signed-in account is isolated at both the application and database layers.</p>
        </article>
      </section>
    </div>
  );
}
