import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';

import { SignedOutLanding } from './signed-out-landing';

describe('SignedOutLanding', () => {
  test('offers intentional sign-in and account-creation paths without tracker data', () => {
    render(<SignedOutLanding />);

    expect(screen.getByRole('heading', { name: /keep every application/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /create your tracker/i })).toHaveAttribute(
      'href',
      '/sign-up',
    );
    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/sign-in');
    expect(screen.queryByText('Cloverfield Digital')).not.toBeInTheDocument();
  });
});
