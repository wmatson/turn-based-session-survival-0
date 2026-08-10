import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIONS, createGame, step, terrainAt, chunkOf, distance,
  chooseUpgrade, xpRequired, spawnRulesForTurn, hashSeed,
} from '../src/engine.js';
import { WEAPON_DEFINITIONS } from '../src/config.js';

const rng = (values = []) => { let i = 0; return { nextInt(max) { return values.length ? values[i++ % values.length] % max : 0; } }; };
const act = (state, action = ACTIONS.wait, random = rng()) => step(state, action, random);

 test('invalid directional actions are ignored without corrupting state', () => {
  const state = createGame({ seed: 7 });
  const result = act(state, { type: 'move', direction: 'bogus' });
  assert.deepEqual(result.state, state);
  assert.deepEqual(act(state, { type: 'wait-facing', direction: 'bogus' }).state, state);
});

 test('initial state and directional movement/facing', () => {
  const state = createGame({ seed: 7 });
  assert.deepEqual(state.player.position, [0, 0]);
  assert.equal(state.player.facing, 'north');
  let result = act(state, ACTIONS.moveEast);
  assert.deepEqual(result.state.player.position, [1, 0]);
  assert.equal(result.state.player.facing, 'east');
  result = act(result.state, ACTIONS.waitFacing('south'));
  assert.deepEqual(result.state.player.position, [1, 0]);
  assert.equal(result.state.player.facing, 'south');
  assert.equal(result.state.turn, 2);
});

test('configured permanent upgrades modify the corresponding starting values', () => {
  const state = createGame({ seed: 7, permanent: { toughness: 2, startingMagnet: 1, sharpStart: 1 } });
  assert.equal(state.player.maxHp, 12);
  assert.equal(state.player.pickupRange, 1);
  assert.equal(state.player.weapons[0].damage, 2);
});

test('pickup collection is contact-only by default and reaches adjacent cells with Starting Magnet', () => {
  const pickups = [
    { id: 1, type: 'gold', position: [0, 0], value: 1 },
    { id: 2, type: 'gold', position: [1, 0], value: 2 },
    { id: 3, type: 'gold', position: [1, 1], value: 4 },
  ];
  const withoutMagnet = createGame({ seed: 8 });
  withoutMagnet.pickups = structuredClone(pickups);
  const defaultResult = act(withoutMagnet, ACTIONS.wait);
  assert.equal(defaultResult.state.runGold, 1);
  assert.deepEqual(defaultResult.state.pickups.map(pickup => pickup.id), [2, 3]);
  const withMagnet = createGame({ seed: 8, permanent: { startingMagnet: 1 } });
  withMagnet.pickups = structuredClone(pickups);
  const magnetResult = act(withMagnet, ACTIONS.wait);
  assert.equal(magnetResult.state.runGold, 3);
  assert.deepEqual(magnetResult.state.pickups.map(pickup => pickup.id), [3]);
});

test('unlocked starting weapon selection replaces the default Knife', () => {
  const state = createGame({ seed: 7, startingWeapon: 'fire-wave', permanent: { startingFireWave: 1 } });
  assert.equal(state.player.weapons.length, 1);
  assert.equal(state.player.weapons[0].type, 'fire-wave');
});

test('locked starting weapon selection safely falls back to Knife', () => {
  const state = createGame({ seed: 7, startingWeapon: 'fire-wave' });
  assert.equal(state.player.weapons[0].type, 'knife');
});

test('invalid upgrade selection leaves the level-up state unchanged', () => {
  const state = createGame({ seed: 8 });
  state.status = 'level-up';
  state.pendingUpgradeChoices = ['not-a-real-upgrade'];
  const result = step(state, { type: 'select-upgrade', id: 'not-a-real-upgrade' });
  assert.equal(result.state.status, 'level-up');
  assert.deepEqual(result.state.pendingUpgradeChoices, ['not-a-real-upgrade']);
  assert.deepEqual(result.events, []);
});

test('terrain chunks are deterministic, bounded, and support negative coordinates', () => {
  assert.deepEqual(chunkOf(-1, 20), [-1, 1]);
  assert.equal(terrainAt({ seed: 42 }, 0, 0), 'floor');
  const first = [], second = [];
  for (let x = -20; x < 0; x++) for (let y = -20; y < 0; y++) if (terrainAt({ seed: 42 }, x, y) === 'wall') first.push([x,y]);
  for (let x = -20; x < 0; x++) for (let y = -20; y < 0; y++) if (terrainAt({ seed: 42 }, x, y) === 'wall') second.push([x,y]);
  assert.deepEqual(first, second);
  assert.equal(first.length, 15);
});

test('pots are generated in chunks away from the origin as the player travels', () => {
  let state = createGame({ seed: 42 });
  state.player.position = [100, 0];
  state = act(state, ACTIONS.wait).state;
  assert.ok(state.breakables.some(object => object.position[0] >= 80));
});

test('chests are generated one in ten distant chunks and contain 10 gold', () => {
  let state = createGame({ seed: 1 });
  state.player.position = [132, 28];
  state = act(state, ACTIONS.wait).state;
  const chests = state.breakables.filter(object => object.type === 'chest');
  assert.ok(chests.length >= 1);
  assert.ok(chests.every(chest => Math.abs(chest.position[0]) + Math.abs(chest.position[1]) >= 100));
  state.player.pickupRange = 1;
  state.player.position = [0, 0];
  state.player.facing = 'east';
  state.player.weapons = [{ id: 'knife', type: 'knife', ...WEAPON_DEFINITIONS.knife, period: 1 }];
  const chest = chests[0];
  chest.position = [1, 0];
  state.breakables = [chest];
  const result = act(state, ACTIONS.wait, rng([99, 99, 99]));
  assert.equal(result.state.runGold, 10);
});

test('blocked movement changes facing but not position', () => {
  const state = createGame({ seed: 3 });
  state.breakables.push({ id: 99, type: 'jar', position: [1, 0], hp: 1 });
  const result = act(state, ACTIONS.moveEast);
  assert.deepEqual(result.state.player.position, [0, 0]);
  assert.equal(result.state.player.facing, 'east');
  assert.ok(result.events.some(e => e.type === 'player-blocked'));
});

test('knife fires on turn five before enemy movement and kills in range', () => {
  let state = createGame({ seed: 1 }); state.player.pickupRange = 1;
  state.enemies.push({ id: 1, type: 'red-square', position: [2, 0], hp: 1, spawnTurn: 0, spawnPosition: [2,0] });
  for (let i = 0; i < 5; i++) { const result = act(state, i === 0 ? ACTIONS.waitFacing('east') : ACTIONS.wait); state = result.state; if (i === 4) { assert.ok(result.events.some(e => e.type === 'weapon-fired' && e.weapon === 'knife')); assert.equal(state.enemies.length, 0); assert.equal(state.player.xp, 1); } }
});

test('red squares move every third turn and contact damages without entering player cell', () => {
  let state = createGame({ seed: 2 });
  state.enemies.push({ id: 1, type: 'red-square', position: [3, 0], hp: 1, spawnTurn: 0, spawnPosition: [3,0] });
  state.player.weapons = [];
  state = act(state).state; assert.deepEqual(state.enemies[0].position, [3,0]);
  state = act(state).state; assert.deepEqual(state.enemies[0].position, [3,0]);
  state = act(state).state; assert.deepEqual(state.enemies[0].position, [2,0]);
  state = act(state).state; assert.equal(state.player.hp, 10);
  state = act(state).state; state = act(state).state; state = act(state).state; state = act(state).state; state = act(state).state;
  assert.equal(state.player.hp, 9); assert.deepEqual(state.enemies[0].position, [1,0]);
});

test('spawn schedule and deterministic spawn perimeter', () => {
  let state = createGame({ seed: 9 });
  for (let i = 0; i < 10; i++) state = act(state, ACTIONS.wait, rng([0])).state;
  assert.equal(state.enemies.length, 2);
  assert.ok(state.enemies.every(e => Math.max(Math.abs(e.position[0]), Math.abs(e.position[1])) >= 17));
  assert.deepEqual(spawnRulesForTurn(10), [{ enemyType: 'red-square', count: 2 }]);
  assert.deepEqual(spawnRulesForTurn(50), [{ enemyType: 'red-square', count: 4 }]);
  assert.deepEqual(spawnRulesForTurn(450), [
    { enemyType: 'blue-square', count: 2 },
    { enemyType: 'green-circle', count: 4 },
    { enemyType: 'red-square', count: 4 },
  ]);
  assert.equal(spawnRulesForTurn(600).filter(rule => rule.enemyType === 'blue-square').reduce((total, rule) => total + rule.count, 0), 4);
  assert.equal(spawnRulesForTurn(800).filter(rule => rule.enemyType === 'green-circle').reduce((total, rule) => total + rule.count, 0), 8);
});

test('outrun enemies are respawned just outside the viewport', () => {
  let state = createGame({ seed: 12 }); state.player.weapons = [];
  state.enemies.push({ id: 1, type: 'red-square', position: [35, 0], hp: 1, spawnTurn: 0, spawnPosition: [35,0], movementPeriod: 3 });
  const result = act(state, ACTIONS.wait, rng([0]));
  const enemy = result.state.enemies[0];
  assert.ok(Math.max(Math.abs(enemy.position[0]), Math.abs(enemy.position[1])) <= 17);
  assert.ok(result.events.some(e => e.type === 'enemy-respawned'));
});

test('turn 200 introduces durable blue squares and fast green circles', () => {
  let state = createGame({ seed: 15 }); state.turn = 199; state.player.weapons = [];
  state = act(state, ACTIONS.wait, rng([0])).state;
  assert.ok(state.enemies.some(e => e.type === 'blue-square' && e.hp === 3));
  assert.ok(state.enemies.some(e => e.type === 'green-circle' && e.hp === 1 && e.movementPeriod === 2));
});

test('blue squares award more XP than basic enemies', () => {
  let state = createGame({ seed: 17 }); state.player.pickupRange = 1; state.player.weapons = [{ id:'knife', type:'knife', ...WEAPON_DEFINITIONS.knife, period:1, damagesObjects:false }]; state.player.facing = 'east';
  state.enemies.push({ id: 1, type:'blue-square', position:[1,0], hp:1, spawnTurn:0, spawnPosition:[1,0] });
  state = act(state, ACTIONS.wait, rng([99])).state;
  assert.equal(state.player.xp, 3);
});

test('enemy gold drops are chance-based while XP always drops', () => {
  let state = createGame({ seed: 18 }); state.player.pickupRange = 1; state.player.weapons = [{ id:'knife', type:'knife', ...WEAPON_DEFINITIONS.knife, period:1, damagesObjects:false }]; state.player.facing = 'east';
  state.enemies.push({ id: 1, type:'red-square', position:[1,0], hp:1, spawnTurn:0, spawnPosition:[1,0] });
  state = act(state, ACTIONS.wait, rng([99])).state;
  assert.equal(state.player.xp, 1); assert.equal(state.runGold, 0);
  state = createGame({ seed: 19 }); state.player.pickupRange = 1; state.player.weapons = [{ id:'knife', type:'knife', ...WEAPON_DEFINITIONS.knife, period:1, damagesObjects:false }]; state.player.facing = 'east';
  state.enemies.push({ id: 1, type:'red-square', position:[1,0], hp:1, spawnTurn:0, spawnPosition:[1,0] });
  state = act(state, ACTIONS.wait, rng([1])).state;
  assert.equal(state.player.xp, 1); assert.equal(state.runGold, 1);
});

test('pots can drop health and gold pickups', () => {
  let state = createGame({ seed: 20 }); state.player.pickupRange = 1; state.player.weapons = [{ id:'knife', type:'knife', ...WEAPON_DEFINITIONS.knife, period:1 }]; state.player.facing = 'east';
  state.breakables = [{ id: 99, type:'jar', position:[1,0], hp:1 }];
  const result = act(state, ACTIONS.wait, rng([0, 0, 1]));
  assert.equal(result.state.breakables.length, 0);
  assert.ok(result.events.some(e => e.type === 'pickup-spawned' && e.pickupType === 'health'));
  assert.ok(result.events.some(e => e.type === 'pickup-spawned' && e.pickupType === 'gold'));
  assert.ok(!result.events.some(e => e.type === 'pickup-spawned' && e.pickupType === 'enemy-kill'));
  assert.equal(result.state.runGold, 5);
});

test('pots can drop a red X that clears all enemies when collected', () => {
  let state = createGame({ seed: 26 }); state.player.pickupRange = 1;
  state.player.weapons = [{ id:'knife', type:'knife', ...WEAPON_DEFINITIONS.knife, period:1 }];
  state.player.facing = 'east';
  state.breakables = [{ id: 99, type:'jar', position:[1,0], hp:1 }];
  state.enemies.push(
    { id: 1, type:'red-square', position:[3,0], hp:1, spawnTurn:0, spawnPosition:[3,0] },
    { id: 2, type:'red-square', position:[4,0], hp:1, spawnTurn:0, spawnPosition:[4,0] },
  );
  const result = act(state, ACTIONS.wait, rng([99, 99, 0]));
  assert.equal(result.state.enemies.length, 0);
  assert.equal(result.state.pickups.filter(pickup => pickup.type === 'xp').length, 2);
  assert.ok(result.events.some(event => event.type === 'pickup-spawned' && event.pickupType === 'enemy-kill'));
  assert.ok(result.events.some(event => event.type === 'enemies-cleared' && event.count === 2));
});

test('Lightning Bolt randomly strikes a visible enemy on its configured turn', () => {
  let state = createGame({ seed: 27 });
  state.player.weapons = [{ id: 'lightning-bolt', type: 'lightning-bolt', ...WEAPON_DEFINITIONS['lightning-bolt'], period: 1 }];
  state.enemies.push(
    { id: 1, type: 'red-square', position: [2, 0], hp: 1, spawnTurn: 0, spawnPosition: [2, 0] },
    { id: 2, type: 'red-square', position: [4, 0], hp: 1, spawnTurn: 0, spawnPosition: [4, 0] },
    { id: 3, type: 'red-square', position: [16, 0], hp: 1, spawnTurn: 0, spawnPosition: [16, 0] },
  );
  const result = act(state, ACTIONS.wait, rng([1]));
  assert.equal(result.state.enemies.length, 2);
  assert.ok(result.state.enemies.some(enemy => enemy.id === 1));
  assert.ok(result.state.enemies.some(enemy => enemy.id === 3));
  assert.ok(!result.state.enemies.some(enemy => enemy.id === 2));
  assert.deepEqual(result.events.find(event => event.type === 'weapon-fired').cells, [[4, 0]]);
});

test('Fire Wave launches a facing projectile every configured period and moves two cells per turn', () => {
  let state = createGame({ seed: 28 });
  state.player.weapons = [{ id: 'fire-wave', type: 'fire-wave', ...WEAPON_DEFINITIONS['fire-wave'] }];
  state.player.facing = 'east';
  state.turn = 9;
  state = act(state, ACTIONS.wait).state;
  assert.equal(state.projectiles.length, 1);
  assert.deepEqual(state.projectiles[0].position, [0, 0]);
  state = act(state, ACTIONS.wait).state;
  assert.deepEqual(state.projectiles[0].position, [2, 0]);
});

test('Fire Wave projectile damages every enemy it crosses and continues traveling', () => {
  let state = createGame({ seed: 29 });
  state.player.weapons = [{ id: 'fire-wave', type: 'fire-wave', ...WEAPON_DEFINITIONS['fire-wave'], period: 10 }];
  state.player.facing = 'east';
  state.turn = 9;
  state.enemies.push(
    { id: 1, type: 'red-square', position: [1, 0], hp: 1, spawnTurn: 0, spawnPosition: [1, 0] },
    { id: 2, type: 'red-square', position: [2, 0], hp: 1, spawnTurn: 0, spawnPosition: [2, 0] },
  );
  state = act(state, ACTIONS.wait, rng([99])).state;
  assert.ok(state.enemies.some(enemy => enemy.id === 1));
  assert.ok(state.enemies.some(enemy => enemy.id === 2));
  state = act(state, ACTIONS.wait, rng([99])).state;
  assert.ok(!state.enemies.some(enemy => enemy.id === 1));
  assert.ok(!state.enemies.some(enemy => enemy.id === 2));
  assert.equal(state.projectiles.length, 1);
  state.projectiles[0].position = [14, 0];
  state.player.weapons = [];
  state = act(state, ACTIONS.wait).state;
  assert.equal(state.projectiles.length, 0);
});

test('Axe uses its configured player-relative burst vectors', () => {
  let state = createGame({ seed: 21 });
  state.player.weapons = [{ id: 'axe', type: 'axe', ...WEAPON_DEFINITIONS.axe, period: 1 }];
  state.player.facing = 'east';
  for (const [id, position] of [[1, [1, -1]], [2, [1, 0]], [3, [1, 1]]]) state.enemies.push({ id, type: 'red-square', position, hp: 1, spawnTurn: 0, spawnPosition: position });
  const result = act(state, ACTIONS.wait, rng([99, 99, 99]));
  assert.equal(result.state.enemies.length, 0);
  assert.deepEqual(result.events.find(event => event.type === 'weapon-fired').cells.map(cell => cell.join(',')).sort(), ['1,-1', '1,0', '1,1']);
});

test('Long Knife extends vector targeting to the upgraded range', () => {
  let state = createGame({ seed: 24 });
  state.status = 'level-up';
  state.pendingUpgradeChoices = ['long-knife'];
  state = chooseUpgrade(state, 'long-knife');
  state.player.weapons[0].period = 1;
  state.player.facing = 'east';
  state.enemies.push({ id: 1, type: 'red-square', position: [3, 0], hp: 1, spawnTurn: 0, spawnPosition: [3, 0] });
  const result = act(state, ACTIONS.wait, rng([99]));
  assert.equal(result.state.player.weapons[0].range, 3);
  assert.equal(result.state.enemies.length, 0);
  assert.deepEqual(result.events.find(event => event.type === 'weapon-fired').cells, [[1, 0], [2, 0], [3, 0]]);
});

test('Long Bolt extends first-in-line targeting to the upgraded range', () => {
  let state = createGame({ seed: 25 });
  state.player.weapons = [{ id: 'crossbow', type: 'crossbow', ...WEAPON_DEFINITIONS.crossbow, period: 1 }];
  state.status = 'level-up';
  state.pendingUpgradeChoices = ['long-bolt'];
  state = chooseUpgrade(state, 'long-bolt');
  state.player.facing = 'east';
  state.enemies.push({ id: 1, type: 'red-square', position: [8, 0], hp: 1, spawnTurn: 0, spawnPosition: [8, 0] });
  const result = act(state, ACTIONS.wait, rng([99]));
  assert.equal(result.state.player.weapons[0].range, 8);
  assert.equal(result.state.enemies.length, 0);
  assert.equal(result.events.find(event => event.type === 'weapon-fired').cells.length, 8);
});

test('regeneration heals every 50 turns and improves by 10 turns per rank', () => {
  let state = createGame({ seed: 22 }); state.player.weapons = []; state.player.hp = 5; state.player.regenerationLevel = 1; state.turn = 49;
  state = act(state).state; assert.equal(state.player.hp, 6);
  state.player.hp = 5; state.player.regenerationLevel = 2; state.turn = 39;
  state = act(state).state; assert.equal(state.player.hp, 6);
});

test('green circles move every two turns while red squares retain three-turn movement', () => {
  let state = createGame({ seed: 16 }); state.player.weapons = [];
  state.enemies.push({ id: 1, type:'green-circle', position:[4,0], hp:1, movementPeriod:2, spawnTurn:0, spawnPosition:[4,0] });
  state = act(state).state; assert.deepEqual(state.enemies[0].position, [4,0]);
  state = act(state).state; assert.deepEqual(state.enemies[0].position, [3,0]);
});

test('xp levels, choices are unique, and selected upgrade applies', () => {
  let state = createGame({ seed: 5 }); state.player.pickupRange = 1; state.player.xp = 4; state.player.facing = 'east'; state.player.weapons[0].period = 1;
  state.enemies.push({ id: 1, type:'red-square', position:[1,0], hp:1, spawnTurn:0, spawnPosition:[1,0] });
  let result = act(state, ACTIONS.wait); state = result.state;
  assert.equal(state.pendingUpgradeChoices.length, 3); assert.equal(new Set(state.pendingUpgradeChoices).size, 3);
  const selected = chooseUpgrade(state, state.pendingUpgradeChoices[0]);
  assert.equal(selected.pendingUpgradeChoices.length, 0); assert.equal(selected.player.level, 2);
});

test('post-movement orbit stone can hit an enemy after it moves', () => {
  let state = createGame({ seed: 8 }); state.player.weapons = [{ id:'orbiting-stone', type:'orbiting-stone', damage:1, period:7, phase:'postEnemyMove', nextFire:7 }];
  state.enemies.push({ id:1,type:'red-square',position:[2,0],hp:1,spawnTurn:0,spawnPosition:[2,0] });
  for (let i=0;i<7;i++) state=act(state).state;
  assert.equal(state.enemies.length, 0);
});

test('victory at turn 500 and continue/exit controls', () => {
  let state = createGame({ seed: 1 }); state.player.weapons=[]; state.turn=499;
  state = act(state).state; assert.equal(state.status,'victory');
  state = step(state, ACTIONS.continue, rng()).state; assert.equal(state.status,'playing');
  state = step(state, ACTIONS.exit, rng()).state; assert.equal(state.status,'complete');
});

test('identical scripted runs are deterministic', () => {
  const actions = Array.from({length:100}, (_, i) => [ACTIONS.moveNorth,ACTIONS.moveEast,ACTIONS.wait,ACTIONS.moveSouth][i%4]);
  const run = () => { let s=createGame({seed:123}); for(const a of actions) s=step(s,a,rng([17,3,9,1])).state; return s; };
  assert.deepEqual(run(), run());
});

test('xp requirement and hash seed are stable', () => { assert.equal(xpRequired(1),5); assert.equal(xpRequired(3),11); assert.equal(hashSeed(1,2,3),hashSeed(1,2,3)); assert.notEqual(distance([0,0],[1,1]),1); });
