export const ENEMY_DEFINITIONS = {
  'red-square': { hp: 1, contactDamage: 1, movementPeriod: 3, shape: 'square', color: '#e55252' },
  'blue-square': { hp: 3, contactDamage: 2, movementPeriod: 3, shape: 'square', color: '#4f8cff' },
  'green-circle': { hp: 1, contactDamage: 1, movementPeriod: 2, shape: 'circle', color: '#62d47e' },
};

export const WEAPON_DEFINITIONS = {
  knife: { damage: 1, range: 2, period: 5, phase: 'preEnemyMove', targeting: 'line', damagesObjects: true, effectColor: '#ffd166' },
  'orbiting-stone': { damage: 1, period: 7, phase: 'postEnemyMove', targeting: 'adjacent', damagesObjects: false, effectColor: '#8be9fd' },
  crossbow: { damage: 1, range: 6, period: 8, phase: 'preEnemyMove', targeting: 'first-in-line', damagesObjects: true, effectColor: '#8be9fd' },
};

export const UPGRADE_DEFINITIONS = [
  { id: 'sharpened-knife', name: 'Sharpened Knife', description: 'Knife damage +1', eligibility: s => s.player.weapons.some(w => w.type === 'knife'), apply: s => s.player.weapons.forEach(w => { if (w.type === 'knife') w.damage += 1; }) },
  { id: 'long-knife', name: 'Long Knife', description: 'Knife range +1', eligibility: s => s.player.weapons.some(w => w.type === 'knife'), apply: s => s.player.weapons.forEach(w => { if (w.type === 'knife') w.range += 1; }) },
  { id: 'quick-hands', name: 'Quick Hands', description: 'Knife fires one turn more often', eligibility: s => s.player.weapons.some(w => w.type === 'knife' && w.period > 2), apply: s => s.player.weapons.forEach(w => { if (w.type === 'knife') w.period = Math.max(2, w.period - 1); }) },
  { id: 'vitality', name: 'Vitality', description: 'Max HP +2 and heal 2', eligibility: () => true, apply: s => { s.player.maxHp += 2; s.player.hp = Math.min(s.player.maxHp, s.player.hp + 2); } },
  { id: 'magnetism', name: 'Magnetism', description: 'Pickup range +1', eligibility: () => true, apply: s => { s.player.pickupRange += 1; } },
  { id: 'orbiting-stone', name: 'Orbiting Stone', description: 'Every 7 turns, strike adjacent enemies', eligibility: s => !s.player.weapons.some(w => w.type === 'orbiting-stone'), apply: s => s.player.weapons.push({ id: 'orbiting-stone', type: 'orbiting-stone', ...WEAPON_DEFINITIONS['orbiting-stone'] }) },
  { id: 'crossbow', name: 'Crossbow', description: 'Every 8 turns, fire a bolt range 6', eligibility: s => !s.player.weapons.some(w => w.type === 'crossbow'), apply: s => s.player.weapons.push({ id: 'crossbow', type: 'crossbow', ...WEAPON_DEFINITIONS.crossbow }) },
];

export const SPAWN_BANDS = [
  { minTurn: 1, maxTurn: 49, enemyType: 'red-square', count: 2 },
  { minTurn: 50, maxTurn: 99, enemyType: 'red-square', count: 4 },
  { minTurn: 100, maxTurn: 149, enemyType: 'red-square', count: 8 },
  { minTurn: 200, maxTurn: Infinity, enemyType: 'blue-square', count: 2 },
  { minTurn: 200, maxTurn: Infinity, enemyType: 'green-circle', count: 4 },
];

export const PERMANENT_UPGRADE_COSTS = {
  toughness: [10, 25, 50],
  startingMagnet: [20],
  sharpStart: [30],
};

export const xpRequired = level => 5 + (level - 1) * 3;
export const getUpgrade = id => UPGRADE_DEFINITIONS.find(upgrade => upgrade.id === id);
