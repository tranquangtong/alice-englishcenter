import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { safePath, validateTest, validateExternal } from '../assets/js/listening-core.js';

const root = fileURLToPath(new URL('../', import.meta.url));
let errors = 0;
let warnings = 0;
const pending = relative => /^content\/syllabus\/[^/]+\.md$/.test(relative) || relative === 'content/roadmap-teacher-student.md';
function report(message, warning = false) {
  if (warning) warnings++; else errors++;
  console[warning ? 'warn' : 'error'](`${warning ? 'WARNING' : 'ERROR'}: ${message}`);
}
async function exists(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}
let manifest;
try {
  manifest = JSON.parse(await readFile(path.join(root, 'content/manifest.json'), 'utf8'));
  if (!Array.isArray(manifest) || !manifest.length) throw new Error('expected a nonempty array');
  const ids = new Set();
  const paths = new Set();
  for (const [index, entry] of manifest.entries()) {
    if (!entry || !['id', 'title', 'group', 'path'].every(key => typeof entry[key] === 'string' && entry[key].trim())) {
      report(`manifest entry ${index}: id, title, group and path must be nonempty strings`);
      continue;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id) || ids.has(entry.id)) report(`invalid or duplicate manifest id: ${entry.id}`);
    ids.add(entry.id);
    if (!/^(?:content|docs)\/(?:[\w-]+\/)*[\w-]+\.md$/.test(entry.path) || paths.has(entry.path)) {
      report(`invalid or duplicate manifest path: ${entry.path}`);
      continue;
    }
    paths.add(entry.path);
    if (!await exists(path.join(root, entry.path))) report(`manifest file missing: ${entry.path}`, pending(entry.path));
  }
} catch (error) { report(`content/manifest.json: ${error.message}`); }

const files = await walk(root);
let checkedLinks = 0;
async function checkLink(raw, source) {
  // External URLs, protocol-relative URLs and local fragments do not reference files.
  if (!raw || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(raw)) return;
  const relativeSource = path.relative(root, source);
  let target;
  try {
    const decoded = decodeURIComponent(raw.split(/[?#]/)[0].replace(/&amp;/g, '&'));
    if (!decoded) return;
    target = path.resolve(path.dirname(source), decoded);
  } catch { report(`${relativeSource}: malformed link ${raw}`); return; }
  const relative = path.relative(root, target);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    report(`${relativeSource}: link escapes site root: ${raw}`);
    return;
  }
  checkedLinks++;
  try {
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
  } catch { /* Report below, including known unpublished content. */ }
  if (!await exists(target)) report(`${relativeSource}: missing link target ${raw}`, pending(relative));
}
for (const file of files) {
  if (/\.(?:mjs|js)$/.test(file)) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    if (result.status !== 0) report(`${path.relative(root, file)}: JS parse failed\n${result.stderr || result.error || ''}`);
  }
  if (!/\.(?:md|html)$/.test(file)) continue;
  let source = await readFile(file, 'utf8');
  source = source.replace(/<!--[\s\S]*?-->/g, '');
  const markdown = file.endsWith('.md');
  if (markdown) source = source.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\n]*$/gm, '').replace(/`+[^`\n]*`+/g, '');
  const links = [];
  for (const match of source.matchAll(/\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) links.push(match[1] ?? match[2] ?? match[3]);
  if (markdown) {
    // Resolve inline links/images and both full and collapsed reference links.
    const definitions = new Map();
    const normalize = label => label.trim().replace(/\s+/g, ' ').toLowerCase();
    for (const match of source.matchAll(/^ {0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gm)) {
      const target = match[2] ?? match[3];
      definitions.set(normalize(match[1]), target);
      links.push(target);
    }
    source = source.replace(/^ {0,3}\[[^\]]+\]:.*$/gm, '');
    for (const match of source.matchAll(/!?\[([^\]]*)\]\(\s*(?:<([^>]+)>|((?:[^\s()]|\([^()]*\))+))(?:\s+["'][^\n]*?["'])?\s*\)/g)) links.push(match[2] ?? match[3]);
    for (const match of source.matchAll(/!?\[([^\]]+)\](?:\[([^\]]*)\])?(?!\()/g)) {
      const label = normalize(match[2] || match[1]);
      if (definitions.has(label)) links.push(definitions.get(label));
      else if (match[2] !== undefined) report(`${path.relative(root, file)}: undefined Markdown reference ${label}`);
    }
    for (const match of source.matchAll(/<(\.{1,2}\/[^<>\s]+)>/g)) links.push(match[1]);
  }
  for (const link of new Set(links)) await checkLink(link, file);
}
const listeningDirectory = 'content/ielts-gt/listening/';
const listeningIndex = path.join(root, listeningDirectory, 'index.json');
if (!await exists(listeningIndex)) console.log('NOTE: Listening index.json not present yet; skipping test catalogue validation.');
else {
  try {
    const catalog = JSON.parse(await readFile(listeningIndex, 'utf8'));
    if (!Array.isArray(catalog.tests)) throw new Error('tests array required');
    const ids = new Set();
    for (const entry of catalog.tests) {
      if (!entry || !/^[a-z0-9-]+$/.test(entry.id) || ids.has(entry.id) || !safePath(entry.file) || !entry.file.startsWith(listeningDirectory) || !entry.file.endsWith('.json')) {
        report('Listening index: invalid or duplicate test id/path'); continue;
      }
      ids.add(entry.id);
      try {
        const test = JSON.parse(await readFile(path.join(root, entry.file), 'utf8'));
        if (test.id !== entry.id) report(`${entry.file}: id differs from index`);
        for (const issue of validateTest(test, { imageExists: image => existsSync(path.join(root, image)) })) report(`${entry.file}: ${issue}`);
      } catch (error) { report(`${entry.file}: ${error.message}`); }
    }
  } catch (error) { report(`Listening index: ${error.message}`); }
}
const externalFile = path.join(root, listeningDirectory, 'external.json');
if (await exists(externalFile)) {
  try { for (const issue of validateExternal(JSON.parse(await readFile(externalFile, 'utf8')))) report(`Listening external.json: ${issue}`); }
  catch (error) { report(`Listening external.json: ${error.message}`); }
}
console.log(`Checked ${files.length} files, ${checkedLinks} relative links. ${errors} error(s), ${warnings} warning(s).`);
process.exitCode = errors ? 1 : 0;
