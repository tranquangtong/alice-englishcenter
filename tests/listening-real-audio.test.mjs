import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpeg from 'ffmpeg-static';

test('16 real MP3s: duration, mono 48 kbps, spoken intro, all scripted pauses, total under 60 MB', { timeout: 120000 }, async () => {
  const catalog = JSON.parse(await readFile(new URL('../content/ielts-gt/listening/index.json', import.meta.url)));
  const report = [];
  let total = 0;
  for (const entry of catalog.tests) {
    const data = JSON.parse(await readFile(new URL(`../${entry.file}`, import.meta.url)));
    for (const part of data.parts) {
      const file = fileURLToPath(new URL(`../${part.audio}`, import.meta.url));
      const bytes = (await stat(file)).size; total += bytes;
      assert.ok(total <= 60_000_000, `audio exceeds 60 MB: ${total} bytes; stop generation`);
      const decoded = spawnSync(ffmpeg, ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-60dB:d=4', '-f', 'null', '-'], { encoding: 'utf8', timeout: 15000, windowsHide: true });
      assert.equal(decoded.status, 0, decoded.stderr);
      assert.match(decoded.stderr, /Audio: mp3, 24000 Hz, mono.*48 kb\/s/);
      const duration = /Duration: (\d+):(\d+):([\d.]+)/.exec(decoded.stderr);
      assert.ok(duration, `${part.audio}: duration missing`);
      const seconds = Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]);
      assert.ok(seconds > 120, `${part.audio}: only ${seconds}s`);
      const silenceStarts = [...decoded.stderr.matchAll(/silence_start: ([\d.]+)/g)].map(m => Number(m[1]));
      const detected = [...decoded.stderr.matchAll(/silence_duration: ([\d.]+)/g)].map(m => Number(m[1]));
      assert.equal(part.script[0].voice, 'en-GB-narrator');
      assert.ok(silenceStarts[0] > 1 && silenceStarts[0] < 90, `${part.audio}: spoken narrator must precede reading pause`);
      const pauses = part.script.filter(s => 'pause' in s).map(s => s.pause);
      const remaining = [...detected];
      for (const pause of pauses) {
        const found = remaining.findIndex(s => s >= pause - 0.1 && s < pause + 3);
        assert.ok(found >= 0, `${part.audio}: missing ${pause}s pause; detected ${detected}`);
        remaining.splice(found, 1);
      }
      report.push({ file: part.audio, bytes, seconds, kbps: 48, channels: 1, scriptedPauses: pauses, detectedPauses: detected });
    }
  }
  assert.equal(report.length, 16);
  await mkdir('test-artifacts', { recursive: true });
  await writeFile('test-artifacts/listening-audio-report.json', JSON.stringify({ totalBytes: total, files: report }, null, 2));
});
