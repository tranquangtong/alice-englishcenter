// npm run audio -- <test.json> | --all [--force]
// Default: Microsoft Edge Read Aloud via msedge-tts (MIT wrapper; Microsoft
// service terms apply separately). Alternative: LISTENING_TTS=azure with
// AZURE_SPEECH_KEY and AZURE_SPEECH_REGION. Neither key is written to disk.
import { readFile, writeFile, mkdir, mkdtemp, rm, stat, rename, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import ffmpegStatic from 'ffmpeg-static';
import { VOICES, safePath, validateTest } from '../assets/js/listening-core.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const xml = text => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const ffmpeg = process.env.FFMPEG_PATH || ffmpegStatic;
export async function runFFmpeg(args) {
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', ...args], { windowsHide: true });
    let error = '';
    const deadline = setTimeout(() => { child.kill(); reject(new Error('FFmpeg timed out after 120 seconds')); }, 120000);
    child.stderr.on('data', chunk => { error += chunk; });
    child.on('error', e => { clearTimeout(deadline); reject(e); });
    child.on('exit', code => { clearTimeout(deadline); code === 0 ? resolve() : reject(new Error(`FFmpeg exit ${code}: ${error}`)); });
  });
}
async function speech(item, output) {
  const voice = VOICES[item.voice];
  const provider = process.env.LISTENING_TTS || 'edge';
  if (provider === 'azure') {
    const region = process.env.AZURE_SPEECH_REGION;
    const key = process.env.AZURE_SPEECH_KEY;
    if (!key || !/^[a-z0-9-]+$/.test(region || '')) throw new Error('Azure needs AZURE_SPEECH_KEY and AZURE_SPEECH_REGION');
    const response = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST', signal: AbortSignal.timeout(45000),
      headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3', 'User-Agent': 'AliceEnglishListeningAudio' },
      body: `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${voice.slice(0, 5)}"><voice name="${voice}">${xml(item.text)}</voice></speak>`
    });
    if (!response.ok) throw new Error(`Azure synthesis HTTP ${response.status}`);
    await writeFile(output, Buffer.from(await response.arrayBuffer()));
  } else if (provider === 'edge') {
    const tts = new MsEdgeTTS({ connectionTimeoutMs: 15000, synthesisTimeoutMs: 45000 });
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(xml(item.text));
      await pipeline(audioStream, createWriteStream(output));
    } finally { tts.close(); }
  } else throw new Error(`Unknown LISTENING_TTS provider: ${provider}`);
  if ((await stat(output)).size < 100) throw new Error('TTS returned empty audio');
}
export async function buildTest(file, { force = false } = {}) {
  const input = path.resolve(root, file);
  const relative = path.relative(root, input).replaceAll('\\', '/');
  if (!safePath(relative)) throw new Error('Test must be inside the repository');
  const test = JSON.parse(await readFile(input, 'utf8'));
  const errors = validateTest(test, { imageExists: image => existsSync(path.join(root, image)) });
  if (errors.length) throw new Error(errors.join('\n'));
  const sourceTime = (await stat(input)).mtimeMs;
  let built = 0;
  for (const part of test.parts) {
    const output = path.resolve(root, part.audio);
    // Restrict writes to the declared audio trees, even for hand-edited JSON.
    if (!/^(?:assets\/audio\/ielts-gt\/listening|scripts\/fixtures\/audio)\/.+\.mp3$/.test(part.audio)) throw new Error(`Unsafe audio output: ${part.audio}`);
    try { if (!force && (await stat(output)).mtimeMs > sourceTime) { console.log(`SKIP ${part.audio} (up to date)`); continue; } } catch { /* Build absent outputs. */ }
    const temporary = await mkdtemp(path.join(tmpdir(), 'alice-listening-audio-'));
    try {
      const pcmFiles = [];
      for (const [index, item] of part.script.entries()) {
        const pcm = path.join(temporary, `${index}.pcm`);
        if ('pause' in item) {
          // Exact 24 kHz, mono, signed 16-bit PCM silence, including fractional pauses.
          await writeFile(pcm, Buffer.alloc(Math.round(item.pause * 24000) * 2));
        } else {
          console.log(`TTS ${test.id} Part ${part.part} line ${index + 1} · ${item.voice}`);
          const mp3 = path.join(temporary, `${index}.mp3`);
          for (let attempt = 1; ; attempt++) {
            try { await speech(item, mp3); break; }
            catch (error) {
              if (attempt >= 3) throw error;
              console.warn(`TTS retry ${attempt}/2: ${error.message}`);
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
          }
          await runFFmpeg(['-i', mp3, '-ar', '24000', '-ac', '1', '-f', 's16le', pcm]);
        }
        pcmFiles.push(pcm);
      }
      // Join PCM rather than MP3 frames: this avoids gaps/timestamps and preserves
      // reading pauses across different voices. Stream to avoid whole-test buffers.
      const combined = path.join(temporary, 'combined.pcm');
      await writeFile(combined, Buffer.alloc(0));
      for (const pcm of pcmFiles) await pipeline(createReadStream(pcm), createWriteStream(combined, { flags: 'a' }));
      const encoded = path.join(temporary, 'part.mp3');
      await runFFmpeg(['-f', 's16le', '-ar', '24000', '-ac', '1', '-i', combined, '-codec:a', 'libmp3lame', '-b:a', '48k', '-ac', '1', encoded]);
      await mkdir(path.dirname(output), { recursive: true });
      // Atomic replacement in the destination filesystem, only after all synthesis succeeds.
      await copyFile(encoded, `${output}.tmp`);
      await rename(`${output}.tmp`, output);
      console.log(`WROTE ${part.audio} (${(await stat(output)).size} bytes, mono 48 kbps)`); built++;
    } finally { await rm(temporary, { recursive: true, force: true }); }
  }
  return built;
}
async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  let files;
  if (args.includes('--all')) {
    const index = JSON.parse(await readFile(path.join(root, 'content/ielts-gt/listening/index.json'), 'utf8'));
    files = index.tests.map(test => test.file);
  } else files = args.filter(arg => !arg.startsWith('--'));
  if (!files.length) throw new Error('Usage: npm run audio -- <test.json> | --all [--force]');
  for (const file of files) await buildTest(file, { force });
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(`Audio build failed: ${error.message}`); process.exitCode = 1; });
}
