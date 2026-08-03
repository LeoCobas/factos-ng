import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const activeProjectRef = 'veqpyhqnpuemdysdorse';
const retiredProjectRef = 'ifkfofyylfkxwtxvyewi';
const files = [
  'public/app-config.json',
  'scripts/generate-runtime-config.mjs',
  'ngsw-config.json',
];

for (const file of files) {
  const contents = await readFile(file, 'utf8');
  assert.match(contents, new RegExp(activeProjectRef), `${file} no apunta a Sao Paulo`);
  assert.doesNotMatch(
    contents,
    new RegExp(retiredProjectRef),
    `${file} todavia referencia el proyecto de Virginia`,
  );
}

console.log('[runtime-config] Sao Paulo references verified.');
