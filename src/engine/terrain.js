export const distance = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
export const chunkOf = (x, y) => [Math.floor(x / 20), Math.floor(y / 20)];
export const hashSeed = (...values) => {
  let hash = 2166136261 >>> 0;
  for (const value of values) {
    hash ^= Number(value) >>> 0;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
};

const chunkWall = (map, chunkX, chunkY) => {
  const hash = hashSeed(map.seed, chunkX, chunkY);
  return {
    x: chunkX * 20 + 2 + hash % 15,
    y: chunkY * 20 + 2 + Math.floor(hash / 31) % 15,
  };
};

export const terrainAt = (map, x, y) => {
  const [chunkX, chunkY] = chunkOf(x, y);
  const wall = chunkWall(map, chunkX, chunkY);
  return x >= wall.x && x < wall.x + 3 && y >= wall.y && y < wall.y + 5 ? 'wall' : 'floor';
};
