export interface ExtensionManifestInput {
  apiOrigin: string;
  clerkFrontendApiOrigin: string;
  extensionPublicKey: string;
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
    key: input.extensionPublicKey,
    permissions: ['activeTab', 'scripting', 'storage'],
    host_permissions: [
      exactHostPattern(input.apiOrigin, 'Wip API origin'),
      exactHostPattern(input.clerkFrontendApiOrigin, 'Clerk Frontend API origin'),
    ],
    icons: {
      16: 'icon/16.png',
      32: 'icon/32.png',
      48: 'icon/48.png',
      128: 'icon/128.png',
    },
    action: {
      default_title: 'Save this job to Wip',
      default_icon: {
        16: 'icon/16.png',
        32: 'icon/32.png',
      },
    },
    content_security_policy: {
      extension_pages:
        "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    },
    incognito: 'not_allowed',
    minimum_chrome_version: '102',
  } as const;
}
