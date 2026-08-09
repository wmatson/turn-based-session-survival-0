import { PERMANENT_UPGRADE_COSTS } from './config.js';

const KEY = 'session-survival-save-v1';
const defaults = { gold: 0, permanentUpgrades: { toughness: 0, startingMagnet: 0, sharpStart: 0 } };

const integerOr = (value, fallback = 0) => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
const normalizeRank = (id, value) => Math.min(integerOr(value), PERMANENT_UPGRADE_COSTS[id]?.length ?? 0);

export const normalizeProgress = raw => ({
  gold: integerOr(raw?.gold),
  permanentUpgrades: Object.fromEntries(Object.keys(defaults.permanentUpgrades).map(id => [id, normalizeRank(id, raw?.permanentUpgrades?.[id])])),
});

export const loadProgress = (storage = globalThis.localStorage) => {
  try {
    const saved = JSON.parse(storage?.getItem(KEY) || 'null');
    return normalizeProgress(saved);
  } catch {
    return structuredClone(defaults);
  }
};

export const saveProgress = (progress, storage = globalThis.localStorage) => {
  try {
    storage?.setItem(KEY, JSON.stringify(normalizeProgress(progress)));
    return true;
  } catch {
    return false;
  }
};

export const addGold = (progress, amount) => ({ ...progress, gold: progress.gold + amount });
export const permanentCosts = PERMANENT_UPGRADE_COSTS;
export const buyPermanent = (progress, id) => { const rank = progress.permanentUpgrades[id] || 0, cost = permanentCosts[id]?.[rank]; if (cost == null || progress.gold < cost) return progress; return { ...progress, gold: progress.gold - cost, permanentUpgrades: { ...progress.permanentUpgrades, [id]: rank + 1 } }; };
