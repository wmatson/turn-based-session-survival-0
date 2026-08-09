export const DIRECTIONS = ['north', 'south', 'east', 'west'];
export const DELTAS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
export const ACTIONS = {
  move: direction => ({ type: 'move', direction }),
  moveNorth: { type: 'move', direction: 'north' }, moveSouth: { type: 'move', direction: 'south' },
  moveEast: { type: 'move', direction: 'east' }, moveWest: { type: 'move', direction: 'west' },
  wait: { type: 'wait' }, waitFacing: direction => ({ type: 'wait-facing', direction }),
  continue: { type: 'continue' }, exit: { type: 'exit' }, selectUpgrade: id => ({ type: 'select-upgrade', id }),
};

const clone = value => structuredClone(value);
const key = p => `${p[0]},${p[1]}`;
export const distance = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
export const chunkOf = (x, y) => [Math.floor(x / 20), Math.floor(y / 20)];
export const hashSeed = (...values) => { let h = 2166136261 >>> 0; for (const value of values) { h ^= Number(value) >>> 0; h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };
const chunkWall = (map, cx, cy) => { const h = hashSeed(map.seed, cx, cy); return { x: cx * 20 + 2 + h % 15, y: cy * 20 + 2 + Math.floor(h / 31) % 15 }; };
export const terrainAt = (map, x, y) => { const [cx, cy] = chunkOf(x, y); const wall = chunkWall(map, cx, cy); return x >= wall.x && x < wall.x + 3 && y >= wall.y && y < wall.y + 5 ? 'wall' : 'floor'; };
const occupied = (state, p, ignoreId = null) => state.player.position[0] === p[0] && state.player.position[1] === p[1] || state.enemies.some(e => e.id !== ignoreId && key(e.position) === key(p)) || state.breakables.some(o => key(o.position) === key(p));
const validRng = rng => rng && typeof rng.nextInt === 'function' ? rng : seededRng(0);
export const seededRng = (seed = 1) => { let value = seed >>> 0; return { nextInt(max) { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return max ? value % max : 0; }, get state() { return value; } }; };

export const xpRequired = level => 5 + (level - 1) * 3;
export const spawnRulesForTurn = turn => turn >= 1 && turn < 50 && turn % 10 === 0 ? [{ enemyType: 'red-square', count: 2 }] : turn >= 50 && turn < 100 && turn % 10 === 0 ? [{ enemyType: 'red-square', count: 4 }] : turn >= 100 && turn < 150 && turn % 10 === 0 ? [{ enemyType: 'red-square', count: 8 }] : [];

const upgradePool = [
  { id: 'sharpened-knife', name: 'Sharpened Knife', description: 'Knife damage +1', eligibility: s => s.player.weapons.some(w => w.type === 'knife'), apply: s => s.player.weapons.forEach(w => { if (w.type === 'knife') w.damage += 1; }) },
  { id: 'long-knife', name: 'Long Knife', description: 'Knife range +1', eligibility: s => s.player.weapons.some(w => w.type === 'knife'), apply: s => s.player.weapons.forEach(w => { if (w.type === 'knife') w.range += 1; }) },
  { id: 'quick-hands', name: 'Quick Hands', description: 'Knife fires one turn more often', eligibility: s => s.player.weapons.some(w => w.type === 'knife' && w.period > 2), apply: s => s.player.weapons.forEach(w => { if (w.type === 'knife') w.period = Math.max(2, w.period - 1); }) },
  { id: 'vitality', name: 'Vitality', description: 'Max HP +2 and heal 2', eligibility: () => true, apply: s => { s.player.maxHp += 2; s.player.hp = Math.min(s.player.maxHp, s.player.hp + 2); } },
  { id: 'magnetism', name: 'Magnetism', description: 'Pickup range +1', eligibility: () => true, apply: s => { s.player.pickupRange += 1; } },
  { id: 'orbiting-stone', name: 'Orbiting Stone', description: 'Every 7 turns, strike adjacent enemies', eligibility: s => !s.player.weapons.some(w => w.type === 'orbiting-stone'), apply: s => s.player.weapons.push({ id: 'orbiting-stone', type: 'orbiting-stone', damage: 1, period: 7, phase: 'postEnemyMove' }) },
  { id: 'crossbow', name: 'Crossbow', description: 'Every 8 turns, fire a bolt range 6', eligibility: s => !s.player.weapons.some(w => w.type === 'crossbow'), apply: s => s.player.weapons.push({ id: 'crossbow', type: 'crossbow', damage: 1, range: 6, period: 8, phase: 'preEnemyMove' }) },
];
const upgradeById = id => upgradePool.find(u => u.id === id);

export const createGame = ({ seed = 1, permanent = {} } = {}) => {
  const maxHp = 10 + (permanent.toughness || 0);
  const state = { seed, map: { seed }, turn: 0, status: 'playing', victoryReached: false, runGold: 0, nextEntityId: 1,
    player: { position: [0, 0], facing: 'north', hp: maxHp, maxHp, xp: 0, level: 1, pickupRange: 1 + (permanent.startingMagnet || 0), upgrades: [],
      weapons: [{ id: 'knife', type: 'knife', damage: 1 + (permanent.sharpStart || 0), range: 2, period: 5, phase: 'preEnemyMove' }] },
    enemies: [], breakables: [], pickups: [], pendingUpgradeChoices: [] };
  for (let cx = -2; cx <= 2; cx++) for (let cy = -2; cy <= 2; cy++) {
    const h = hashSeed(seed, cx, cy, 91); if (h % 7 !== 0) continue;
    const candidate = [cx * 20 + 4 + h % 11, cy * 20 + 4 + Math.floor(h / 17) % 11];
    if (key(candidate) !== '0,0' && terrainAt(state.map, ...candidate) === 'floor') state.breakables.push({ id: state.nextEntityId++, type: 'jar', position: candidate, hp: 1 });
  }
  return state;
};

const event = (type, data = {}) => ({ type, ...data });
const pos = (p, d, amount = 1) => [p[0] + DELTAS[d][0] * amount, p[1] + DELTAS[d][1] * amount];
const damageEnemy = (state, enemy, amount, events) => { enemy.hp -= amount; events.push(event('enemy-damaged', { enemyId: enemy.id, amount, position: [...enemy.position] })); if (enemy.hp <= 0) { events.push(event('enemy-killed', { enemyId: enemy.id, position: [...enemy.position] })); state.pickups.push({ id: state.nextEntityId++, type: 'xp', position: [...enemy.position], value: 1 }); events.push(event('pickup-spawned', { pickupType: 'xp', position: [...enemy.position] })); state.runGold += 1; state.enemies = state.enemies.filter(e => e.id !== enemy.id); } };
const damageObject = (state, object, amount, events, rng) => { object.hp -= amount; events.push(event('object-damaged', { objectId: object.id, amount })); if (object.hp <= 0) { state.breakables = state.breakables.filter(o => o.id !== object.id); events.push(event('object-broken', { objectId: object.id, position: [...object.position] })); if (rng.nextInt(100) < 25) { state.pickups.push({ id: state.nextEntityId++, type: 'health', position: [...object.position], value: 3 }); events.push(event('pickup-spawned', { pickupType: 'health', position: [...object.position] })); } } };
const fireWeapon = (state, weapon, events, rng) => {
  const origin = [...state.player.position]; const cells = []; let targets = [];
  if (weapon.type === 'knife') { for (let i = 1; i <= weapon.range; i++) cells.push(pos(origin, state.player.facing, i)); targets = state.enemies.filter(e => cells.some(c => key(c) === key(e.position))); }
  if (weapon.type === 'crossbow') { for (let i = 1; i <= weapon.range; i++) { const c = pos(origin, state.player.facing, i); cells.push(c); const hit = state.enemies.find(e => key(e.position) === key(c)); if (hit) { targets = [hit]; break; } } }
  if (weapon.type === 'orbiting-stone') { for (const d of DIRECTIONS) cells.push(pos(origin, d)); targets = state.enemies.filter(e => cells.some(c => key(c) === key(e.position))); }
  events.push(event('weapon-fired', { weapon: weapon.type, origin, direction: state.player.facing, cells }));
  for (const target of [...targets]) if (state.enemies.some(e => e.id === target.id)) damageEnemy(state, target, weapon.damage, events);
  if (weapon.type === 'knife' || weapon.type === 'crossbow') for (const object of [...state.breakables]) if (cells.some(c => key(c) === key(object.position))) damageObject(state, object, weapon.damage, events, rng);
};
const runWeapons = (state, phase, events, rng) => { for (const weapon of state.player.weapons) if (weapon.phase === phase && state.turn % weapon.period === 0) fireWeapon(state, weapon, events, rng); };
const enemyOrder = (a, b) => a.spawnTurn - b.spawnTurn || distance(a.spawnPosition, [0,0]) - distance(b.spawnPosition, [0,0]) || a.spawnPosition[0] - b.spawnPosition[0] || a.spawnPosition[1] - b.spawnPosition[1] || a.id - b.id;
const moveEnemies = (state, events) => {
  if (state.turn % 3) return;
  const ordered = [...state.enemies].sort(enemyOrder);
  for (const enemy of ordered) {
    if (!state.enemies.some(e => e.id === enemy.id)) continue;
    const dx = state.player.position[0] - enemy.position[0], dy = state.player.position[1] - enemy.position[1];
    const direction = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'east' : 'west') : (dy >= 0 ? 'south' : 'north');
    const destination = pos(enemy.position, direction);
    if (key(destination) === key(state.player.position)) { state.player.hp -= enemy.contactDamage ?? 1; events.push(event('enemy-hit-player', { enemyId: enemy.id, amount: enemy.contactDamage ?? 1 })); events.push(event('player-damaged', { amount: enemy.contactDamage ?? 1, hp: state.player.hp })); if (state.player.hp <= 0) { state.status = 'dead'; events.push(event('player-died')); return; } continue; }
    if (terrainAt(state.map, ...destination) === 'wall' || occupied(state, destination, enemy.id)) { events.push(event('enemy-blocked', { enemyId: enemy.id, position: [...enemy.position] })); continue; }
    enemy.position = destination; events.push(event('enemy-moved', { enemyId: enemy.id, position: [...destination] }));
  }
};
const spawnEnemies = (state, rules, rng, events) => {
  for (const rule of rules) for (let i = 0; i < rule.count; i++) { const candidates = []; const p = state.player.position, d = 27; for (let x = p[0]-d; x <= p[0]+d; x++) candidates.push([x,p[1]-d],[x,p[1]+d]); for (let y = p[1]-d+1; y < p[1]+d; y++) candidates.push([p[0]-d,y],[p[0]+d,y]); const valid = candidates.filter(c => terrainAt(state.map,...c) === 'floor' && !occupied(state,c)); if (!valid.length) continue; const location = valid[rng.nextInt(valid.length)]; const enemy = { id: state.nextEntityId++, type: rule.enemyType, position: [...location], hp: 1, contactDamage: 1, movementPeriod: 3, spawnTurn: state.turn, spawnPosition: [...location] }; state.enemies.push(enemy); events.push(event('enemy-spawned', { enemyId: enemy.id, position: [...location], enemyType: rule.enemyType })); }
};
const collectPickups = (state, events) => { const remaining = []; for (const pickup of state.pickups) { if (distance(state.player.position, pickup.position) > state.player.pickupRange) { remaining.push(pickup); continue; } events.push(event('pickup-collected', { pickupType: pickup.type, value: pickup.value, position: [...pickup.position] })); if (pickup.type === 'xp') { state.player.xp += pickup.value; events.push(event('xp-gained', { amount: pickup.value })); } if (pickup.type === 'health') { const before = state.player.hp; state.player.hp = Math.min(state.player.maxHp, state.player.hp + pickup.value); if (state.player.hp !== before) events.push(event('player-healed', { amount: state.player.hp - before })); } } state.pickups = remaining; };
const offerLevelUps = (state, rng, events) => { while (state.player.xp >= xpRequired(state.player.level)) { state.player.xp -= xpRequired(state.player.level); state.player.level += 1; events.push(event('level-gained', { level: state.player.level })); const eligible = upgradePool.filter(u => u.eligibility(state) && !state.player.upgrades.includes(u.id)); const pool = [...eligible], choices = []; while (choices.length < Math.min(3, pool.length)) { const index = rng.nextInt(pool.length); choices.push(pool.splice(index, 1)[0].id); } state.pendingUpgradeChoices = choices; state.status = 'level-up'; events.push(event('upgrade-options-generated', { choices: [...choices] })); break; } };
export const chooseUpgrade = (input, id) => { const state = clone(input); if (state.status !== 'level-up' || !state.pendingUpgradeChoices.includes(id)) return state; const upgrade = upgradeById(id); upgrade.apply(state); state.player.upgrades.push(id); state.pendingUpgradeChoices = []; state.status = 'playing'; return state; };

export const step = (input, action, providedRng) => {
  const state = clone(input), events = [], rng = validRng(providedRng);
  if (state.status === 'level-up' && action?.type === 'select-upgrade') { const next = chooseUpgrade(state, action.id); if (next.status === 'playing') offerLevelUps(next, rng, events); return { state: next, events: [event('upgrade-selected', { id: action.id }), ...events] }; }
  if (state.status === 'victory' && action?.type === 'continue') { state.status = 'playing'; state.victoryReached = true; return { state, events: [] }; }
  if (state.status === 'victory' && action?.type === 'exit') { state.status = 'complete'; return { state, events: [event('run-exited')] }; }
  if (state.status === 'playing' && action?.type === 'exit') { state.status = 'complete'; return { state, events: [event('run-exited')] }; }
  if (state.status !== 'playing' || !['move','wait','wait-facing'].includes(action?.type)) return { state, events: [] };
  state.turn += 1;
  if (action.type === 'move' || action.type === 'wait-facing') { const direction = action.direction; if (action.type === 'move') { state.player.facing = direction; const destination = pos(state.player.position, direction, 1); if (terrainAt(state.map,...destination) === 'wall' || occupied(state,destination)) events.push(event('player-blocked', { position: [...state.player.position] })); else { state.player.position = destination; events.push(event('player-moved', { position: [...destination] })); } } else { state.player.facing = direction; events.push(event('player-facing-changed', { direction })); } }
  runWeapons(state, 'preEnemyMove', events, rng); if (state.status === 'playing') moveEnemies(state, events); if (state.status === 'playing') runWeapons(state, 'postEnemyMove', events, rng); if (state.status === 'playing') { spawnEnemies(state, spawnRulesForTurn(state.turn), rng, events); collectPickups(state, events); offerLevelUps(state, rng, events); if (state.turn >= 200 && !state.victoryReached && state.status === 'playing') { state.status = 'victory'; state.victoryReached = true; events.push(event('victory-reached')); } } return { state, events };
};

export const getUpgrade = id => upgradeById(id);
