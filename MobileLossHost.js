// Included inside FFContractor's closure by BUILD_MOBILE.py.
const MOBILE_STORE='ff-mobile-loss-host-v1',MOBILE_KEY='ff-mobile-torn-key-v1';
let mobile=null,mobileBusy=false,mobileLastApi=0,mobileStatus='Not started',mobileInstalled=false;
function mobileSave(){setStore(MOBILE_STORE,mobile);}
function mobileKey(){try{return sessionStorage.getItem(MOBILE_KEY)||'';}catch{return '';}}
function mobileWorker(){return window.FFMobileLossCycle;}
function mobileCount(){return mobile?Math.max(mobile.baseline+mobile.local.length,Number(mobile.providerDelivered)||0):0;}
function mobilePause(reason){mobileWorker()?.pause(String(reason));mobileStatus=String(reason);if(mobile){mobile.note=mobileStatus;mobileSave();}if(opened)render();}
async function mobileApi(route){
 const key=mobileKey();if(!isKey(key))throw Error('Enter the separate Torn API key again in Mobile Session; the phone session key is missing.');
 const wait=mobileLastApi+1500-Date.now();if(wait>0)await new Promise(r=>setTimeout(r,wait));mobileLastApi=Date.now();
 const response=await sendHttp('GET','https://api.torn.com/v2/'+route,{Authorization:'ApiKey '+key,Accept:'application/json'});
 let data;try{data=JSON.parse(response.responseText);}catch{throw Error('Torn returned unreadable API data.');}
 if(Number(response.status)<200||Number(response.status)>=300||data.error)throw Error('Torn API check failed'+(data.error?.code?' (code '+Number(data.error.code)+')':'')+'. Pause and refresh; nothing retried.');
 return data;
}
async function mobileObservation(){
 const d=await mobileApi('user?selections=profile,cooldowns,perks'),p=d.profile;
 if(!p||p.id!==mobile.owner)throw Error('Torn key belongs to a different account. No item or fight authorized.');
 if(!['Hospital','Okay'].includes(p.status?.state))throw Error('Account is not in Hospital or Okay status.');
 if(/radiation|poison/i.test(JSON.stringify(p.status)))throw Error('Nonstandard hospitalization requires manual review.');
 if(!d.perks||typeof d.perks!=='object'||Array.isArray(d.perks))throw Error('Medical perks were not returned. Check Torn API permissions.');
 const mods=FFMobileCore.modifiers(d.perks),now=Date.now();
 const o={owner:p.id,at:now,until:p.status.state==='Hospital'?Number(p.status.until)*1000:now,cooldown:Number(d.cooldowns.medical),...mods,energy:Number(d.bars?.energy?.current)};
 if(!Number.isFinite(o.until)||!Number.isFinite(o.cooldown)||o.cooldown<0)throw Error('Medical snapshot incomplete.');
 return o;
}
async function mobileClaimCheck(force=false){
 if(!mobile||mobile.seller!==hash(apiKey))throw Error('Seller account changed. Stop this mobile session before changing accounts.');
 if(force||Date.now()-Number(mobile.checked||0)>20000){
  const data=await request('GET','/claims'),rows=(data.claims||[]).map(claimWithTarget),claim=rows.find(c=>String(c.id)===String(mobile.remoteId));
  if(!claim)throw Error('Owning claim unavailable. No new fight authorized.');
  mobile.deadline=FFMobileCore.validateSession(mobile,mobile.owner,claim,Date.now());mobile.providerDelivered=Number(claim.slots_delivered)||0;mobile.checked=Date.now();mobile.claim=claim;mergeLedger(rows);mobileSave();
 }
 mobileWorker()?.setExternalDeadline?.(mobile.deadline);
 if(mobile.deadline<=Date.now())throw Error('Claim deadline reached. No new fight authorized.');
 return mobile.claim;
}
function mobileContext(m){
 return mobile&&mobile.seller===hash(apiKey)&&m.profileId===String(mobile.owner)&&m.orderId==='ff-mobile-'+mobile.remoteId&&(!m.targetId||Number(m.targetId)===mobile.target)&&Number(mobileWorker()?.getState()?.targetId)===mobile.target&&(!m.medicalSession||m.medicalSession===mobile.medicalSession);
}
async function mobileReceive(m){
 if(m.type==='tc-loss-status'){if(mobile&&m.profileId!==String(mobile.owner))return;if(mobile&&m.running&&!document.hidden&&Date.now()-Number(mobile.seenAt||0)>1000){mobile.seenAt=Date.now();mobileSave();}const next=m.status||m.stage;if(next!==mobileStatus){mobileStatus=next;if(opened&&tab==='Mobile Session')render();}return;}
 if(m.type==='tc-loss-finished'){if(mobile){mobile.note='Session complete. Refresh FFScouter to reconcile provider progress; completion/payment remain provider-controlled.';mobileSave();}return;}
 if(!mobileContext(m))return;
 if(m.type==='tc-loss-abandon'){if(mobile.lease?.id===m.claimId){mobile.lease=null;mobileSave();}return;}
 if(mobileBusy)return;mobileBusy=true;
 try{
  const worker=mobileWorker();
  if(m.type==='tc-loss-claim'){
   await mobileClaimCheck();const remaining=mobile.total-mobileCount();
   if(remaining<=0){worker.onClaim(m.requestId,false,'','Complete: requested losses delivered locally. Refresh provider progress.');return;}
   if(mobile.lease){worker.onClaim(m.requestId,true,mobile.lease.id,'Continuing the reserved mobile fight.');return;}
   const self=await mobileApi('user?selections=profile,bars');
   if(self.profile?.id!==mobile.owner)throw Error('Torn account changed.');
   if(self.profile.status?.state==='Hospital'){worker.recoverFromHospital();return;}
   if(self.profile.status?.state!=='Okay')throw Error('Account unavailable for fighting.');
   if(Number(self.bars?.energy?.current)<25){worker.onClaim(m.requestId,false,'','Complete: fewer than 25 energy remain.');return;}
   if(!worker.getState()?.running)return;
   mobile.lease={id:'mobile-'+Date.now()+'-'+Math.random().toString(36).slice(2),started:Date.now()};mobileSave();
   worker.onClaim(m.requestId,true,mobile.lease.id,'Mobile target slot authorized.');return;
  }
  if(m.type==='tc-loss-commit'||m.type==='tc-loss-terminal'){
   if(mobile.local.some(x=>x.lease===m.claimId)){
    const remaining=Math.max(0,mobile.total-mobileCount());if(m.type==='tc-loss-terminal')worker.onLossTerminal({kind:'verified',claimId:m.claimId,ok:true,remaining,message:'Previously recorded mobile loss.'});else worker.onCommit(m.claimId,true,remaining,'Previously recorded mobile loss.');return;
   }
   if(mobile.lease?.id!==m.claimId)throw Error('No matching mobile attack reservation.');
   let attackId=0;
   if(m.type==='tc-loss-terminal'||m.visibleOutcome!=='loss'||Number(m.lossObservedAt)<Number(m.fightStartedAt)||Number(m.fightStartedAt)<mobile.lease.started-2000){
    const data=await mobileApi('user/attacks?filters=outgoing&limit=100&sort=desc&from='+Math.floor(mobile.lease.started/1000));
    const receipt=FFMobileCore.receipt(data.attacks,mobile.owner,mobile.target,mobile.lease.started,mobile.local.map(x=>x.attackId));
    if(!receipt){worker.onLossTerminal({kind:'pending',claimId:m.claimId,retryAt:Date.now()+8000,message:'Waiting for an official loss receipt; no extra attack.'});return;}
    if(receipt.result!=='Lost')throw Error('Fight was not a verified loss. No delivery counted.');attackId=receipt.id;
   }
   mobile.local.push({lease:m.claimId,attackId,at:Date.now(),provisional:attackId===0});mobile.lease=null;mobileSave();
   const remaining=Math.max(0,mobile.total-mobileCount()),message='Mobile loss recorded; '+remaining+' remaining. Provider confirmation may lag.';
   if(m.type==='tc-loss-terminal')worker.onLossTerminal({kind:'verified',claimId:m.claimId,ok:true,remaining,message});else worker.onCommit(m.claimId,true,remaining,message);
   return;
  }
  if(m.type.startsWith('tc-medical-')){
   const reply=r=>worker.onMedical(m.requestId,r);
   if(m.browserPlayerId!==mobile.owner)throw Error('Medical browser identity differs from the owning account.');
   const inv={};for(const row of m.inventory||[]){if(row.id!==739&&!FFMobileCore.meds.some(x=>x.id===row.id))throw Error('Unsupported medical item. Blood bags/drugs are excluded.');if(!Number.isSafeInteger(row.quantity)||row.quantity<0)throw Error('Invalid item count.');inv[row.id]=row.quantity;}
   if(m.type==='tc-medical-plan'){
    if(mobile.op?.issued&&!mobile.op.verified)throw Error('The previous item still requires verification. No new plan authorized.');
    const o=await mobileObservation(),p=FFMobileCore.plan(Math.max(0,Math.ceil((o.until-Date.now())/1000)),o.cooldown,o.maximum,o.bonus,inv,mobile.permissions);
    if(p.state==='Recovered'){mobile.op=null;mobileSave();reply({state:'Recovered'});return;}
    if(p.state==='Cooldown'){reply({state:'Cooldown',reason:'Medical cooldown reached. No drugs will be used.',waitUntil:new Date(Date.now()+p.waitSeconds*1000).toISOString(),autoResume:false});return;}
    if(p.state!=='Ready')throw Error(p.reason||'No permitted medical supplies can end hospitalization.');
    const item=FFMobileCore.meds.find(x=>x.id===p.items[0]);
    mobile.op={token:'med-'+Date.now()+'-'+Math.random().toString(36).slice(2),id:item.id,before:o,inventory:inv,issued:false,verified:false,attempts:0,expires:Date.now()+40000};mobileSave();
    reply({state:'Ready',token:mobile.op.token,itemId:item.id,name:item.name,quantity:inv[item.id],expires:new Date(mobile.op.expires).toISOString(),automatic:mobile.heal===true});return;
   }
   const op=mobile.op;if(!op||op.token!==m.token)throw Error('Medical operation identity changed.');
   if(m.type==='tc-medical-authorize'){
    if(!mobile.heal||!mobile.permissions[op.id]||op.issued)throw Error('Medical permission missing or already issued.');
    if(op.expires<Date.now()||inv[op.id]!==op.inventory[op.id]){mobile.op=null;mobileSave();reply({state:'Replan',reason:'Unused medical plan changed. Recalculate remaining supplies.'});return;}
    if(Date.now()-op.before.at>10000){mobile.op=null;mobileSave();reply({state:'Replan',reason:'Unused medical snapshot expired. Recalculate before dispatch.'});return;}
    op.issued=true;mobileSave();reply({state:'Authorized',token:op.token,itemId:op.id,expires:new Date(Date.now()+30000).toISOString()});return;
   }
   if(m.type==='tc-medical-verify'){
    if(!op.issued)throw Error('No item was authorized.');
    if(op.verified){reply({state:'Verified',token:op.token});return;}
    const after=await mobileObservation();
    if(!FFMobileCore.verify(op.before,after,op.id,op.inventory,inv,(after.at-op.before.at)/1000)){
     if(++op.attempts>6)throw Error('Item outcome remains uncertain. No second item or drug fallback.');
     mobileSave();reply({state:'PendingVerification',token:op.token,retryAfterMs:op.attempts<3?2500:8000,reason:'Waiting for item/cooldown/hospital evidence; no repeat click.'});return;
    }
    op.verified=true;mobile.itemsUsed=Number(mobile.itemsUsed||0)+1;mobile.cooldownUsed=Number(mobile.cooldownUsed||0)+FFMobileCore.meds.find(x=>x.id===op.id).cost;mobileSave();reply({state:'Verified',token:op.token});return;
   }
  }
 }catch(error){mobilePause(mobileKey()?String(error.message||error).split(mobileKey()).join('[redacted]'):String(error.message||error));}
 finally{mobileBusy=false;}
}
function installMobileWorker(){
 if(mobileInstalled)return;mobileInstalled=true;window.__FFMobileReceive=m=>{void mobileReceive(m);};
 /* MOBILE_WORKER */
}
async function startMobile(id){
 if(window.chrome?.webview){errorText='Use Commander desktop Loss Desk here. Mobile sessions run in TornPDA.';render();return;}
 const claim=claims.find(c=>String(c.id)===String(id));if(!claim||busy||pending())throw Error('Refresh active claims before starting.');
 if(mobileBusy)throw Error('Wait for the pending mobile verification to finish.');
 if(mobile?.op?.issued&&!mobile.op.verified)throw Error('Resume to verify the previous medical item before starting a new session.');
 if(mobileWorker()?.getState()?.running)throw Error('Stop the existing mobile session first.');
 const torn=String(panel.querySelector('#ff-mobile-torn-key')?.value||mobileKey()).trim();
 if(!isKey(torn))throw Error('Enter a separate Torn API key for identity, energy and medical checks.');
 if(!panel.querySelector('#ff-mobile-home-off')?.checked)throw Error('Confirm that this claim is not running on your PC or another device.');
 const heal=!!panel.querySelector('#ff-mobile-heal')?.checked;
 if(!window.confirm('Start the mobile loss loop for this claim? It spends energy'+(heal?' and permitted personal medical items':'')+'. Keep TornPDA visible and do not run the same claim on your PC. This automation is not compliant with Torn scripting rules.'))return;
 sessionStorage.setItem(MOBILE_KEY,torn);
 const identity=await request('GET','/account/balance',null,'https://ffscouter.com/api/v1'),owner=positiveTornId(identity.player_id),target=targetIdFrom(claimWithTarget(claim));
 if(!owner||!target)throw Error('Claim target or seller identity is missing.');
 const self=await mobileApi('user/profile');if(self.profile?.id!==owner)throw Error('Torn key and seller account do not match.');
 const permission={};for(const item of FFMobileCore.meds)permission[item.id]=!!panel.querySelector('#ff-mobile-item-'+item.id)?.checked;
 const candidate={seller:hash(apiKey),owner,target,remoteId:Number(claim.id),baseline:Number(claim.slots_delivered)||0,total:Number(claim.slots_claimed),local:[],permissions:permission,heal,medicalSession:'mobile-med-'+Date.now(),claim};
 if(mobile?.seller===candidate.seller&&mobile.remoteId===candidate.remoteId&&mobile.owner===owner){candidate.baseline=mobile.baseline;candidate.local=mobile.local;candidate.itemsUsed=mobile.itemsUsed;candidate.cooldownUsed=mobile.cooldownUsed;}
 candidate.deadline=FFMobileCore.validateSession(candidate,owner,claim,Date.now());mobile=candidate;mobile.seenAt=Date.now();mobileSave();await mobileClaimCheck(true);if(mobileCount()>=mobile.total)throw Error('This claim already has all losses recorded. Refresh provider progress rather than restarting it.');installMobileWorker();
 mobileWorker().reset();mobileWorker().start({profileId:String(owner),slot:'MOBILE',orderId:'ff-mobile-'+mobile.remoteId,targetId:String(target),selfName:self.profile.name,playerId:owner,smartMedical:true,medicalSession:mobile.medicalSession,attackDelayMs:1000,localLossTracking:true,externalDeadline:mobile.deadline});
 errorText='';notice='Mobile session started on this phone.';setOpen(false);
}
function mobileHtml(){
 const active=claims.find(c=>c.state==='active'),state=mobileWorker()?.getState(),owned=mobile&&mobile.seller===hash(apiKey);
 return '<h3>Phone-native loss session</h3><p class="ff-small">Runs on this phone, not your home PC. Keep TornPDA foreground and unlocked. Do not run this claim on another device. Automatic attacks/healing are contrary to Torn scripting rules.</p>'+
 '<div class="ff-card"><strong>'+esc(owned?mobileStatus:'Not started')+'</strong><div class="ff-small">'+(owned?mobileCount()+'/'+mobile.total+' tracked losses · '+Math.max(0,mobileCount()-mobile.baseline)+' locally recorded this session · '+Number(mobile.itemsUsed||0)+' medical items · '+Math.round(Number(mobile.cooldownUsed||0)/60)+' minutes added medical cooldown':'No mobile session for this seller account.')+'</div><div class="ff-row"><button data-action="mobile-pause">Pause</button><button data-action="mobile-resume">Resume</button><button data-action="mobile-stop">Stop</button><button data-action="mobile-diagnostic">Copy diagnostic</button></div></div>'+
 '<div class="ff-card"><label><input id="ff-mobile-home-off" type="checkbox"> I stopped home-PC execution for this claim</label><label>Separate Torn API key (this browser session only)<input id="ff-mobile-torn-key" type="password" autocomplete="off" placeholder="Identity, bars, cooldowns and perks access required"></label><label><input id="ff-mobile-heal" type="checkbox"> I permit automatic personal medical consumption</label><div class="ff-small">Drug use is permanently disabled. No blood bags or faction supplies.</div>'+FFMobileCore.meds.map(x=>'<label><input id="ff-mobile-item-'+x.id+'" type="checkbox" checked> '+esc(x.name)+'</label>').join('')+(active?'<button class="ff-primary" data-action="mobile-start" data-id="'+Number(active.id)+'">Start mobile loss loop</button>':'<p>No active claim. Refresh Contracts or reserve one first.</p>')+'</div>';
}
async function mobileAction(action,id){
 try{
  if(action==='mobile-start'){await startMobile(id);return;}
  if(action==='mobile-diagnostic'){const value=JSON.stringify({version:VERSION,status:mobileStatus,note:mobile?.note||'',hasSellerKey:isKey(apiKey),hasTornKey:isKey(mobileKey()),foreground:!document.hidden,path:location.pathname,worker:mobileWorker()?.diagnostics?.()||null});try{await navigator.clipboard.writeText(value);notice='Mobile diagnostic copied.';}catch{window.prompt('Copy mobile diagnostic (no API keys)',value);}render();return;}
  if(!mobile||mobile.seller!==hash(apiKey))throw Error('No matching mobile session.');
  installMobileWorker();
  if(action==='mobile-pause')mobileWorker().pause();
  if(action==='mobile-stop'){mobileWorker().stop();mobile.note='Stopped explicitly';mobileSave();}
  if(action==='mobile-resume'){
   const entered=String(panel.querySelector('#ff-mobile-torn-key')?.value||'').trim();if(entered){if(!isKey(entered))throw Error('Invalid Torn key.');sessionStorage.setItem(MOBILE_KEY,entered);}
   await mobileClaimCheck(true);const self=await mobileApi('user/profile');if(self.profile?.id!==mobile.owner)throw Error('Account changed.');const state=mobileWorker().getState();if(state?.profileId!==String(mobile.owner)||state?.orderId!=='ff-mobile-'+mobile.remoteId||Number(state?.targetId)!==mobile.target)throw Error('Saved worker does not match this mobile claim. Start a new session after reviewing pending actions.');if(!mobileWorker().resume())throw Error('No paused mobile session is available to resume.');setOpen(false);
  }
 }catch(error){errorText=mobileKey()?String(error.message||error).split(mobileKey()).join('[redacted]'):String(error.message||error);render();}
}
function restoreMobile(){
 const saved=getStore(MOBILE_STORE,null);if(!saved)return;
 if(saved.seller!==hash(apiKey)){mobileStatus='Saved mobile session needs its owning seller key. Reconnect it to restore the worker.';errorText=mobileStatus;return;}
 mobile=saved;const prior=getStore('__ff_mobile_loss_cycle_v1',null),arrival=FFMobileCore.navigationArrival(prior,mobile,location.href,Date.now()),stale=Date.now()-Number(mobile.seenAt||0)>15000;
 // Restore a window marker only for a recent, exact, session-bound navigation.
 if(arrival&&isKey(mobileKey())&&!sessionStorage.getItem('__ff_mobile_loss_cycle_session_v1'))sessionStorage.setItem('__ff_mobile_loss_cycle_session_v1',prior.sessionToken);
 installMobileWorker();
 if(!isKey(mobileKey())&&mobileWorker()?.getState()?.running)mobilePause('Torn API key did not survive this page change. Enter it in Mobile Session and Resume. No game action was authorized.');
 else if(stale&&!arrival&&mobileWorker()?.getState()?.running)mobilePause('Mobile session was interrupted. Review the page and Resume explicitly.');
 if(arrival){mobile.departure=null;mobile.seenAt=Date.now();mobileSave();}
}
function mobileRestoreFailed(){
 mobileStatus='Mobile session could not restart after navigation. Open Mobile Session and copy its diagnostic.';errorText=mobileStatus;loadState.done=false;render();
}
let mobileHideTimer=null,mobileWasHidden=!!document.hidden,mobileDeparting=false;
window.addEventListener?.('pagehide',event=>{
 if(!mobileWorker()?.getState()?.running)return;
 const state=mobileWorker().getState(),to=FFMobileCore.plannedNavigation(state,mobile,Date.now());
 if(to){mobileDeparting=true;clearTimeout(mobileHideTimer);mobile.departure={to,owner:mobile.owner,remoteId:mobile.remoteId,token:state.sessionToken,at:Date.now()};mobileSave();return;}
 mobilePause('Torn page was closed or left outside the planned route. Resume explicitly.');
});
document.addEventListener('visibilitychange',()=>{
 clearTimeout(mobileHideTimer);
 if(document.hidden){
  mobileWasHidden=true;
  // Navigation may emit hidden before pagehide; defer the decision until the
  // outgoing document can distinguish its planned route from backgrounding.
  mobileHideTimer=setTimeout(()=>{if(document.hidden&&!mobileDeparting&&mobileWorker()?.getState()?.running)mobilePause('Phone left the foreground. Return to TornPDA and Resume explicitly.');},200);
 }else{
  if(mobileWasHidden&&!mobileDeparting&&mobileWorker()?.getState()?.running)mobilePause('Phone left the foreground. Return to TornPDA and Resume explicitly.');
  mobileWasHidden=false;
 }
});
