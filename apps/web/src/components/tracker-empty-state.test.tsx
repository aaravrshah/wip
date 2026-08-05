import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { TrackerEmptyState } from './tracker-empty-state';

describe('TrackerEmptyState', () => {
  test('explains that a new owner stays empty rather than receiving the seed', () => {
    render(<TrackerEmptyState context="today" />);

    expect(screen.getByRole('heading', { name: /tracker is ready/i })).toBeInTheDocument();
    expect(screen.getByText(/no fictional demo records/i)).toBeInTheDocument();
  });
});
