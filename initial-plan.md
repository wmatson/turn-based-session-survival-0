# Turn-Based Session Survival — Initial Implementation Plan

## 1. Goal

Implement a small, fully playable turn-based “session survival” game for the web, statically hosted on GitHub Pages.

The game should borrow the progression loop of games such as Vampire Survivors or Halls of Torment, but all gameplay during a run is turn-based.

The player controls only:

* Movement north, south, east, or west.
* Waiting in place.
* Waiting while changing facing north, south, east, or west.
* Selecting upgrades when leveling.
* Choosing whether to continue or exit after reaching the nominal victory turn.

Everything else happens automatically according to deterministic game rules.

The implementation should prioritize:

1. A small pure game engine.
2. Comprehensive unit tests of game rules.
3. Deterministic seeded randomness.
4. Simple SVG-based rendering.
5. Clear separation between engine, rendering, input, and persistence.

Do not optimize prematurely.

---

# 2. Architecture

Use four primary modules.

## Engine

Pure game logic.

Conceptually:

```text
step(gameState, playerAction, rng)
  -> {
       state: nextGameState,
       events: [...]
     }
```

The engine must not:

* Read the DOM.
* Use browser APIs.
* Read keyboard state.
* Call a global random-number function.
* Perform animation.
* Read/write localStorage.
* Depend on wall-clock time.

Every result must depend only on:

* The previous game state.
* The chosen player action.
* The provided RNG.

## Renderer

Turns game state into DOM/SVG presentation.

The renderer should not contain game rules.

## Input

Maps keyboard/buttons to player actions.

## Persistence

Stores permanent progression between runs using localStorage.

Keep persistence replaceable so the core game does not depend directly on localStorage.

---

# 3. Coordinates and Grid

Use integer Cartesian coordinates.

Recommended convention:

```text
north = y - 1
south = y + 1
west  = x - 1
east  = x + 1
```

The world is logically infinite.

The player sees a `51 x 51` viewport centered on the player:

```text
25 cells north
25 cells south
25 cells west
25 cells east
```

The player therefore remains visually centered while the world scrolls.

Do not allocate an infinite grid.

Represent only entities and generated terrain that are currently needed.

---

# 4. Map

Start with one map.

## Initial map terrain

The map consists mostly of empty walkable space.

Every `20 x 20` world region contains one deterministic `3 x 5` rectangle of impassable wall cells.

Use chunk coordinates:

```text
chunkX = floorDiv(x, 20)
chunkY = floorDiv(y, 20)
```

Terrain generation must work correctly for negative coordinates.

The wall placement inside each chunk should be deterministic from:

* map seed
* chunkX
* chunkY

The same chunk must always regenerate identically.

For the initial implementation, the wall may always be the same size and orientation.

Its position within the chunk may vary deterministically.

Ensure the wall:

* fits entirely inside the chunk;
* does not overlap the player's initial spawn;
* leaves surrounding walkable space.

Do not store every generated floor tile.

Prefer something equivalent to:

```text
terrainAt(map, x, y) -> floor | wall
```

with optional caching.

---

# 5. Entities

Only one blocking entity may occupy a grid square.

Blocking entities include:

* Player.
* Enemies.
* Breakable boxes/jars.

Walls are terrain rather than entities.

Pickups may coexist with a blocking entity if necessary.

This allows an enemy to die and leave XP on its square without requiring special occupancy handling.

---

# 6. Player

Initial player state:

```text
position: [0, 0]
facing: north
maxHp: 10
hp: 10
xp: 0
level: 1
pickupRange: 1
weapons: [starterKnife]
upgrades: []
```

Pickup range `1` means XP is automatically collected from:

* the player's own square;
* all four orthogonally adjacent squares.

Do not use diagonal distance.

A future pickup-range upgrade can increase this radius using Manhattan distance.

---

# 7. Player Actions

Represent actions explicitly.

At minimum:

```text
move north
move south
move east
move west

wait

waitFacing north
waitFacing south
waitFacing east
waitFacing west
```

## Movement

A player directional move:

1. Changes facing to that direction.
2. Attempts to move one square.

If the destination contains:

* a wall;
* an enemy;
* a breakable object;

the player remains in place.

The facing change still occurs.

This makes directional input useful even when movement is blocked.

## Plain wait

The player remains stationary and retains current facing.

## Wait-and-face

The player remains stationary and changes facing.

Desktop control:

```text
Arrow/WASD       -> move
Shift + Arrow/WASD -> wait and face
Space            -> wait
```

Provide equivalent visible controls suitable for touch screens.

---

# 8. Turn Counter

The initial state is turn `0`.

A player action begins the next turn.

After accepting the first action, processing occurs for turn `1`.

The turn number is incremented exactly once per accepted player action.

Upgrade selection does not consume a turn.

Menu interaction does not consume a turn.

---

# 9. Turn Resolution

Use this default pipeline:

1. Accept player action.
2. Increment turn number.
3. Resolve player movement/facing.
4. Resolve weapons scheduled for pre-enemy movement.
5. Resolve resulting damage, deaths, and drops.
6. Move enemies that act this turn.
7. Resolve enemy contact attacks.
8. Resolve weapons scheduled for post-enemy movement.
9. Resolve resulting damage, deaths, and drops.
10. Spawn new enemies/objects if scheduled.
11. Collect pickups within player pickup range.
12. Resolve XP gains.
13. Resolve level-up if threshold reached.
14. Resolve victory/death state.

Weapons must specify their timing explicitly.

For example:

```text
phase: preEnemyMove
```

or:

```text
phase: postEnemyMove
```

Do not hard-code all weapons into one phase.

---

# 10. Starter Weapon

Name it something simple, such as `Knife`.

Initial behavior:

```text
fires every 5 turns
phase: preEnemyMove
damage: 1
range: 2
width: 1
direction: player facing
```

It attacks the two cells directly in front of the player.

Example facing east:

```text
P > >
```

All enemies in those affected cells take damage.

The visual attack should briefly display a narrow triangular knife-like SVG pointing outward from the player.

The SVG animation is presentation only.

The engine should emit an event similar to:

```text
weapon-fired
weapon: knife
origin: [x, y]
direction: east
cells: [[x+1,y], [x+2,y]]
```

Rendering may animate that event.

---

# 11. Initial Enemy

Name:

```text
Red Square
```

Initial stats:

```text
hp: 1
contactDamage: 1
movementPeriod: 3 turns
```

Render as a red square SVG.

## Movement

Every third turn, the enemy attempts to move one square toward the player.

Choose the axis on which the absolute distance to the player is greatest.

Example:

```text
enemy = [0, 0]
player = [5, 2]

enemy tries east
```

When distances are equal, use a fixed deterministic tie-break rule.

Use:

```text
horizontal before vertical
```

unless there is a reason to change it later.

Enemies do not pathfind around walls in v1.

If their desired square is blocked, they remain stationary.

Do not attempt a secondary axis.

This deliberately keeps enemy logic simple.

---

# 12. Enemy Movement Ordering

When multiple enemies act during a turn, resolve movement sequentially.

Older enemies move first.

Enemy age ordering is determined by:

1. Earlier spawn turn.
2. For enemies spawned on the same turn, spawn position closest to the world origin is older.

Define “origin-most” deterministically as:

```text
Manhattan distance from [0,0]
```

Tie-break further with:

```text
x ascending
then y ascending
```

Each enemy also receives a permanent unique ID when spawned.

Use ID as the final fallback tie-breaker.

Once assigned, enemy ordering must remain stable.

Because movement resolves sequentially, an older enemy may claim a square that a younger enemy wanted.

The younger enemy then remains stationary.

---

# 13. Enemy Contact

If an enemy attempts to move into the player's square:

* The enemy remains in its previous square.
* The player takes the enemy's contact damage.

Initially:

```text
1 damage
```

Multiple enemies may damage the player during the same turn if each independently attempts to move onto the player.

If player HP reaches zero, finish the current relevant damage resolution and mark the run dead.

Do not process unnecessary later phases after death.

---

# 14. Enemy Spawning

Enemies spawn exactly two cells outside the visible viewport.

The viewport extends 25 cells from the player.

Therefore spawn candidates lie on a perimeter approximately 27 cells from the player.

Generate candidate positions on the four lines:

```text
x = playerX - 27
x = playerX + 27
y = playerY - 27
y = playerY + 27
```

Candidate cells must:

* not be walls;
* not contain another blocking entity.

Use the injected RNG to choose among valid positions.

Spawn ordering must then be normalized using the age/tie-break rules described above.

---

# 15. Spawn Schedule

For the first implementation, use a data-driven spawn schedule rather than embedding progression logic into the general spawning code.

Initial schedule:

```text
turns 1-49:
  every 10 turns:
    spawn 2 Red Squares

turns 50-99:
  every 10 turns:
    spawn 4 Red Squares

turns 100-149:
  every 10 turns:
    spawn 8 Red Squares
```

The exact progression is temporary.

Design this as something like:

```text
spawnRulesForTurn(turn)
```

returning a collection of:

```text
enemyType
count
```

This should make later wave composition easy.

The intended future model is that enemy types have overlapping curves.

For example:

```text
turns 100-150:
  Red Squares decrease
  Fast Enemies increase
```

Do not implement a generalized curve system yet.

Just ensure the spawning code does not assume there is only one enemy type.

---

# 16. Breakable Objects

Add jars or boxes as non-moving blocking entities.

They should occasionally appear in the world.

For v1, generation may be deterministic and sparse.

Example:

```text
approximately one breakable per several chunks
```

They:

```text
hp: 1
movement: none
```

Weapons can damage them.

When destroyed, they have a deterministic seeded chance to drop a health pickup.

Example:

```text
25% chance
```

A health pickup restores:

```text
3 HP
```

without exceeding max HP.

Use SVG geometric art:

* jar: simple outlined polygon/rectangle;
* health pickup: green cross, circle, or diamond.

---

# 17. Enemy Death and XP

The initial Red Square drops:

```text
1 XP
```

Create an XP pickup on its death square.

XP pickups do not block movement.

Render them as a small geometric SVG, such as a diamond.

After spawning/death resolution, collect all XP pickups within the player's Manhattan pickup radius.

Initial pickup radius:

```text
1
```

Thus:

```text
distance 0 -> collected
distance 1 -> collected
distance 2 -> not collected
```

---

# 18. Leveling

Initial XP requirement:

```text
level 1 -> 2: 5 XP
```

Use a simple formula for later levels.

Suggested:

```text
xpRequired(level) = 5 + (level - 1) * 3
```

Examples:

```text
1 -> 2: 5
2 -> 3: 8
3 -> 4: 11
```

When the player has enough XP:

1. Subtract the required XP.
2. Increase level.
3. Pause normal gameplay.
4. Generate three upgrade choices.
5. Player selects one.
6. Apply it.
7. If enough XP remains for another level, repeat the process.

No turns pass during upgrade selection.

---

# 19. Upgrade System

Make upgrades data-driven.

Each upgrade should define:

```text
id
name
description
eligibility
apply
```

Upgrade selection randomness must use the injected RNG.

Do not offer duplicate choices in one level-up.

## Initial upgrade pool

Implement at least these.

### Sharpened Knife

```text
Knife damage +1
```

### Long Knife

```text
Knife range +1
```

### Quick Hands

```text
Knife fires one turn more frequently
minimum period: 2
```

### Vitality

```text
max HP +2
heal 2 immediately
```

### Magnetism

```text
pickup range +1
```

### Fleet

```text
Every 10th player movement action moves 2 squares instead of 1.
```

This may be deferred if it substantially complicates collision rules.

### Orbiting Stone

New weapon.

Every 7 turns, deal 1 damage to enemies orthogonally adjacent to the player.

Phase:

```text
postEnemyMove
```

### Crossbow

New weapon.

Every 8 turns, fires in the current facing direction.

Range:

```text
6
```

Hits the first enemy encountered.

Phase:

```text
preEnemyMove
```

These provide enough variety to validate multiple weapons and attack timing.

---

# 20. Weapon Representation

Avoid weapon-specific conditionals spread throughout the engine.

Weapon state should contain at least:

```text
type
period
damage
phase
lastTriggeredTurn or equivalent scheduling state
```

Weapon definitions determine affected cells or targeting behavior.

For periodic weapons, prefer a clear deterministic rule.

For the initial knife:

```text
turn % 5 == 0
```

is acceptable.

If upgrades modify timing, maintain explicit weapon state or schedule so changing the period does not cause confusing retroactive firing.

Choose one consistent approach and test it thoroughly.

---

# 21. Victory

Initial nominal victory turn:

```text
200
```

When the player survives turn 200:

Pause the game and present:

```text
Victory

[Exit Run]
[Continue]
```

## Exit Run

Ends the session successfully and moves to the between-run screen.

## Continue

Removes the victory stop and lets the run continue until:

* death; or
* voluntary exit.

Do not repeatedly show the victory dialog.

---

# 22. Gold and Permanent Progression

Enemies may also award gold.

For v1, make this simple.

Example:

```text
Red Square: 1 gold
```

Gold may either:

* drop as a pickup; or
* be awarded immediately on kill.

Prefer immediate award for v1 to avoid introducing another pickup mechanic unnecessarily.

At run end, earned gold is added to persistent gold.

Store permanent state in localStorage.

Example:

```text
gold
permanentUpgrades
```

Implement a minimal between-session screen.

Possible upgrades:

### Toughness

Cost:

```text
10 / 25 / 50 gold
```

Effect:

```text
+1 starting max HP per rank
```

### Starting Magnet

Cost:

```text
20 gold
```

Effect:

```text
+1 starting pickup range
```

### Sharp Start

Cost:

```text
30 gold
```

Effect:

```text
starter Knife +1 damage
```

Do not build a complicated progression tree.

---

# 23. Randomness

All random behavior must come from a supplied RNG abstraction.

Random operations include:

* spawn location;
* upgrade choices;
* breakable generation if randomized;
* health drop chance;
* map/chunk generation where appropriate.

Tests should be able to provide a static RNG sequence.

Example conceptual API:

```text
nextInt(rng, upperBound)
-> [value, nextRng]
```

or equivalent state-threaded design.

The same:

```text
initial state
player actions
random seed
```

must always produce the same result.

---

# 24. Engine Events

The engine should return events describing what happened.

Examples:

```text
player-moved
player-blocked
player-facing-changed

weapon-fired

enemy-moved
enemy-blocked
enemy-hit-player
enemy-damaged
enemy-killed
enemy-spawned

object-damaged
object-broken

pickup-spawned
pickup-collected

xp-gained
level-gained
upgrade-options-generated
upgrade-selected

player-damaged
player-healed

victory-reached
player-died
```

Events are useful for:

* rendering animations;
* sound later;
* debugging;
* tests.

State remains authoritative.

Do not make game correctness depend on replaying events.

---

# 25. UI

Keep presentation intentionally minimal.

## Main screen

Show:

* 51x51 grid.
* Player centered.
* Enemies.
* Walls.
* Breakables.
* Pickups.
* Temporary weapon SVG effects.

HUD:

```text
HP
Level
XP / next level
Turn
Gold this run
```

## Input

Desktop:

```text
WASD / arrows = move
Space = wait
Shift + direction = wait and face
```

Mobile:

Display controls for:

```text
north
south
east
west
wait
```

Include a way to face without moving.

One option:

* tap = move;
* long press or secondary toggle = face/wait.

For the first implementation, simplicity is more important than elegance. Explicit additional face buttons are acceptable.

---

# 26. SVG Assets

All initial visual assets must be SVG or CSS/SVG geometry.

Do not introduce raster images.

Initial assets:

```text
Player:
simple contrasting circle or polygon with facing indicator

Red Square:
red square

Knife attack:
narrow triangle

Wall:
gray rectangle

Jar:
outlined geometric container

XP:
small diamond

Health:
simple cross or green geometric icon

Crossbow attack:
thin line/bolt

Orbiting Stone:
circle
```

Visual polish is not a priority.

---

# 27. Rendering and Animation

The game is turn-based, but short animations may play after actions.

The engine should complete the turn immediately.

The renderer may animate events afterward.

Do not make the engine wait for animations.

Prevent additional player actions while the current turn animation is playing.

A “fast animation” or disabled-animation mode should eventually be possible.

---

# 28. Required Engine Tests

The core engine should have broad unit-test coverage.

Do not rely primarily on browser/UI tests.

At minimum test the following.

## Player movement

* Player moves north.
* Player moves south.
* Player moves east.
* Player moves west.
* Wait leaves position unchanged.
* Wait leaves facing unchanged.
* Wait-facing changes facing without movement.
* Moving changes facing.
* Player cannot enter wall.
* Player cannot enter enemy cell.
* Player cannot enter breakable cell.
* Blocked directional input still changes facing.

## Knife

* Does not fire turns 1-4.
* Fires turn 5.
* Fires again on correct future turns.
* Uses facing after movement.
* Plain wait preserves previous facing.
* Wait-facing changes attack direction.
* Hits target one cell away.
* Hits target two cells away.
* Does not hit target three cells away.
* Resolves before enemy movement.
* Killed enemy does not subsequently move.

## Enemy movement

* Enemy moves every third turn.
* Enemy does not move on other turns.
* Moves along axis with greater distance.
* Equal-axis tie uses horizontal.
* Cannot move through walls.
* Cannot move into another enemy.
* Does not try secondary route when blocked.

## Enemy ordering

* Older enemy moves first.
* Spawn-turn ordering works.
* Same-turn origin distance ordering works.
* Coordinate tie-break works.
* Enemy movement gives older enemy priority for contested destination.

## Contact damage

* Enemy attempting to enter player cell damages player.
* Enemy remains in prior cell.
* Multiple enemies can damage player during same turn.
* HP reaching zero marks player dead.

## Spawning

* Spawn occurs every tenth turn.
* Correct count before turn 50.
* Correct count after turn 50.
* Spawn positions are two cells outside viewport.
* Spawn does not occur inside wall.
* Spawn does not overlap blocking entity.
* Fixed RNG gives fixed spawn result.

## Terrain

* Same chunk seed produces same walls.
* Different appropriate chunks may produce different placements.
* Negative coordinates use correct chunk calculation.
* Walls remain 3x5.
* Wall stays within chunk.
* Player origin is not initially blocked.

## XP

* Enemy death creates XP pickup.
* Pickup on player's cell collects.
* Pickup one orthogonal cell away collects.
* Pickup two cells away does not collect initially.
* Diagonal distance obeys Manhattan distance.
* Pickup-range upgrade works.

## Leveling

* Level occurs at threshold.
* Excess XP remains.
* Exactly three choices generated when possible.
* Choices are unique.
* Static RNG gives static choices.
* Upgrade selection does not advance turn.
* Multiple accumulated levels are resolved sequentially.

## Breakables

* Weapon can break jar.
* Jar blocks movement.
* Static RNG determines health drop.
* Health restores correct amount.
* Healing cannot exceed max HP.

## Post-movement weapons

* Weapon with `postEnemyMove` acts after enemies.
* Enemy can move into/out of attack area before attack resolves.

## Victory

* No victory before turn 200.
* Victory occurs after surviving turn 200.
* Continue removes future victory interruption.
* Exit ends run successfully.

## Determinism

Run a substantial scripted sequence such as:

```text
seed = fixed seed
100 predefined player actions
```

Execute it twice.

Assert that the complete resulting game state is identical.

This should be one of the primary regression tests.

---

# 29. Integration Tests

Add a smaller number of broader tests.

Example:

### First 10 turns

Given:

```text
fixed seed
known movement sequence
```

verify:

* knife fired turns 5 and 10;
* enemies spawned on turn 10;
* final player location;
* final facing;
* expected event sequence.

### Combat scenario

Construct a hand-authored state with enemies around the player.

Execute several turns and verify exact movement/combat resolution.

### Level-up scenario

Construct state one XP short of level-up.

Kill an adjacent enemy.

Verify:

```text
death
XP drop
pickup
level-up
upgrade pause
selection
resume
```

in the correct order.

---

# 30. Debugging Support

Provide a development/debug mode capable of showing:

```text
world coordinates
turn number
entity IDs
enemy spawn turn
enemy movement period
current RNG seed/state
```

Also provide a way in development to initialize a run from a supplied seed.

Example:

```text
?seed=12345
```

This is useful for reproducing bugs.

---

# 31. Suggested Data Shape

Exact syntax depends on implementation language, but conceptually:

```text
GameState
  turn
  status
  map
  player
  enemies
  breakables
  pickups
  nextEntityId
  pendingUpgradeChoices
  runGold
  victoryReached

Player
  position
  facing
  hp
  maxHp
  xp
  level
  pickupRange
  weapons
  upgrades

Enemy
  id
  type
  position
  hp
  spawnTurn
  spawnPosition

Weapon
  id
  type
  damage
  range
  period
  phase
  schedulingState

Pickup
  id
  type
  position
  value
```

Avoid storing values that can cheaply and unambiguously be derived.

---

# 32. Implementation Sequence

Implement in this order.

## Milestone 1 — Pure movement engine

Implement:

* coordinates;
* player;
* actions;
* facing;
* walls;
* movement;
* turn counter.

Tests first or alongside implementation.

No rendering beyond enough to inspect manually.

## Milestone 2 — Enemy movement

Implement:

* Red Square;
* movement periods;
* enemy ordering;
* collisions;
* contact damage.

Add complete tests.

## Milestone 3 — Starter weapon

Implement:

* weapon phases;
* Knife;
* damage;
* enemy death;
* engine events.

Add complete tests.

## Milestone 4 — Spawn system

Implement:

* viewport-relative spawning;
* seeded RNG;
* spawn schedules.

Add determinism tests.

## Milestone 5 — XP and upgrades

Implement:

* XP pickups;
* pickup radius;
* leveling;
* upgrade selection;
* starter upgrade pool;
* additional weapons.

## Milestone 6 — Terrain objects

Implement:

* deterministic chunk terrain;
* jars/boxes;
* health drops.

## Milestone 7 — Win/run flow

Implement:

* turn 200 victory;
* Continue;
* Exit;
* Death;
* between-run screen.

## Milestone 8 — Permanent progression

Implement:

* gold;
* localStorage persistence;
* three basic permanent upgrades.

## Milestone 9 — Presentation

Implement:

* SVG renderer;
* HUD;
* keyboard controls;
* usable mobile controls;
* short attack/movement animations.

## Milestone 10 — GitHub Pages deployment

Ensure:

* build is static;
* no server dependency;
* relative URLs work under a GitHub Pages repository path;
* refresh/navigation does not require server-side routing;
* deployment can be done through GitHub Actions or standard GitHub Pages static hosting.

---

# 33. Explicit Non-Goals for Initial Version

Do not implement yet:

* Multiplayer.
* Backend services.
* User accounts.
* Cloud saves.
* Sophisticated enemy pathfinding.
* Procedural dungeons.
* Diagonal movement.
* Physics.
* Real-time simulation.
* Elaborate particle systems.
* Large permanent skill trees.
* Equipment inventory.
* Character selection.
* Multiple maps.
* Bosses.
* Status-effect framework unless naturally required.
* Modding APIs.
* Advanced accessibility work beyond basic keyboard/touch usability.
* Gamepad support.
* Audio.

Prefer leaving clean extension points rather than implementing these prematurely.

---

# 34. Acceptance Criteria

The initial version is complete when:

1. It runs entirely as a static GitHub Pages site.
2. A new run can be started.
3. The player can move/wait indefinitely on an infinite deterministic grid.
4. The initial map contains deterministic 3x5 wall rectangles in each 20x20 chunk.
5. The viewport displays 51x51 cells centered on the player.
6. The player begins facing north.
7. Shift-direction changes facing without moving.
8. The Knife attacks every fifth turn after player movement and before enemy movement.
9. Red Squares move every third turn.
10. Enemy movement and collision ordering are deterministic.
11. Enemies spawn outside the visible area according to the current spawn schedule.
12. Enemies die, produce XP, and XP within pickup range is collected.
13. Level-ups pause play and offer three seeded-random upgrades.
14. At least two additional weapons work, including one post-enemy-movement weapon.
15. Breakable objects can produce healing items.
16. The player can die.
17. Surviving turn 200 produces a victory decision.
18. Continuing allows indefinite survival.
19. Exiting/death returns to a between-run screen.
20. Gold and basic permanent upgrades persist in localStorage.
21. Core game behavior is covered by unit tests.
22. Replaying identical actions with identical RNG input produces identical state.
23. All initial assets are simple SVG/geometric representations.

The central design rule is:

> Game rules belong in a deterministic pure state-transition engine. Rendering and browser behavior are consumers of that engine, not participants in it.

