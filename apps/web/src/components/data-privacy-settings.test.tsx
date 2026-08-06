import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type * as ApiClient from '@/api/client';
import { TRACKER_DELETION_PHRASE } from '@wip/schemas';

const mocks = vi.hoisted(() => ({ apiMutation: vi.fn(), push: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return { ...actual, apiMutation: mocks.apiMutation };
});

import { DataPrivacySettings } from './data-privacy-settings';

describe('DataPrivacySettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiMutation.mockResolvedValue({
      applicationsDeleted: 1,
      documentsDeleted: 1,
      contactsDeleted: 1,
    });
  });

  test('offers versioned JSON and spreadsheet CSV exports', () => {
    render(<DataPrivacySettings canManage />);

    expect(screen.getByRole('link', { name: /download json/i })).toHaveAttribute(
      'href',
      '/api/v1/tracker/export?format=json',
    );
    expect(screen.getByRole('link', { name: /applications csv/i })).toHaveAttribute(
      'href',
      '/api/v1/tracker/export?format=csv',
    );
    expect(screen.getByText(/wip\.tracker\.export/)).toBeInTheDocument();
  });

  test('requires the exact phrase and deletes tracker data without requesting an owner id', async () => {
    const user = userEvent.setup();
    render(<DataPrivacySettings canManage />);
    const confirmation = screen.getByLabelText(/type .* to continue/i);
    const button = screen.getByRole('button', { name: /permanently delete tracker data/i });

    await user.type(confirmation, 'DELETE MY DATA');
    expect(button).toBeDisabled();
    await user.clear(confirmation);
    await user.type(confirmation, TRACKER_DELETION_PHRASE);
    expect(button).toBeEnabled();
    await user.click(button);

    expect(mocks.apiMutation).toHaveBeenCalledWith({
      url: '/api/v1/tracker',
      method: 'DELETE',
      body: { confirmation: TRACKER_DELETION_PHRASE },
    });
    expect(mocks.apiMutation.mock.calls[0]![0].body).not.toHaveProperty('ownerId');
    expect(mocks.push).toHaveBeenCalledWith('/applications?trackerDeleted=1');
  });
});
