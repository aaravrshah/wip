import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { demoApplications } from '@wip/fixtures';

import { ApplicationDetail } from './application-detail';

describe('ApplicationDetail', () => {
  it('shows the complete read-only application record', () => {
    const application = demoApplications.find(({ id }) => id === 'cloverfield-digital');
    expect(application).toBeDefined();

    render(<ApplicationDetail application={application!} />);

    expect(screen.getByRole('heading', { name: 'Associate Product Manager' })).toBeInTheDocument();
    expect(screen.getByText('CD-APM-202')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Job-description snapshot' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Documents used' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contacts' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product sense interview' })).toBeInTheDocument();

    const timelineSection = screen
      .getByRole('heading', { name: 'Hiring timeline' })
      .closest('section');
    expect(timelineSection).not.toBeNull();
    const timeline = within(timelineSection!).getByRole('list');
    const events = within(timeline).getAllByRole('listitem');
    expect(events).toHaveLength(4);
    expect(events[0]).toHaveTextContent('Application submitted');
    expect(events.at(-1)).toHaveTextContent('Product sense interview scheduled');
  });
});
