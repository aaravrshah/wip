import { SignIn } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getServerEnvironment } from '@/env/server';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  if (getServerEnvironment().dataSource === 'demo') redirect('/');

  return (
    <div className="auth-page">
      <div className="auth-intro">
        <p className="eyebrow">Welcome back</p>
        <h1>Pick up where your search left off.</h1>
        <p>Use Google or a passwordless email link to return to your private Wip tracker.</p>
      </div>
      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
    </div>
  );
}
