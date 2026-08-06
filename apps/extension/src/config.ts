function exactOrigin(value: string, label: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password ||
    url.hostname.includes('*')
  ) {
    throw new Error(`${label} must be an exact http(s) origin.`);
  }
  return url.origin;
}

export interface ExtensionConfig {
  apiOrigin: string;
  clerkPublishableKey: string;
  webSignInUrl: string;
}

export function getExtensionConfig(): ExtensionConfig {
  const apiOrigin = exactOrigin(
    import.meta.env.WXT_WIP_API_ORIGIN || 'http://localhost:3000',
    'Wip API origin',
  );
  const clerkPublishableKey = import.meta.env.WXT_CLERK_PUBLISHABLE_KEY;
  if (!clerkPublishableKey?.startsWith('pk_')) {
    throw new Error('Set WXT_CLERK_PUBLISHABLE_KEY to the Clerk publishable key.');
  }
  return {
    apiOrigin,
    clerkPublishableKey,
    webSignInUrl: `${apiOrigin}/sign-in`,
  };
}
