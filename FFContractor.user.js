// ==UserScript==
// @name         FFScouter Loss Desk - Torn PDA
// @namespace    https://ffscouter.com/
// @version      0.7.0
// @description  FFScouter loss contracts in a lightweight TornPDA chat panel, with payouts and GitHub updates.
// @homepageURL  https://github.com/E7t7t7/FFContractor
// @downloadURL  https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js
// @updateURL    https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @include      *://*.torn.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
  'use strict';
  // The launcher intentionally uses plain DOM, like the successful TornPDA
  // injection diagnostic. Dashboard setup and HTTP never block its creation.
  const VERSION = '0.7.0';
  const ROOT_URL = 'https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js';
  const API = 'https://ffscouter.com/api/v1/losses/seller';
  const ID = 'ffcontractor-launcher';
  const old = document.getElementById(ID);
  if (old && old.getAttribute('data-ff-version') === VERSION) return;
  if (old) old.remove();

  const launch = document.createElement('button');
  launch.id = ID;
  launch.type = 'button';
  launch.textContent = '⚔ FF';
  launch.title = 'FFContractor v' + VERSION;
  launch.setAttribute('data-ff-version', VERSION);
  launch.style.cssText = 'all:initial!important;display:flex!important;align-items:center!important;justify-content:center!important;position:fixed!important;left:10px!important;bottom:calc(104px + env(safe-area-inset-bottom,0px))!important;width:62px!important;height:45px!important;background:#125a7b!important;color:#fff!important;font:bold 16px -apple-system,system-ui,sans-serif!important;border:2px solid #6ac9ee!important;border-radius:12px!important;box-shadow:0 5px 16px #0009!important;z-index:2147483647!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;touch-action:manipulation!important;';

  function mount() {
    const parent = document.body || document.documentElement;
    if (parent && launch.parentNode !== parent) parent.appendChild(launch);
  }
  mount();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, {once:true});
  window.addEventListener('pageshow', mount);
  window.addEventListener('focus', mount);
  window.addEventListener('hashchange', mount);
  window.addEventListener('popstate', mount);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) mount(); });
  setInterval(mount, 1500);

  let panel, status, tab = 'Overview', opened = false, apiKey = '', remember = false, busy = false;
  let contracts = [], claims = [], cap = 10, lastSync = 0, errorText = '', notice = '', verifying = false;
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
  function paid(c) { return c.payment_status === 'resolved' || Number(c.paid_at)>0; }
  function mergeLedger(data) {
    let changed=false;
    for (const c of data) {
      const id=String(c.id || ''); if(!/^\d+$/.test(id))continue;
      const prev=currentLedger.claims[id] || {};
      const next={...prev,id:c.id,order_number:c.order_number || prev.order_number || '',state:c.state || prev.state || '',
        slots_delivered:Number(c.slots_delivered == null ? prev.slots_delivered || 0 : c.slots_delivered),
        slots_claimed:Number(c.slots_claimed == null ? prev.slots_claimed || 0 : c.slots_claimed),
        earnings:Number(c.earnings == null ? prev.earnings || 0 : c.earnings),
        paid_at:Number(c.paid_at || prev.paid_at || 0),payment_status:c.payment_status == null ? prev.payment_status : c.payment_status,
        claimed_at:Number(c.claimed_at || prev.claimed_at || 0)};
      if(JSON.stringify(prev)!==JSON.stringify(next)) {currentLedger.claims[id]=next;changed=true;}
    }
    if(changed) void saveLedger();
  }
  function summarize() {
    const all=Object.values(currentLedger.claims);
    const due=all.filter(c=>!paid(c)&&c.state!=='active'&&Number(c.earnings)>0);
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
      #ffcontractor-panel{position:fixed!important;z-index:2147483646!important;left:9px!important;bottom:calc(160px + env(safe-area-inset-bottom,0px))!important;width:calc(100vw - 18px)!important;max-width:480px!important;height:min(70vh,700px)!important;max-height:calc(100vh - 205px)!important;display:none;flex-direction:column;overflow:hidden;background:#181b23;color:#f3f6ff;border:1px solid #4a6478;border-radius:16px;box-shadow:0 12px 44px #000d;font:14px/1.45 -apple-system,system-ui,sans-serif}
      #ffcontractor-panel.ff-open{display:flex!important}
      #ffcontractor-panel button{font:inherit;font-weight:700;cursor:pointer;background:#29445c;color:#f4f8ff;border:1px solid #58718b;border-radius:8px;padding:9px;min-height:36px}
      #ffcontractor-panel button.ff-primary{background:#087ba5;border-color:#33a8cf}
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
      @media(min-width:650px){#ffcontractor-panel{left:auto!important;right:10px!important}}`;
    (document.head || document.documentElement).appendChild(st);
  }
  function buildPanel() {
    css();
    if(panel && panel.isConnected) return;
    panel=document.createElement('div');panel.id='ffcontractor-panel';
    panel.innerHTML=`<div class="ff-top"><strong style="flex:1">⚔ FFContractor <span class="ff-small">v${VERSION}</span></strong><button data-action="refresh">↻</button><button data-action="update">⇧</button><button data-action="close">✕</button></div><div class="ff-tabs">${['Overview','Contracts','Payouts','Settings'].map(x=>`<button data-tab="${x}">${x}</button>`).join('')}</div><div class="ff-scroll"></div>`;
    (document.body || document.documentElement).appendChild(panel);
    panel.addEventListener('click', handleClick);
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
      html+=`<div class="ff-card"><strong>GitHub updates</strong><p class="ff-small">Installed v${VERSION}. TornPDA handles updates from your original remote URL.</p><button data-action="update">Check GitHub for updates</button></div>`;
      html+='<button data-action="forget">Forget API key</button>';
    }
    if(!isKey(apiKey)&&tab!=='Settings')html='<div class="ff-note">Add your FFScouter API key in Settings to load contracts.</div>'+html;
    scroll.innerHTML=html;
    scroll.scrollTop=oldScroll;
  }
  function activeMarkup(c) {
    const id=Number(c.target_id||c.target_user_id||c.target||0);
    return `<div class="ff-card"><strong>Active: ${esc(c.order_number||c.id)}</strong><div class="ff-small">${Number(c.slots_delivered)||0}/${Number(c.slots_claimed)||0} verified · ${money(c.earnings||0)} earned</div><div class="ff-row"><button class="ff-primary" data-action="attack" data-target="${id}" ${id>0?'':'disabled'}>⚔ Attack target</button><button data-action="complete" data-id="${Number(c.id)}">Mark complete</button></div><div class="ff-small">Complete your losses manually on Torn. FFScouter verifies attack logs.</div></div>`;
  }
  function setOpen(value) {
    opened=!!value;buildPanel();
    panel.classList.toggle('ff-open',opened);
    launch.textContent=opened?'✕ FF':'⚔ FF';
    if(opened){render(); if(isKey(apiKey)&&Date.now()-lastSync>15000)void refresh();}
  }
  async function request(method,path,body) {
    if(!isKey(apiKey))throw Error('Enter your 16-character FFScouter API key in Settings.');
    let r;
    if(method==='GET'){
      if(typeof PDA_httpGet!=='function')throw Error('TornPDA HTTP bridge is unavailable.');
      r=await PDA_httpGet(API+path+(path.includes('?')?'&':'?')+'key='+encodeURIComponent(apiKey),{Accept:'application/json'});
    } else {
      if(typeof PDA_httpPost!=='function')throw Error('TornPDA POST bridge is unavailable.');
      r=await PDA_httpPost(API+path,{Accept:'application/json','Content-Type':'application/json'},JSON.stringify({key:apiKey,...(body||{})}));
    }
    let json;try{json=typeof r.responseText==='string'?JSON.parse(r.responseText):r.responseText;}catch(_){throw Error('Server returned invalid JSON');}
    if(Number(r.status)<200||Number(r.status)>=300||!json||json.error)throw Error(String(json&&json.error||json&&json.message||'HTTP '+r.status));
    return json;
  }
  async function refresh() {
    if(busy||!isKey(apiKey))return;busy=true;notice='Loading FFScouter…';errorText='';render();
    const results=await Promise.allSettled([request('GET','/contracts'),request('GET','/claims')]);
    const fails=[];
    if(results[0].status==='fulfilled'){
      const obj=results[0].value;contracts=Array.isArray(obj.contracts)?obj.contracts:[];cap=Number(obj.max_claim_slots)||10;
    }else fails.push(String(results[0].reason.message||results[0].reason));
    if(results[1].status==='fulfilled'){
      claims=Array.isArray(results[1].value.claims)?results[1].value.claims:[];mergeLedger(claims);
    }else fails.push(String(results[1].reason.message||results[1].reason));
    errorText=fails.join(' · ');notice=fails.length?'':'Updated successfully';lastSync=Date.now();busy=false;render();
  }
  async function connect(){
    const key=String(panel.querySelector('#ff-api-key')?.value||'').trim();
    if(!isKey(key)){errorText='API key must be 16 letters/numbers.';render();return;}
    apiKey=key;remember=!!panel.querySelector('#ff-remember')?.checked;
    setSession(key);activateLedger();if(remember)await nativeSet(KEY_STORAGE,key);else await nativeDelete(KEY_STORAGE);
    tab='Overview';await refresh();
  }
  async function claim(order,max){
    const c=contracts.find(c=>String(c.order_number)===order);if(!c||busy)return;
    const limit=Math.max(0,Math.min(Number(c.slots_available)||0,cap));
    const input=panel.querySelectorAll('[data-order-input]');let num=0;
    input.forEach(x=>{if(x.getAttribute('data-order-input')===order)num=Number(x.value)});
    const count=max?limit:num;
    if(!Number.isInteger(count)||count<1||count>limit){errorText='Select a valid number of losses.';render();return;}
    if(!window.confirm('Reserve '+count+' losses on '+order+'? FFScouter starts its claim timers immediately.'))return;
    busy=true;render();
    try{const r=await request('POST','/claim',{order_number:order,slots:max?0:count});notice='Claim reserved. Start the loss attacks promptly.';errorText='';if(r.claim)mergeLedger([r.claim]);await refreshAfterAction();}
    catch(e){errorText=String(e.message||e);busy=false;render();}
  }
  async function complete(id){
    if(!window.confirm('Mark this claim complete and release unused slots?'))return;
    busy=true;render();
    try{await request('POST','/claims/'+id+'/complete');notice='Claim submitted for settlement.';errorText='';await refreshAfterAction();}
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
    if(typeof PDA_httpGet!=='function'){errorText='TornPDA HTTP bridge not available';render();return;}
    busy=true;notice='Scanning message subjects and events…';render();let found=0,errs=[];
    for(const [name,url,field] of [['Messages','https://api.torn.com/v2/user/messages?limit=100','messages'],['Events','https://api.torn.com/v2/user/events?limit=100&striptags=true','events']]){
      try{const r=await PDA_httpGet(url,{Authorization:'ApiKey '+apiKey,Accept:'application/json'});const d=JSON.parse(r.responseText||'{}');if(d.error)throw Error(d.error.error||d.error.message);for(const x of Array.isArray(d[field])?d[field]:[]){found+=recordReceipt(name==='Events'?x.event:x.topic,name+':'+String(x.id||x.timestamp))}}
      catch(e){errs.push(name+': '+String(e.message||e));}
    }
    busy=false;notice='Matched '+found+' new references.';errorText=errs.join(' · ');render();
  }
  function copyLedger(){const value=JSON.stringify({exported_at:new Date().toISOString(),claims:currentLedger.claims,receipts:currentLedger.receipts},null,2);if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(value).then(()=>{notice='Ledger copied.';render()}).catch(()=>window.prompt('Copy ledger',value));else window.prompt('Copy ledger',value);}
  async function updateCheck(){
    tab='Settings';notice='Checking GitHub…';errorText='';render();
    try{if(typeof PDA_httpGet!=='function')throw Error('TornPDA HTTP bridge unavailable');const r=await PDA_httpGet(ROOT_URL+'?v='+Date.now(),{Accept:'text/plain'});if(Number(r.status)!==200)throw Error('GitHub HTTP '+r.status);const ver=(String(r.responseText||'').match(/^\/\/\s*@version\s+(\d+(?:\.\d+)*)/m)||[])[1];if(!ver)throw Error('Version header not found');const newer=ver.split('.').some((x,i)=>Number(x)>Number(VERSION.split('.')[i]||0));notice=newer?'GitHub v'+ver+' available. Install through TornPDA script updates.':'Current version: v'+VERSION;}
    catch(e){errorText=String(e.message||e);}render();
  }
  async function handleClick(e){
    const b=e.target.closest('[data-action], [data-tab]');if(!b)return;
    if(b.hasAttribute('data-tab')){tab=b.getAttribute('data-tab');render();return;}
    const action=b.getAttribute('data-action');
    if(action==='close')setOpen(false);
    if(action==='refresh')void refresh();
    if(action==='update')void updateCheck();
    if(action==='contracts'){tab='Contracts';render();}
    if(action==='payouts'){tab='Payouts';render();}
    if(action==='connect')void connect();
    if(action==='claim'||action==='claimmax')void claim(b.getAttribute('data-order'),action==='claimmax');
    if(action==='complete')void complete(Number(b.getAttribute('data-id')));
    if(action==='attack'){const id=Number(b.getAttribute('data-target'));if(Number.isSafeInteger(id)&&id>0){setOpen(false);window.location.assign('https://www.torn.com/loader.php?sid=attack&user2ID='+id)}}
    if(action==='forget'){apiKey='';setSession('');await nativeDelete(KEY_STORAGE);activateLedger();tab='Settings';render();}
    if(action==='export')copyLedger();
    if(action==='scanmail')void scanMail();
    if(action==='match'){const value=panel.querySelector('#ff-receipt')?.value||'';notice='Matched '+recordReceipt(value,'paste:'+Date.now())+' known claims. Message text not stored.';render();}
  }
  async function loadState(){
    apiKey=getSession();
    ledgerAll=await nativeGet(LEDGER_STORAGE,{});if(!ledgerAll||typeof ledgerAll!=='object')ledgerAll={};
    const saved=await nativeGet(KEY_STORAGE,'');
    if(isKey(saved)){remember=true;if(!isKey(apiKey))apiKey=saved;}
    const pda='###PDA-APIKEY###';if(!isKey(apiKey)&&isKey(pda))apiKey=pda;
    activateLedger();
    render();
    if(isKey(apiKey)&&opened)void refresh();
  }
  launch.onclick=function(){
    try{
      setOpen(!opened);
      if(opened&&!loadState.done){loadState.done=true;void loadState().catch(e=>{errorText='Startup issue: '+String(e.message||e);render()});}
    }catch(e){launch.textContent='FF !';window.alert('FFContractor error: '+String(e.message||e));}
  };
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened)setOpen(false)});
  setInterval(()=>{if(opened&&panel&&panel.isConnected&&isKey(apiKey)&&Date.now()-lastSync>25000)void refresh();},30000);
})();