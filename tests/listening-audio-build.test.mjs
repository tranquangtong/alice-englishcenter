import test from 'node:test';
import assert from 'node:assert/strict';
import { mapConcurrent } from '../scripts/build-listening-audio.mjs';

test('audio synthesis bounds service connections and returns segments in script order', async () => {
  let active = 0, peak = 0;
  const completed = [];
  const result = await mapConcurrent([30, 1, 1, 1], 2, async (delay, index) => {
    active++; peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, delay));
    active--; completed.push(index);
    return `segment-${index}`;
  });
  assert.equal(peak, 2);
  assert.equal(active, 0);
  assert.notDeepEqual(completed, [0, 1, 2, 3]);
  assert.deepEqual(result, ['segment-0', 'segment-1', 'segment-2', 'segment-3']);
});

test('audio synthesis drains active workers before a failure allows temp cleanup', async () => {
  const started = [], finished = [];
  await assert.rejects(mapConcurrent([0, 1, 2, 3], 2, async (_, index) => {
    started.push(index);
    await new Promise(resolve => setTimeout(resolve, index === 0 ? 1 : 20));
    finished.push(index);
    if (index === 0) throw new Error('service unavailable');
  }), /service unavailable/);
  assert.deepEqual(started, [0, 1]);
  assert.deepEqual(finished, [0, 1]);
});
