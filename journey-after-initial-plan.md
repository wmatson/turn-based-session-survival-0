# Turn-Based Session Survival — Journey After the Initial Plan

This document records the implementation journey after `initial-plan.md`. The initial plan describes the intended first version; this document captures the decisions, changes, corrections, and follow-up work that shaped the current game.

## 1. Starting Point

The initial plan called for a deterministic static GitHub Pages game with:

- a pure turn-based engine;
- seeded randomness;
- an infinite generated grid;
- SVG rendering;
- automated enemies, weapons, drops, upgrades, victory, and death;
- localStorage-backed between-run progression;
- keyboard and touch controls;
- comprehensive engine tests.

The implementation stayed within that overall architecture. The main differences from the initial plan are documented below rather than silently changing the original plan.

## 2. Core Implementation

The repository was built as a no-build browser application using native ES modules.

Current runtime boundaries are:

- `src/engine.js`: pure state creation and state transitions;
- `src/engine/`: shared constants, deterministic random helpers, terrain helpers, and wave selection;
- `src/config.js`: enemy, weapon, upgrade, wave, drop, color, and cost definitions;
- `src/renderer.js`: SVG presentation and world/camera rendering;
- `src/main.js`: browser input, UI flow, transient effects, and run orchestration;
- `src/persistence.js`: replaceable permanent progression storage;
- `test/engine.test.js`: gameplay and determinism regression coverage;
- `test/module-load.test.js`: runtime ES-module import/linkage coverage.

The engine remains independent of the DOM, browser APIs, localStorage, wall-clock time, and global randomness. Browser randomness is used only to choose a seed for a new run when the player leaves the seed field empty.

## 3. Gameplay Changes After the Initial Plan

### Random default seeds

New runs use a browser-generated random seed by default. An explicit seed remains available for reproducible runs and deterministic testing.

### Viewport revision

The original plan specified a 51×51 viewport. The playable implementation was revised to a 31×31 viewport:

- 15 tiles in every direction from the player;
- player fixed at the visual center;
- padded rendering radius of 16 tiles to reduce edge blinking;
- enemy spawn and outrun distances derived from shared viewport constants.

The smaller viewport improves readability and mobile presentation while preserving the infinite-world model.

### Enemy roster and waves

The original Red Square enemy was expanded with:

- Blue Squares: tougher, slower enemies with a higher XP reward;
- Green Circles: faster, weaker enemies;
- later wave bands that introduce additional enemy types;
- deterministic respawning for enemies that fall too far outside the active area.

Enemy XP is guaranteed. Enemy gold is an independent low-probability drop rather than a guaranteed reward.

### Breakables and pots

Breakable pots were added as blocking generated objects. Pot generation uses two independent attempts in qualifying chunks, producing roughly one qualifying chunk in four and allowing some chunks to contain two pots.

Pot destruction can produce health, 5-gold, or (at a 1% independent chance) a red-X enemy-kill pickup. Collecting the red X kills all current enemies through the normal enemy-death/drop event path. Health pickups use a localized SVG cross so their size remains consistent with the tile graphics.

Pot chunks are generated lazily around the player's current and attempted destination chunks. This preserves deterministic two-attempt generation while allowing pots to appear throughout the infinite world instead of only in the initial origin neighborhood.

Distant chunks also have an independent 1-in-10 chance to contain a small chest once its deterministic position is at least 100 Manhattan tiles from origin. Breaking a chest guarantees a 10-gold pickup.

### Weapons

The starter weapon and additional weapons became data-driven through `src/config.js`. Weapon-local upgrade metadata now lives beside each weapon definition, and the engine applies generic weapon-stat, player-stat, weapon-unlock, and regeneration operations rather than invoking weapon-specific upgrade closures.

The Axe was added as a wide attack:

- it attacks one tile ahead in the facing direction;
- it covers three side-by-side cells perpendicular to that direction;
- it can affect enemies and breakables in all three cells.

Lightning Bolt was later added as a dynamic weapon that fires every five turns and uses the injected RNG to select one enemy within the 31×31 on-screen square.

Fire Wave was added as a persistent projectile weapon. It fires every ten turns in the player's facing direction, advances two world cells per turn, damages every enemy it crosses, and expires when it hits a wall or leaves the on-screen square.

Weapon upgrades were added for the existing weapons and the Axe. Stackable upgrades are supported where appropriate.

### Regeneration

Regeneration was added as a stackable upgrade:

- first rank: one HP every 50 turns;
- each additional rank reduces the interval by 10 turns;
- the interval is bounded at 10 turns;
- healing never exceeds maximum HP.

### Victory and continuation

The nominal victory threshold is now turn 500 rather than turn 200. The victory screen allows the player to continue indefinitely or exit and bank the run's gold.

At wave 450, four additional red squares spawn every wave. Together with the existing two blue squares and four green circles, that makes ten enemies per ten-turn interval against nine weapon-fire opportunities when all periodic weapon upgrades are applied. Continuation beyond victory adds two more blue squares at wave 600 and four more green circles at wave 800.

The turn limiter was later removed. Actions are now processed immediately whenever the engine is in the `playing` state. This keeps the game turn-based while avoiding input lag and animation-related action queuing.

## 4. Presentation and Rendering Iterations

### Facing controls

The original consolidated facing interaction was removed. Cardinal facing buttons are available directly, and facing without moving consumes a wait-and-face turn.

The facing indicator is rendered as part of the player graphic layer.

### Movement animation experiments

Several presentation approaches were tested:

1. 150ms movement animations;
2. 100ms movement animations;
3. top-level camera movement with the player held at the center;
4. padded grid rendering to reduce edge appearance/disappearance;
5. removal of independent enemy and player animations after rapid-turn jitter was observed;
6. faint dashed one-move arrows as movement trails.

The current approach intentionally avoids player and enemy movement animation. The authoritative world renders at its post-turn position, while short-lived trails communicate movement. This removes start-square/end-square blinking caused by independently animated SVG entities being rebuilt during rapid turns.

### World transform

Rendering was refactored so world objects use world-coordinate geometry and a top-level SVG transform maps the camera-relative world into the viewport.

The grid is still rendered, including a padded ring around the visible area, but individual entities no longer need to calculate their final screen position from a separate subview coordinate system. The player and facing indicator are rendered in a separate fixed layer at the center.

## 5. Refactoring and Hardening

The first implementation was reorganized into shared support modules and centralized configuration. Later review identified additional boundary and lifecycle issues, which were addressed in a second refactoring pass.

### Engine boundary validation

Invalid directional actions are now ignored safely. Previously, an arbitrary direction could either throw while looking up a movement delta or corrupt the player's facing value and fail during rendering.

### Level-up flow

Upgrade selection now returns through the engine's `select-upgrade` action path. This preserves sequential level-up behavior when excess XP is enough to trigger multiple levels.

### Persistence normalization

Saved progression is normalized when loaded:

- gold becomes a finite non-negative integer;
- permanent upgrade ranks are normalized and capped to configured costs;
- unknown fields are discarded;
- malformed save data falls back safely;
- storage write failures no longer interrupt the between-run transition.

Starting weapon unlocks were added as one-time permanent upgrades costing 100 gold each for the additional weapons. Knife is unlocked by default. The Between Runs screen exposes a starting-weapon selector; Knife remains the fallback, while any unlocked configured weapon can replace it for the next run.

Pickup collection is contact-only without Starting Magnet: a pickup must share the player's tile. One Starting Magnet rank expands the collection radius to the four cardinally adjacent tiles.

### Effect lifecycle isolation

Transient weapon and movement effects carry a run-generation boundary. Effects from an old run cannot trigger redraws after a new run starts or an old run ends.

### Test maintenance

The suite now includes malformed-action coverage, Axe coverage, regeneration coverage, enemy-type coverage, drop coverage, module-load coverage, and a deterministic scripted-run test. A misleading victory test name was corrected to match the configured turn-500 threshold.

## 6. Verification History

The project has been kept behind automated checks throughout the implementation:

- Node's built-in test runner;
- JavaScript syntax checks for runtime and test modules;
- static build confirmation;
- `git diff --check`;
- module-loading smoke coverage to catch broken ES-module exports;
- repository-wide code review and refactoring review.

The latest verified state at that point contained 21 passing tests, a successful static build, successful syntax checks, and a clean synchronized `main` branch. Subsequent feature work added more tests and left the current working tree intentionally uncommitted until the next review checkpoint.

Browser smoke testing was performed during earlier feature work. A later environment did not have a Chrome, Chromium, or Firefox binary available, so the most recent review could not repeat browser-level validation.

## 7. Current Architecture Principles

The implementation now follows these principles:

1. The engine is authoritative; events are presentation and test data, not a second state system.
2. Explicit seeds remain replayable even though new browser runs default to random seeds.
3. Configuration is centralized, while the engine interprets a small set of targeting and behavior modes.
4. World coordinates and camera transforms are separate from the fixed player presentation layer.
5. Persistence is normalized and replaceable.
6. Short-lived effects must be isolated from run lifecycle changes.
7. Visual polish must not make turn processing depend on animation completion.
8. Tests should cover deterministic state transitions before browser presentation.

## 8. Known Follow-Up Work

The whole-repository review identified several useful next steps that were deliberately not folded into the latest pass:

### Enemy population policy

Enemies currently accumulate during very long continued runs. A configurable active-enemy budget, replacement policy, or far-away despawn rule would keep long sessions bounded. This is a gameplay decision as well as a performance change and needs dedicated balancing tests.

### Incremental SVG rendering

The renderer currently rebuilds the SVG tree after actions and effect updates. Static terrain/entity/effect layers or cached terrain nodes could reduce allocation and paint work, especially on mobile. This should be profiled before changing the current reliable full-render approach.

### Engine phase extraction

`src/engine.js` remains a deliberately small public facade in terms of exports, but it still contains much of the turn pipeline. Combat, enemy movement, progression, and turn orchestration could be extracted into focused internal modules while preserving phase ordering and deterministic RNG consumption.

### Browser automation

A browser-level smoke test would cover starting a run, keyboard/touch controls, modal transitions, SVG rendering, and console errors. It should be added when a supported browser automation environment is available.

### Deployment artifact scope

The Pages workflow currently uploads the repository root. A future deployment step could assemble a small artifact containing only the static runtime files, reducing deployed non-runtime documents and test files.

## 9. Relationship to the Initial Plan

`initial-plan.md` remains the original design and acceptance reference. This document is the implementation history and current-state supplement.

When the two documents differ:

- use `initial-plan.md` to understand the original intent;
- use this document to understand which decisions were intentionally revised;
- use the source code and tests as the final authority for current behavior.
