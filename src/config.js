export const ENEMY_DEFINITIONS = {
  'red-square': { hp: 1, contactDamage: 1, movementPeriod: 3, xp: 1, goldChance: 2, gold: 1, shape: 'square', color: '#e55252' },
  'blue-square': { hp: 3, contactDamage: 2, movementPeriod: 3, xp: 3, goldChance: 2, gold: 1, shape: 'square', color: '#4f8cff' },
  'green-circle': { hp: 1, contactDamage: 1, movementPeriod: 2, xp: 1, goldChance: 2, gold: 1, shape: 'circle', color: '#62d47e' },
};

export const BREAKABLE_DEFINITIONS = {
  jar: { hp: 1, healthChance: 25, goldChance: 35, enemyKillChance: 1, gold: 5, health: 3 },
  chest: { hp: 1, healthChance: 0, goldChance: 100, enemyKillChance: 0, gold: 10 },
};

export const WEAPON_DEFINITIONS = {
  knife: {
    name: 'Knife', description: 'Reliable forward strikes', icon: '⚔', damage: 1, range: 2, period: 5, phase: 'preEnemyMove',
    targeting: { mode: 'vectors', vectors: [[1, 0], [2, 0]], extend: [1, 0] },
    damagesObjects: true, effectColor: '#ffd166',
    upgrades: [
      { id: 'sharpened-knife', name: 'Sharpened Knife', description: 'Knife damage +1', operation: { kind: 'weapon-stat', stat: 'damage', amount: 1 } },
      { id: 'long-knife', name: 'Long Knife', description: 'Knife range +1', operation: { kind: 'weapon-stat', stat: 'range', amount: 1 } },
      { id: 'quick-hands', name: 'Quick Hands', description: 'Knife fires one turn more often', operation: { kind: 'weapon-stat', stat: 'period', amount: -1, minimum: 2 } },
    ],
  },
  'orbiting-stone': {
    name: 'Orbiting Stone', description: 'Hits enemies around you', icon: '✦', damage: 1, period: 7, phase: 'postEnemyMove',
    targeting: { mode: 'vectors', vectors: [[1, 0], [-1, 0], [0, 1], [0, -1]] },
    damagesObjects: false, effectColor: '#8be9fd',
    upgrades: [
      { id: 'heavy-stone', name: 'Heavy Stone', description: 'Orbiting Stone damage +1', operation: { kind: 'weapon-stat', stat: 'damage', amount: 1 } },
      { id: 'quick-stone', name: 'Quick Stone', description: 'Orbiting Stone fires one turn more often', operation: { kind: 'weapon-stat', stat: 'period', amount: -1, minimum: 2 } },
    ],
  },
  crossbow: {
    name: 'Crossbow', description: 'Long-range line shot', icon: '➶', damage: 1, range: 6, period: 8, phase: 'preEnemyMove',
    targeting: { mode: 'first-in-line' },
    damagesObjects: true, effectColor: '#8be9fd',
    upgrades: [
      { id: 'reinforced-bolt', name: 'Reinforced Bolt', description: 'Crossbow damage +1', operation: { kind: 'weapon-stat', stat: 'damage', amount: 1 } },
      { id: 'long-bolt', name: 'Long Bolt', description: 'Crossbow range +2', operation: { kind: 'weapon-stat', stat: 'range', amount: 2 } },
    ],
  },
  axe: {
    name: 'Axe', description: 'Wide three-cell sweep', icon: '◈', damage: 1, range: 1, period: 6, phase: 'preEnemyMove',
    targeting: { mode: 'vectors', vectors: [[1, -1], [1, 0], [1, 1]] },
    damagesObjects: true, effectColor: '#ff9f68',
    upgrades: [
      { id: 'heavy-axe', name: 'Heavy Axe', description: 'Axe damage +1', operation: { kind: 'weapon-stat', stat: 'damage', amount: 1 } },
    ],
  },
  'lightning-bolt': {
    name: 'Lightning Bolt', description: 'Randomly strikes on-screen enemies', icon: 'ϟ', damage: 1, period: 5, phase: 'preEnemyMove',
    targeting: { mode: 'random-visible' },
    damagesObjects: false, effectColor: '#ff5d73',
    upgrades: [],
  },
  'fire-wave': {
    name: 'Fire Wave', description: 'Persistent two-cell wave', icon: '♨', damage: 1, period: 10, phase: 'preEnemyMove',
    targeting: { mode: 'projectile', speed: 2 },
    damagesObjects: false, effectColor: '#ff7b32',
    upgrades: [],
  },
};

const weaponUpgrades = weaponType => (WEAPON_DEFINITIONS[weaponType].upgrades ?? []).map(upgrade => ({ ...upgrade, weaponType }));
const weaponUnlock = (id, name, description, weaponType) => ({ id, name, description, operation: { kind: 'add-weapon', weaponType } });

export const UPGRADE_DEFINITIONS = [
  ...weaponUpgrades('knife'),
  ...weaponUpgrades('orbiting-stone'),
  ...weaponUpgrades('crossbow'),
  ...weaponUpgrades('axe'),
  { id: 'vitality', name: 'Vitality', description: 'Max HP +2 and heal 2', operation: { kind: 'player-stat', stat: 'maxHp', amount: 2, heal: 2 } },
  { id: 'magnetism', name: 'Magnetism', description: 'Pickup range +1', operation: { kind: 'player-stat', stat: 'pickupRange', amount: 1 } },
  weaponUnlock('orbiting-stone', 'Orbiting Stone', 'Every 7 turns, strike adjacent enemies', 'orbiting-stone'),
  weaponUnlock('crossbow', 'Crossbow', 'Every 8 turns, fire a bolt range 6', 'crossbow'),
  weaponUnlock('axe', 'Axe', 'Every 6 turns, strike three cells wide', 'axe'),
  weaponUnlock('lightning-bolt', 'Lightning Bolt', 'Every 5 turns, randomly strike a visible enemy', 'lightning-bolt'),
  weaponUnlock('fire-wave', 'Fire Wave', 'Every 10 turns, launch a two-cell-per-turn fire projectile', 'fire-wave'),
  { id: 'regeneration', name: 'Regeneration', description: 'Restore 1 HP every 50 turns; each rank shortens the interval by 10', stackable: true, operation: { kind: 'regeneration', amount: 1 } },
];

export const SPAWN_BANDS = [
  { minTurn: 1, maxTurn: 49, enemyType: 'red-square', count: 2 },
  { minTurn: 50, maxTurn: 99, enemyType: 'red-square', count: 4 },
  { minTurn: 100, maxTurn: 149, enemyType: 'red-square', count: 8 },
  { minTurn: 200, maxTurn: Infinity, enemyType: 'blue-square', count: 2 },
  { minTurn: 200, maxTurn: Infinity, enemyType: 'green-circle', count: 4 },
  { minTurn: 450, maxTurn: Infinity, enemyType: 'red-square', count: 4 },
  { minTurn: 600, maxTurn: Infinity, enemyType: 'blue-square', count: 2 },
  { minTurn: 800, maxTurn: Infinity, enemyType: 'green-circle', count: 4 },
];

export const PERMANENT_UPGRADE_COSTS = {
  toughness: [10, 25, 50],
  startingMagnet: [20],
  sharpStart: [30],
  startingOrbitingStone: [100],
  startingCrossbow: [100],
  startingAxe: [100],
  startingLightningBolt: [100],
  startingFireWave: [100],
};

export const PERMANENT_UPGRADE_DEFINITIONS = [
  { id: 'toughness', name: 'Toughness', description: '+1 starting max HP', operation: { kind: 'starting-stat', stat: 'maxHp', amount: 1 } },
  { id: 'startingMagnet', name: 'Starting Magnet', description: '+1 starting pickup range', operation: { kind: 'starting-stat', stat: 'pickupRange', amount: 1 } },
  { id: 'sharpStart', name: 'Sharp Start', description: '+1 starting Knife damage', operation: { kind: 'weapon-stat', weaponType: 'knife', stat: 'damage', amount: 1 } },
  { id: 'startingOrbitingStone', name: 'Starting Orbiting Stone', description: 'Unlock Orbiting Stone as a selectable starting weapon', operation: { kind: 'starting-weapon', weaponType: 'orbiting-stone' } },
  { id: 'startingCrossbow', name: 'Starting Crossbow', description: 'Unlock Crossbow as a selectable starting weapon', operation: { kind: 'starting-weapon', weaponType: 'crossbow' } },
  { id: 'startingAxe', name: 'Starting Axe', description: 'Unlock Axe as a selectable starting weapon', operation: { kind: 'starting-weapon', weaponType: 'axe' } },
  { id: 'startingLightningBolt', name: 'Starting Lightning Bolt', description: 'Unlock Lightning Bolt as a selectable starting weapon', operation: { kind: 'starting-weapon', weaponType: 'lightning-bolt' } },
  { id: 'startingFireWave', name: 'Starting Fire Wave', description: 'Unlock Fire Wave as a selectable starting weapon', operation: { kind: 'starting-weapon', weaponType: 'fire-wave' } },
];

export const xpRequired = level => 5 + (level - 1) * 3;
export const getUpgrade = id => UPGRADE_DEFINITIONS.find(upgrade => upgrade.id === id);
