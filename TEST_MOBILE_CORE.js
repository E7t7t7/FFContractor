const assert=require('assert'),fs=require('fs'),vm=require('vm'),core=require('./MobileLossCore.js').FFMobileCore;
const stock={68:50,67:50,66:50},permission={68:true,67:true,66:true};
for(const [minutes,cost,id] of [[18,600,68],[38,900,67],[66,1200,66],[75,1800,0]]){
 const p=core.plan(minutes*60,0,21600,0,stock,permission);assert.equal(p.cost,cost);if(id)assert.equal(p.items[0],id);
}
assert.equal(core.plan(18*60,21599,21600,0,stock,permission).state,'Ready');
assert.equal(core.plan(18*60,21600,21600,0,stock,permission).state,'Cooldown');
assert.equal(core.plan(66*60,32399,32400,0,stock,permission).state,'Ready');
assert.equal(core.plan(38*60,0,21600,0,{68:2},{68:true}).items.length,2);
assert.equal(core.plan(66*60,0,21600,0,stock,{}).state,'Supplies');
assert(core.plan(66*60,0,21600,0,{68:50,67:50,66:0},permission).items.every(id=>id!==66));
assert(core.plan(66*60,0,21600,0,{206:999},{206:true}).state!=='Ready');
assert.deepEqual(core.modifiers({education:['10% medical item effectiveness'],faction:['20% medical item effectiveness','Medical cooldown increased by 3 hours']}),{bonus:30,maximum:32400});
assert.throws(()=>core.modifiers({faction:['Medical cooldown increased somehow']}));
const before={owner:1,at:1000000,until:2000000,cooldown:500};
const after={owner:1,at:1005000,until:1005000,cooldown:1395};
assert(core.verify(before,after,67,{67:2},{67:1},5));
assert(!core.verify(before,{...after,owner:2},67,{67:2},{67:1},5));
assert(!core.verify(before,{...after,cooldown:500},67,{67:2},{67:1},5));
assert(!core.verify(before,after,206,{206:2},{206:1},5));
const now=Date.now(),claim={id:9,slots_claimed:2,slots_delivered:0,state:'active',target_player_id:2,expires_at:(now+300000)/1000,idle_deadline_at:(now+200000)/1000};
assert.equal(core.validateSession({owner:1,remoteId:9,target:2},1,claim,now),now+200000);
assert.throws(()=>core.validateSession({owner:1,remoteId:9,target:2},2,claim,now));
assert.throws(()=>core.validateSession({owner:1,remoteId:9,target:2},1,{...claim,state:'fulfilled'},now));
assert.throws(()=>core.validateSession({owner:1,remoteId:9,target:2},1,claim,now+300000));
assert.equal(core.receipt([{id:4,attacker:{id:1},defender:{id:2},started:1000,ended:1002,result:'Lost'}],1,2,1000000,[])?.id,4);
assert(!core.receipt([{id:4,attacker:{id:1},defender:{id:2},started:1000,ended:1002,result:'Lost'}],1,2,1000000,[4]));
console.log('MOBILE CORE PASSED: optimal medical combinations, modifiers, six/nine-hour capacity, depletion, no-drug allowlist, receipt verification, claim identity/deadline and duplicate exclusion.');
