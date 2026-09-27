import assert from 'node:assert/strict';
import {stateFor,findMapForWhere,durationMinutes} from '../logic.js';

const rule={shoot1:20,move1:5,shoot2:20,move2:5,cheki:20};
const group={times:[{start:'13:20',end:'14:30',label:'2部'}]};
const p={sessions:[{a1:'野外4',a2:'屋内9',cheki:true}]};
assert.equal(durationMinutes(rule),70);
assert.deepEqual(stateFor(p,group,rule,'13:32').kind,'shoot');
assert.equal(stateFor(p,group,rule,'13:32').where,'野外4');
assert.equal(stateFor(p,group,rule,'13:32').remain,8);
assert.equal(stateFor(p,group,rule,'13:42').kind,'move');
assert.equal(stateFor(p,group,rule,'13:55').where,'屋内9');
assert.equal(stateFor(p,group,rule,'14:07').kind,'move');
assert.equal(stateFor(p,group,rule,'14:20').kind,'cheki');

const maps={one:{label:'野外',areas:[1,2,3,4]},two:{label:'屋内',areas:[9,10]}};
assert.equal(findMapForWhere(maps,'野外4').key,'one');
assert.equal(findMapForWhere(maps,'屋内9').key,'two');
const generic={a:{label:'第1会場',areas:['RED','BLUE']}};
assert.equal(findMapForWhere(generic,'RED').key,'a');
console.log('logic tests: ok');
