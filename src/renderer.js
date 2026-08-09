import { terrainAt } from './engine.js';
import { VIEWPORT_RADIUS } from './engine/constants.js';
import { ENEMY_DEFINITIONS, WEAPON_DEFINITIONS } from './config.js';
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k,v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const color = { floor: '#151c2d', wall: '#4d5a70' };
const inViewport = (position, playerPosition) => Math.abs(position[0] - playerPosition[0]) <= VIEWPORT_RADIUS && Math.abs(position[1] - playerPosition[1]) <= VIEWPORT_RADIUS;
const weaponPoints = (x, y, direction) => ({ north:`${x+2},${y+10} ${x+6},${y+2} ${x+10},${y+10}`, south:`${x+2},${y+2} ${x+6},${y+10} ${x+10},${y+2}`, east:`${x+2},${y+2} ${x+10},${y+6} ${x+2},${y+10}`, west:`${x+10},${y+2} ${x+2},${y+6} ${x+10},${y+10}` })[direction] || `${x+2},${y+2} ${x+10},${y+6} ${x+2},${y+10}`;
export const renderGame = (svg, state, debug = false, effects = []) => {
  svg.replaceChildren(); const size = 12, half = VIEWPORT_RADIUS, dimension = VIEWPORT_RADIUS * 2 + 1, view = svgEl('g'); svg.append(view); svg.setAttribute('viewBox', `0 0 ${size*dimension} ${size*dimension}`);
  const [px,py] = state.player.position;
  for (let row=0; row<dimension; row++) for (let col=0; col<dimension; col++) { const x=px+col-half, y=py+row-half; const tile=svgEl('rect',{x:col*size,y:row*size,width:size-0.5,height:size-0.5,fill:color[terrainAt(state.map,x,y)]}); view.append(tile); }
  const at = p => [(p[0]-px+half)*size, (p[1]-py+half)*size];
  for (const object of state.breakables) if (inViewport(object.position,state.player.position)) { const [x,y]=at(object.position); view.append(svgEl('rect',{x:x+2,y:y+2,width:8,height:8,fill:'none',stroke:'#d9a441','stroke-width':2,rx:2})); }
  for (const pickup of state.pickups) if (inViewport(pickup.position,state.player.position)) { const [x,y]=at(pickup.position); if(pickup.type==='xp') view.append(svgEl('polygon',{points:`${x+6},${y+2} ${x+10},${y+6} ${x+6},${y+10} ${x+2},${y+6}`,fill:'#62d6ff'})); else view.append(svgEl('path',{d:`M${x+4} ${y+2}h4v4h4v4H8v4H4v-4H0V6h4z`,transform:`translate(${x+0},${y-2})`,fill:'#67e58b'})); }
  for (const enemy of state.enemies) { if(!inViewport(enemy.position,state.player.position)) continue; const [x,y]=at(enemy.position); const definition = ENEMY_DEFINITIONS[enemy.type] ?? ENEMY_DEFINITIONS['red-square']; const shape = definition.shape === 'circle' ? svgEl('circle',{cx:x+6,cy:y+6,r:5,fill:definition.color}) : svgEl('rect',{x:x+1,y:y+1,width:10,height:10,fill:definition.color,rx:2}); view.append(shape); if(debug){const t=svgEl('text',{x:x+1,y:y+9,fill:'white','font-size':5});t.textContent=enemy.id;view.append(t);} }
  const [x,y]=at(state.player.position); const player=svgEl('circle',{cx:x+6,cy:y+6,r:4.5,fill:'#f4f7ff',stroke:'#7c5cff','stroke-width':2}); view.append(player); const [dx,dy] = ({north:[0,-3],south:[0,3],east:[3,0],west:[-3,0]})[state.player.facing]; view.append(svgEl('line',{x1:x+6,y1:y+6,x2:x+6+dx,y2:y+6+dy,stroke:'#ffcf5a','stroke-width':2}));
  for (const e of effects) { if (e.type !== 'weapon-fired') continue; const pts=e.cells.map(c=>at(c)); const definition = WEAPON_DEFINITIONS[e.weapon] ?? WEAPON_DEFINITIONS.knife; for(const [ex,ey] of pts) view.append(svgEl('polygon',{points:weaponPoints(ex,ey,e.direction),fill:definition.effectColor,opacity:.85,class:'weapon-effect'})); }
};
