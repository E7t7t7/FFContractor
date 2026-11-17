/* Pure mobile loss host. No DOM actions, credentials, network or storage are embedded here. */
(function(root){
'use strict';
const meds=[{id:68,name:'Small First Aid Kit',heal:1200,cost:600},{id:67,name:'First Aid Kit',heal:2400,cost:900},{id:66,name:'Morphine',heal:4200,cost:1200}];
function plan(hospital,cooldown,maximum,bonus,inventory,permissions){
 if(!Number.isFinite(hospital)||hospital<0||hospital>86400||!Number.isFinite(cooldown)||cooldown<0||maximum<21600||maximum>32400||bonus<0||bonus>50)throw Error('Invalid medical observation.');
 if(hospital===0)return {state:'Recovered'};
 if(cooldown>=maximum)return {state:'Cooldown',waitSeconds:cooldown-maximum+1};
 const gains=meds.map(x=>Math.floor(x.heal*(1+bonus/100))),limits=meds.map((x,i)=>permissions[x.id]?Math.min(Number(inventory[x.id]||0),Math.ceil(hospital/gains[i])):0);
 if(limits.some(x=>!Number.isSafeInteger(x)||x<0))throw Error('Invalid personal medical inventory.');
 let best=null;
 for(let a=0;a<=limits[0];a++)for(let b=0;b<=limits[1];b++)for(let c=0;c<=limits[2];c++){
  const n=[a,b,c],cost=n.reduce((v,q,i)=>v+q*meds[i].cost,0),healing=n.reduce((v,q,i)=>v+q*gains[i],0),count=a+b+c,last=c?1200:b?900:a?600:0;
  if(!count||healing<hospital||cooldown+cost-last>=maximum)continue;
  if(!best||cost<best.cost||cost===best.cost&&count<best.count)best={cost,count,items:n.flatMap((q,i)=>Array(q).fill(meds[i].id))};
 }
 return best?{state:'Ready',...best}:{state:'Supplies',reason:'Permitted personal supplies and medical capacity cannot end hospitalization.'};
}
function modifiers(perks){
 let bonus=0,maximum=21600;
 for(const values of Object.values(perks||{}))for(const text of Array.isArray(values)?values:[]){
  if(typeof text!=='string')continue;
  if(/medical item effectiveness/i.test(text)){const match=text.match(/(\d+(?:\.\d+)?)\s*%/);if(!match)throw Error('Unrecognized medical bonus.');bonus+=Number(match[1]);}
  if(/medical.*cooldown|cooldown.*medical/i.test(text)){const h=text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i),m=text.match(/(\d+)\s*(?:minutes?|mins?)\b/i);if(!h&&!m)throw Error('Unrecognized medical capacity.');maximum=21600+Number(h?.[1]||0)*3600+Number(m?.[1]||0)*60;}
 }
 if(bonus>50||maximum>32400)throw Error('Unsupported medical modifiers.');
 return {bonus,maximum};
}
function verify(before,after,itemId,beforeInventory,afterInventory,elapsed){
 const item=meds.find(x=>x.id===itemId);if(!item||elapsed<0||elapsed>180||before.owner!==after.owner)return false;
 const expected=Math.max(0,before.cooldown-elapsed)+item.cost;
 return beforeInventory[itemId]-Number(afterInventory[itemId]||0)===1&&Math.abs(after.cooldown-expected)<=12&&(after.until<=after.at&&before.until>before.at||after.until<before.until-30);
}
function receipt(rows,owner,target,started,seen){
 return (rows||[]).find(a=>a.attacker?.id===owner&&a.defender?.id===target&&a.started>=Math.floor(started/1000)&&a.ended>0&&!seen.includes(a.id));
}
function validateSession(s,owner,claim,now){
 if(!Number.isSafeInteger(Number(claim?.slots_claimed))||Number(claim.slots_claimed)<1||Number(claim.slots_claimed)>1000000||!Number.isSafeInteger(Number(claim.slots_delivered))||Number(claim.slots_delivered)<0||Number(claim.slots_delivered)>Number(claim.slots_claimed))throw Error('Claim delivery quota is missing or invalid.');
 if(!s||s.owner!==owner||String(claim?.id)!==String(s.remoteId)||Number(claim.target_player_id)!==s.target||claim.state!=='active')throw Error('The owning account or active claim changed.');
 const deadline=Math.min(Number(claim.expires_at)||0,Number(claim.idle_deadline_at)||Infinity)*1000;
 if(!deadline||deadline<=now)throw Error('The claim expired. No new attack authorized.');
 return deadline;
}
function plannedNavigation(state,session,now){
 if(!state?.running||!session||state.profileId!==String(session.owner)||state.orderId!=='ff-mobile-'+session.remoteId||Number(state.targetId)!==session.target||!['attack-open','heal-open','recovery-probe','final-recovery'].includes(state.stage))return null;
 const age=now-Number(state.navigationLastAt);if(!Number.isFinite(age)||age<0||age>30000)return null;
 try{
  const url=new URL(state.navigationUrl);
  if(url.protocol!=='https:'||url.hostname!=='www.torn.com'||url.port||url.username||url.password)return null;
  if(url.pathname==='/item.php'&&state.stage==='heal-open')return url.href;
  if(url.pathname==='/page.php'&&url.searchParams.get('sid')==='attack'&&Number(url.searchParams.get('user2ID'))===session.target&&state.stage!=='heal-open')return url.href;
 }catch{}
 return null;
}
function navigationArrival(state,session,actual,now){
 const departure=session?.departure,expected=plannedNavigation(state,session,now);
 if(!departure||!expected||departure.to!==expected||departure.owner!==session.owner||departure.remoteId!==session.remoteId||departure.token!==state.sessionToken||now-departure.at<0||now-departure.at>30000)return false;
 try{const a=new URL(actual),b=new URL(expected);return a.origin===b.origin&&a.pathname===b.pathname&&(b.pathname==='/item.php'||a.searchParams.get('sid')==='attack'&&Number(a.searchParams.get('user2ID'))===session.target);}catch{return false;}
}
root.FFMobileCore={meds,plan,modifiers,verify,receipt,validateSession,plannedNavigation,navigationArrival};
})(typeof module==='object'?module.exports:globalThis);
