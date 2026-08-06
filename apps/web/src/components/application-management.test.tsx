import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { demoApplications } from '@wip/fixtures';

import type * as ApiClient from '@/api/client';

const mocks = vi.hoisted(() => ({
  apiMutation: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));

vi.mock('@/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClient>();
  return {
    ...actual,
    apiMutation: mocks.apiMutation,
    createIdempotencyKey: () => 'stage-event:test-key-1234',
  };
});

import {
  DeleteApplication,
  NextActionsManager,
  NotesManager,
  StageChangeForm,
} from './application-management';

const application = demoApplications.find(({ nextAction }) => nextAction)!;

describe('authenticated application management controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.apiMutation.mockResolvedValue(application);
  });

  test('records a stage event through the versioned event route', async () => {
    const user = userEvent.setup();
    render(<StageChangeForm application={application} />);

    await user.selectOptions(screen.getByLabelText('Stage'), 'assessment');
    await user.click(screen.getByRole('button', { name: /record event/i }));

    expect(mocks.apiMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'stage-event:test-key-1234',
        method: 'POST',
        url: `/api/v1/applications/${application.id}/events`,
        body: expect.objectContaining({ stage: 'assessment' }),
      }),
    );
  });

  test('adds a private note without representing it as a timeline event', async () => {
    const user = userEvent.setup();
    render(<NotesManager application={{ ...application, notes: [] }} />);

    await user.type(screen.getByLabelText('Add a note'), 'Fictional interview preparation.');
    await user.click(screen.getByRole('button', { name: /add note/i }));

    expect(mocks.apiMutation).toHaveBeenCalledWith({
      body: { body: 'Fictional interview preparation.' },
      method: 'POST',
      url: `/api/v1/applications/${application.id}/notes`,
    });
  });

  test('completes an open next action using its current version', async () => {
    const user = userEvent.setup();
    render(<NextActionsManager application={application} />);

    await user.click(screen.getAllByRole('button', { name: /complete/i })[0]!);

    expect(mocks.apiMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'PATCH',
        url: expect.stringMatching(/\/actions\//),
        body: expect.objectContaining({ state: 'completed' }),
      }),
    );
  });

  test('enables permanent deletion only after an exact company or role confirmation', async () => {
    const user = userEvent.setup();
    render(<DeleteApplication application={application} />);
    const button = screen.getByRole('button', { name: /delete permanently/i });
    const confirmation = screen.getByLabelText(/type .* to confirm/i);

    expect(button).toBeDisabled();
    await user.type(confirmation, 'Almost right');
    expect(button).toBeDisabled();
    await user.clear(confirmation);
    await user.type(confirmation, application.company);
    expect(button).toBeEnabled();
    await user.click(button);

    expect(mocks.apiMutation).toHaveBeenCalledWith({
      body: { confirmation: application.company },
      method: 'DELETE',
      url: `/api/v1/applications/${application.id}`,
    });
  });
});
