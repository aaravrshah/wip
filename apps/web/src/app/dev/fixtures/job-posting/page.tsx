import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Fictional job capture fixture | Wip development',
  robots: { index: false, follow: false },
};

const jobPosting = {
  '@context': 'https://schema.org',
  '@type': 'JobPosting',
  title: 'Junior Community Operations Associate',
  hiringOrganization: {
    '@type': 'Organization',
    name: 'Fictional Northstar Cooperative',
  },
  identifier: {
    '@type': 'PropertyValue',
    name: 'Fictional Northstar Cooperative',
    value: 'FNC-DEV-204',
  },
  employmentType: 'FULL_TIME',
  jobLocationType: 'TELECOMMUTE',
  jobLocation: {
    '@type': 'Place',
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Port Aurora',
      addressRegion: 'NY',
      addressCountry: 'US',
    },
  },
  baseSalary: {
    '@type': 'MonetaryAmount',
    currency: 'USD',
    value: {
      '@type': 'QuantitativeValue',
      minValue: 58_000,
      maxValue: 66_000,
      unitText: 'YEAR',
    },
  },
  description: `
    <section>
      <h2>About the fictional role</h2>
      <p>Help a fictional early-career community run welcoming programs and document what works.</p>
      <h2>What you will do</h2>
      <ul>
        <li>Coordinate accessible online sessions with the fictional community team.</li>
        <li>Turn participant feedback into clear next steps.</li>
        <li>Maintain calm, accurate operating notes.</li>
      </ul>
      <h2>What we are looking for</h2>
      <p>Clear writing, careful follow-through, and curiosity. No real applicant information is used on this page.</p>
    </section>
  `,
};

export default function FictionalJobPostingFixture() {
  if (process.env.NODE_ENV === 'production') notFound();

  return (
    <section className="fixture-job-page" aria-labelledby="fixture-job-title">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPosting) }}
      />
      <p className="eyebrow">Local extension test fixture</p>
      <h1 id="fixture-job-title">Junior Community Operations Associate</h1>
      <p className="fixture-job-company">Fictional Northstar Cooperative</p>
      <dl className="fixture-job-facts">
        <div>
          <dt>Location</dt>
          <dd>Remote · Port Aurora, NY</dd>
        </div>
        <div>
          <dt>Requisition</dt>
          <dd>FNC-DEV-204</dd>
        </div>
      </dl>
      <article
        className="fixture-job-description"
        data-job-description
        dangerouslySetInnerHTML={{ __html: jobPosting.description }}
      />
      <aside className="callout fixture-job-note">
        This page is entirely fictional and exists only in development for manually testing Wip’s
        user-invoked extension capture.
      </aside>
    </section>
  );
}
