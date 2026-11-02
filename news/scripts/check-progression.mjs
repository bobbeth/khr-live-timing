import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const context={window:{}};vm.createContext(context);
vm.runInContext(await fs.readFile(new URL('../assets/progression.js',import.meta.url),'utf8'),context);
const build=context.window.MMTVProgression.build;
const race=(round,points,series='Example',season='2026',estimated=0)=>({entry:{round,series,season},points,estimated});
const data={drivers:[
 {id:'a',name:'A',races:[race(1,10),race(3,5)]},
 {id:'b',name:'B',races:[race(1,5),race(2,5),race(3,10,'Example','2026',1)]},
 {id:'c',name:'C',races:[race(2,10)]},
 {id:'other',name:'Other',races:[race(1,999,'Other'),race(1,999,'Example','2025')]}
]};
const model=build(data,'2026','Example',e=>e.season);
assert.equal(model.drivers.length,3);
const find=id=>model.drivers.find(d=>d.id===id);
assert.deepEqual(Array.from(find('a').history,h=>h.points),[10,10,15]);
assert.deepEqual(Array.from(find('a').history,h=>h.earned),[10,0,5]);
assert.equal(find('a').history[1].raced,false);
assert.equal(find('c').history[0].round,2,'Late entrant must not appear before joining');
assert.deepEqual(Array.from(find('b').history,h=>h.rank),[2,1,1]);
assert.equal(find('a').history[1].rank,1,'Tied points share the championship position');
assert.equal(find('c').history[1].rank,3);
assert.equal(find('b').history[1].estimated,false);
assert.equal(find('b').history[2].estimated,true);
assert.equal(find('a').history[2].rank,2);
const zero=build({drivers:[{id:'z',name:'Zero',races:[race(1,0)]}]},'2026','Example',e=>e.season);
assert.equal(zero.drivers[0].history[0].rank,1);
assert.equal(build({drivers:[]},'2026','Example',e=>e.season).rounds.length,0);
// Rendering: one-round/all-zero series, position orientation, group/metric changes.
function node(){return {innerHTML:'',children:new Map(),querySelector(selector){if(!this.children.has(selector))this.children.set(selector,node());return this.children.get(selector);},querySelectorAll(){return [];}};}
const element=node();
context.window.MMTVProgression.mount({element,data:{drivers:[{id:'z',name:'Zero',races:[race(1,0)]}]},groups:[{season:'2026',series:'Example'}],driverId:'z',seasonName:e=>e.season,esc:String});
assert.ok(!element.querySelector('.progression-plot').innerHTML.includes('NaN'));
assert.ok(element.querySelector('.progression-plot').innerHTML.includes('<circle'));
element.querySelector('#progression-undefined-metric').onchange({target:{value:'rank'}});
assert.ok(element.querySelector('.progression-plot').innerHTML.includes('first place at the top'));
assert.ok(!element.querySelector('.progression-plot').innerHTML.includes('NaN'));
console.log('PASS: cumulative points, ties, missed rounds, late entries, season/series isolation, estimated points, zero points and chart rendering.');
