import { SPAWN_BANDS } from '../config.js';

export const spawnRulesForTurn = turn => {
  if (turn % 10 !== 0) return [];
  return SPAWN_BANDS
    .filter(band => turn >= band.minTurn && turn <= band.maxTurn)
    .map(({ enemyType, count }) => ({ enemyType, count }));
};
