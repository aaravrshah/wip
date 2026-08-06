import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { demoApplications } from '@wip/fixtures';

import type * as ApiClient from '@/api/client';

const mocks = vi.hoisted(() => ({ apiMutation: vi.fn(), refresh: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    apiMutation: mocks.apiMutation,
    createIdempotencyKey: () => 'board-stage-event:test-key-1234',
  };
});

import { ApplicationsBoard } from './applications-board';

const savedApplication = demoApplications.find(({ stage }) => stage === 'saved')!;

describe('ApplicationsBoard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiMutation.mockResolvedValue({ ...savedApplication, stage: 'preparing' });
  });

  test('moves a card through the existing stage-event command using the accessible menu', async () => {
    const user = userEvent.setup();
    render(<ApplicationsBoard applications={[savedApplication]} canManage />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: `Move ${savedApplication.company} to stage` }),
      'preparing',
    );

    await waitFor(() =>
      expect(mocks.apiMutation).toHaveBeenCalledWith({
        url: `/api/v1/applications/${savedApplication.id}/events`,
        method: 'POST',
        idempotencyKey: 'board-stage-event:test-key-1234',
        body: { stage: 'preparing', effectiveAt: expect.any(String) },
      }),
    );
    expect(await screen.findByRole('status')).toHaveTextContent(/timeline event added/i);
  });

  test('restores the card to its previous stage when the mutation fails', async () => {
    const user = userEvent.setup();
    mocks.apiMutation.mockRejectedValue(new Error('network'));
    render(<ApplicationsBoard applications={[savedApplication]} canManage />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: `Move ${savedApplication.company} to stage` }),
      'preparing',
    );

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/restored/i));
    expect(
      screen.getByRole('combobox', { name: `Move ${savedApplication.company} to stage` }),
    ).toHaveValue('saved');
  });

  test('requires deliberate confirmation for terminal movement', async () => {
    const user = userEvent.setup();
    render(<ApplicationsBoard applications={[savedApplication]} canManage />);
    const stageSelector = screen.getByRole('combobox', {
      name: `Move ${savedApplication.company} to stage`,
    });

    await user.selectOptions(stageSelector, 'rejected');
    expect(screen.getByRole('alertdialog')).toHaveTextContent(/immutable timeline event/i);
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(mocks.apiMutation).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(stageSelector).toHaveFocus();

    await user.selectOptions(stageSelector, 'rejected');
    await user.click(screen.getByRole('button', { name: 'Confirm move' }));
    await waitFor(() => expect(mocks.apiMutation).toHaveBeenCalledOnce());
  });
});
