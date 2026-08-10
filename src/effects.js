export const MAX_EFFECT_AGE_TURNS = 2;

export const pruneEffects = (effects, currentTurn) => effects.filter(effect => (
  effect.createdTurn == null || currentTurn - effect.createdTurn <= MAX_EFFECT_AGE_TURNS
));
