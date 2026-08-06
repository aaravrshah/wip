export interface ExtensionManifestInput {
  apiOrigin: string;
  clerkFrontendApiOrigin: string;
}

function exactHostPattern(value: string, label: string): string {
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
    throw new Error(`${label} must be an exact http(s) origin without a path, query, or fragment.`);
  }
  return `${url.origin}/*`;
}

export function createExtensionManifest(input: ExtensionManifestInput) {
  return {
    name: 'Wip',
    description: 'Review and save the current job to your private Wip tracker.',
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: [
      exactHostPattern(input.apiOrigin, 'Wip API origin'),
      exactHostPattern(input.clerkFrontendApiOrigin, 'Clerk Frontend API origin'),
    ],
    action: { default_title: 'Save this job to Wip' },
  } as const;
}
