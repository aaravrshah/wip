import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import { demoApplications } from '@wip/fixtures';

import { ApplicationsExplorer } from './applications-explorer';

describe('ApplicationsExplorer', () => {
  it('searches by location and clears the query', async () => {
    const user = userEvent.setup();
    render(<ApplicationsExplorer applications={demoApplications} />);

    await user.type(screen.getByRole('searchbox', { name: 'Search applications' }), 'Austin');

    expect(screen.getByText('Willow Circuit')).toBeInTheDocument();
    expect(screen.queryByText('Cloverfield Digital')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 application');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.getByRole('status')).toHaveTextContent('12 applications');
  });

  it('filters by stage and changes the basic sort order', async () => {
    const user = userEvent.setup();
    render(<ApplicationsExplorer applications={demoApplications} />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by stage' }),
      'assessment',
    );
    expect(screen.getByRole('status')).toHaveTextContent('2 applications');
    expect(screen.getByText('Willow Circuit')).toBeInTheDocument();
    expect(screen.getByText('Northline Commons')).toBeInTheDocument();
    expect(screen.queryByText('Paper Kite Labs')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by stage' }), 'all');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Sort applications' }),
      'company',
    );

    const rows = within(screen.getByRole('table')).getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Aster & Finch');
    expect(rows.at(-1)).toHaveTextContent('Willow Circuit');
  });

  it('switches to a mobile-scroll-contained board with every canonical stage', async () => {
    const user = userEvent.setup();
    const { container } = render(<ApplicationsExplorer applications={demoApplications} />);

    await user.click(screen.getByRole('button', { name: 'Board' }));

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Applications board')).toBeInTheDocument();
    expect(container.querySelector('.kanban-scroll')).toBeInTheDocument();
    for (const label of [
      'Saved',
      'Preparing',
      'Applied',
      'Assessment',
      'Interviewing',
      'Offer',
      'Accepted',
      'Rejected',
      'Withdrawn',
    ]) {
      expect(screen.getByRole('heading', { name: label })).toBeInTheDocument();
    }
  });
});
