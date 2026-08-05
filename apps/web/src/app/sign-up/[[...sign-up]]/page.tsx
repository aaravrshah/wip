import { SignUp } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { getServerEnvironment } from '@/env/server';

export const metadata: Metadata = { title: 'Create account' };

export default function SignUpPage() {
  if (getServerEnvironment().dataSource === 'demo') redirect('/');

  return (
    <div className="auth-page">
      <div className="auth-intro">
        <p className="eyebrow">Start clearly</p>
        <h1>Give your job search a reliable home.</h1>
        <p>Create an account with Google or a passwordless email link. New trackers start empty.</p>
      </div>
      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
    </div>
  );
}
