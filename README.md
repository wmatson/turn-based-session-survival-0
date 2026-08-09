# Turn-Based Session Survival

A small, static, turn-based survival game for GitHub Pages. The world, terrain, enemy ordering, weapon timing, spawns, and upgrade choices are deterministic for a given seed and action sequence.

## Run locally

```sh
npm test
npm run build
npx serve .
```

Open the served URL. No build toolchain or server runtime is required for deployment; `index.html` and the `src/` modules are static assets.

## Controls

- WASD / arrow keys: move and face
- Shift + WASD / arrows: wait and face
- Space: wait
- Touch buttons are available below the board

The debug button shows the current world coordinate and entity counter. Use the seed field to reproduce a run.

## Project layout

- `src/config.js`: editable enemy, weapon, upgrade, wave, and permanent-progression definitions
- `src/engine.js`: pure state transition engine
- `src/engine/`: terrain, RNG, action constants, and wave-selection helpers used by the engine
- `src/renderer.js`: SVG presentation only
- `src/main.js`: browser input and run flow
- `src/persistence.js`: replaceable permanent progression storage
- `test/engine.test.js`: engine regression and determinism tests

To create a variant, start with `src/config.js`: add or modify enemy/weapon/upgrade definitions and spawn bands without changing the state-transition engine. Targeting behavior names such as `line`, `first-in-line`, and `adjacent` are interpreted by the engine.

## GitHub Pages

The repository includes a workflow under `.github/workflows/pages.yml`. Enable GitHub Pages with GitHub Actions as the source, then pushes to `main` publish the static site.
