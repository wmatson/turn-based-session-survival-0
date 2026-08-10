import test from 'node:test';

const modules = [
  '../src/config.js',
  '../src/engine/constants.js',
  '../src/engine/random.js',
  '../src/engine/terrain.js',
  '../src/engine/waves.js',
  '../src/engine.js',
  '../src/persistence.js',
  '../src/effects.js',
  '../src/renderer.js',
];

test('all runtime modules load without export-linking errors', async () => {
  for (const modulePath of modules) await import(modulePath);
});
