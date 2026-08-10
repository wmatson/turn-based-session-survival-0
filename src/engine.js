import { ACTIONS, DELTAS, DIRECTIONS, OUTRUN_RADIUS, SPAWN_RADIUS, VIEWPORT_RADIUS, VICTORY_TURN } from './engine/constants.js';
import { BREAKABLE_DEFINITIONS, ENEMY_DEFINITIONS, PERMANENT_UPGRADE_DEFINITIONS, UPGRADE_DEFINITIONS, WEAPON_DEFINITIONS, getUpgrade, xpRequired } from './config.js';
import { CHUNK_SIZE, chunkOf, distance, hashSeed, terrainAt } from './engine/terrain.js';
import { normalizeRng, seededRng } from './engine/random.js';
import { spawnRulesForTurn } from './engine/waves.js';

export { ACTIONS, chunkOf, distance, getUpgrade, hashSeed, seededRng, terrainAt, VICTORY_TURN, xpRequired };

const clone = value => structuredClone(value);
const key = p => `${p[0]},${p[1]}`;
const occupied = (state, p, ignoreId = null) => state.player.position[0] === p[0] && state.player.position[1] === p[1] || state.enemies.some(e => e.id !== ignoreId && key(e.position) === key(p)) || state.breakables.some(o => key(o.position) === key(p));
const validRng = normalizeRng;
const enemyDefinitions = ENEMY_DEFINITIONS;
export { spawnRulesForTurn };

const addBreakablesForChunk = (state, chunkX, chunkY) => {
  const chunkKey = `${chunkX},${chunkY}`;
  if (state.generatedBreakableChunks.includes(chunkKey)) return;
  state.generatedBreakableChunks.push(chunkKey);
  for (let trigger = 0; trigger < 2; trigger++) {
    const h = hashSeed(state.seed, chunkX, chunkY, 91 + trigger);
    if (h % 4 !== 0) continue;
    const candidate = [chunkX * CHUNK_SIZE + 4 + h % 11, chunkY * CHUNK_SIZE + 4 + Math.floor(h / 17) % 11];
    if (key(candidate) !== '0,0' && terrainAt(state.map, ...candidate) === 'floor' && !state.breakables.some(object => key(object.position) === key(candidate))) state.breakables.push({ id: state.nextEntityId++, type: 'jar', position: candidate, hp: BREAKABLE_DEFINITIONS.jar.hp });
  }
};

const ensureBreakables = (state, positions) => {
  const chunks = new Set();
  for (const position of positions) {
    const [chunkX, chunkY] = chunkOf(...position);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) chunks.add(`${chunkX + dx},${chunkY + dy}`);
  }
  for (const chunkKey of chunks) { const [chunkX, chunkY] = chunkKey.split(',').map(Number); addBreakablesForChunk(state, chunkX, chunkY); }
};

export const createGame = ({ seed = 1, permanent = {}, startingWeapon = 'knife', victoryTurn = VICTORY_TURN } = {}) => {
  const startingStats = { maxHp: 10, pickupRange: 1 };
  const weaponStats = { knife: { damage: WEAPON_DEFINITIONS.knife.damage } };
  const startingWeapons = new Set(['knife']);
  for (const definition of PERMANENT_UPGRADE_DEFINITIONS) {
    const rank = Number.isInteger(permanent[definition.id]) ? Math.max(0, permanent[definition.id]) : 0;
    const operation = definition.operation;
    if (!rank || !operation) continue;
    if (operation.kind === 'starting-stat' && operation.stat in startingStats) startingStats[operation.stat] += rank * operation.amount;
    if (operation.kind === 'weapon-stat' && operation.weaponType in weaponStats && operation.stat in weaponStats[operation.weaponType]) weaponStats[operation.weaponType][operation.stat] += rank * operation.amount;
    if (operation.kind === 'starting-weapon' && rank > 0) startingWeapons.add(operation.weaponType);
  }
  const maxHp = startingStats.maxHp;
  const knifeDamage = weaponStats.knife.damage;
  const selectedWeapon = startingWeapons.has(startingWeapon) && WEAPON_DEFINITIONS[startingWeapon] ? startingWeapon : 'knife';
  const startingDefinition = WEAPON_DEFINITIONS[selectedWeapon];
  const state = { seed, map: { seed }, turn: 0, victoryTurn, status: 'playing', victoryReached: false, runGold: 0, nextEntityId: 1,
    player: { position: [0, 0], facing: 'north', hp: maxHp, maxHp, xp: 0, level: 1, pickupRange: startingStats.pickupRange, regenerationLevel: 0, upgrades: [],
      weapons: [{ id: selectedWeapon, type: selectedWeapon, ...startingDefinition, ...(selectedWeapon === 'knife' ? { damage: knifeDamage } : {}) }] },
    enemies: [], breakables: [], generatedBreakableChunks: [], pickups: [], projectiles: [], pendingUpgradeChoices: [] };
  ensureBreakables(state, [[0, 0]]);
  return state;
};

const event = (type, data = {}) => ({ type, ...data });
const pos = (p, d, amount = 1) => [p[0] + DELTAS[d][0] * amount, p[1] + DELTAS[d][1] * amount];
const relativePos = (origin, facing, [forward, lateral]) => {
  const forwardDelta = DELTAS[facing];
  const lateralDirection = facing === 'north' || facing === 'south' ? 'east' : 'south';
  const lateralDelta = DELTAS[lateralDirection];
  const lateralSign = facing === 'south' || facing === 'west' ? -1 : 1;
  return [origin[0] + forwardDelta[0] * forward + lateralDelta[0] * lateral * lateralSign, origin[1] + forwardDelta[1] * forward + lateralDelta[1] * lateral * lateralSign];
};
const damageEnemy = (state, enemy, amount, events, rng) => { enemy.hp -= amount; events.push(event('enemy-damaged', { enemyId: enemy.id, amount, position: [...enemy.position] })); if (enemy.hp <= 0) { const definition = enemyDefinitions[enemy.type] ?? enemyDefinitions['red-square']; events.push(event('enemy-killed', { enemyId: enemy.id, position: [...enemy.position] })); state.pickups.push({ id: state.nextEntityId++, type: 'xp', position: [...enemy.position], value: definition.xp ?? 1 }); events.push(event('pickup-spawned', { pickupType: 'xp', position: [...enemy.position], value: definition.xp ?? 1 })); if (rng.nextInt(100) < (definition.goldChance ?? 0)) { state.pickups.push({ id: state.nextEntityId++, type: 'gold', position: [...enemy.position], value: definition.gold ?? 1 }); events.push(event('pickup-spawned', { pickupType: 'gold', position: [...enemy.position], value: definition.gold ?? 1 })); } state.enemies = state.enemies.filter(e => e.id !== enemy.id); } };
const damageObject = (state, object, amount, events, rng) => { object.hp -= amount; events.push(event('object-damaged', { objectId: object.id, amount })); if (object.hp <= 0) { const definition = BREAKABLE_DEFINITIONS[object.type] ?? BREAKABLE_DEFINITIONS.jar; state.breakables = state.breakables.filter(o => o.id !== object.id); events.push(event('object-broken', { objectId: object.id, position: [...object.position] })); if (rng.nextInt(100) < definition.healthChance) { state.pickups.push({ id: state.nextEntityId++, type: 'health', position: [...object.position], value: definition.health }); events.push(event('pickup-spawned', { pickupType: 'health', position: [...object.position], value: definition.health })); } if (rng.nextInt(100) < definition.goldChance) { state.pickups.push({ id: state.nextEntityId++, type: 'gold', position: [...object.position], value: definition.gold }); events.push(event('pickup-spawned', { pickupType: 'gold', position: [...object.position], value: definition.gold })); } if (rng.nextInt(100) < definition.enemyKillChance) { state.pickups.push({ id: state.nextEntityId++, type: 'enemy-kill', position: [...object.position] }); events.push(event('pickup-spawned', { pickupType: 'enemy-kill', position: [...object.position] })); } } };
const fireWeapon = (state, weapon, events, rng) => {
  const definition = WEAPON_DEFINITIONS[weapon.type] ?? {};
  const targeting = weapon.targeting ?? definition.targeting;
  const mode = typeof targeting === 'string' ? targeting : targeting?.mode;
  const damagesObjects = weapon.damagesObjects ?? definition.damagesObjects;
  const origin = [...state.player.position];
  const cells = [];
  let targets = [];
  if (mode === 'vectors') {
    const vectors = targeting.extend
      ? Array.from({ length: weapon.range }, (_, index) => targeting.extend.map(component => component * (index + 1)))
      : targeting.vectors ?? [];
    for (const vector of vectors) cells.push(relativePos(origin, state.player.facing, vector));
    targets = state.enemies.filter(enemy => cells.some(cell => key(cell) === key(enemy.position)));
  } else if (mode === 'random-visible') {
    const visible = state.enemies.filter(enemy => Math.abs(enemy.position[0] - origin[0]) <= VIEWPORT_RADIUS && Math.abs(enemy.position[1] - origin[1]) <= VIEWPORT_RADIUS);
    if (visible.length) {
      const target = visible[rng.nextInt(visible.length)];
      cells.push([...target.position]);
      targets = [target];
    }
  } else if (mode === 'projectile') {
    const projectile = { id: state.nextEntityId++, type: weapon.type, position: [...origin], direction: state.player.facing, speed: targeting.speed, damage: weapon.damage };
    state.projectiles.push(projectile);
    events.push(event('projectile-fired', { projectileId: projectile.id, weapon: weapon.type, position: [...origin], direction: projectile.direction }));
    return;
  } else if (mode === 'line' || mode === 'first-in-line') {
    for (let i = 1; i <= weapon.range; i++) {
      const cell = pos(origin, state.player.facing, i);
      cells.push(cell);
      if (mode === 'first-in-line') {
        const hit = state.enemies.find(enemy => key(enemy.position) === key(cell));
        if (hit) { targets = [hit]; break; }
      }
    }
    if (mode === 'line') targets = state.enemies.filter(enemy => cells.some(cell => key(cell) === key(enemy.position)));
  }
  events.push(event('weapon-fired', { weapon: weapon.type, origin, direction: state.player.facing, cells }));
  for (const target of [...targets]) if (state.enemies.some(enemy => enemy.id === target.id)) damageEnemy(state, target, weapon.damage, events, rng);
  if (damagesObjects) for (const object of [...state.breakables]) if (cells.some(cell => key(cell) === key(object.position))) damageObject(state, object, weapon.damage, events, rng);
};
const runWeapons = (state, phase, events, rng) => { for (const weapon of state.player.weapons) if (weapon.phase === phase && state.turn % weapon.period === 0) fireWeapon(state, weapon, events, rng); };
const runProjectiles = (state, events, rng) => {
  const remaining = [];
  for (const projectile of state.projectiles) {
    let active = true;
    for (let distanceMoved = 0; distanceMoved < projectile.speed && active; distanceMoved += 1) {
      const destination = pos(projectile.position, projectile.direction);
      if (terrainAt(state.map, ...destination) === 'wall') { active = false; break; }
      projectile.position = destination;
      const targets = state.enemies.filter(enemy => key(enemy.position) === key(projectile.position));
      for (const target of targets) {
        if (!state.enemies.some(enemy => enemy.id === target.id)) continue;
        damageEnemy(state, target, projectile.damage, events, rng);
        events.push(event('projectile-hit', { projectileId: projectile.id, enemyId: target.id, position: [...projectile.position] }));
      }
      if (Math.abs(projectile.position[0] - state.player.position[0]) > VIEWPORT_RADIUS || Math.abs(projectile.position[1] - state.player.position[1]) > VIEWPORT_RADIUS) { active = false; break; }
    }
    if (active) remaining.push(projectile);
  }
  state.projectiles = remaining;
};
const enemyOrder = (a, b) => a.spawnTurn - b.spawnTurn || distance(a.spawnPosition, [0,0]) - distance(b.spawnPosition, [0,0]) || a.spawnPosition[0] - b.spawnPosition[0] || a.spawnPosition[1] - b.spawnPosition[1] || a.id - b.id;
const moveEnemies = (state, events) => {
  const ordered = [...state.enemies].sort(enemyOrder);
  for (const enemy of ordered) {
    if (!state.enemies.some(e => e.id === enemy.id)) continue;
    if (state.turn % (enemy.movementPeriod ?? enemyDefinitions[enemy.type]?.movementPeriod ?? 3)) continue;
    const dx = state.player.position[0] - enemy.position[0], dy = state.player.position[1] - enemy.position[1];
    const direction = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'east' : 'west') : (dy >= 0 ? 'south' : 'north');
    const destination = pos(enemy.position, direction);
    if (key(destination) === key(state.player.position)) { state.player.hp -= enemy.contactDamage ?? 1; events.push(event('enemy-hit-player', { enemyId: enemy.id, amount: enemy.contactDamage ?? 1 })); events.push(event('player-damaged', { amount: enemy.contactDamage ?? 1, hp: state.player.hp })); if (state.player.hp <= 0) { state.status = 'dead'; events.push(event('player-died')); return; } continue; }
    if (terrainAt(state.map, ...destination) === 'wall' || occupied(state, destination, enemy.id)) { events.push(event('enemy-blocked', { enemyId: enemy.id, position: [...enemy.position] })); continue; }
    const from = [...enemy.position]; enemy.position = destination; events.push(event('enemy-moved', { enemyId: enemy.id, from, position: [...destination] }));
  }
};
const spawnCandidates = (state, distanceFromPlayer = SPAWN_RADIUS) => {
  const candidates = [], p = state.player.position, d = distanceFromPlayer;
  for (let x = p[0]-d; x <= p[0]+d; x++) candidates.push([x,p[1]-d],[x,p[1]+d]);
  for (let y = p[1]-d+1; y < p[1]+d; y++) candidates.push([p[0]-d,y],[p[0]+d,y]);
  return candidates.filter(c => terrainAt(state.map,...c) === 'floor' && !occupied(state,c));
};
const respawnOutrunEnemies = (state, rng, events) => {
  for (const enemy of state.enemies) {
    const dx = Math.abs(enemy.position[0] - state.player.position[0]), dy = Math.abs(enemy.position[1] - state.player.position[1]);
    if (Math.max(dx, dy) <= OUTRUN_RADIUS) continue;
    const valid = spawnCandidates(state, SPAWN_RADIUS).filter(c => c[0] !== enemy.position[0] || c[1] !== enemy.position[1]);
    if (!valid.length) continue;
    enemy.position = [...valid[rng.nextInt(valid.length)]];
    enemy.spawnPosition = [...enemy.position];
    events.push(event('enemy-respawned', { enemyId: enemy.id, position: [...enemy.position] }));
  }
};
const spawnEnemies = (state, rules, rng, events) => {
  for (const rule of rules) for (let i = 0; i < rule.count; i++) { const valid = spawnCandidates(state, SPAWN_RADIUS); if (!valid.length) continue; const location = valid[rng.nextInt(valid.length)], definition = enemyDefinitions[rule.enemyType] ?? enemyDefinitions['red-square']; const enemy = { id: state.nextEntityId++, type: rule.enemyType, position: [...location], hp: definition.hp, contactDamage: definition.contactDamage, movementPeriod: definition.movementPeriod, spawnTurn: state.turn, spawnPosition: [...location] }; state.enemies.push(enemy); events.push(event('enemy-spawned', { enemyId: enemy.id, position: [...location], enemyType: rule.enemyType })); }
};
const collectPickups = (state, events, rng) => { const initialPickups = state.pickups; const remaining = []; for (const pickup of initialPickups) { if (distance(state.player.position, pickup.position) > state.player.pickupRange) { remaining.push(pickup); continue; } events.push(event('pickup-collected', { pickupType: pickup.type, value: pickup.value, position: [...pickup.position] })); if (pickup.type === 'xp') { state.player.xp += pickup.value; events.push(event('xp-gained', { amount: pickup.value })); } if (pickup.type === 'gold') state.runGold += pickup.value; if (pickup.type === 'health') { const before = state.player.hp; state.player.hp = Math.min(state.player.maxHp, state.player.hp + pickup.value); if (state.player.hp !== before) events.push(event('player-healed', { amount: state.player.hp - before })); } if (pickup.type === 'enemy-kill') { const enemies = [...state.enemies]; for (const enemy of enemies) if (state.enemies.some(candidate => candidate.id === enemy.id)) damageEnemy(state, enemy, enemy.hp, events, rng); events.push(event('enemies-cleared', { count: enemies.length })); } } state.pickups = [...remaining, ...state.pickups.slice(initialPickups.length)]; };
const upgradeEligible = (state, upgrade) => {
  if (!upgrade.stackable && state.player.upgrades.includes(upgrade.id)) return false;
  const operation = upgrade.operation;
  if (operation.kind === 'weapon-stat') return state.player.weapons.some(weapon => weapon.type === upgrade.weaponType);
  if (operation.kind === 'add-weapon') return !state.player.weapons.some(weapon => weapon.type === operation.weaponType);
  return true;
};
const applyUpgrade = (state, upgrade) => {
  const operation = upgrade.operation;
  if (operation.kind === 'weapon-stat') for (const weapon of state.player.weapons) if (weapon.type === upgrade.weaponType) weapon[operation.stat] = Math.max(operation.minimum ?? -Infinity, weapon[operation.stat] + operation.amount);
  if (operation.kind === 'player-stat') { state.player[operation.stat] += operation.amount; if (operation.heal) state.player.hp = Math.min(state.player.maxHp, state.player.hp + operation.heal); }
  if (operation.kind === 'add-weapon') state.player.weapons.push({ id: operation.weaponType, type: operation.weaponType, ...WEAPON_DEFINITIONS[operation.weaponType] });
  if (operation.kind === 'regeneration') state.player.regenerationLevel = (state.player.regenerationLevel || 0) + operation.amount;
};
const offerLevelUps = (state, rng, events) => { while (state.player.xp >= xpRequired(state.player.level)) { state.player.xp -= xpRequired(state.player.level); state.player.level += 1; events.push(event('level-gained', { level: state.player.level })); const eligible = UPGRADE_DEFINITIONS.filter(upgrade => upgradeEligible(state, upgrade)); const pool = [...eligible], choices = []; while (choices.length < Math.min(3, pool.length)) { const index = rng.nextInt(pool.length); choices.push(pool.splice(index, 1)[0].id); } state.pendingUpgradeChoices = choices; state.status = 'level-up'; events.push(event('upgrade-options-generated', { choices: [...choices] })); break; } };
export const chooseUpgrade = (input, id) => { const state = clone(input); if (state.status !== 'level-up' || !state.pendingUpgradeChoices.includes(id)) return state; const upgrade = getUpgrade(id); if (!upgrade?.operation) return state; applyUpgrade(state, upgrade); state.player.upgrades.push(id); state.pendingUpgradeChoices = []; state.status = 'playing'; return state; };

export const step = (input, action, providedRng) => {
  const state = clone(input), events = [], rng = validRng(providedRng);
  if (state.status === 'level-up' && action?.type === 'select-upgrade') { const next = chooseUpgrade(state, action.id); if (next.status !== 'playing') return { state: next, events: [] }; if (next.status === 'playing') offerLevelUps(next, rng, events); return { state: next, events: [event('upgrade-selected', { id: action.id }), ...events] }; }
  if (state.status === 'victory' && action?.type === 'continue') { state.status = 'playing'; state.victoryReached = true; return { state, events: [] }; }
  if (state.status === 'victory' && action?.type === 'exit') { state.status = 'complete'; return { state, events: [event('run-exited')] }; }
  if (state.status === 'playing' && action?.type === 'exit') { state.status = 'complete'; return { state, events: [event('run-exited')] }; }
  if (state.status !== 'playing' || !['move','wait','wait-facing'].includes(action?.type)) return { state, events: [] };
  if (['move', 'wait-facing'].includes(action.type) && !DIRECTIONS.includes(action.direction)) return { state, events: [] };
  ensureBreakables(state, action.type === 'move' ? [state.player.position, pos(state.player.position, action.direction)] : [state.player.position]);
  state.turn += 1;
  if (action.type === 'move' || action.type === 'wait-facing') { const direction = action.direction; if (action.type === 'move') { state.player.facing = direction; const destination = pos(state.player.position, direction, 1); if (terrainAt(state.map,...destination) === 'wall' || occupied(state,destination)) events.push(event('player-blocked', { position: [...state.player.position] })); else { const from = [...state.player.position]; state.player.position = destination; events.push(event('player-moved', { from, position: [...destination] })); } } else { state.player.facing = direction; events.push(event('player-facing-changed', { direction })); } }
  runProjectiles(state, events, rng); if (state.status === 'playing') runWeapons(state, 'preEnemyMove', events, rng); if (state.status === 'playing') moveEnemies(state, events); if (state.status === 'playing') respawnOutrunEnemies(state, rng, events); if (state.status === 'playing') runWeapons(state, 'postEnemyMove', events, rng); if (state.status === 'playing') { spawnEnemies(state, spawnRulesForTurn(state.turn), rng, events); collectPickups(state, events, rng); offerLevelUps(state, rng, events); const regenerationLevel = state.player.regenerationLevel || 0; if (regenerationLevel > 0) { const regenerationPeriod = Math.max(10, 50 - (regenerationLevel - 1) * 10); if (state.turn % regenerationPeriod === 0) { const before = state.player.hp; state.player.hp = Math.min(state.player.maxHp, state.player.hp + 1); if (state.player.hp !== before) events.push(event('player-healed', { amount: 1, reason: 'regeneration' })); } } if (state.turn >= state.victoryTurn && !state.victoryReached && state.status === 'playing') { state.status = 'victory'; state.victoryReached = true; events.push(event('victory-reached')); } } return { state, events };
};
