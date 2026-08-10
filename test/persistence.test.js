import test from 'node:test';
import assert from 'node:assert/strict';
import { buyPermanent, loadProgress, normalizeProgress, permanentCosts, saveProgress } from '../src/persistence.js';

test('progress normalization rejects malformed and unknown saved values', () => {
  const storage = { getItem: () => '{"gold":"999999","permanentUpgrades":{"toughness":999,"unknown":5}}' };
  assert.deepEqual(loadProgress(storage), { gold: 0, permanentUpgrades: { toughness: 3, startingMagnet: 0, sharpStart: 0, startingOrbitingStone: 0, startingCrossbow: 0, startingAxe: 0, startingLightningBolt: 0, startingFireWave: 0 } });
  assert.deepEqual(normalizeProgress({ gold: -4, permanentUpgrades: { toughness: Infinity } }), { gold: 0, permanentUpgrades: { toughness: 0, startingMagnet: 0, sharpStart: 0, startingOrbitingStone: 0, startingCrossbow: 0, startingAxe: 0, startingLightningBolt: 0, startingFireWave: 0 } });
});

test('saveProgress contains storage failures at the adapter boundary', () => {
  const storage = { setItem: () => { throw new Error('storage unavailable'); } };
  assert.equal(saveProgress({ gold: 10, permanentUpgrades: {} }, storage), false);
});

test('starting weapon unlocks cost 100 gold each', () => {
  const ids = ['startingOrbitingStone', 'startingCrossbow', 'startingAxe', 'startingLightningBolt', 'startingFireWave'];
  for (const id of ids) {
    assert.deepEqual(permanentCosts[id], [100]);
    const progress = buyPermanent({ gold: 100, permanentUpgrades: Object.fromEntries(ids.map(candidate => [candidate, 0])) }, id);
    assert.equal(progress.gold, 0);
    assert.equal(progress.permanentUpgrades[id], 1);
  }
});
