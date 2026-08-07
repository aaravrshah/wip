import { DEVELOPMENT_EXTENSION_ID } from './extension-identity';

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
  expectedExtensionId: string;
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
  const expectedExtensionId = import.meta.env.WXT_WIP_EXTENSION_ID || DEVELOPMENT_EXTENSION_ID;
  if (!/^[a-p]{32}$/.test(expectedExtensionId)) {
    throw new Error('WXT_WIP_EXTENSION_ID must be a valid Chrome extension ID.');
  }
  if (chrome.runtime.id !== expectedExtensionId) {
    throw new Error(
      `This build expected extension ID ${expectedExtensionId}, but Chrome assigned ${chrome.runtime.id}. Reload the configured unpacked build.`,
    );
  }
  return {
    apiOrigin,
    clerkPublishableKey,
    expectedExtensionId,
    webSignInUrl: `${apiOrigin}/sign-in`,
  };
}
