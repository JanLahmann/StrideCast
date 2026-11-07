import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('the extension carries the same stats.js as the pages', async () => {
  assert.equal(await read('extension/lib/stats.js'), await read('web/assets/stats.js'),
    'copy web/assets/stats.js to extension/lib/stats.js');
});

test('the manifest names files that exist', async () => {
  const manifest = JSON.parse(await read('extension/manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  const files = [
    manifest.background.service_worker,
    ...manifest.content_scripts.flatMap((c) => c.js),
    ...manifest.web_accessible_resources.flatMap((r) => r.resources),
  ];
  for (const file of files) await read(`extension/${file}`);
});
