import { readFile, readdir } from 'node:fs/promises';
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

process.stdout.write(
  `Inspected ${paths.length} extension artifact files: permission and secret scan passed.\n`,
);
