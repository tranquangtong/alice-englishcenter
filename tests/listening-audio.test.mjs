import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

test('built neural fixture MP3s decode as mono 48 kbps with the scripted reading pause', async () => {
  const fixture = JSON.parse(await readFile(new URL('../scripts/fixtures/sample-listening.json', import.meta.url)));
  let total = 0;
  for (const part of fixture.parts) {
    const audio = fileURLToPath(new URL(`../${part.audio}`, import.meta.url));
    total += (await stat(audio)).size;
    const result = spawnSync(ffmpeg, ['-hide_banner', '-i', audio, '-af', 'silencedetect=noise=-60dB:d=19', '-f', 'null', '-'], { encoding: 'utf8', timeout: 15000, windowsHide: true });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stderr, /Audio: mp3, 24000 Hz, mono.*48 kb\/s/);
    const pauses = [...result.stderr.matchAll(/silence_duration: ([\d.]+)/g)].map(match => Number(match[1]));
    // Includes a little natural trailing/leading silence from the neural voices.
    assert.ok(pauses.some(seconds => seconds >= 19.95 && seconds < 23), `missing 20-second reading pause: ${pauses}`);
  }
  assert.ok(total < 1_000_000, `fixture audio size ${total} must stay below 1 MB`);
});
