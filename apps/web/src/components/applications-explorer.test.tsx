import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

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
});
