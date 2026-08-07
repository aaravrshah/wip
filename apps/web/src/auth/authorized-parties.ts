const extensionOriginPattern = /^chrome-extension:\/\/[a-p]{32}$/;

export function parseWebOrigin(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.origin !== value ||
    url.username ||
    url.password
  ) {
    throw new Error('WIP_WEB_ORIGIN must be one exact http(s) origin.');
  }
  return url.origin;
}

export function parseExtensionOrigins(value: string | undefined): readonly string[] {
  if (!value?.trim()) return [];
  return [
    ...new Set(
      value.split(',').map((entry) => {
        const origin = entry.trim();
        if (!extensionOriginPattern.test(origin)) {
          throw new Error('WIP_EXTENSION_ORIGINS must contain exact chrome-extension:// origins.');
        }
        return origin;
      }),
    ),
  ];
}

export function configuredAuthorizedParties(values: {
  webOrigin?: string;
  extensionOrigins?: string;
}): string[] {
  return [
    parseWebOrigin(values.webOrigin ?? 'http://localhost:3000'),
    ...parseExtensionOrigins(values.extensionOrigins),
  ];
}
