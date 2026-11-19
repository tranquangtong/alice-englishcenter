import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { minifyCSS, cssOutputs, checkCSS } from '../scripts/build-css.mjs';

test('CSS minification preserves strings, SVG URLs, descendant pseudos, escapes and calc spacing', () => {
  const svg = 'url("data:image/svg+xml,<svg viewBox=\'0 0 24 24\'>/*literal*/</svg>")';
  const css = `/* header */ .a :focus, .b > span { content: "a;  b \\\" c"; background: ${svg}; width: calc(100% - 2px); --value: 1  2; }`;
  assert.equal(minifyCSS(css), `.a :focus,.b>span{content:"a;  b \\\" c";background:${svg};width:calc(100% - 2px);--value:1 2}`);
  assert.equal(minifyCSS('a/**/b { margin: 0; }'), 'a/**/b{margin:0}');
  assert.equal(minifyCSS('.a\\:b { color: red; }'), '.a\\:b{color:red}');
  assert.equal(minifyCSS('.\\31  .a { color: red; }'), '.\\31  .a{color:red}');
  assert.equal(minifyCSS('.\\31\r\n.a { color: red; }'), '.\\31\r\n.a{color:red}');
  assert.equal(minifyCSS('a { background: url(data:text/plain,a/**/b); }'), 'a{background:url(data:text/plain,a/**/b)}');
  assert.throws(() => minifyCSS('/* unfinished'), /Unclosed CSS comment/);
  assert.throws(() => minifyCSS('a { content: "unfinished'), /Unclosed CSS string/);
  assert.throws(() => minifyCSS('a { background: url(unfinished'), /Unclosed CSS URL/);
});

test('CSS check catches missing/stale builds, including comment-only source edits, and loaded-byte overruns', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'alice-css-build-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'assets/css'), { recursive: true });
  const source = path.join(root, 'assets/css/style.css');
  const target = path.join(root, 'assets/css/style.min.css');
  await writeFile(source, 'a { color: red; }');
  await writeFile(path.join(root, 'index.html'), '<link rel="stylesheet" href="https://fonts.example/font.css"><link rel="stylesheet" href="assets/css/style.min.css?v=2">');
  assert.match((await checkCSS(root)).errors.join('\n'), /missing or stale/);
  const outputs = await cssOutputs(root);
  assert.equal(outputs.length, 1);
  await writeFile(target, outputs[0].contents);
  assert.deepEqual((await checkCSS(root)).errors, []);
  await writeFile(source, 'a { color: red; }\r\n');
  await writeFile(target, (await cssOutputs(root))[0].contents.replace(/\n/g, '\r\n'));
  assert.deepEqual((await checkCSS(root)).errors, []);
  await writeFile(source, 'a { color: red; }\n');
  assert.deepEqual((await checkCSS(root)).errors, []);
  await writeFile(source, '/* changed */ a { color: red; }');
  assert.match((await checkCSS(root)).errors.join('\n'), /missing or stale/);
  await writeFile(target, (await cssOutputs(root))[0].contents);
  assert.deepEqual((await checkCSS(root)).errors, []);
  await writeFile(target, (await readFile(target, 'utf8')) + ' '.repeat(40_000));
  const result = await checkCSS(root);
  assert.match(result.errors.join('\n'), /budget/);
  assert.ok(result.gzip < result.raw);
});
