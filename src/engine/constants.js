export const DIRECTIONS = ['north', 'south', 'east', 'west'];
export const VICTORY_TURN = 500;
export const VIEWPORT_RADIUS = 15;
export const SPAWN_RADIUS = VIEWPORT_RADIUS + 2;
export const OUTRUN_RADIUS = VIEWPORT_RADIUS + 4;
export const DELTAS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

export const ACTIONS = {
  move: direction => ({ type: 'move', direction }),
  moveNorth: { type: 'move', direction: 'north' },
  moveSouth: { type: 'move', direction: 'south' },
  moveEast: { type: 'move', direction: 'east' },
  moveWest: { type: 'move', direction: 'west' },
  wait: { type: 'wait' },
  waitFacing: direction => ({ type: 'wait-facing', direction }),
  continue: { type: 'continue' },
  exit: { type: 'exit' },
  selectUpgrade: id => ({ type: 'select-upgrade', id }),
};
