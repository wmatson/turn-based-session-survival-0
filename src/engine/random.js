export const seededRng = (seed = 1) => {
  let value = seed >>> 0;
  return {
    nextInt(max) {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return max ? value % max : 0;
    },
    get state() { return value; },
  };
};

export const normalizeRng = rng => rng && typeof rng.nextInt === 'function' ? rng : seededRng(0);
