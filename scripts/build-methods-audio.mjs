import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildClip } from './build-listening-audio.mjs';
import { validatePractice } from '../assets/js/listening-methods-core.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(await readFile(path.join(root, 'content/ielts-gt/listening/index.json'), 'utf8'));
const args = process.argv.slice(2);
const selected = args.filter(arg => arg !== '--force');
const methods = catalog.methods.filter(method => !selected.length || selected.includes(method.id));
if (!methods.length || selected.some(id => !methods.some(method => method.id === id))) throw new Error('Usage: npm run audio:methods -- [method-id …] [--force]');
for (const method of methods) {
  const expected = `content/ielts-gt/listening/methods/${method.id}/exercises.json`;
  if (!/^[a-z-]+$/.test(method.id) || method.file !== expected) throw new Error(`Invalid method path: ${method.file}`);
  const input = path.join(root, expected);
  const sourceTime = (await stat(input)).mtimeMs;
  const exercises = JSON.parse(await readFile(input, 'utf8'));
  for (const exercise of exercises) {
    const errors = validatePractice(exercise, method.id);
    if (errors.length) throw new Error(`${exercise.id}: ${errors.join('; ')}`);
    for (const clip of exercise.clips) {
      if (clip.source.kind === 'tatoeba') continue;
      const output = path.join(root, clip.audio);
      const existing = await stat(output).catch(error => { if (error.code !== 'ENOENT') throw error; });
      if (!args.includes('--force') && existing?.size > 100 && existing.mtimeMs >= sourceTime) {
        console.log(`SKIP ${clip.audio} (up to date)`);
        continue;
      }
      await buildClip(clip.script, output, `${exercise.id}/${clip.id}`);
    }
  }
}
