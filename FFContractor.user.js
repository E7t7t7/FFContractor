// ==UserScript==
// @name         FFScouter Loss Desk - Torn PDA
// @namespace    https://ffscouter.com/
// @version      0.6.1
// @homepageURL  https://github.com/E7t7t7/FFContractor
// @downloadURL  https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js
// @updateURL    https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js
// @description  Mobile FFScouter contracts and payouts inside TornPDA, with GitHub update checker.
// @author       Personal-use script
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @include      *://*.torn.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

/*
 * Works with Torn PDA's built-in PDA_httpGet / PDA_httpPost bridge.
 * FFScouter Seller API: https://ffscouter.com/api-docs
 * No external JavaScript, analytics, proxies, or automatic Torn actions.
 * Attacks themselves are performed manually in Torn.
 */
(() => {
  'use strict';

  // Torn can re-inject scripts during navigation in the same document.
  // Reuse the existing instance instead of creating competing launchers/timers.
  const existingBoot = window.__FFCONTRACTOR_BOOT__;
  if (existingBoot && typeof existingBoot.ensure === 'function') {
    existingBoot.ensure();
    return;
  }

  // Launcher is a direct child of <html>, as a durable Torn-style chat tab. It does NOT
  // depend on TornPDA exposing Torn's chat button row. No borrowed source code.
  const earlyLauncher = document.createElement('button');
  earlyLauncher.id = 'ffcontractor-launcher';
  earlyLauncher.type = 'button';
  earlyLauncher.title = 'FFContractor — Open FFScouter losses';
  earlyLauncher.setAttribute('aria-label', 'Open FFScouter Loss Desk');
  earlyLauncher.setAttribute('data-ff-launcher-version','0.6.1');
  earlyLauncher.textContent = '⚔ FF';
  earlyLauncher.style.cssText = [
    'all:initial!important', 'box-sizing:border-box!important',
    'display:flex!important', 'align-items:center!important',
    'justify-content:center!important', 'position:fixed!important',
    'right:auto!important', 'left:12px!important', 'bottom:calc(115px + env(safe-area-inset-bottom, 0px))!important',
    'width:54px!important', 'height:48px!important',
    'min-width:54px!important', 'min-height:48px!important',
    'padding:0!important', 'margin:0!important',
    'border-radius:6px 6px 0 0!important', 'border:1px solid #31647b!important',
    'background:linear-gradient(#0a779d,#003c56)!important',
    'box-shadow:inset 0 0 5px #ffffff30,0 -1px 8px #0005!important',
    'color:#f5fbff!important', 'font:bold 17px/1 system-ui,sans-serif!important',
    'visibility:visible!important', 'opacity:1!important',
    'z-index:2147483647!important', 'pointer-events:auto!important',
    'cursor:pointer!important', 'touch-action:manipulation!important'
  ].join(';');
  let earlyLaunchAction = null;
  let earlyLaunchProblem = '';
  earlyLauncher.onclick = () => {
    if (earlyLaunchAction) earlyLaunchAction();
    else alert(earlyLaunchProblem || 'FFContractor is still starting. Try again shortly.');
  };


  // Follow the left edge of Torn's chat controls *geometrically*, never by
  // inserting our button into a React-managed DOM subtree.
  function locateChatBarLeft() {
    const chat = document.getElementById('chatRoot');
    if (!chat) return null;
    let buttons=[];
    const hint = chat.querySelector('button[title="Settings"],button[title="Notes"],button[title="People"]');
    if (hint && hint.parentElement) buttons=Array.from(hint.parentElement.querySelectorAll('button'));
    else buttons=Array.from(chat.querySelectorAll('button')).filter(btn=>{
      const r=btn.getBoundingClientRect();
      return r.width>0 && r.top>=window.innerHeight-48 && r.bottom<=window.innerHeight+6;
    });
    const coords=buttons.map(btn=>btn.getBoundingClientRect()).filter(r=>r.width>0 && r.left>=0);
    return coords.length?Math.min(...coords.map(r=>r.left)):null;
  }
  function mountEarlyLauncher() {
    // Mount outside Torn's React-controlled <body>. Body replacement on reload
    // is a known way to lose ordinary floating buttons.
    const container=document.documentElement || document.body;
    if (!container) return;
    const duplicate=document.getElementById('ffcontractor-launcher');
    if (duplicate && duplicate !== earlyLauncher) duplicate.remove();
    if (earlyLauncher.parentNode !== container) container.appendChild(earlyLauncher);
    let left=null;
    try { left=locateChatBarLeft(); } catch (_) { left=null; }
    // Stay above TornPDA's bottom toolbar. On iOS the browser is not always
    // allowed to cover the native toolbar with a fixed button at bottom:0.
    earlyLauncher.style.setProperty('bottom','calc(115px + env(safe-area-inset-bottom,0px))','important');
    if (left == null) {
      earlyLauncher.style.setProperty('left','12px','important');
      earlyLauncher.style.setProperty('right','auto','important');
      earlyLauncher.dataset.ffLauncherState='bottom-toolbar-safe';
    } else {
      earlyLauncher.style.setProperty('right','auto','important');
      earlyLauncher.style.setProperty('left',Math.max(12,Math.round(left))+'px','important');
      earlyLauncher.dataset.ffLauncherState='chat-aligned';
    }
  }
  mountEarlyLauncher();
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', mountEarlyLauncher, {once:true});
  window.__FFCONTRACTOR_BOOT__ = { version:'0.6.1', ensure:mountEarlyLauncher };
  setInterval(mountEarlyLauncher, 1200);
  window.addEventListener('resize', mountEarlyLauncher);
  window.addEventListener('pageshow', mountEarlyLauncher);
  window.addEventListener('popstate', mountEarlyLauncher);
  window.addEventListener('hashchange', mountEarlyLauncher);
  window.addEventListener('focus', mountEarlyLauncher);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) mountEarlyLauncher();
  });
  // The outer document root persists even when Torn swaps the body.
  // Watch the root directly and recover if the tab is unexpectedly detached.
  if (typeof MutationObserver === 'function' && document.documentElement) {
    new MutationObserver(() => {
      if (!earlyLauncher.isConnected) mountEarlyLauncher();
    }).observe(document.documentElement, {childList:true, subtree:false});
  }
  // Recheck position when Torn rerenders; our button stays attached to <html>.
  function observeChatPosition() {
    if (!document.body || typeof MutationObserver !== 'function') return;
    let queued=false;
    new MutationObserver(() => {
      if (queued) return;
      queued=true;
      setTimeout(() => {queued=false;mountEarlyLauncher();},200);
    }).observe(document.body,{childList:true,subtree:false});
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', observeChatPosition, {once:true});
  else observeChatPosition();

  let dashboardLaunched=false;
  function startDashboard() {
    if (dashboardLaunched) return;
    dashboardLaunched=true;
    try {
  // TornPDA can inject inside the active game frame. Never bail out solely
  // because the WebView is framed (v0.3.0 did this and could hide the launcher).
  if (window.__FFSCOUTER_PERSONAL_LOSS_DESK__ && document.getElementById('ffscouter-personal-loss-desk')) return;
  window.__FFSCOUTER_PERSONAL_LOSS_DESK__ = true;

  const BASE = 'https://ffscouter.com/api/v1/losses/seller';
  const SCRIPT_VERSION = '0.6.1';
  const SCRIPT_URL = 'https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js';
  const GITHUB_REPO = 'https://github.com/E7t7t7/FFContractor';
  const KEY_STORAGE = 'ffscouter-loss-desk-key-v1';
  const LEDGER_STORAGE = 'ffscouter-loss-desk-ledger-v2';
  const SESSION_KEY = 'ffscouter-loss-desk-session-key-v1';
  const SESSION_OPEN = 'ffscouter-loss-desk-open-v1';
  // Torn PDA replaces this exact placeholder with its current API key at runtime.
  const PDA_KEY = '###PDA-APIKEY###';
  const isKey = value => /^[a-zA-Z0-9]{16}$/.test(value || '');
  const fmtMoney = n => '$' + Number(n || 0).toLocaleString('en-US');
  const accountHash = key => { let h = 2166136261; for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); };
  const normalizeText = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const dateStr = unix => Number(unix) ? new Date(Number(unix) * 1000).toLocaleDateString() : '—';
  const timeLeft = sec => {
    if (!Number.isFinite(Number(sec)) || !Number(sec)) return '—';
    const remaining = Math.max(0, Number(sec) - Math.floor(Date.now() / 1000));
    const min = Math.floor(remaining / 60);
    const s = remaining % 60;
    return (min ? `${min}m ` : '') + `${String(s).padStart(2, '0')}s`;
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g,
    ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
  const sessGet = k => { try { return sessionStorage.getItem(k) || ''; } catch { return ''; } };
  const sessSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch { /* blocked */ } };
  const sessDel = k => { try { sessionStorage.removeItem(k); } catch { /* blocked */ } };
  const nativeStore = typeof PDA_storage !== 'undefined' && typeof PDA_storage.get === 'function';

  const state = {
    key: '', remembered: false, open: sessGet(SESSION_OPEN) === 'yes',
    contracts: [], claims: [], maxSlots: 10, slotsDraft: {},
    busy: false, refreshing: false, action: '',
    message: '', error: false, lastSync: 0, loaded: false, lastContractSync: 0,
    initialClaim: null, showKey: false, keyEditor: false, keyDraft: '', rememberDraft: null,
    tab: 'dashboard', ledger: {claims:{},receipts:[]}, ledgerAll:{},
    scanning: false, scanResult: '', receiptDraft: '', storageWarn: '',
    updateChecking: false, updateVersion: '', updateAvailable: false, updateMessage: '', updateError: false
  };

  const host = document.createElement('div');
  host.id = 'ffscouter-personal-loss-desk';
  host.style.cssText = 'position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;z-index:2147483600!important;pointer-events:none!important;display:block!important;visibility:visible!important;';
  // Attaching to <html> prevents Torn's own page-body redraw from trapping the button.
  document.documentElement.appendChild(host);
  document.documentElement.dataset.ffcontractorVersion = SCRIPT_VERSION;
  const shadow = host.attachShadow({mode: 'open'});
  shadow.innerHTML = `
    <style>
      * { box-sizing:border-box; }

      #scrim { position:fixed; inset:0; pointer-events:auto; background:transparent; display:none; z-index:1; }
      #scrim.open { display:block; }
      /* Chat-style flyout directly above the bottom tab; no centered dialog. */
      #panel { font:14px/1.45 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        pointer-events:auto; color:#edf0f7; background:#18181d;
        border:1px solid #3c3d49; border-radius:17px;
        box-shadow:0 18px 50px #000c; position:fixed; z-index:2;
        left:16px; right:16px; top:auto; transform:none;
        bottom:52px; width:auto; height:min(75dvh,780px);
        max-height:78dvh; display:none; flex-direction:column; overflow:hidden; }
      #panel.open { display:flex; }
      button:focus-visible, input:focus-visible { outline:3px solid #ffb55a; outline-offset:2px; }
      .head { padding:13px 14px; flex-shrink:0; display:flex; gap:8px; align-items:center;
        border-bottom:1px solid #383943; background:#202025; }
      .head-main { flex:1; min-width:0; }
      .head strong { display:block; letter-spacing:.4px; font-size:15px; }
      .sub { font-size:11px; color:#b2bad0; }
      .scroll { overflow-y:auto; overscroll-behavior:contain; padding:13px 14px 20px; flex:1; }
      button { appearance:none; border:1px solid #526080; border-radius:9px; background:#27334b; color:#f5f6fb;
        font:inherit; font-weight:700; padding:10px 11px; min-height:40px; cursor:pointer; }
      button:disabled { opacity:.42; cursor:not-allowed; }
      button.primary { background:#0d84ac; border-color:#1998c2; color:#fff; }
      button.danger { border-color:#9d5252; background:#4d282e; }
      button.plain { border-color:#47516a; background:#1c2537; }
      button.small { padding:6px 9px; min-height:34px; }
      .row { display:flex; flex-wrap:wrap; gap:8px; align-items:center; }
      .row > .grow { flex:1; min-width:0; }
      .card { background:#24242b; border:1px solid #3d3e49; padding:12px; border-radius:12px; margin:9px 0; }
      .card.important { border-color:#2998bb; }
      .label { display:block; font-weight:700; font-size:12px; color:#bdc8df; margin-bottom:5px; }
      .section { margin:16px 0 8px; font-size:14px; font-weight:850; }
      .muted { color:#abb6cc; font-size:12px; }
      .tiny { font-size:11px; color:#aab4ca; }
      input[type=password], input[type=text], input[type=number] { min-width:0; border:1px solid #58647b; border-radius:8px; padding:10px;
        color:#fff; background:#0c1320; min-height:42px; font:16px system-ui,sans-serif; }
      input[type=number] { width:76px; }
      input[type=checkbox] { width:17px; height:17px; accent-color:#edb25d; }
      .check { display:flex; gap:8px; align-items:center; margin:10px 0; font-size:12px; color:#dce3f2; }
      .message { border-radius:9px; border:1px solid #4b7d73; padding:9px; margin:9px 0; font-size:12px; color:#ccf2e7; background:#17302e; }
      .message.err { color:#ffdada; border-color:#985656; background:#351e29; }
      .num { font-weight:800; color:#72cef4; }
      .money { color:#9be6c5; font-weight:800; }
      .divider { height:1px; background:#35415a; margin:12px 0; }
      .prog { background:#0c1422; height:8px; overflow:hidden; border-radius:6px; margin:10px 0; }
      .prog > div { height:100%; background:#74d1a4; }
      .stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:10px 0 12px; }
      .stat { background:#25252c; border:1px solid #41424c; padding:12px 10px; border-radius:12px; min-width:0; }
      .stat-label { font-size:10px; font-weight:850; color:#aeb1bc; letter-spacing:.55px; text-transform:uppercase; }
      .stat-value { font-size:21px; font-weight:850; letter-spacing:-.5px; margin-top:4px; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
      .stat-sub { font-size:10px; color:#999eac; margin-top:2px; }
      .tabs { display:flex; gap:5px; background:#202025; padding:8px; border-bottom:1px solid #393940; }
      .tabs button { flex:1; min-height:36px; padding:7px 3px; border-radius:8px; font-size:11px; background:transparent; border-color:transparent; color:#b6b6be; }
      .tabs button.current { background:#135a75; border-color:#278eb2; color:#fff; }
      textarea { display:block; width:100%; padding:10px; border:1px solid #59606e; border-radius:9px; color:#fff; background:#14151b; min-height:94px; resize:vertical; font:13px/1.5 system-ui,sans-serif; }
      .times { display:flex; gap:12px; margin:8px 0 11px; }
      .times > div { flex:1; background:#111b2a; padding:8px; border-radius:7px; }
      .times b { display:block; font-size:17px; font-variant-numeric:tabular-nums; }
      .times span { color:#b8c4d6; font-size:11px; }
      .warn { color:#ffd38b; }
      .mono { font-variant-numeric:tabular-nums; }
      @media (min-width:561px) { #panel { left:auto;right:16px;width:min(500px,calc(100vw - 32px));height:min(74dvh,760px); } }
      @media (max-height:650px) { #panel { height:calc(100dvh - 95px);max-height:calc(100dvh - 95px); } }
    </style>
    <div id="scrim" aria-hidden="true"></div>
    <div id="panel" role="dialog" aria-label="FFScouter Loss Desk">
      <div class="head">
        <div class="head-main"><strong>FF<span style="color:#20b7e7">Scouter</span> Loss Desk</strong><div class="sub">Contracts • Payout tracking • Torn PDA</div></div>
        <button type="button" class="small plain" data-act="check-update" title="Check GitHub for a script update" aria-label="Check for updates">⇧</button>
        <button type="button" class="small plain" data-act="refresh" title="Refresh">↻</button>
        <button type="button" class="small plain" data-act="close" title="Minimize">✕</button>
      </div>
      <div class="tabs" id="tabs">
        <button data-tab="dashboard" class="current" type="button">Overview</button>
        <button data-tab="contracts" type="button">Contracts</button>
        <button data-tab="payouts" type="button">Payouts</button>
        <button data-tab="settings" type="button">Settings</button>
      </div>
      <div class="scroll" id="content"></div>
    </div>
  `;
  const scrim = shadow.querySelector('#scrim');
  const panel = shadow.querySelector('#panel');
  const content = shadow.querySelector('#content');
  // The early launcher already exists. Keep one button and reveal the
  // full dashboard only after it has initialized successfully.
  const bubble = earlyLauncher;
  const obsoleteBubble = shadow.querySelector('#bubble');
  if (obsoleteBubble) obsoleteBubble.remove();


  function activeClaim() {
    return state.claims.find(c => c.state === 'active') ||
      (state.initialClaim && state.initialClaim.state === 'active' ? state.initialClaim : null);
  }
  function flash(message, error = false) { state.message = String(message || ''); state.error = error; render(); }

  function setOpen(value) {
    state.open = !!value;
    sessSet(SESSION_OPEN, state.open ? 'yes' : 'no');
    panel.classList.toggle('open', state.open);
    scrim.classList.toggle('open', state.open);
    bubble.textContent = state.open ? '× FF' : '⚔ FF';
    bubble.setAttribute('aria-expanded', String(state.open));
    bubble.setAttribute('aria-label', state.open ? 'Minimize FFScouter Loss Desk' : 'Open FFScouter Loss Desk');
    if (state.open && state.key && (!state.loaded || Date.now() - state.lastSync > 15000)) void refreshAll();
  }

  async function storeLedger() {
    state.ledgerAll[accountHash(state.key)] = state.ledger;
    try {
      if (nativeStore) await PDA_storage.set(LEDGER_STORAGE, state.ledgerAll);
      else localStorage.setItem(LEDGER_STORAGE, JSON.stringify(state.ledgerAll));
      state.storageWarn = '';
    } catch (e) {
      state.storageWarn = 'Ledger could not be saved on this device. Figures may reset.';
    }
  }
  async function loadLedger() {
    try {
      const raw = nativeStore ? await PDA_storage.get(LEDGER_STORAGE, {}) : JSON.parse(localStorage.getItem(LEDGER_STORAGE) || '{}');
      state.ledgerAll = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    } catch { state.ledgerAll = {}; }
    activateLedger();
  }
  function activateLedger() {
    const ledger = state.ledgerAll[accountHash(state.key)];
    state.ledger = ledger && typeof ledger === 'object' ? ledger : {claims:{},receipts:[]};
    if (!state.ledger.claims || typeof state.ledger.claims !== 'object') state.ledger.claims = {};
    if (!Array.isArray(state.ledger.receipts)) state.ledger.receipts = [];
  }
  function mergeClaims(claims) {
    let changed = false;
    for (const claim of claims) {
      if (!Number.isSafeInteger(Number(claim.id)) || Number(claim.id) < 1) continue;
      const id = String(claim.id);
      const previous = state.ledger.claims[id] || {};
      const next = {
        ...previous, id:Number(claim.id), order_number:String(claim.order_number || previous.order_number || ''),
        state:String(claim.state || previous.state || ''),
        slots_delivered: Math.max(0, Number(claim.slots_delivered ?? previous.slots_delivered ?? 0)),
        slots_claimed: Math.max(0, Number(claim.slots_claimed ?? previous.slots_claimed ?? 0)),
        earnings: Math.max(0, Number(claim.earnings ?? previous.earnings ?? 0)),
        payment_status:claim.payment_status ?? previous.payment_status ?? null,
        paid_at:Number(claim.paid_at || previous.paid_at || 0),
        claimed_at:Number(claim.claimed_at || previous.claimed_at || 0),
        completed_at:Number(claim.completed_at || previous.completed_at || 0)
      };
      if (JSON.stringify(previous) !== JSON.stringify(next)) { state.ledger.claims[id] = next; changed = true; }
    }
    if (changed) void storeLedger();
  }
  function ledgerEntries() { return Object.values(state.ledger.claims || {}); }
  function wasPaid(c) { return c.payment_status === 'resolved' || Number(c.paid_at) > 0; }
  function stats() {
    const records = ledgerEntries();
    const due = records.filter(c => !wasPaid(c) && c.state !== 'active' && Number(c.earnings) > 0);
    return {
      paid:records.filter(wasPaid).reduce((n,c) => n + Number(c.earnings || 0),0),
      pending:due.reduce((n,c) => n + Number(c.earnings || 0),0),
      earned:records.reduce((n,c) => n + Number(c.earnings || 0),0),
      hits:records.reduce((n,c) => n + Number(c.slots_delivered || 0),0),
      finished:records.filter(c => ['fulfilled','expired'].includes(c.state) && Number(c.slots_delivered) > 0).length,
      available:state.contracts.length, active:activeClaim()?1:0, pendingCount:due.length
    };
  }
  function statGrid() {
    const a = stats();
    const cards = [
      ['Total paid',fmtMoney(a.paid),'FFScouter confirmed'],
      ['Outstanding payouts',fmtMoney(a.pending),'Earned, unpaid'],
      ['Total earned',fmtMoney(a.earned),'Recorded earnings'],
      ['Losses completed',String(a.hits),'Verified deliveries'],
      ['Contracts finished',String(a.finished),'With verified losses'],
      ['Available contracts',String(a.available),'Eligible now'],
      ['Active claims',String(a.active),'Maximum 1'],
      ['Payments pending',String(a.pendingCount),'Unresolved claims']
    ];
    return '<div class="stats">' + cards.map(([label,value,sub]) => `<div class="stat"><div class="stat-label">${esc(label)}</div><div class="stat-value">${esc(value)}</div><div class="stat-sub">${esc(sub)}</div></div>`).join('') + '</div>';
  }
  function matchReceipt(input, source, sourceId, timestamp) {
    const txt = normalizeText(input).slice(0,3000);
    const known = ledgerEntries();
    const contextual = /ffscouter|glasnost|loss(?:es)?|claim/i.test(txt);
    if (!txt || !known.length) return [];
    const matched = known.filter(c => {
      if (c.order_number && txt.toUpperCase().includes(c.order_number.toUpperCase())) return true;
      return contextual && new RegExp('(?:claim|order|id|#)\\s*[:#-]?\\s*'+c.id+'(?!\\d)','i').test(txt);
    });
    let count = 0;
    for (const c of matched) {
      const receiptId = source + '|' + String(sourceId) + '|' + c.id;
      if (state.ledger.receipts.some(r => r.id === receiptId)) continue;
      state.ledger.receipts.push({id:receiptId,claim_id:c.id,order_number:c.order_number,
        source, seen_at:Number(timestamp) || Math.floor(Date.now()/1000)});
      count++;
    }
    if (count) {
      state.ledger.receipts.sort((a,b) => b.seen_at - a.seen_at);
      state.ledger.receipts = state.ledger.receipts.slice(0,1000);
      void storeLedger();
    }
    return matched;
  }
  async function scanMail() {
    if (state.scanning || !isKey(state.key)) return;
    state.scanning = true; state.scanResult = 'Checking recent Torn message subjects and events…'; render();
    let found = 0; const failures = [];
    for (const [source,url,field] of [
      ['Torn message subject','https://api.torn.com/v2/user/messages?limit=100','messages'],
      ['Torn event','https://api.torn.com/v2/user/events?limit=100&striptags=true','events']
    ]) {
      try {
        if (typeof PDA_httpGet !== 'function') throw Error('TornPDA API bridge not available');
        const r = await PDA_httpGet(url, {Authorization:'ApiKey '+state.key,Accept:'application/json'});
        const data = JSON.parse(r.responseText || '{}');
        if (data.error || !(Number(r.status)>=200 && Number(r.status)<300)) throw Error(data.error?.error || data.error?.message || 'HTTP '+r.status);
        for (const item of Array.isArray(data[field]) ? data[field] : []) {
          const sourceId = String(item.id || item.timestamp || 'unknown');
          const text = source === 'Torn event' ? item.event : item.topic;
          if (!text) continue;
          const before = state.ledger.receipts.length;
          matchReceipt(text,source,sourceId,Number(item.timestamp));
          found += state.ledger.receipts.length - before;
        }
      } catch (e) { failures.push(source+': '+(e.message || String(e))); }
    }
    state.scanning = false;
    state.scanResult = `Found ${found} new matching reference(s).` + (failures.length ? ' ' + failures.join(' • ') : '');
    render();
  }
  function importReceipt() {
    const box = content.querySelector('#receipt-message');
    const raw = String(box?.value || state.receiptDraft || '').trim();
    if (!raw) return flash('Paste the payout message text first.',true);
    const before = state.ledger.receipts.length;
    const matched = matchReceipt(raw,'Pasted receipt',accountHash(raw),Math.floor(Date.now()/1000));
    if (!matched.length) return flash('No matching FFScouter contract / claim ID in your locally recorded claims. No private mail text was saved.',true);
    state.receiptDraft = '';
    state.scanResult = `${matched.length} matched claim(s), ${state.ledger.receipts.length-before} new reference(s). Receipt does not itself mark a payout confirmed.`;
    render();
  }
  function payoutHtml() {
    const records = ledgerEntries().sort((a,b) => (b.claimed_at||0)-(a.claimed_at||0));
    let html = '<div class="section">Payments & matching</div>';
    html += '<div class="muted">FFScouter payment status is the source for confirmed payouts. Your private local ledger keeps totals beyond its 7-day API history, starting when this version is installed.</div>';
    html += `<div class="row" style="margin:10px 0"><button type="button" class="primary grow" data-act="scan-mail" ${state.scanning?'disabled':''}>${state.scanning?'Scanning…':'Scan Torn mail subjects & events'}</button></div>`;
    html += '<div class="tiny">Torn only exposes message subjects via the API—not the message body. This scan reads the newest 100 subjects and 100 events, then stores only matching IDs (not private message text). Requires a limited-access key.</div>';
    if (state.scanResult) html += `<div class="message">${esc(state.scanResult)}</div>`;
    html += '<div class="section">Paste a payout message</div><textarea id="receipt-message" placeholder="Paste the FFScouter payout mail here. It will match order or claim IDs in your local ledger.">'+esc(state.receiptDraft)+'</textarea><div class="row" style="margin-top:7px"><button class="primary grow" data-act="receipt-import">Match receipt to claims</button></div>';
    html += '<div class="tiny" style="margin-top:7px">Only extracted reference IDs and source type are saved. Pasting a receipt does not override a pending payment status.</div>';
    html += '<div class="section">Tracked claim payouts</div>';
    if (!records.length) html += '<div class="muted">No FFScouter claims recorded yet.</div>';
    for (const c of records.slice(0,100)) {
      const refs = state.ledger.receipts.filter(r => Number(r.claim_id) === Number(c.id));
      html += `<div class="card" style="margin:7px 0"><div class="row" style="justify-content:space-between"><b>${esc(c.order_number || '#'+c.id)} <span class="tiny">claim ${Number(c.id)}</span></b><b class="money">${fmtMoney(c.earnings)}</b></div>
        <div class="muted">${wasPaid(c) ? '✅ Paid' : c.state==='active' ? '⏳ Active (not due)' : c.payment_status==='pending' ? '🟠 Payment pending' : '⏳ Awaiting payment record'} • ${Number(c.slots_delivered||0)} losses • ${esc(dateStr(c.claimed_at))}</div>
        <div class="tiny">${Number(c.paid_at) ? 'Paid '+esc(dateStr(c.paid_at))+' • ' : ''}${refs.length ? refs.length+' matching message/event reference(s)' : 'No matched payout message'}</div></div>`;
    }
    return html;
  }

  function compareVersion(a, b) {
    const parse = v => String(v).split('.').map(Number);
    const aa = parse(a), bb = parse(b);
    for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
      const diff = (aa[i] || 0) - (bb[i] || 0);
      if (diff) return diff > 0 ? 1 : -1;
    }
    return 0;
  }

  function updateHtml() {
    const status = state.updateChecking ? 'Checking GitHub…' :
      state.updateVersion ? `GitHub: v${esc(state.updateVersion)} • Installed: v${SCRIPT_VERSION}` :
      `Installed: v${SCRIPT_VERSION} • GitHub not checked`;
    return `<div class="section">GitHub Updates</div>
      <div class="card"><div class="muted">${status}</div>
      ${state.updateMessage ? `<div class="message ${state.updateError ? 'err' : ''}">${esc(state.updateMessage)}</div>` : ''}
      <div class="row" style="margin-top:10px">
        <button type="button" class="primary grow" data-act="check-update" ${state.updateChecking?'disabled':''}>${state.updateChecking ? 'Checking…' : 'Check for Updates'}</button>
        <button type="button" class="${state.updateAvailable ? 'primary' : 'plain'} grow" data-act="install-update">${state.updateAvailable ? 'Install Update' : 'Open Install Link'}</button>
      </div>
      <div class="tiny" style="margin-top:9px">Updates come from your <b>FFContractor</b> GitHub repository. TornPDA installs the updated script after its normal confirmation. For automatic update tracking, initially install this script from its remote GitHub URL rather than importing a local file. Your saved FFScouter data stays in TornPDA's per-script storage.</div></div>`;
  }

  async function checkUpdates() {
    if (state.updateChecking) return;
    state.updateChecking = true; state.updateError = false; state.updateMessage = '';
    // Switch to settings so the result and install action remain visible.
    state.tab = 'settings'; render();
    try {
      if (typeof PDA_httpGet !== 'function') throw Error('GitHub checks require TornPDA’s HTTP bridge.');
      const response = await PDA_httpGet(SCRIPT_URL + '?check=' + Date.now(), { Accept: 'text/plain' });
      if (Number(response.status) < 200 || Number(response.status) >= 300)
        throw Error('GitHub returned HTTP ' + String(response.status || '?') + '.');
      const source = String(response.responseText || '');
      const headerEnd = source.indexOf('// ==/UserScript==');
      const header = headerEnd > 0 && headerEnd < 5000 ? source.slice(0, headerEnd) : '';
      if (!/\/\/\s*@name\s+FFScouter Loss Desk - Torn PDA\s*$/m.test(header))
        throw Error('The GitHub file does not look like the expected FFContractor userscript.');
      const match = header.match(/^\/\/\s*@version\s+(\d+(?:\.\d+){1,3})\s*$/m);
      if (!match) throw Error('GitHub userscript has no usable version header.');
      state.updateVersion = match[1];
      state.updateAvailable = compareVersion(match[1], SCRIPT_VERSION) > 0;
      state.updateMessage = state.updateAvailable ?
        `New v${match[1]} available. Tap Install Update and approve TornPDA's installation prompt.` :
        `Up to date (v${SCRIPT_VERSION}).`;
    } catch (error) {
      state.updateError = true;
      state.updateMessage = String(error.message || error);
    } finally { state.updateChecking = false; render(); }
  }

  function openUpdateInstaller() {
    // TornPDA recognizes direct .user.js URLs and manages the actual script replacement.
    // Browser userscripts are not allowed to modify the installed source silently.
    window.location.assign(SCRIPT_URL);
  }

  function render() {
    const scroll = content.scrollTop;
    const authenticated = isKey(state.key);
    shadow.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('current',b.dataset.tab===state.tab));
    let html = '';
    if (state.message) html += `<div class="message ${state.error ? 'err' : ''}" role="status">${esc(state.message)}</div>`;
    if (authenticated && !state.keyEditor && state.tab === 'settings') {
      html += `<div class="card" style="padding:8px 10px"><div class="row"><div class="grow muted"><b style="color:#9de0bc">● ${state.loaded ? 'Connected' : 'Key available'}</b> • FFScouter API • ${state.remembered ? 'Saved on device' : 'Session only'}</div>
        <button class="small plain" data-act="edit-key">Change key</button></div></div>`;
    } else if (!authenticated || state.keyEditor || state.tab === 'settings') {
    html += `<div class="card">
      <div class="row" style="justify-content:space-between"><span class="label">Registered FFScouter API key</span><span class="tiny">${authenticated ? '● Key entered' : '● Not connected'}</span></div>
      <div class="row"><input class="grow" id="key" type="${state.showKey ? 'text' : 'password'}" inputmode="text" maxlength="16" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="16-character API key" value="${esc(state.keyDraft)}" />
      <button type="button" class="small plain" data-act="toggle-key">${state.showKey ? 'Hide' : 'Show'}</button></div>
      <label class="check"><input type="checkbox" id="remember" ${(state.rememberDraft ?? state.remembered) ? 'checked' : ''} /> Remember key locally in Torn PDA</label>
      <div class="row"><button type="button" class="primary grow" data-act="connect" ${state.busy ? 'disabled' : ''}>${state.busy && state.action === 'connect' ? 'Loading…' : 'Load contracts'}</button>
      <button type="button" class="plain" data-act="forget">Forget</button>
      ${isKey(PDA_KEY) && !state.key ? '<button type="button" class="plain" data-act="pda-key">Use PDA key</button>' : ''}</div>
      <div class="tiny" style="margin-top:8px">Key is sent directly to FFScouter. A registered key with basic + attacks access is required.</div>
    </div>`;
    }
    if (state.storageWarn) html += `<div class="message err">${esc(state.storageWarn)}</div>`;
    if (!authenticated || !state.loaded) {
      html += '<div class="muted" style="margin-top:14px">Enter your FFScouter key, tap <b>Load contracts</b>, then claim available losses. If your Torn PDA key is already registered with FFScouter, you can use the same key.</div>';
      if (state.refreshing) html += '<p class="muted">Contacting FFScouter…</p>';
      if (state.tab === 'settings') html += updateHtml();
      content.innerHTML = html;
      content.scrollTop = scroll;
      return;
    }
    if (state.tab === 'payouts') {
      html += payoutHtml(); content.innerHTML = html; content.scrollTop = scroll; return;
    }
    if (state.tab === 'settings') {
      html += `<div class="card muted">Saved earnings stay on this device and are associated with the API key used. Changing to another key makes a separate ledger. Ledger figures start when this script records your claims, since FFScouter's API only returns 7 days.</div>`;
      html += `<div class="row"><button type="button" class="plain" data-act="export-ledger">Copy ledger JSON</button><button type="button" class="danger" data-act="clear-ledger">Clear local ledger</button></div>`;
      html += updateHtml();
      content.innerHTML = html; content.scrollTop = scroll; return;
    }
    if (state.tab === 'dashboard') html += statGrid();
    const active = activeClaim();
    const settling = state.claims.find(c => c.state === 'settling');
    html += `<div class="row" style="justify-content:space-between;margin-top:9px"><span class="tiny">${state.refreshing ? 'Refreshing…' : `Synced ${state.lastSync ? new Date(state.lastSync).toLocaleTimeString() : '—'}`}</span>
      <span class="tiny">Max per claim: <b class="num">${Number(state.maxSlots) || 10}</b></span></div>`;
    if (active) {
      const claimed = Number(active.slots_claimed || 0);
      const delivered = Number(active.slots_delivered || 0);
      const target = Number(active.target_player_id || 0);
      const title = active.target_player_name || `Player ${target}`;
      html += `<div class="section">Your active claim</div><div class="card important">
        <div class="row" style="justify-content:space-between"><b>${esc(title)}</b><span class="money">${fmtMoney(active.price_per_loss || 0)} / loss</span></div>
        <div class="muted">Order ${esc(active.order_number || '')} • ${esc(active.state || '')}</div>
        <div style="margin-top:9px"><span class="num">${delivered}</span> / ${claimed} verified losses</div>
        <div class="prog"><div style="width:${claimed > 0 ? Math.min(100, Math.max(0, delivered / claimed * 100)) : 0}%"></div></div>
        <div class="times"><div><span>Next loss due</span><b class="mono" data-deadline="${Number(active.idle_deadline_at) || 0}">${timeLeft(active.idle_deadline_at)}</b></div>
        <div><span>Claim expires</span><b class="mono" data-deadline="${Number(active.expires_at) || 0}">${timeLeft(active.expires_at)}</b></div></div>
        <div class="muted">${typeof active.earnings === 'number' ? `Verified earnings: <span class="money">${fmtMoney(active.earnings)}</span>` : 'FFScouter verifies attacks from your logs.'}</div>
        <div class="row" style="margin-top:12px">
          <button type="button" class="primary grow" data-act="attack" data-target="${target}" ${target > 0 ? '' : 'disabled'}>⚔ Attack target</button>
          <button type="button" class="plain" data-act="refresh">Check hits</button>
        </div>
        <div class="row" style="margin-top:8px"><button type="button" class="danger grow" data-act="complete" data-id="${Number(active.id)}" ${state.busy ? 'disabled' : ''}>Mark complete / release unused</button></div>
        <div class="tiny warn" style="margin-top:10px">Equip a pillow only. First loss and each following loss must be within 5 minutes; the entire claim ends in 15 minutes. This panel cannot fight for you.</div>
      </div>`;
    } else {
      if (settling) html += `<div class="message">Claim ${esc(settling.order_number || '')} is settling while FFScouter checks attack logs. Claiming again may remain unavailable until settlement finishes.</div>`;
    }
    if (state.tab === 'dashboard') {
      html += `<div class="row"><button type="button" class="primary grow" data-act="tab-contracts">Browse contracts</button><button type="button" class="plain grow" data-act="tab-payouts">View payouts</button></div>`;
      if (!active) html += '<div class="muted" style="margin-top:12px">No active claim. Browse contracts to reserve losses without leaving Torn.</div>';
      content.innerHTML = html; content.scrollTop = scroll; return;
    }
    html += '<div class="section">Available contracts</div>';
    if (!state.contracts.length) html += '<div class="card muted">No eligible contracts available right now. FFScouter hides targets until you claim, and only lists contracts you qualify to sell on.</div>';
    for (const c of state.contracts) {
      const order = String(c.order_number || '');
      const avail = Math.max(0, Number(c.slots_available) || 0);
      const cap = Math.max(0, Math.min(avail, Number(state.maxSlots) || 10));
      const draft = state.slotsDraft[order] ?? Math.min(cap, 4);
      const lock = active || settling || state.busy || cap < 1;
      html += `<div class="card"><div class="row" style="justify-content:space-between"><strong>${esc(order)}</strong><strong class="money">${fmtMoney(c.price_per_loss)} / loss</strong></div>
        <div class="muted">${avail} slots available • Up to ${cap} for you</div>
        <div class="row" style="margin-top:10px"><input type="number" inputmode="numeric" min="1" max="${cap}" value="${esc(draft)}" data-slots="${esc(order)}" aria-label="Number of losses for ${esc(order)}" ${lock ? 'disabled' : ''} />
        <button type="button" class="plain grow" data-act="claim" data-order="${esc(order)}" ${lock ? 'disabled' : ''}>Claim selected</button>
        <button type="button" class="primary grow" data-act="claim-max" data-order="${esc(order)}" ${lock ? 'disabled' : ''}>Claim max (${cap})</button></div>
      </div>`;
    }
    html += '<div class="section">Recent claims (7 days)</div>';
    const history = state.claims.filter(c => c.state !== 'active').slice(0, 7);
    if (!history.length) html += '<div class="muted">No completed claims listed yet.</div>';
    for (const c of history) {
      html += `<div class="card" style="margin:6px 0;padding:9px"><div class="row" style="justify-content:space-between"><b>${esc(c.order_number || '')}</b><span class="muted">${esc(c.state || 'unknown')}</span></div>
        <div class="muted">${Number(c.slots_delivered || 0)} / ${Number(c.slots_claimed || 0)} verified • ${fmtMoney(c.earnings || 0)} • ${esc(c.payment_status || 'payment pending / unknown')}</div></div>`;
    }
    html += '<div class="divider"></div><div class="tiny">Personal UI for FFScouter’s published seller API. Only your own claim can be reserved. Attack actions happen in Torn, not through the API.</div>';
    content.innerHTML = html;
    content.scrollTop = scroll;
  }

  async function request(method, path, body) {
    if (!isKey(state.key)) throw Error('Enter a valid 16-character API key.');
    const url = BASE + path;
    let response;
    if (method === 'GET') {
      if (typeof PDA_httpGet !== 'function') throw Error('Torn PDA request bridge unavailable. Open this script inside the Torn PDA browser.');
      response = await PDA_httpGet(url + (url.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(state.key), {
        'Accept': 'application/json'
      });
    } else {
      if (typeof PDA_httpPost !== 'function') throw Error('Torn PDA POST bridge unavailable. Open this script inside the Torn PDA browser.');
      response = await PDA_httpPost(url, {
        'Accept': 'application/json', 'Content-Type': 'application/json'
      }, JSON.stringify({ key: state.key, ...(body || {}) }));
    }
    let data;
    try { data = JSON.parse(response.responseText || '{}'); }
    catch { throw Error(`FFScouter returned an invalid response (HTTP ${response.status || '?'}).`); }
    if (Number(response.status) < 200 || Number(response.status) >= 300 || data.error) {
      let msg = data.error || data.message || `FFScouter error (HTTP ${response.status || '?'}).`;
      if (data.retry_after_seconds) msg += ` Try again after ${data.retry_after_seconds} seconds.`;
      throw Error(String(msg));
    }
    return data;
  }

  async function refreshClaims() {
    const data = await request('GET', '/claims');
    if (!Array.isArray(data.claims)) throw Error('Unexpected FFScouter claims response.');
    state.claims = data.claims;
    mergeClaims(data.claims);
    if (state.claims.some(c => c.id === state.initialClaim?.id)) state.initialClaim = null;
    state.lastSync = Date.now();
    state.loaded = true;
    return data;
  }
  async function refreshContracts() {
    const data = await request('GET', '/contracts');
    if (!Array.isArray(data.contracts)) throw Error('Unexpected FFScouter contract response.');
    state.contracts = data.contracts;
    state.maxSlots = Number(data.max_claim_slots) || 10;
    state.lastContractSync = Date.now();
    state.loaded = true;
    return data;
  }
  async function refreshAll() {
    if (!isKey(state.key) || state.refreshing || state.busy) return;
    state.refreshing = true;
    render();
    const results = await Promise.allSettled([refreshClaims(), refreshContracts()]);
    state.refreshing = false;
    const errors = results.filter(r => r.status === 'rejected').map(r => r.reason?.message || 'Unknown error');
    if (errors.length) { state.message = errors.join(' • '); state.error = true; }
    else { state.message = ''; state.error = false; }
    render();
  }
  async function saveKey() {
    // Persist only by explicit checkbox selection; Torn PDA storage is per-script, not encrypted.
    if (!nativeStore) {
      state.remembered = false;
      return;
    }
    try {
      if (state.remembered) await PDA_storage.set(KEY_STORAGE, state.key);
      else await PDA_storage.delete(KEY_STORAGE);
    } catch (e) {
      state.remembered = false;
      throw Error('Could not save the key in Torn PDA: ' + (e.message || String(e)));
    }
  }
  async function connect() {
    const key = String(content.querySelector('#key')?.value || state.keyDraft || '').trim();
    const remember = !!content.querySelector('#remember')?.checked;
    if (!isKey(key)) return flash('Your FFScouter key should have exactly 16 letters or numbers.', true);
    state.key = key;
    activateLedger();
    state.keyDraft = key;
    state.keyEditor = false;
    state.remembered = remember;
    state.rememberDraft = remember;
    sessSet(SESSION_KEY, key); // Retains key only for the in-app tab/session unless Remember is selected.
    try { await saveKey(); }
    catch (e) { flash(e.message, true); }
    state.loaded = false;
    state.claims = [];
    state.contracts = [];
    state.initialClaim = null;
    await refreshAll();
  }
  async function forget() {
    state.key = '';
    state.keyDraft = '';
    state.keyEditor = true;
    state.remembered = false;
    state.rememberDraft = false;
    state.contracts = [];
    state.claims = [];
    state.initialClaim = null;
    state.loaded = false;
    sessDel(SESSION_KEY);
    try { if (nativeStore) await PDA_storage.delete(KEY_STORAGE); }
    catch (e) { flash('Local key reset, but native storage could not be cleared: ' + String(e.message || e), true); return; }
    flash('Key cleared from this session and the script’s saved key.');
  }
  async function claim(order, max) {
    if (state.busy) return;
    const c = state.contracts.find(x => x.order_number === order);
    if (!c) return flash('Contract is no longer in the list. Refresh and try again.', true);
    if (activeClaim() || state.claims.some(c => c.state === 'settling')) return flash('Wait until your current FFScouter claim finishes settling before claiming more.', true);
    const cap = Math.min(Number(c.slots_available) || 0, Number(state.maxSlots) || 10);
    const slots = Number(state.slotsDraft[order] ?? Math.min(4, cap));
    if (!max && (!Number.isInteger(slots) || slots < 1 || slots > cap))
      return flash(`Choose 1 to ${cap} losses.`, true);
    const count = max ? cap : slots;
    if (!window.confirm(`Claim ${max ? 'up to ' : ''}${count} loss(es) on ${order}?\n\nYou must start within 5 minutes, keep each gap under 5 minutes, and finish within 15 minutes. You need about ${count * 25} energy.\n\nFFScouter will reserve the slots immediately.`)) return;
    state.busy = true;
    state.action = 'claim';
    render();
    try {
      // Slots=0 means take as many as the FFScouter personal cap/current supply allows.
      const data = await request('POST', '/claim', { order_number: order, slots: max ? 0 : slots });
      if (!data.claim || !data.claim.id) throw Error('Claim succeeded but its details were missing. Refresh your active claims.');
      state.initialClaim = { ...data.claim, state: 'active', slots_delivered: 0,
        price_per_loss: Number(c.price_per_loss) || 0, earnings: 0 };
      mergeClaims([state.initialClaim]);
      state.message = `Reserved ${data.claim.slots_claimed ?? count} losses. Open the target and begin now.`;
      state.error = false;
    } catch(e) { state.message = e.message || String(e); state.error = true; }
    finally { state.busy = false; state.action = ''; render(); }
    // Reconcile even if the mutation response was lost (e.g. timeout after reserving).
    void refreshAll();
  }
  async function complete(id) {
    if (state.busy) return;
    if (!window.confirm('Mark this claim complete now?\n\nFFScouter will recheck attack logs and release any unused slots after settlement.')) return;
    state.busy = true;
    state.action = 'complete';
    render();
    try {
      const data = await request('POST', `/claims/${encodeURIComponent(id)}/complete`);
      state.message = `Claim marked ${data.claim?.state || 'complete'}. ${data.claim?.slots_delivered ?? 'Verified'} losses currently recorded. FFScouter may keep it settling for about a minute.`;
      state.error = false;
      state.initialClaim = null;
    } catch (e) { state.message = e.message || String(e); state.error = true; }
    finally { state.busy = false; state.action = ''; render(); }
    void refreshAll();
  }

  shadow.addEventListener('input', e => {
    if (e.target.id === 'key') state.keyDraft = e.target.value;
    if (e.target.id === 'remember') state.rememberDraft = !!e.target.checked;
    if (e.target.id === 'receipt-message') state.receiptDraft = e.target.value;
    const order = e.target.getAttribute?.('data-slots');
    if (order) state.slotsDraft[order] = e.target.value === '' ? '' : Number(e.target.value);
  });
  shadow.addEventListener('click', e => {
    const button = e.target.closest?.('[data-act]');
    if (!button) return;
    const action = button.dataset.act;
    if (action === 'close') setOpen(false);
    if (action === 'check-update') void checkUpdates();
    if (action === 'install-update') openUpdateInstaller();
    if (action === 'tab-contracts') { state.tab='contracts'; render(); }
    if (action === 'tab-payouts') { state.tab='payouts'; render(); }
    if (action === 'clear-ledger') {
      if (window.confirm('Erase all locally tracked FFScouter claim history and matched receipt references for this API key? This cannot be undone and does not change any FFScouter contracts.')) {
        state.ledger={claims:{},receipts:[]}; state.ledgerAll[accountHash(state.key)]=state.ledger;
        void storeLedger(); flash('Local payout ledger cleared. FFScouter will reload claims from the last seven days on your next refresh.');
      }
    }
    if (action === 'scan-mail') void scanMail();
    if (action === 'receipt-import') importReceipt();
    if (action === 'export-ledger') {
      const exportCopy={exported_at:new Date().toISOString(),claims:state.ledger.claims,receipts:state.ledger.receipts};
      const json=JSON.stringify(exportCopy,null,2);
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(json).then(()=>flash('Ledger copied to clipboard.')).catch(()=>window.prompt('Copy this ledger:',json));
      else window.prompt('Copy this ledger:',json);
    }
    if (action === 'edit-key') { state.keyDraft = state.key; state.keyEditor = true; render(); }
    if (action === 'toggle-key') { state.showKey = !state.showKey; render(); }
    if (action === 'pda-key') { state.keyDraft = PDA_KEY; render(); }
    if (action === 'refresh') void refreshAll();
    if (action === 'connect') void connect();
    if (action === 'forget') void forget();
    if (action === 'claim') void claim(button.dataset.order, false);
    if (action === 'claim-max') void claim(button.dataset.order, true);
    if (action === 'complete') void complete(Number(button.dataset.id));
    if (action === 'attack') {
      const id = Number(button.dataset.target);
      if (Number.isSafeInteger(id) && id > 0) {
        setOpen(false);
        window.location.assign(`https://www.torn.com/loader.php?sid=attack&user2ID=${id}`);
      }
    }
  });
  shadow.querySelector('#tabs').addEventListener('click', e => {
    const tab = e.target.closest?.('[data-tab]');
    if (tab) { state.tab = tab.dataset.tab; render(); }
  });
  earlyLaunchAction = () => setOpen(!state.open);
  scrim.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.open) setOpen(false); });

  // Counts down locally every second; claims are reverified by FFScouter, never by the clock.
  setInterval(() => {
    if (!state.open) return;
    shadow.querySelectorAll('[data-deadline]').forEach(node => {
      const deadline = Number(node.getAttribute('data-deadline'));
      node.textContent = timeLeft(deadline);
      node.style.color = deadline && deadline - Date.now()/1000 < 60 ? '#ff918e' : '#f7c477';
    });
  }, 1000);
  // While browsing Torn, follow live claim delivery without ever automating an attack.
  setInterval(() => {
    if (document.hidden || !isKey(state.key) || state.refreshing || state.busy) return;
    const shouldCheckClaims = state.open || activeClaim();
    if (shouldCheckClaims) {
      void (async () => {
        try { await refreshClaims(); state.message = ''; state.error = false; }
        catch (e) { state.message = e.message || String(e); state.error = true; }
        if (state.open) render();
      })();
    }
    if (state.open && Date.now() - state.lastContractSync > 60000) {
      void refreshContracts().then(() => render()).catch(e => { state.message = e.message; state.error = true; render(); });
    }
  }, 12000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isKey(state.key) && Date.now() - state.lastSync > 15000) void refreshAll();
  });

  async function init() {
    state.key = sessGet(SESSION_KEY);
    if (nativeStore) {
      try {
        const saved = await PDA_storage.get(KEY_STORAGE, '');
        if (isKey(saved)) { state.remembered = true; if (!isKey(state.key)) state.key = saved; }
      } catch (e) { console.warn('[FFScouter Loss Desk] Saved key could not be loaded.'); }
    }
    if (!isKey(state.key) && isKey(PDA_KEY)) state.key = PDA_KEY;
    await loadLedger();
    state.keyDraft = state.key;
    state.rememberDraft = state.remembered;
    state.keyEditor = !isKey(state.key);
    render();
    setOpen(state.open);
    if (isKey(state.key)) void refreshAll();
  }
  // Torn is a single-page app and sometimes replaces parts of its root tree.
  // Keep the launcher mounted without creating additional event listeners.
  setInterval(() => {
    if (!host.isConnected && document.documentElement) document.documentElement.appendChild(host);
    mountEarlyLauncher();
  }, 2500);
  console.info('[FFContractor] v' + SCRIPT_VERSION + ' bottom chat tab initialized');
  void init().then(() => setOpen(true)).catch(e => {
    earlyLaunchAction = null;
    earlyLaunchProblem = 'FFContractor initialization failed: ' + (e && (e.message || String(e)));
    earlyLauncher.textContent = '!';
    earlyLauncher.style.setProperty('background','#a02028','important');
    console.error('[FFContractor]', e);
  });
  } catch (e) {
    dashboardLaunched=false;
    earlyLaunchAction = () => alert('FFContractor startup failed: ' + (e && (e.message || String(e))));
    earlyLaunchProblem = 'FFContractor startup error: ' + (e && (e.message || String(e)));
    earlyLauncher.textContent = '!';
    earlyLauncher.style.setProperty('background','#a02028','important');
    console.error('[FFContractor]', e);
  }
  }
  // The button is live immediately and dashboard code starts only upon tap.
  earlyLaunchAction = startDashboard;
  document.documentElement.setAttribute('data-ffcontractor-injected','0.6.1');
  mountEarlyLauncher();
})();