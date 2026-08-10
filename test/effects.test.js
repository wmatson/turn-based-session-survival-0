import test from 'node:test';
import assert from 'node:assert/strict';
import { pruneEffects } from '../src/effects.js';

test('effects from more than two turns ago are discarded while recent effects remain', () => {
  const effects = [
    { type: 'movement-trail', createdTurn: 7 },
    { type: 'weapon-fired', createdTurn: 8 },
    { type: 'movement-trail', createdTurn: 10 },
  ];

  assert.deepEqual(pruneEffects(effects, 10), [effects[1], effects[2]]);
});
