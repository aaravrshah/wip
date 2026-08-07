import { Buffer } from 'node:buffer';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

const outputDirectory = fileURLToPath(new URL('../.output/chrome-mv3/', import.meta.url));
const forbiddenContent = [
  /CLERK_SECRET_KEY/,
  /DATABASE_URL/,
  /DIRECT_DATABASE_URL/,
  /NEON_AUTHENTICATED_DATABASE_URL/,
  /NEON_RUNTIME_DATABASE_URL/,
  /postgres(?:ql)?:\/\//i,
  /sk_(?:test|live)_/,
];
const forbiddenArtifactPath =
  /(?:^|\/)(?:src|test|tests|fixtures|__tests__)(?:\/|$)|\.(?:map|ts|tsx|spec\.js|test\.js)$/i;

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? files(path) : [path];
    }),
  );
  return nested.flat();
}

const paths = await files(outputDirectory);
for (const path of paths) {
  const relativePath = path.slice(outputDirectory.length + 1);
  if (forbiddenArtifactPath.test(relativePath)) {
    throw new Error(`Development-only file was packaged: ${relativePath}.`);
  }
  const content = await readFile(path);
  if (content.includes(0)) continue;
  const text = content.toString('utf8');
  for (const pattern of forbiddenContent) {
    if (pattern.test(text))
      throw new Error(`Forbidden secret or database marker found in ${path}.`);
  }
}

const manifest = JSON.parse(await readFile(join(outputDirectory, 'manifest.json'), 'utf8'));
const serializedManifest = JSON.stringify(manifest);
if (/<all_urls>|\*:\/\/|"cookies"|"history"|"webRequest"|"downloads"/i.test(serializedManifest)) {
  throw new Error('The built manifest contains a forbidden broad permission.');
}

if (
  JSON.stringify(manifest.permissions) !== JSON.stringify(['activeTab', 'scripting', 'storage'])
) {
  throw new Error('The built manifest permission set differs from the reviewed beta boundary.');
}
if (
  manifest.content_security_policy?.extension_pages !==
  "script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
) {
  throw new Error('The built manifest does not contain the reviewed extension-page CSP.');
}

const publicKey = Buffer.from(manifest.key ?? '', 'base64');
if (publicKey.length < 128) throw new Error('The built manifest is missing a stable public key.');
const extensionId = [...createHash('sha256').update(publicKey).digest('hex').slice(0, 32)]
  .map((digit) => String.fromCharCode(97 + Number.parseInt(digit, 16)))
  .join('');

for (const size of [16, 32, 48, 128]) {
  const iconPath = join(outputDirectory, `icon/${size}.png`);
  const icon = await readFile(iconPath);
  if (icon.readUInt32BE(16) !== size || icon.readUInt32BE(20) !== size) {
    throw new Error(`Extension icon/${size}.png does not have the required dimensions.`);
  }
}

process.stdout.write(
  `Inspected ${paths.length} extension artifact files for ${extensionId}: packaging, permission, CSP, icon, and secret scans passed.\n`,
);
