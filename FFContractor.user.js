// ==UserScript==
// @name         FFScouter Loss Desk - Torn PDA
// @namespace    https://ffscouter.com/
// @version      0.9.1
// @description  FFScouter loss contracts in a lightweight TornPDA chat panel, with payouts and GitHub updates.
// @homepageURL  https://github.com/E7t7t7/FFContractor
// @downloadURL  https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js
// @updateURL    https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @include      *://*.torn.com/*
// @run-at       document-end
// @connect      ffscouter.com
// @connect      api.torn.com
// @connect      raw.githubusercontent.com
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  // Keep v0.7's proven plain-DOM launcher bootstrap and reinjection pattern.
  // Position recoverability is handled independently of FFScouter API startup.
  const VERSION = '0.9.1';
  const ROOT_URL = 'https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js';
  const API = 'https://ffscouter.com/api/v1/losses/seller';
  const ID = 'ffcontractor-launcher';
  const old = document.getElementById(ID);
  const previous=window.__FFContractor;
  if(old&&old.getAttribute('data-ff-version')===VERSION&&previous&&previous.ready&&typeof old.onclick==='function'){previous.mount();return;}
  if(previous&&typeof previous.dispose==='function')previous.dispose();
  let disposed=false;const timers=[];
  function every(fn,ms){const id=setInterval(()=>{if(!disposed)fn();},ms);timers.push(id);return id;}

  if (old) old.remove();

  const launch = document.createElement('button');
  launch.id = ID;
  launch.type = 'button';
  launch.textContent = '⚔\nFF';
  launch.title = 'FFContractor v' + VERSION;
  launch.setAttribute('data-ff-version', VERSION);
  launch.style.cssText = 'all:initial!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;position:fixed!important;right:0!important;left:auto!important;top:50%!important;bottom:auto!important;width:42px!important;height:64px!important;padding:0!important;margin:0!important;white-space:pre!important;text-align:center!important;line-height:22px!important;background:linear-gradient(180deg,#1b789a,#10445f)!important;color:#fff!important;font:bold 14px -apple-system,system-ui,sans-serif!important;border:1px solid #4c91ac!important;border-radius:12px 0 0 12px!important;box-shadow:0 2px 12px #0009,inset 0 1px 0 #ffffff22!important;z-index:2147483647!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;cursor:grab!important;user-select:none!important;-webkit-user-select:none!important;touch-action:none!important;';

  // Store only side and proportional vertical position, never absolute pixels.
  // This survives orientation changes and stays separate from the payout ledger.
  // Reset only tab placement once after the invisible-tab report; v1's stale
  // coordinates are intentionally ignored. API key and payout keys are unchanged.
  const DOCK_KEY = 'ffcontractor-tab-position-v2';
  const DOCK_DEFAULT = {side:'right', fraction:0.52};
  const clamp = (n,lo,hi) => Math.min(hi,Math.max(lo,n));
  function sanitizeDock(raw) {
    return raw && (raw.side==='left'||raw.side==='right') && Number.isFinite(Number(raw.fraction))
      ? {side:raw.side,fraction:clamp(Number(raw.fraction),0.08,0.92)}
      : {...DOCK_DEFAULT};
  }
  let dockStored=false;
  let dock={...DOCK_DEFAULT};
  try {
    const raw=localStorage.getItem(DOCK_KEY);
    if(raw){dock=sanitizeDock(JSON.parse(raw));dockStored=true;}
  } catch (_) {}
  let drag=null, suppressClickUntil=0, dockTouched=false;
  function viewport() {
    // iOS WKWebView can expose a larger layout viewport than the visible
    // screen after zooming, rotating or navigating between Torn pages.
    const width=Math.max(240,window.innerWidth||document.documentElement.clientWidth||400);
    const height=Math.max(260,window.innerHeight||document.documentElement.clientHeight||700);
    const vv=window.visualViewport;
    const w=vv&&vv.width>120?Math.min(width,vv.width):width;
    const h=vv&&vv.height>140?Math.min(height,vv.height):height;
    const x=vv&&Number.isFinite(vv.offsetLeft)?clamp(vv.offsetLeft,0,Math.max(0,width-w)):0;
    const y=vv&&Number.isFinite(vv.offsetTop)?clamp(vv.offsetTop,0,Math.max(0,height-h)):0;
    return {w,h,x,y};
  }
  function launcherTop() {
    const v=viewport();
    const min=v.y+Math.min(24,Math.max(8,v.h-64));
    const max=Math.max(min,v.y+v.h-64-18);
    return Math.round(clamp(v.y+dock.fraction*v.h-32,min,max));
  }
  function placeLauncher() {
    if(drag) return;
    const v=viewport(), x=dock.side==='left'?v.x:Math.max(v.x,v.x+v.w-42);
    // Use pixel X rather than CSS right:0 (which can be outside the
    // visible area in a zoomed TornPDA WebView).
    launch.style.setProperty('position','fixed','important');
    launch.style.setProperty('top',launcherTop()+'px','important');
    launch.style.setProperty('bottom','auto','important');
    launch.style.setProperty('left',Math.round(x)+'px','important');
    launch.style.setProperty('right','auto','important');
    launch.style.setProperty('display','flex','important');
    launch.style.setProperty('visibility','visible','important');
    launch.style.setProperty('opacity','1','important');
    launch.style.setProperty('border-radius',dock.side==='left'?'0 12px 12px 0':'12px 0 0 12px','important');
  }
  function saveDock() {
    dockTouched=true;
    try{localStorage.setItem(DOCK_KEY,JSON.stringify(dock));}catch(_){}
    try {
      if(typeof PDA_storage!=='undefined' && typeof PDA_storage.set==='function')
        Promise.resolve(PDA_storage.set(DOCK_KEY,dock)).catch(()=>{});
    } catch (_) {}
  }
  function setDock(side,fraction) {
    dock=sanitizeDock({side:side,fraction:fraction});
    saveDock();placeLauncher();placePanel();
  }
  // Read native TornPDA storage only as fallback; don't delay showing the tab.
  if(!dockStored){
    try {
      if(typeof PDA_storage!=='undefined' && typeof PDA_storage.get==='function')
        Promise.resolve(PDA_storage.get(DOCK_KEY,null)).then(value=>{
          if(!dockTouched && value){dock=sanitizeDock(value);placeLauncher();placePanel();}
        }).catch(()=>{});
    } catch (_) {}
  }
  launch.addEventListener('pointerdown',e=>{
    if(e.button!==undefined && e.button!==0)return;
    const rect=launch.getBoundingClientRect(), v=viewport();
    drag={id:e.pointerId,x:e.clientX,y:e.clientY,
      left:Number.isFinite(rect.left)?rect.left:(dock.side==='left'?0:v.w-42),
      top:Number.isFinite(rect.top)?rect.top:launcherTop(),moved:false,started:Date.now()};
    try{launch.setPointerCapture(e.pointerId);}catch(_){}
  });
  launch.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y, v=viewport();
    if(Math.hypot(dx,dy)>7)drag.moved=true;
    if(!drag.moved)return;
    e.preventDefault();
    launch.style.setProperty('left',Math.round(clamp(drag.left+dx,v.x,v.x+v.w-42))+'px','important');
    launch.style.setProperty('right','auto','important');
    launch.style.setProperty('top',Math.round(clamp(drag.top+dy,v.y+12,Math.max(v.y+12,v.y+v.h-76)))+'px','important');
  });
  function finishDrag(e,cancelled) {
    if(!drag||e.pointerId!==drag.id)return;
    const previous=drag; drag=null;
    try{launch.releasePointerCapture(e.pointerId);}catch(_){}
    if(previous.moved){
      suppressClickUntil=Date.now()+650;
      if(!cancelled){
        const v=viewport();
        const top=clamp(previous.top+(e.clientY-previous.y),v.y+12,Math.max(v.y+12,v.y+v.h-76));
        dock={side:e.clientX<v.x+v.w/2?'left':'right',
          fraction:clamp((top-v.y+32)/v.h,0.08,0.92)};
        saveDock();
      }
    }
    placeLauncher();
    if(opened)placePanel();
  }
  launch.addEventListener('pointerup',e=>finishDrag(e,false));
  launch.addEventListener('pointercancel',e=>finishDrag(e,true));
  launch.addEventListener('lostpointercapture', () => {
    // iOS may cancel touch capture when the app bar changes or a page reloads.
    if(drag){drag=null;placeLauncher();}
  });


  if(!('PointerEvent' in window)){
    const touchEvent=(e,end)=>{const t=(end?e.changedTouches:e.touches)[0];return t?{pointerId:1,button:0,clientX:t.clientX,clientY:t.clientY,preventDefault:()=>e.preventDefault()}:null;};
    launch.addEventListener('touchstart',e=>{const t=touchEvent(e,false);if(t){const r=launch.getBoundingClientRect();drag={id:1,x:t.clientX,y:t.clientY,left:r.left,top:r.top,moved:false,started:Date.now()};}},{passive:true});
    launch.addEventListener('touchmove',e=>{const t=touchEvent(e,false);if(!t||!drag)return;const v=viewport(),dx=t.clientX-drag.x,dy=t.clientY-drag.y;if(Math.hypot(dx,dy)>7)drag.moved=true;if(drag.moved){e.preventDefault();launch.style.setProperty('left',Math.round(clamp(drag.left+dx,v.x,v.x+v.w-42))+'px','important');launch.style.setProperty('top',Math.round(clamp(drag.top+dy,v.y+12,v.y+v.h-76))+'px','important');}},{passive:false});
    launch.addEventListener('touchend',e=>{const t=touchEvent(e,true);if(t)finishDrag(t,false);});
    launch.addEventListener('touchcancel',e=>{const t=touchEvent(e,true);if(t)finishDrag(t,true);});
  }
  function mount() {
    if(disposed)return;
    const parent = document.documentElement || document.body;
    if (parent && launch.parentNode !== parent) parent.appendChild(launch);
    if(drag && Date.now()-drag.started>6500) drag=null;
    placeLauncher();
    // Panel reattachment happens after panel state initializes; mount() also
    // runs early before the dashboard's let bindings exist.
  }
  mount();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  window.addEventListener('pageshow', mount);
  window.addEventListener('resize', mount);
  if(window.visualViewport) {
    window.visualViewport.addEventListener('resize', mount);
    window.visualViewport.addEventListener('scroll', mount);
  }
  window.addEventListener('focus', mount);
  window.addEventListener('hashchange', mount);
  window.addEventListener('popstate', mount);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) mount(); });
  every(mount, 1500);

  let panel, status, tab = 'Overview', opened = false, apiKey = '', remember = false, busy = false;
  // Torn may replace its body after the modal has already opened.
  every(() => {
    if (opened && panel && !panel.isConnected) { buildPanel(); render(); }
    else if (opened && panel) placePanel();
  }, 1900);
  let contracts = [], claims = [], cap = 0, lastSync = 0, errorText = '', notice = '', verifying = false;
  let pendingAll={},claimsCheckedAt=0,ownerPlayer=0;
  const PENDING_STORAGE='ffcontractor-pending-v1';
  const pending=()=>pendingAll[hash(apiKey)];
  async function setPending(value){if(value)pendingAll[hash(apiKey)]=value;else delete pendingAll[hash(apiKey)];await nativeSet(PENDING_STORAGE,pendingAll);if(value){const saved=await nativeGet(PENDING_STORAGE,{});if(!saved[hash(apiKey)]||saved[hash(apiKey)].nonce!==value.nonce)throw Error('Could not save the request guard. No reservation sent.');}}
  let ledgerAll = {}, currentLedger = {claims:{},receipts:[]};
  const KEY_STORAGE = 'ffscouter-loss-desk-key-v1';
  const LEDGER_STORAGE = 'ffscouter-loss-desk-ledger-v2';
  const stateKey = 'ffscouter-loss-desk-session-key-v1';
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const money = v => '$' + (Number(v) || 0).toLocaleString('en-US');
  const isKey = k => /^[a-z0-9]{16}$/i.test(k || '');
  function hash(k) { let n=2166136261; for(let i=0;i<k.length;i++) n=Math.imul(n^k.charCodeAt(i),16777619);return (n>>>0).toString(36); }
  function getSession() { try { return sessionStorage.getItem(stateKey) || ''; } catch (_) { return ''; } }
  function setSession(k) { try { sessionStorage.setItem(stateKey,k); } catch (_) {} }
  function getStore(k, fallback) { try { return localStorage.getItem(k) ? JSON.parse(localStorage.getItem(k)) : fallback; } catch (_) { return fallback; } }
  function setStore(k,v) { try { localStorage.setItem(k,JSON.stringify(v)); } catch (_) {} }
  async function nativeGet(k, fallback) { try { if(typeof PDA_storage !== 'undefined' && PDA_storage.get) return await PDA_storage.get(k,fallback); } catch (_) {} return getStore(k,fallback); }
  async function nativeSet(k,v) { try { if(typeof PDA_storage !== 'undefined' && PDA_storage.set) return await PDA_storage.set(k,v); } catch (_) {} setStore(k,v); }
  async function nativeDelete(k) { try { if(typeof PDA_storage !== 'undefined' && PDA_storage.delete) return await PDA_storage.delete(k); } catch (_) {} try { localStorage.removeItem(k); } catch (_) {} }
  function activateLedger() { const l = ledgerAll[hash(apiKey)]; currentLedger = l && typeof l === 'object' ? l : {claims:{},receipts:[]}; if (!currentLedger.claims) currentLedger.claims={}; if (!Array.isArray(currentLedger.receipts)) currentLedger.receipts=[]; }
  function saveLedger() { ledgerAll[hash(apiKey)]=currentLedger; return nativeSet(LEDGER_STORAGE,ledgerAll); }
  function paid(c) { return !c.payment_review_required && (c.payment_status === 'resolved' || Number(c.paid_at)>0); }

  // The seller API may expose a target ID under different field names on a
  // contract, a newly reserved claim, or a refreshed active claim. Never use
  // the claim ID or order number as the target.
  function positiveTornId(v) {
    if (typeof v !== 'string' && typeof v !== 'number') return 0;
    const t=String(v).trim();
    if (!/^\d{1,12}$/.test(t)) return 0;
    const n=Number(t);
    return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : 0;
  }
  function tornIdFromUrl(raw) {
    if(typeof raw!=='string'||!raw||raw.length>2048)return 0;
    try {
      const u=new URL(raw,'https://www.torn.com');
      if(u.protocol!=='https:'||!['torn.com','www.torn.com'].includes(u.hostname))return 0;
      for(const key of ['user2ID','user2Id','XID','xid']) {
        const id=positiveTornId(u.searchParams.get(key));
        if(id)return id;
      }
      return 0;
    }catch(_){return 0;}
  }
  function targetIdFrom(c) {
    if(!c||typeof c!=='object') return 0;
    for(const key of ['target_player_id','target_user_id','target_id','target_torn_id',
      'target_xid','targetId','targetPlayerId','targetUserId','user2ID','user2Id']) {
      const id=positiveTornId(c[key]);
      if(id)return id;
    }
    if(c.target) {
      const scalar=positiveTornId(c.target);
      if(scalar)return scalar;
      if(typeof c.target==='object'){
        for(const key of ['player_id','user_id','id','torn_id','xid','target_id']) {
          const id=positiveTornId(c.target[key]);if(id)return id;
        }
      }
    }
    for(const key of ['attack_url','target_url','target_profile_url','profile_url','target_link']) {
      const id=tornIdFromUrl(c[key]);if(id)return id;
    }
    for(const key of ['order','contract']) {
      const nested=c[key];
      if(nested && typeof nested==='object') {
        const id=targetIdFrom(nested);if(id)return id;
      }
    }
    return 0;
  }
  function matchContract(c) {
    return contracts.find(x=>String(x.order_number||'')===String(c.order_number||''));
  }
  function claimWithTarget(c) {
    const ledger=currentLedger.claims[String(c.id||'')] || {};
    const id=targetIdFrom(c)||targetIdFrom(ledger)||targetIdFrom(matchContract(c));
    return id?{...c,target_player_id:id}:c;
  }
  function attackLink(id) {
    return 'https://www.torn.com/page.php?sid=attack&user2ID='+id;
  }
  function mergeLedger(data) {
    let changed=false;
    for (const c of data) {
      const id=String(c.id || ''); if(!/^\d+$/.test(id)||!Number.isSafeInteger(Number(id))||Number(id)<=0)continue;
      const prev=currentLedger.claims[id] || {};
      const next={...prev,id:c.id,order_number:c.order_number || prev.order_number || '',state:c.state || prev.state || '',
        slots_delivered:Number(c.slots_delivered == null ? prev.slots_delivered || 0 : c.slots_delivered),
        slots_claimed:Number(c.slots_claimed == null ? prev.slots_claimed || 0 : c.slots_claimed),
        earnings:Number(c.earnings == null ? prev.earnings || 0 : c.earnings),
        paid_at:Object.prototype.hasOwnProperty.call(c,'paid_at')?Number(c.paid_at||0):Number(prev.paid_at||0),payment_status:Object.prototype.hasOwnProperty.call(c,'payment_status')?(c.payment_status||''):(prev.payment_status||''),payment_review_required:Object.prototype.hasOwnProperty.call(c,'payment_review_required')?!!c.payment_review_required:!!prev.payment_review_required,
        claimed_at:Number(c.claimed_at || prev.claimed_at || 0),
        price_per_loss:Number(c.price_per_loss == null ? prev.price_per_loss || 0 : c.price_per_loss),
        expires_at:Number(c.expires_at == null ? prev.expires_at || 0 : c.expires_at),
        idle_deadline_at:Object.prototype.hasOwnProperty.call(c,'idle_deadline_at')?Number(c.idle_deadline_at||0):Number(prev.idle_deadline_at||0),
        completed_at:Object.prototype.hasOwnProperty.call(c,'completed_at')?Number(c.completed_at||0):Number(prev.completed_at||0),
        hits:Array.from(new Map([...(prev.hits||[]),...(c.hits||[])].filter(x=>Number.isSafeInteger(Number(x.attack_id))&&Number(x.attack_id)>0).map(x=>[String(x.attack_id),x])).values()),
        target_player_id:targetIdFrom(c)||targetIdFrom(prev)||0};
      if(JSON.stringify(prev)!==JSON.stringify(next)) {currentLedger.claims[id]=next;changed=true;}
    }
    if(changed) void saveLedger();
  }
  function summarize() {
    const all=Object.values(currentLedger.claims);
    const due=all.filter(c=>!paid(c)&&Number(c.earnings)>0);
    return [
      ['Total paid', money(all.filter(paid).reduce((a,c)=>a+Number(c.earnings||0),0))],
      ['Outstanding',money(due.reduce((a,c)=>a+Number(c.earnings||0),0))],
      ['Total earned',money(all.reduce((a,c)=>a+Number(c.earnings||0),0))],
      ['Losses completed',String(all.reduce((a,c)=>a+Number(c.slots_delivered||0),0))],
      ['Contracts finished',String(all.filter(c=>c.state==='fulfilled'||c.state==='expired').length)],
      ['Available contracts',String(contracts.length)],
      ['Active claims',String(claims.filter(c=>c.state==='active').length)],
      ['Payments pending',String(due.length)]
    ];
  }

  function css() {
    if(document.getElementById('ffcontractor-css')) return;
    const st=document.createElement('style');st.id='ffcontractor-css';st.textContent=`
      #ffcontractor-panel,#ffcontractor-panel *{box-sizing:border-box}
      #ffcontractor-panel{position:fixed!important;z-index:2147483646!important;left:auto;right:48px;top:22px;bottom:auto!important;width:calc(100vw - 60px)!important;max-width:460px!important;height:min(68dvh,690px);max-height:calc(100dvh - 32px)!important;display:none;flex-direction:column;overflow:hidden;background:#181b23;color:#f3f6ff;border:1px solid #4a6478;border-radius:17px;box-shadow:0 12px 44px #000d;font:14px/1.45 -apple-system,system-ui,sans-serif}
      #ffcontractor-panel.ff-open{display:flex!important}
      #ffcontractor-panel button{font:inherit;font-weight:700;cursor:pointer;background:#29445c;color:#f4f8ff;border:1px solid #58718b;border-radius:8px;padding:9px;min-height:36px}
      #ffcontractor-panel button.ff-primary,#ffcontractor-panel a.ff-target-link{background:#087ba5;border-color:#33a8cf}
      #ffcontractor-panel a.ff-target-link{display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:9px;border:1px solid #33a8cf;border-radius:8px;color:#fff;text-decoration:none;font-weight:700;text-align:center;cursor:pointer}
      #ffcontractor-panel button:disabled{opacity:.5}
      #ffcontractor-panel input,#ffcontractor-panel textarea{font:16px -apple-system,system-ui,sans-serif;background:#101723;color:#fff;border:1px solid #62758a;border-radius:7px;padding:9px;min-width:0;max-width:100%}
      #ffcontractor-panel .ff-top{display:flex;align-items:center;gap:7px;background:#232a35;padding:10px;border-bottom:1px solid #3a485a}
      #ffcontractor-panel .ff-tabs{display:flex;gap:5px;padding:8px;border-bottom:1px solid #3a485a}
      #ffcontractor-panel .ff-tabs button{flex:1;padding:7px 3px;font-size:12px}
      #ffcontractor-panel .ff-tabs button.current{background:#087ba5}
      #ffcontractor-panel .ff-scroll{overflow:auto;overscroll-behavior:contain;padding:11px;flex:1}
      #ffcontractor-panel .ff-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #ffcontractor-panel .ff-stat,#ffcontractor-panel .ff-card{border-radius:11px;background:#242d39;border:1px solid #3f5268;padding:11px;margin-bottom:8px}
      #ffcontractor-panel .ff-label{font-size:11px;color:#b8c8d8}
      #ffcontractor-panel .ff-number{font-size:20px;font-weight:800;color:#b6e5fc;overflow-wrap:anywhere}
      #ffcontractor-panel .ff-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px}
      #ffcontractor-panel .ff-row > *{flex:1}
      #ffcontractor-panel .ff-small{font-size:12px;color:#b8c8d8}
      #ffcontractor-panel .ff-note{padding:8px;background:#19374a;border-radius:8px;margin-bottom:8px}
      #ffcontractor-panel .ff-error{padding:8px;background:#5d2434;color:#fff;border-radius:8px;margin-bottom:8px}
      #ffcontractor-panel h3{margin:13px 0 6px;font-size:15px}
      @media(min-width:650px){#ffcontractor-panel{width:min(460px,calc(100vw - 60px))!important}}`;
    (document.head || document.documentElement).appendChild(st);
  }
  function placePanel() {
    if(!panel)return;
    const v=viewport(), width=Math.round(Math.max(180,Math.min(460,v.w-60)));
    const height=Math.round(Math.max(180,Math.min(690,v.h*0.68,v.h-24)));
    const top=Math.round(clamp(launcherTop()+32-height*0.53,v.y+12,Math.max(v.y+12,v.y+v.h-height-12)));
    const left=Math.round(dock.side==='left'?v.x+48:v.x+v.w-48-width);
    panel.style.setProperty('width',width+'px','important');
    panel.style.setProperty('height',height+'px','important');
    panel.style.setProperty('top',top+'px','important');
    panel.style.setProperty('bottom','auto','important');
    panel.style.setProperty('left',left+'px','important');
    panel.style.setProperty('right','auto','important');
  }
  function buildPanel() {
    css();
    if(panel && panel.isConnected) return;
    panel=document.createElement('div');panel.id='ffcontractor-panel';
    panel.innerHTML=`<div class="ff-top"><strong style="flex:1">⚔ FFContractor <span class="ff-small">v${VERSION}</span></strong><button data-action="refresh">↻</button><button data-action="update">⇧</button><button data-action="close">✕</button></div><div class="ff-tabs">${['Overview','Contracts','Payouts','Settings'].map(x=>`<button data-tab="${x}">${x}</button>`).join('')}</div><div class="ff-scroll"></div>`;
    (document.documentElement || document.body).appendChild(panel);
    panel.addEventListener('click', handleClick);
    placePanel();
  }
  function render() {
    if(!panel) return;
    panel.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('current',b.dataset.tab===tab));
    const scroll=panel.querySelector('.ff-scroll');
    const oldScroll=scroll.scrollTop;
    let html='';
    if(errorText)html+=`<div class="ff-error">${esc(errorText)}</div>`;
    else if(notice)html+=`<div class="ff-note">${esc(notice)}</div>`;
    const active=claims.find(c=>c.state==='active');
    if(tab==='Overview') {
      html+=`<div class="ff-grid">${summarize().map(([name,v])=>`<div class="ff-stat"><div class="ff-label">${esc(name)}</div><div class="ff-number">${esc(v)}</div></div>`).join('')}</div>`;
      html+=`<p class="ff-small">Locally recorded totals begin when FFContractor first records your claims. Confirmed paid status comes from FFScouter.</p>`;
      if(active)html+=activeMarkup(active);
      else html+='<div class="ff-card">No active claim. Open Contracts to reserve losses.</div>';
      html+='<div class="ff-row"><button class="ff-primary" data-action="contracts">Browse contracts</button><button data-action="payouts">Payout history</button></div>';
    } else if(tab==='Contracts') {
      if(active)html+=activeMarkup(active);
      html+=`<h3>Available contracts</h3>`;
      if(!contracts.length)html+='<div class="ff-card">No eligible contracts loaded or available. Tap ↻ to refresh.</div>';
      for(const c of contracts){const count=Math.max(0,Math.min(Number(c.slots_available)||0,cap));
        html+=`<div class="ff-card"><strong>${esc(c.order_number||'Contract')}</strong> · <strong>${money(c.price_per_loss)}/loss</strong><div class="ff-small">${Number(c.slots_available)||0} slots available · You can claim up to ${count}</div><div class="ff-row"><input type="number" inputmode="numeric" min="1" max="${count}" value="${Math.min(4,count)}" data-order-input="${esc(c.order_number)}" style="flex:0 0 70px" ${active||busy||count===0?'disabled':''}><button data-action="claim" data-order="${esc(c.order_number)}" ${active||busy||count===0?'disabled':''}>Claim</button><button class="ff-primary" data-action="claimmax" data-order="${esc(c.order_number)}" ${active||busy||count===0?'disabled':''}>Claim max</button></div></div>`;
      }
      html+='<h3>Recent claims</h3>';
      for(const c of claims.slice(0,10))html+=`<div class="ff-card"><strong>${esc(c.order_number||c.id)}</strong><div class="ff-small">${esc(c.state)} · ${c.slots_delivered||0}/${c.slots_claimed||0} verified · ${money(c.earnings)} · ${esc(c.payment_status||'pending')}</div></div>`;
    } else if(tab==='Payouts'){
      const entries=Object.values(currentLedger.claims).sort((a,b)=>(b.claimed_at||0)-(a.claimed_at||0));
      html+='<p class="ff-small">FFScouter payment status is authoritative. Message matches are references only, not proof of payment.</p>';
      html+='<div class="ff-row"><button data-action="scanmail">Scan mail subjects & events</button><button data-action="export">Copy ledger</button></div>';
      html+='<h3>Paste a payout reference</h3><textarea id="ff-receipt" rows="3" placeholder="Paste a message containing a claim or order ID" style="width:100%"></textarea><button data-action="match" style="width:100%;margin-top:6px">Match payout message</button>';
      html+='<h3>Tracked claims</h3>';
      if(!entries.length)html+='<div class="ff-card">No claims recorded yet.</div>';
      for(const c of entries)html+=`<div class="ff-card"><strong>${esc(c.order_number||c.id)}</strong> · ${money(c.earnings)}<div class="ff-small">${paid(c)?'Paid (FFScouter confirmed)':'Pending / unconfirmed'} · ${c.slots_delivered||0} verified losses</div></div>`;
      if(currentLedger.receipts.length)html+=`<div class="ff-small">${currentLedger.receipts.length} matched message references retained locally.</div>`;
    } else {
      html+=`<div class="ff-card"><div><strong>FFScouter API key</strong></div><div class="ff-row"><input id="ff-api-key" type="password" placeholder="16-character key" autocomplete="off" value="${esc(apiKey)}" style="width:100%"><button class="ff-primary" data-action="connect">${isKey(apiKey)?'Reconnect':'Connect'}</button></div><label class="ff-small"><input id="ff-remember" type="checkbox" ${remember?'checked':''}> Remember key on this device</label></div>`;
      html+=`<div class="ff-card"><strong>Tab position</strong><p class="ff-small">Drag the blue FF handle up, down, or across the screen to switch sides. Tap it to open the panel.</p><div class="ff-row"><button data-action="dockleft">${dock.side==='left'?'✓ ':''}Left</button><button data-action="dockright">${dock.side==='right'?'✓ ':''}Right</button><button data-action="dockreset">Reset</button></div></div>`;
      html+=`<div class="ff-card"><strong>GitHub updates</strong><p class="ff-small">Installed v${VERSION}. TornPDA handles updates from your original remote URL.</p><button data-action="update">Check GitHub for updates</button></div>`;
      html+='<div class="ff-card"><a href="https://ffscouter.com/sell-losses">Seller rules / data policy</a> · <a href="https://ffscouter.com/api-docs/guidance">API guidance</a><p class="ff-small">Standalone in TornPDA or optional inside Commander. The desktop can watch NEW claims when explicitly armed; no PC is required for mobile use. Older phone history is not automatically copied. Consider FFScouter premium to support the provider.</p></div>';
      html+='<button data-action="forget">Forget API key</button>';
    }
    if(!isKey(apiKey)&&tab!=='Settings')html='<div class="ff-note">Add your FFScouter API key in Settings to load contracts.</div>'+html;
    if(pending())html='<div class="ff-note">A reservation/completion may have succeeded. Refresh claims before retrying. <button data-action="clear-pending">Reviewed claims — clear request guard</button></div>'+html;
    scroll.innerHTML=html;
    scroll.scrollTop=oldScroll;
  }
  function activeMarkup(c) {
    const id=targetIdFrom(claimWithTarget(c));
    const action=id
      ? '<a class="ff-target-link" data-action="attack" href="'+attackLink(id)+'">⚔ Attack now</a>'
      : '<button type="button" data-action="locate-target" data-order="'+esc(c.order_number||'')+'" data-claim-id="'+esc(c.id||'')+'">Find target</button>';
    return '<div class="ff-card"><strong>Active: '+esc(c.order_number||c.id)+'</strong>'+
      '<div class="ff-small">'+(Number(c.slots_delivered)||0)+'/'+(Number(c.slots_claimed)||0)+
      ' verified · '+money(c.earnings||0)+' earned'+(id?' · Target ['+id+']':'')+'</div>'+
      '<div class="ff-row">'+action+'<button data-action="complete" data-id="'+Number(c.id)+'">Mark complete</button></div>'+
      (!id?'<div class="ff-small">Target ID was not included with the refreshed claim. Tap Find target to check the order details. If unavailable, <a href="https://ffscouter.com/sell-losses">open your official FFScouter claims</a>.</div>':
      '<div class="ff-small">Opens Torn’s attack page in this browser. Perform your losses manually.</div>')+'</div>';
  }
  function setOpen(value) {
    opened=!!value;buildPanel();
    panel.classList.toggle('ff-open',opened);
    launch.textContent=opened?'×\nFF':'⚔\nFF';
    placePanel();
    if(opened){render(); if(isKey(apiKey)&&Date.now()-lastSync>15000)void refresh();}
  }
  async function sendHttp(method,url,headers,body){
    if(method==='GET'&&typeof PDA_httpGet==='function')return await PDA_httpGet(url,headers);
    if(method==='POST'&&typeof PDA_httpPost==='function')return await PDA_httpPost(url,headers,body);
    if(typeof GM_xmlhttpRequest==='function')return await new Promise((resolve,reject)=>GM_xmlhttpRequest({method,url,headers,data:body,timeout:25000,onload:resolve,onerror:()=>reject(Error('Connection interrupted; refresh claims before retrying.')),ontimeout:()=>reject(Error('Request timed out; refresh claims before retrying.'))}));
    throw Error('Use TornPDA on mobile or install this script in Torn Commander. HTTP bridge unavailable.');
  }
  async function request(method,path,body,base=API) {
    if(!isKey(apiKey))throw Error('Enter your 16-character FFScouter API key in Settings.');
    let r;
    if(method==='GET'){
      r=await sendHttp('GET',base+path+(path.includes('?')?'&':'?')+'key='+encodeURIComponent(apiKey),{Accept:'application/json'});
    } else {
      r=await sendHttp('POST',base+path+'?key='+encodeURIComponent(apiKey),{Accept:'application/json','Content-Type':'application/json'},JSON.stringify(body||{}));
    }
    let json;try{json=typeof r.responseText==='string'?JSON.parse(r.responseText):r.responseText;}catch(_){throw Error('Server returned invalid JSON');}
    if(Number(r.status)<200||Number(r.status)>=300||!json||json.error)throw Error(String(json&&json.error||json&&json.message||'HTTP '+r.status).split(apiKey).join('[redacted]'));
    return json;
  }
  async function refresh() {
    if(busy||!isKey(apiKey))return;busy=true;notice='Loading FFScouter…';errorText='';render();
    const results=await Promise.all([request('GET','/contracts'),request('GET','/claims')].map(p=>p.then(value=>({status:'fulfilled',value}),reason=>({status:'rejected',reason}))));
    const fails=[];
    if(results[0].status==='fulfilled'){
      const obj=results[0].value;contracts=Array.isArray(obj.contracts)?obj.contracts:[];cap=Math.max(0,Number(obj.max_claim_slots)||0);
    }else fails.push(String(results[0].reason.message||results[0].reason));
    if(results[1].status==='fulfilled'){
      claims=Array.isArray(results[1].value.claims)?results[1].value.claims.map(claimWithTarget):[];mergeLedger(claims);claimsCheckedAt=Date.now();
      const p=pending();if(p&&((p.type==='claim'&&claims.some(c=>String(c.order_number)===p.order&&!(p.known||[]).includes(String(c.id))&&Number(c.claimed_at)>=p.at-5))||(p.type==='complete'&&claims.some(c=>String(c.id)===p.id&&c.state!=='active'))))await setPending(null);
    }else fails.push(String(results[1].reason.message||results[1].reason));
    errorText=fails.join(' · ');notice=fails.length?'':'Updated successfully';lastSync=Date.now();busy=false;render();
  }
  async function connect(){
    if(busy||pending()){errorText="Reconcile the current request before changing seller accounts.";render();return;}
    const key=String((panel.querySelector('#ff-api-key')||{}).value||'').trim();
    if(!isKey(key)){errorText='API key must be 16 letters/numbers.';render();return;}
    ownerPlayer=0;apiKey=key;remember=!!(panel.querySelector('#ff-remember')||{}).checked;
    setSession(key);activateLedger();if(remember)await nativeSet(KEY_STORAGE,key);else await nativeDelete(KEY_STORAGE);
    try{const identity=await request('GET','/account/balance',null,'https://ffscouter.com/api/v1');ownerPlayer=positiveTornId(identity.player_id);}catch(_){}tab='Overview';await refresh();
  }
  async function claim(order,max){
    const c=contracts.find(c=>String(c.order_number)===order);if(!c||busy)return;
    if(pending()){errorText='Previous request needs reconciliation. Refresh claims; do not reserve twice.';render();return;}
    if(claims.some(c=>c.state==='active'&&Number(c.expires_at)>Date.now()/1000)){errorText='Only one active claim is allowed. Complete the existing claim first.';render();return;}
    if(Date.now()-lastSync>45000||!claimsCheckedAt||Date.now()-claimsCheckedAt>45000){errorText='Refresh seller data before reserving.';render();return;}
    const limit=Math.max(0,Math.min(Number(c.slots_available)||0,cap));
    const input=panel.querySelectorAll('[data-order-input]');let num=0;
    input.forEach(x=>{if(x.getAttribute('data-order-input')===order)num=Number(x.value)});
    const count=max?limit:num;
    if(!Number.isInteger(count)||count<1||count>limit){errorText='Select a valid number of losses.';render();return;}
    if(!window.confirm('Reserve '+count+' losses on '+order+'? FFScouter starts its claim timers immediately.'))return;
    busy=true;render();
    try{await setPending({type:'claim',order,known:claims.map(x=>String(x.id)),at:Math.floor(Date.now()/1000),nonce:Date.now()+'-'+Math.random()});const r=await request('POST','/claim',{order_number:order,slots:count});
      if(!r.claim||!positiveTornId(r.claim.target_player_id)||!Number.isSafeInteger(Number(r.claim.id))||Number(r.claim.id)<=0||((pending()||{}).known||[]).includes(String(r.claim.id))||Number(r.claim.slots_claimed)<1||Number(r.claim.slots_claimed)>count||String(r.claim.order_number)!==order)throw Error('Reservation response incomplete; refresh to reconcile.');notice='Claim reserved. If Commander is armed at home it can discover this claim; avoid attacking it on both devices at once.';errorText='';if(r.claim){const fresh=claimWithTarget({...r.claim,state:r.claim.state||'active',claimed_at:r.claim.claimed_at||Math.floor(Date.now()/1000),price_per_loss:c.price_per_loss,order_number:r.claim.order_number||order});mergeLedger([fresh]);claims=[fresh,...claims.filter(x=>String(x.id)!==String(fresh.id))];}await saveLedger();await setPending(null);await refreshAfterAction();}
    catch(e){errorText=String(e.message||e);busy=false;render();}
  }
  async function locateTarget(order,claimId) {
    if(!order){errorText='This claim has no order reference. Open FFScouter Sell Losses for the official target link.';render();return;}
    notice='Checking FFScouter for target details…';errorText='';render();
    try {
      const data=await request('GET','/orders/'+encodeURIComponent(order));
      const candidates=[data,(data||{}).order,(data||{}).contract,(data||{}).claim,
        ...(Array.isArray((data||{}).claims)?data.claims.filter(c=>String(c.id)===String(claimId)):[])];
      const id=candidates.map(targetIdFrom).find(Boolean)||0;
      if(!id) throw Error('FFScouter returned no usable target ID. Use its Target link for this contract.');
      const item=claims.find(c=>String(c.id)===String(claimId));
      if(item){item.target_player_id=id;mergeLedger([item]);}
      notice='Target ['+id+'] found. Tap Attack now.';errorText='';render();
    }catch(e){errorText=String(e.message||e);notice='';render();}
  }
  async function complete(id){
    if(pending()){errorText='Refresh/reconcile the previous request first.';render();return;}
    if(!window.confirm('Mark this claim complete and release unused slots?'))return;
    busy=true;render();
    try{await setPending({type:'complete',id:String(id),at:Math.floor(Date.now()/1000),nonce:Date.now()+'-'+Math.random()});const result=await request('POST','/claims/'+id+'/complete');if(!result.claim||String(result.claim.id)!==String(id))throw Error('Completion response incomplete; refresh to reconcile.');mergeLedger([result.claim]);await saveLedger();await setPending(null);notice='Claim submitted for settlement.';errorText='';await refreshAfterAction();}
    catch(e){errorText=String(e.message||e);busy=false;render();}
  }
  async function refreshAfterAction(){busy=false;await refresh();}
  function recordReceipt(value,source){
    const text=String(value||'').slice(0,2500).replace(/<[^>]*>/g,' ');
    const entries=Object.values(currentLedger.claims);let added=0;
    for(const c of entries){
      const order=String(c.order_number||'');const id=String(c.id||'');
      const matched=order && text.toLowerCase().includes(order.toLowerCase()) || (/ffscouter|loss|claim|order/i.test(text)&&new RegExp('(?:claim|order|id|#)\\s*[:#-]?\\s*'+id+'(?!\\d)','i').test(text));
      if(!matched)continue;
      const ref=source+'|'+id;
      if(currentLedger.receipts.some(x=>x.id===ref))continue;
      currentLedger.receipts.push({id:ref,claim_id:id,source,seen_at:Math.floor(Date.now()/1000)});added++;
    }
    if(added)void saveLedger();return added;
  }
  async function scanMail(){
    const tornKey=String(window.prompt('Optional separate Torn API key for reading mail/events. Used only for this scan; not saved. Do not assume the FFScouter key is interchangeable.')||'').trim();if(!isKey(tornKey))return;
    busy=true;notice='Scanning message subjects and events…';render();let found=0,errs=[];
    for(const [name,url,field] of [['Messages','https://api.torn.com/v2/user/messages?limit=100','messages'],['Events','https://api.torn.com/v2/user/events?limit=100&striptags=true','events']]){
      try{const r=await sendHttp('GET',url,{Authorization:'ApiKey '+tornKey,Accept:'application/json'});const d=JSON.parse(r.responseText||'{}');if(d.error)throw Error(d.error.error||d.error.message);for(const x of Array.isArray(d[field])?d[field]:[]){found+=recordReceipt(name==='Events'?x.event:x.topic,name+':'+String(x.id||x.timestamp))}}
      catch(e){errs.push(name+': '+String(e.message||e));}
    }
    busy=false;notice='Matched '+found+' new references.';errorText=errs.join(' · ');render();
  }
  function copyLedger(){const value=JSON.stringify({schema_version:1,provider:'FFScouter',owner_player_id:ownerPlayer||null,exported_at:new Date().toISOString(),claims:currentLedger.claims,receipts:currentLedger.receipts},null,2);if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(value).then(()=>{notice='Ledger copied.';render()}).catch(()=>window.prompt('Copy ledger',value));else window.prompt('Copy ledger',value);}
  async function updateCheck(){
    tab='Settings';notice='Checking GitHub…';errorText='';render();
    try{const r=await sendHttp('GET',ROOT_URL+'?v='+Date.now(),{Accept:'text/plain'});if(Number(r.status)!==200)throw Error('GitHub HTTP '+r.status);const ver=(String(r.responseText||'').match(/^\/\/\s*@version\s+(\d+(?:\.\d+)*)/m)||[])[1];if(!ver)throw Error('Version header not found');const newer=ver.split('.').some((x,i)=>Number(x)>Number(VERSION.split('.')[i]||0));notice=newer?'GitHub v'+ver+' available. Install through TornPDA script updates.':'Current version: v'+VERSION;}
    catch(e){errorText=String(e.message||e);}render();
  }
  async function handleClick(e){
    const b=e.target.closest('[data-action], [data-tab]');if(!b)return;
    if(b.hasAttribute('data-tab')){tab=b.getAttribute('data-tab');render();return;}
    const action=b.getAttribute('data-action');
    if(action==='close')setOpen(false);
    if(action==='refresh')void refresh();
    if(action==='clear-pending'&&Date.now()-claimsCheckedAt<45000&&window.confirm('Review your refreshed claims first. Clearing this guard permits another request; it does not undo an earlier reservation.')){await setPending(null);render();}
    if(action==='update')void updateCheck();
    if(action==='dockleft'){setDock('left',dock.fraction);render();}
    if(action==='dockright'){setDock('right',dock.fraction);render();}
    if(action==='dockreset'){setDock(DOCK_DEFAULT.side,DOCK_DEFAULT.fraction);render();}
    if(action==='contracts'){tab='Contracts';render();}
    if(action==='payouts'){tab='Payouts';render();}
    if(action==='connect')void connect();
    if(action==='claim'||action==='claimmax')void claim(b.getAttribute('data-order'),action==='claimmax');
    if(action==='complete')void complete(Number(b.getAttribute('data-id')));
    if(action==='attack'){setOpen(false);return;} // native <a href> opens same TornPDA tab
    if(action==='locate-target')void locateTarget(b.getAttribute('data-order'),b.getAttribute('data-claim-id'));
    if(action==='forget'&&pending()){errorText='Reconcile the pending request before forgetting its key.';render();return;}
    if(action==='forget'){ownerPlayer=0;apiKey='';setSession('');await nativeDelete(KEY_STORAGE);activateLedger();tab='Settings';render();}
    if(action==='export')copyLedger();
    if(action==='scanmail')void scanMail();
    if(action==='match'){const value=(panel.querySelector('#ff-receipt')||{}).value||'';notice='Matched '+recordReceipt(value,'paste:'+Date.now())+' known claims. Message text not stored.';render();}
  }
  async function loadState(){
    apiKey=getSession();
    pendingAll=await nativeGet(PENDING_STORAGE,{});if(!pendingAll||typeof pendingAll!=='object')pendingAll={};
    ledgerAll=await nativeGet(LEDGER_STORAGE,{});if(!ledgerAll||typeof ledgerAll!=='object')ledgerAll={};
    const saved=await nativeGet(KEY_STORAGE,'');
    if(isKey(saved)){remember=true;if(!isKey(apiKey))apiKey=saved;}
    // Seller credentials are entered explicitly; never silently forward TornPDA's Torn key.
    activateLedger();
    render();
    if(isKey(apiKey)&&opened)void refresh();
  }
  launch.onclick=function(){
    if(Date.now()<suppressClickUntil)return;
    try{
      setOpen(!opened);
      if(opened&&!loadState.done){loadState.done=true;void loadState().catch(e=>{errorText='Startup issue: '+String(e.message||e);render()});}
    }catch(e){launch.textContent='FF !';window.alert('FFContractor error: '+String(e.message||e));}
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened)setOpen(false)});
  every(()=>{if(opened&&panel&&panel.isConnected&&isKey(apiKey)&&Date.now()-lastSync>25000)void refresh();},30000);
  let mountObserver=null;
  if(typeof MutationObserver==='function'&&document.documentElement){mountObserver=new MutationObserver(()=>{if(!disposed)mount();});mountObserver.observe(document.documentElement,{childList:true});}
  window.__FFContractor={
    version:VERSION,ready:true,mount,
    show(){mount();setOpen(true);if(!loadState.done){loadState.done=true;void loadState().catch(e=>{errorText='Startup issue: '+String(e.message||e);render();});}},
    reset(){setDock(DOCK_DEFAULT.side,DOCK_DEFAULT.fraction);mount();},
    diagnostic(){return {version:VERSION,launcherAttached:!!launch.isConnected,panelOpen:opened,bridge:typeof PDA_httpGet==='function'?'TornPDA':typeof GM_xmlhttpRequest==='function'?'Commander':'unavailable',viewport:viewport()};},
    dispose(){disposed=true;timers.forEach(clearInterval);if(mountObserver)mountObserver.disconnect();launch.remove();if(panel)panel.remove();}
  };
  if(typeof GM_registerMenuCommand==='function'){
    GM_registerMenuCommand('Open FFContractor',()=>window.__FFContractor.show());
    GM_registerMenuCommand('Reset FF tab position',()=>window.__FFContractor.reset());
  }
})();