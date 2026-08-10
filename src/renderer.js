import { terrainAt } from './engine.js';
import { VIEWPORT_RADIUS } from './engine/constants.js';
import { ENEMY_DEFINITIONS, WEAPON_DEFINITIONS } from './config.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const color = { floor: '#151c2d', wall: '#4d5a70' };
const inViewport = (position, playerPosition, radius = VIEWPORT_RADIUS + 1) => Math.abs(position[0] - playerPosition[0]) <= radius && Math.abs(position[1] - playerPosition[1]) <= radius;
const weaponPoints = (x, y, direction) => ({ north:`${x+2},${y+10} ${x+6},${y+2} ${x+10},${y+10}`, south:`${x+2},${y+2} ${x+6},${y+10} ${x+10},${y+2}`, east:`${x+2},${y+2} ${x+10},${y+6} ${x+2},${y+10}`, west:`${x+10},${y+2} ${x+2},${y+6} ${x+10},${y+10}` })[direction] || `${x+2},${y+2} ${x+10},${y+6} ${x+2},${y+10}`;

export const renderGame = (svg, state, debug = false, effects = []) => {
  svg.replaceChildren();
  const size = 12;
  const half = VIEWPORT_RADIUS;
  const renderRadius = VIEWPORT_RADIUS + 1;
  const dimension = renderRadius * 2 + 1;
  const world = svgEl('g');
  const worldContent = svgEl('g', { transform: `translate(${(half - state.player.position[0]) * size},${(half - state.player.position[1]) * size})` });
  const playerLayer = svgEl('g');
  svg.append(world, playerLayer);
  world.append(worldContent);
  svg.setAttribute('viewBox', `0 0 ${size * (half * 2 + 1)} ${size * (half * 2 + 1)}`);

  const [px, py] = state.player.position;
  const at = position => [position[0] * size, position[1] * size];
  for (let row = 0; row < dimension; row += 1) for (let col = 0; col < dimension; col += 1) {
    const x = px + col - renderRadius;
    const y = py + row - renderRadius;
    worldContent.append(svgEl('rect', { x: x * size, y: y * size, width: size - 0.5, height: size - 0.5, fill: color[terrainAt(state.map, x, y)] }));
  }
  for (const object of state.breakables) if (inViewport(object.position, state.player.position)) {
    const [x, y] = at(object.position);
    if (object.type === 'chest') worldContent.append(svgEl('rect', { x: x + 1, y: y + 4, width: 10, height: 7, fill: '#8c552e', stroke: '#e8b85c', 'stroke-width': 1, rx: 1 }), svgEl('path', { d: `M${x+1} ${y+4} Q${x+6} ${y-1} ${x+11} ${y+4}`, fill: '#b8783d', stroke: '#e8b85c', 'stroke-width': 1 }), svgEl('rect', { x: x + 5, y: y + 5, width: 2, height: 3, fill: '#ffe08a' }));
    else worldContent.append(svgEl('rect', { x: x + 2, y: y + 2, width: 8, height: 8, fill: 'none', stroke: '#d9a441', 'stroke-width': 2, rx: 2 }));
  }
  for (const pickup of state.pickups) if (inViewport(pickup.position, state.player.position)) {
    const [x, y] = at(pickup.position);
    if (pickup.type === 'xp') worldContent.append(svgEl('polygon', { points: `${x+6},${y+2} ${x+10},${y+6} ${x+6},${y+10} ${x+2},${y+6}`, fill: '#62d6ff' }));
    else if (pickup.type === 'enemy-kill') worldContent.append(svgEl('line', { x1: x + 3, y1: y + 3, x2: x + 9, y2: y + 9, stroke: '#e55252', 'stroke-width': 2 }), svgEl('line', { x1: x + 9, y1: y + 3, x2: x + 3, y2: y + 9, stroke: '#e55252', 'stroke-width': 2 }));
    else if (pickup.type === 'health') worldContent.append(svgEl('path', { d: 'M4 0h4v4h4v4H8v4H4v-4H0V4h4z', transform: `translate(${x},${y})`, fill: '#67e58b' }));
    else worldContent.append(svgEl('circle', { cx: x + 6, cy: y + 6, r: 4, fill: '#ffd166', stroke: '#fff0a8', 'stroke-width': 1 }));
  }
  const projectileDelta = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };
  for (const projectile of state.projectiles) if (inViewport(projectile.position, state.player.position)) {
    const [x, y] = at(projectile.position), [dx, dy] = projectileDelta[projectile.direction] ?? [1, 0];
    worldContent.append(svgEl('line', { x1: x + 6 - dx * 4, y1: y + 6 - dy * 4, x2: x + 6 + dx * 4, y2: y + 6 + dy * 4, stroke: '#ff7b32', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: .9 }));
    worldContent.append(svgEl('circle', { cx: x + 6, cy: y + 6, r: 3, fill: '#ffd166', opacity: .95 }));
  }
  const trailArrow = (from, to) => {
    const [x1, y1] = at(from), [x2, y2] = at(to);
    const dx = x2 - x1, dy = y2 - y1, length = Math.hypot(dx, dy);
    if (!length) return null;
    const ux = dx / length, uy = dy / length, px = -uy, py = ux, tipX = x2 + 6, tipY = y2 + 6;
    return {
      line: svgEl('line', { x1: x1 + 6, y1: y1 + 6, x2: tipX, y2: tipY, stroke: '#d7e2ff', 'stroke-width': 1, 'stroke-dasharray': '2 2', opacity: .32 }),
      arrow: svgEl('polygon', { points: `${tipX},${tipY} ${tipX-ux*4+px*2},${tipY-uy*4+py*2} ${tipX-ux*4-px*2},${tipY-uy*4-py*2}`, fill: '#d7e2ff', opacity: .32 }),
    };
  };
  for (const trail of effects) if (trail.type === 'movement-trail') {
    const arrows = trailArrow(trail.from, trail.to);
    if (arrows) worldContent.append(arrows.line, arrows.arrow);
  }
  for (const enemy of state.enemies) if (inViewport(enemy.position, state.player.position)) {
    const [x, y] = at(enemy.position);
    const definition = ENEMY_DEFINITIONS[enemy.type] ?? ENEMY_DEFINITIONS['red-square'];
    const shape = definition.shape === 'circle' ? svgEl('circle', { cx: x + 6, cy: y + 6, r: 5, fill: definition.color }) : svgEl('rect', { x: x + 1, y: y + 1, width: 10, height: 10, fill: definition.color, rx: 2 });
    worldContent.append(shape);
    if (debug) { const text = svgEl('text', { x: x + 1, y: y + 9, fill: 'white', 'font-size': 5 }); text.textContent = enemy.id; worldContent.append(text); }
  }
  for (const effect of effects) if (effect.type === 'weapon-fired') {
    const definition = WEAPON_DEFINITIONS[effect.weapon] ?? WEAPON_DEFINITIONS.knife;
    for (const cell of effect.cells) {
      const [x, y] = at(cell);
      if (effect.weapon === 'lightning-bolt') worldContent.append(svgEl('polyline', { points: `${x+6},${y-6} ${x+4},${y+2} ${x+7},${y+2} ${x+3},${y+12} ${x+8},${y+4} ${x+5},${y+4} ${x+9},${y-6}`, fill: 'none', stroke: definition.effectColor, 'stroke-width': 1.5, 'stroke-linejoin': 'round', opacity: .9 }));
      else worldContent.append(svgEl('polygon', { points: weaponPoints(x, y, effect.direction), fill: definition.effectColor, opacity: .85, class: 'weapon-effect' }));
    }
  }
  const x = half * size, y = half * size;
  playerLayer.append(svgEl('circle', { cx: x + 6, cy: y + 6, r: 4.5, fill: '#f4f7ff', stroke: '#7c5cff', 'stroke-width': 2 }));
  const [dx, dy] = ({ north: [0, -3], south: [0, 3], east: [3, 0], west: [-3, 0] })[state.player.facing] ?? [0, -3];
  playerLayer.append(svgEl('line', { x1: x + 6, y1: y + 6, x2: x + 6 + dx, y2: y + 6 + dy, stroke: '#ffcf5a', 'stroke-width': 2 }));
};
