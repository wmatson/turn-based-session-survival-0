import { PERMANENT_UPGRADE_COSTS } from './config.js';

const KEY = 'session-survival-save-v1';
const defaults = { gold: 0, permanentUpgrades: { toughness: 0, startingMagnet: 0, sharpStart: 0 } };
export const loadProgress = (storage = globalThis.localStorage) => { try { return { ...defaults, ...(JSON.parse(storage?.getItem(KEY) || 'null') || {}), permanentUpgrades: { ...defaults.permanentUpgrades, ...(JSON.parse(storage?.getItem(KEY) || 'null')?.permanentUpgrades || {}) } }; } catch { return structuredClone(defaults); } };
export const saveProgress = (progress, storage = globalThis.localStorage) => { storage?.setItem(KEY, JSON.stringify(progress)); };
export const addGold = (progress, amount) => ({ ...progress, gold: progress.gold + amount });
export const permanentCosts = PERMANENT_UPGRADE_COSTS;
export const buyPermanent = (progress, id) => { const rank = progress.permanentUpgrades[id] || 0, cost = permanentCosts[id]?.[rank]; if (cost == null || progress.gold < cost) return progress; return { ...progress, gold: progress.gold - cost, permanentUpgrades: { ...progress.permanentUpgrades, [id]: rank + 1 } }; };
