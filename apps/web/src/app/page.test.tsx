import { render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';

const { hasAuthenticatedSession, listApplications } = vi.hoisted(() => ({
  hasAuthenticatedSession: vi.fn(),
  listApplications: vi.fn(),
}));

vi.mock('@/auth/server', () => ({ hasAuthenticatedSession }));
vi.mock('@/env/server', () => ({
  getServerEnvironment: () => ({
    dataSource: 'neon',
    authenticatedDatabaseUrl:
      'postgresql://authenticated@example-pooler.invalid/wip?sslmode=require',
    clerkJwtTemplate: 'neon',
  }),
}));
vi.mock('@/data', () => ({
  applicationRepository: {
    listApplications,
    getReferenceDate: vi.fn(),
  },
}));

import TodayPage from './page';

describe('TodayPage authentication boundary', () => {
  test('renders the public landing and does not read tracker data when signed out', async () => {
    hasAuthenticatedSession.mockResolvedValue(false);

    render(await TodayPage());

    expect(screen.getByRole('heading', { name: /keep every application/i })).toBeInTheDocument();
    expect(listApplications).not.toHaveBeenCalled();
  });
});
