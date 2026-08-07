import 'server-only';

import { auth } from '@clerk/nextjs/server';

import { getServerEnvironment } from '@/env/server';
import { getAuthorizedParties } from '@/env/server';

interface ClerkSessionState {
  isAuthenticated: boolean;
  userId: string | null;
  sessionClaims?: { azp?: unknown } | null;
}

export interface AuthenticatedDatabaseIdentity {
  clerkUserId: string;
}

export class AuthenticationRequiredError extends Error {
  constructor(message = 'A verified Clerk session is required.') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export async function resolveAuthenticatedDatabaseIdentity(
  session: ClerkSessionState,
  options?: {
    authorizedParties: readonly string[];
    requiredAuthorizedParty?: string;
  },
): Promise<AuthenticatedDatabaseIdentity> {
  if (!session.isAuthenticated || !session.userId) {
    throw new AuthenticationRequiredError();
  }

  if (options) {
    const authorizedParty = session.sessionClaims?.azp;
    const requiredParty = options.requiredAuthorizedParty;
    if (
      (requiredParty &&
        (!options.authorizedParties.includes(requiredParty) ||
          authorizedParty !== requiredParty)) ||
      (typeof authorizedParty === 'string' && !options.authorizedParties.includes(authorizedParty))
    ) {
      throw new AuthenticationRequiredError(
        'The Clerk session was not issued to an authorized Wip origin.',
      );
    }
  }

  return { clerkUserId: session.userId };
}

export async function hasAuthenticatedSession(): Promise<boolean> {
  const session = await auth();
  return session.isAuthenticated;
}

export async function requireAuthenticatedDatabaseIdentity(): Promise<AuthenticatedDatabaseIdentity> {
  const environment = getServerEnvironment();
  if (environment.dataSource !== 'neon') {
    throw new AuthenticationRequiredError('Authenticated data access is unavailable in demo mode.');
  }

  const session = await auth.protect();
  return resolveAuthenticatedDatabaseIdentity(session);
}

export async function requireApiDatabaseIdentity(
  requiredAuthorizedParty?: string,
): Promise<AuthenticatedDatabaseIdentity> {
  const environment = getServerEnvironment();
  if (environment.dataSource !== 'neon') {
    throw new AuthenticationRequiredError('Authenticated data access is unavailable in demo mode.');
  }

  return resolveAuthenticatedDatabaseIdentity(await auth({ acceptsToken: 'session_token' }), {
    authorizedParties: getAuthorizedParties(),
    ...(requiredAuthorizedParty ? { requiredAuthorizedParty } : {}),
  });
}
