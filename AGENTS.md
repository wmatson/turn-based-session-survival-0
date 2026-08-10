# Repository Contribution Guidelines

## Project intent

This repository is a static, browser-native, turn-based survival game. Preserve the separation between simulation, presentation, browser orchestration, and persistence.

## Required engineering principles

### Use strict TDD

For every behavior change or bug fix:

1. Add a focused regression test first.
2. Run the focused test and confirm it fails for the expected reason.
3. Make the smallest production change that makes it pass.
4. Run the focused test again.
5. Run the complete suite before finishing.
6. Refactor only while the tests remain green.

Do not add production behavior without a test. Prefer behavioral assertions over implementation-detail assertions.

The standard verification command is:

```sh
npm test && npm run build && git diff --check
```

Also run `node --check` for changed JavaScript modules when appropriate.

### Keep the engine pure and deterministic

`src/engine.js` and engine support modules must not:

- read or mutate the DOM;
- use browser APIs, localStorage, timers, or wall-clock time;
- read keyboard state;
- use global randomness;
- perform rendering or animation;
- depend on mutable module-level game state.

All gameplay results must be determined by the previous state, explicit action, and injected RNG. Preserve deterministic replay for explicit seeds and scripted actions.

The engine should return authoritative state plus events. Events are useful for presentation and tests, but gameplay correctness must not depend on replaying events.

### Prefer data-driven behavior

Put editable game content in `src/config.js` or a focused configuration module rather than adding weapon/enemy-specific branches to the turn pipeline.

Prefer small declarative vocabularies and interpreters over scattered conditionals. Validate configuration at useful boundaries and keep compatibility behavior explicit.

For weapons in particular:

- Give each weapon its own local state/variables in its weapon state object when scheduling or upgrades require them.
- Keep weapon-local variables close to the weapon definition and avoid deriving unrelated weapon state from global player fields.
- Colocate possible weapon upgrades with the weapon definition or a clearly associated data structure when practical.
- Represent static attack shapes with player-relative vectors or other declarative targeting data.
- Represent dynamic attacks, such as first-hit lines, with explicit targeting modes and parameters.
- Make upgrades modify weapon-local fields through a generic operation or well-defined weapon-specific capability, rather than adding new branches to `step()` for each upgrade.
- Preserve phase ordering (`preEnemyMove` and `postEnemyMove`) and deterministic RNG consumption when refactoring weapon logic.

The engine may interpret a small set of generic targeting modes, but new weapons should normally be implemented by adding configuration and tests, not by adding another weapon-name conditional.

### Keep presentation separate

`src/renderer.js` is responsible for SVG presentation only. `src/main.js` owns browser input, UI flow, rendering calls, and transient effect lifecycle. Do not move game rules into either module.

Rendering may rebuild or transform SVG as needed, but animations and timers must remain outside the engine. The player/facing graphic, world transform, padded viewport, and movement trails are presentation concerns.

### Keep persistence replaceable and defensive

`src/persistence.js` is the browser storage adapter. The engine must not import it. Normalize saved values, handle malformed data and storage failures, and keep persistence logic replaceable for tests or alternate storage.

### Preserve static-site constraints

- Use browser-native ES modules and APIs.
- Do not add a build step unless explicitly requested.
- Keep GitHub Pages paths relative.
- Do not commit `node_modules`, generated dependencies, credentials, API keys, or secret values.
- Do not expose authentication details in code, documentation, commit messages, or summaries; use `[REDACTED]` if a placeholder is needed.
- Prefer SVG/CSS geometry and avoid unnecessary external assets.

## Testing expectations

Maintain broad engine coverage for:

- movement, facing, blocking, and turn progression;
- weapon timing, targeting, range, damage, drops, and upgrade effects;
- enemy ordering, movement, contact damage, spawning, and respawning;
- pickups, XP, level-up sequencing, and regeneration;
- victory, continuation, exit, death, and persistence-facing run values;
- deterministic replay and malformed input/configuration boundaries;
- module-loading/linking regressions.

When changing configuration, add at least one test that exercises the configured definition rather than reconstructing an unrelated fixture by hand.

## Refactoring guidance

Preserve the public engine facade and explicit turn-phase order while extracting helpers or focused modules. Favor simple, reviewable changes over broad rewrites. Avoid premature optimization; profile before replacing reliable full SVG rendering with incremental updates.

When reducing duplication, first identify the existing shared helper or configuration vocabulary. Do not create a one-off wrapper merely to avoid touching the underlying abstraction.

## Workflow and reporting

Before editing, inspect the relevant source, tests, and current git state. After editing:

- run focused tests, then the full suite;
- run the static build and diff checks;
- inspect the final diff and worktree status;
- report actual tool results, not assumed results.

Use clear, direct summaries. Mention uncommitted work explicitly. Only commit or push when requested by the user or when the task explicitly requires it.

## Documentation

`initial-plan.md` is the original design and acceptance reference. `journey-after-initial-plan.md` records later implementation decisions and deviations. Update the journey document when a durable architectural or gameplay decision materially changes the current design.
