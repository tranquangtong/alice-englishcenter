import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { buildVersion, checkVersion } from '../scripts/build-version.mjs';

test('release fingerprint covers the shell, nested content and binary assets', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'aec-version-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const write = (file, contents) => writeFile(path.join(root, file), contents);
  const shell = '<meta name="aec-version" content="">';
  for (const dir of ['assets', 'content/nested', 'docs', 'tests', 'scripts', 'node_modules', 'test-artifacts']) {
    await mkdir(path.join(root, dir), { recursive: true });
  }
  await write('index.html', shell);
  await write('assets/track.mp3', Buffer.from([0, 0xff, 13, 10]));
  await write('content/nested/lesson.md', 'One\nTwo\n');
  assert.equal(await checkVersion(root), false);
  const first = await buildVersion(root);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.equal(await checkVersion(root), true);

  for (const dir of ['docs', 'tests', 'scripts', 'node_modules', 'test-artifacts']) await write(`${dir}/note.md`, 'Excluded');
  await write('content/nested/lesson.md', 'One\r\nTwo\r\n');
  assert.equal(await buildVersion(root), first);

  await write('index.html', `${shell}\n<title>New release</title>`);
  assert.equal(await checkVersion(root), false);
  const second = await buildVersion(root);
  assert.notEqual(second, first);
  await write('content/nested/lesson.md', 'New lesson');
  const third = await buildVersion(root);
  assert.notEqual(third, second);
  await write('assets/track.mp3', Buffer.from([0, 0xff, 10]));
  assert.equal(await checkVersion(root), false);
  const fourth = await buildVersion(root);
  assert.notEqual(fourth, third);
  await write('version.json', JSON.stringify({ hash: third }));
  assert.equal(await checkVersion(root), false);
  assert.equal(await buildVersion(root), fourth);
  assert.equal(await checkVersion(root), true);
});
