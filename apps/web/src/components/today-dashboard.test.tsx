import {
  getAwaitingResponses,
  getOverdueFollowUps,
  getRecentlyChanged,
  getStageCounts,
  getUpcomingItems,
} from '@wip/domain';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { demoApplications, demoReferenceDate } from '@wip/fixtures';

import { TodayDashboard } from './today-dashboard';

describe('TodayDashboard', () => {
  it('renders each actionable dashboard section and the full stage summary', () => {
    render(
      <TodayDashboard
        applications={demoApplications}
        referenceDate={demoReferenceDate}
        stageCounts={getStageCounts(demoApplications)}
        upcoming={getUpcomingItems(demoApplications, demoReferenceDate)}
        overdue={getOverdueFollowUps(demoApplications, demoReferenceDate)}
        awaiting={getAwaitingResponses(demoApplications)}
        recent={getRecentlyChanged(demoApplications, 4)}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Upcoming interviews & assessments' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Overdue follow-ups' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Awaiting responses' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recently changed' })).toBeInTheDocument();
    expect(screen.getByLabelText('Application counts by stage').children).toHaveLength(9);
    expect(screen.getByText('Record HireVue responses')).toBeInTheDocument();
    expect(screen.getByText('Product sense interview')).toBeInTheDocument();
  });
});
