const fs=require('fs'),vm=require('vm'),assert=require('assert'),core=require('./MobileLossCore.js').FFMobileCore;
const packets=[],store=new Map();let pauses=0,hospitalProbes=0;
const state={running:true,targetId:'2'},worker={getState:()=>state,pause:()=>{pauses++;state.running=false;},recoverFromHospital:()=>hospitalProbes++,onClaim:(...x)=>packets.push(['claim',...x]),onCommit:(...x)=>packets.push(['commit',...x]),onLossTerminal:x=>packets.push(['terminal',x]),onMedical:(...x)=>packets.push(['medical',...x])};
let response={profile:{id:1,status:{state:'Okay'},life:{current:100,maximum:100}},bars:{energy:{current:100}},cooldowns:{medical:0},perks:{}},requests=0;
const context={FFMobileCore:core,window:{FFMobileLossCycle:worker},document:{addEventListener(){}},apiKey:'fixture-seller',hash:()=> 'fixture-seller-hash',sessionStorage:{getItem:()=> '0123456789ABCDEF'},Date,Math,console,setTimeout:f=>f(),opened:false,tab:'Mobile Session',
getStore:(k,d)=>store.get(k)||d,setStore:(k,v)=>store.set(k,structuredClone(v)),render(){},isKey:k=>k==='0123456789ABCDEF',
sendHttp:async(method,url,headers)=>{requests++;assert(url.startsWith('https://api.torn.com/v2/'));assert.equal(headers.Authorization,'ApiKey 0123456789ABCDEF');return {status:200,responseText:JSON.stringify(response)};},mergeLedger(){},claimWithTarget:c=>c,request:async()=>{throw Error('Unexpected remote mutation');}};
vm.createContext(context);
vm.runInContext(fs.readFileSync('MobileLossHost.js','utf8')+'\nglobalThis.host={receive:mobileReceive,set(s){mobile=s;mobileLastApi=0;},get:()=>mobile,start:startMobile};',context);
function session(){return {seller:'fixture-seller-hash',owner:1,target:2,remoteId:9,total:2,baseline:0,local:[],checked:Date.now(),deadline:Date.now()+300000,claim:{id:9},heal:true,permissions:{68:true,67:true,66:true},medicalSession:'test-med'};}
const msg=(type,extra={})=>({type,profileId:'1',orderId:'ff-mobile-9',...extra});
(async()=>{
 context.host.set(session());await context.host.receive(msg('tc-loss-claim',{requestId:'next'}));
 const lease=context.host.get().lease;assert(lease&&packets.at(-1)[2]===true);
 const commit=msg('tc-loss-commit',{claimId:lease.id,visibleOutcome:'loss',fightStartedAt:lease.started,lossObservedAt:Date.now()});
 await context.host.receive(commit);await context.host.receive(commit);
 assert.equal(context.host.get().local.length,1,'replayed visible result counted twice');
 assert.equal(packets.at(-1)[3],1,'remaining quota incorrect');
 await context.host.receive(msg('tc-loss-claim',{requestId:'next-two'}));assert(context.host.get().lease);
 context.host.set(session());response.profile.status={state:'Hospital',until:Math.floor((Date.now()+38*60000)/1000)};response.cooldowns.medical=0;
 const med=(type,extra={})=>msg(type,{browserPlayerId:1,medicalSession:'test-med',requestId:'medical',inventory:[{id:67,quantity:3},{id:68,quantity:20},{id:66,quantity:2},{id:739,quantity:1}],...extra});
 await context.host.receive(med('tc-medical-plan'));let op=context.host.get().op;assert.equal(op.id,67,'38-minute plan should select regular FAK');assert.equal(packets.at(-1)[2].state,'Ready');
 await context.host.receive(med('tc-medical-authorize',{token:op.token}));assert.equal(packets.at(-1)[2].state,'Authorized');assert(op.issued);
 response.profile.status={state:'Okay'};response.cooldowns.medical=900;
 await context.host.receive(med('tc-medical-verify',{token:op.token,inventory:[{id:67,quantity:2},{id:68,quantity:20},{id:66,quantity:2}]}));
 assert(op.verified&&context.host.get().itemsUsed===1&&context.host.get().cooldownUsed===900);
 await context.host.receive(med('tc-medical-verify',{token:op.token}));assert.equal(context.host.get().itemsUsed,1,'replayed medicine counted twice');
 const oldRequests=requests;await context.host.receive(med('tc-medical-plan',{browserPlayerId:2}));assert.equal(requests,oldRequests,'wrong-account medical request touched API');assert(pauses>0);
 context.host.set(session());state.running=true;response.profile.id=2;const packetCount=packets.length;await context.host.receive(msg('tc-loss-claim',{requestId:'wrong-owner'}));assert.equal(packets.length,packetCount,'wrong API account received fight grant');
 response.profile.id=1;response.profile.status={state:'Hospital',until:Math.floor((Date.now()+60000)/1000)};state.running=true;context.host.set(session());await context.host.receive(msg('tc-loss-claim',{requestId:'hospital-race'}));assert.equal(hospitalProbes,1,'hospital race failed to route to recovery');
 context.host.set(session());state.running=true;await context.host.receive(med('tc-medical-plan',{inventory:[{id:206,quantity:99}]}));assert(!state.running,'drug inventory accepted');

 // Exercise the actual Start control's setup path without a game click or remote mutation.
 state.running=false;context.host.set(session());response.profile={id:1,name:'Fixture',status:{state:'Okay'}};
 const active={id:9,state:'active',target_player_id:2,slots_claimed:2,slots_delivered:0,expires_at:Math.floor(Date.now()/1000)+300};
 context.claims=[active];context.busy=false;context.pending=()=>false;context.positiveTornId=n=>Number(n)||0;context.targetIdFrom=c=>c.target_player_id;
 context.panel={querySelector:id=>id==='#ff-mobile-torn-key'?{value:'0123456789ABCDEF'}:{checked:true}};context.window.confirm=()=>true;
 context.sessionStorage.setItem=()=>{};context.setOpen=()=>{};
 context.request=async(method,path)=>{assert.equal(method,'GET');if(path==='/account/balance')return {player_id:1};if(path==='/claims')return {claims:[active]};throw Error('Undocumented endpoint');};
 let started;worker.reset=()=>{};worker.start=config=>{started=config;};
 await context.host.start(9);assert(started&&started.playerId===1&&started.targetId==='2'&&started.localLossTracking&&started.smartMedical);
 assert.equal(started.orderId,'ff-mobile-9');assert(context.host.get().heal&&context.host.get().permissions[67]);
 console.log('MOBILE HOST PASSED: native claim grants, local receipt replay/quota, medical plan-authorize-verify, quantity/cooldown verification, no repeated medicine, account isolation, hospital race and drug rejection. Mocked only.');
})().catch(e=>{console.error(e);process.exitCode=1});
