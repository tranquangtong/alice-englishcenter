import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const versionTag = /(<meta name="aec-version" content=")[a-f0-9]{0,64}(?=">)/;
const textFile = /\.(?:css|html|js|json|md|svg|txt|xml)$/i;
const normalize = text => text.replace(/\r\n/g, '\n');

async function deployedFiles(siteRoot, directory) {
  const files = [];
  for (const entry of await readdir(path.join(siteRoot, directory), { withFileTypes: true })) {
    const name = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await deployedFiles(siteRoot, name));
    else if (entry.isFile()) files.push(name);
  }
  return files;
}

async function versionOutput(siteRoot) {
  const html = await readFile(path.join(siteRoot, 'index.html'), 'utf8');
  if (!versionTag.test(html)) throw new Error('index.html is missing its aec-version meta tag');
  // Blank the generated stamp so this HTML field can identify its own release.
  const digestInput = normalize(html.replace(versionTag, '$1'));
  const files = ['index.html', ...await deployedFiles(siteRoot, 'assets'), ...await deployedFiles(siteRoot, 'content')];
  const digest = createHash('sha256');
  for (const filename of files.sort()) {
    let bytes = filename === 'index.html' ? Buffer.from(digestInput) : await readFile(path.join(siteRoot, filename));
    if (filename !== 'index.html' && textFile.test(filename)) bytes = Buffer.from(normalize(bytes.toString('utf8')));
    digest.update(`${filename}\0${bytes.length}\0`).update(bytes);
  }
  const hash = digest.digest('hex');
  return { hash, html, stamped: html.replace(versionTag, (_, prefix) => prefix + hash) };
}

export async function checkVersion(siteRoot = root) {
  const { hash, html, stamped } = await versionOutput(siteRoot);
  try {
    const version = JSON.parse(await readFile(path.join(siteRoot, 'version.json'), 'utf8'));
    return html === stamped && version?.hash === hash;
  } catch { return false; }
}

export async function buildVersion(siteRoot = root) {
  const { hash, html, stamped } = await versionOutput(siteRoot);
  if (html !== stamped) await writeFile(path.join(siteRoot, 'index.html'), stamped);
  await writeFile(path.join(siteRoot, 'version.json'), `${JSON.stringify({ hash })}\n`);
  return hash;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`version.json: ${await buildVersion()}`);
}
