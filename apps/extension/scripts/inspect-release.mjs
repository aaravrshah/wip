import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const outputDirectory = join(root, '.output');
const archives = await Promise.all(
  (await readdir(outputDirectory))
    .filter((name) => name.endsWith('.zip') && !name.includes('sources'))
    .map(async (name) => ({ name, modifiedAt: (await stat(join(outputDirectory, name))).mtimeMs })),
);
const archive = archives.sort((left, right) => right.modifiedAt - left.modifiedAt).at(0)?.name;
if (!archive) throw new Error('WXT did not create a Chrome release ZIP.');

const entries = execFileSync('unzip', ['-Z1', join(outputDirectory, archive)], {
  encoding: 'utf8',
})
  .split('\n')
  .filter(Boolean);
const forbidden = entries.filter(
  (entry) =>
    /(?:^|\/)(?:src|test|tests|fixtures|__tests__)(?:\/|$)|\.(?:map|ts|tsx|pem|key)$/i.test(
      entry,
    ) || entry.endsWith('.DS_Store'),
);
if (forbidden.length > 0) {
  throw new Error(`Release ZIP contains forbidden files: ${forbidden.join(', ')}`);
}
if (!entries.includes('manifest.json') || !entries.includes('popup.html')) {
  throw new Error('Release ZIP is missing its manifest or popup entry point.');
}

const sha256 = createHash('sha256')
  .update(await readFile(join(outputDirectory, archive)))
  .digest('hex');

process.stdout.write(
  `Release ZIP ${archive} contains ${entries.length} reviewed artifact files (SHA-256 ${sha256}).\n`,
);
