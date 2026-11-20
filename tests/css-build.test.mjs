import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
  await writeFile(target, (await readFile(target, 'utf8')) + ' '.repeat(60_000));
  const result = await checkCSS(root);
  assert.match(result.errors.join('\n'), /budget/);
  assert.ok(result.gzip < result.raw);
});

test('CSS budgets enforce combined loaded raw bytes and separately compressed gzip bytes', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'alice-css-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'assets/css'), { recursive: true });
  await writeFile(path.join(root, 'index.html'), '<link rel="stylesheet" href="a.min.css"><link rel="stylesheet" href="b.min.css">');
  const a = path.join(root, 'a.min.css');
  const b = path.join(root, 'b.min.css');
  await writeFile(a, ' '.repeat(30_000));
  await writeFile(b, ' '.repeat(29_999));
  assert.deepEqual((await checkCSS(root)).errors, []);
  await writeFile(b, ' '.repeat(30_000));
  assert.match((await checkCSS(root)).errors.join('\n'), /<60,000-byte raw budget: 60000 bytes/);
  // Deterministic, poorly compressible text isolates gzip failure below the raw limit.
  const text = Array.from({ length: 750 }, (_, i) => createHash('sha256').update(String(i)).digest('hex')).join('');
  await writeFile(a, text.slice(0, 24_000));
  await writeFile(b, text.slice(24_000));
  const result = await checkCSS(root);
  assert.ok(result.raw < 60_000);
  assert.ok(result.gzip >= 15_000);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /<15,000-byte gzip budget/);
});

test('method route includes lazy styles and has a separate budget', async t => {
  const root = await mkdtemp(path.join(tmpdir(), 'alice-css-method-budget-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'assets/css'), { recursive: true });
  const base = '<link rel="stylesheet" href="base.css?v=1">';
  const practice = '<meta name="aec-practice-css" content="practice.css?v=2">';
  const html = path.join(root, 'index.html');
  await writeFile(html, base + practice);
  await writeFile(path.join(root, 'base.css'), ' '.repeat(59_000));
  await writeFile(path.join(root, 'practice.css'), ' '.repeat(13_000));
  const result = await checkCSS(root);
  assert.equal(result.raw, 59_000);
  assert.equal(result.methods.raw, 72_000);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /Methods CSS.*<72,000-byte raw budget/);
  await writeFile(html, base + practice + '<link rel="stylesheet" href="practice.css">');
  assert.match((await checkCSS(root)).errors.join('\n'), /must load only on method routes/);
});
