import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import type * as ApiClient from '@/api/client';
import { ApiResponseError } from '@/api/client';

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
    createIdempotencyKey: () => 'application-create:test-key-1234',
  };
});

import { ApplicationForm } from './application-form';

describe('ApplicationForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('prevents a duplicate create submission while the first request is pending', async () => {
    mocks.apiMutation.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    const { container } = render(<ApplicationForm mode="create" />);

    await user.type(screen.getByLabelText(/company/i), 'Fictional Sunbeam Studio');
    await user.type(screen.getByLabelText(/role or title/i), 'Junior Product Designer');

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);
    fireEvent.submit(form!);

    expect(mocks.apiMutation).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();
    expect(mocks.apiMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'application-create:test-key-1234',
        method: 'POST',
        url: '/api/v1/applications',
      }),
    );
  });

  test('preserves entered values when server validation fails', async () => {
    mocks.apiMutation.mockRejectedValue(
      new ApiResponseError('Check the highlighted fields and try again.', 'validation_error', 400, {
        sourceUrl: ['Use an http:// or https:// URL.'],
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<ApplicationForm mode="create" />);
    const company = screen.getByLabelText(/company/i);
    const role = screen.getByLabelText(/role or title/i);

    await user.type(company, 'Fictional Sunbeam Studio');
    await user.type(role, 'Junior Product Designer');
    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByRole('alert')).toHaveTextContent(/highlighted fields/i);
    expect(company).toHaveValue('Fictional Sunbeam Studio');
    expect(role).toHaveValue('Junior Product Designer');
  });
});
