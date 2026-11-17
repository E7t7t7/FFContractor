// ==UserScript==
// @name         FFScouter Loss Desk - Torn PDA
// @namespace    https://ffscouter.com/
// @version      0.9.5
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
/* Pure mobile loss host. No DOM actions, credentials, network or storage are embedded here. */
(function (root) {
    'use strict';
    const meds = [{ id: 68, name: 'Small First Aid Kit', heal: 1200, cost: 600 }, { id: 67, name: 'First Aid Kit', heal: 2400, cost: 900 }, { id: 66, name: 'Morphine', heal: 4200, cost: 1200 }];
    function plan(hospital, cooldown, maximum, bonus, inventory, permissions) {
        if (!Number.isFinite(hospital) || hospital < 0 || hospital > 86400 || !Number.isFinite(cooldown) || cooldown < 0 || maximum < 21600 || maximum > 32400 || bonus < 0 || bonus > 50)
            throw Error('Invalid medical observation.');
        if (hospital === 0)
            return { state: 'Recovered' };
        if (cooldown >= maximum)
            return { state: 'Cooldown', waitSeconds: cooldown - maximum + 1 };
        const gains = meds.map(x => Math.floor(x.heal * (1 + bonus / 100))), limits = meds.map((x, i) => permissions[x.id] ? Math.min(Number(inventory[x.id] || 0), Math.ceil(hospital / gains[i])) : 0);
        if (limits.some(x => !Number.isSafeInteger(x) || x < 0))
            throw Error('Invalid personal medical inventory.');
        let best = null;
        for (let a = 0; a <= limits[0]; a++)
            for (let b = 0; b <= limits[1]; b++)
                for (let c = 0; c <= limits[2]; c++) {
                    const n = [a, b, c], cost = n.reduce((v, q, i) => v + q * meds[i].cost, 0), healing = n.reduce((v, q, i) => v + q * gains[i], 0), count = a + b + c, last = c ? 1200 : b ? 900 : a ? 600 : 0;
                    if (!count || healing < hospital || cooldown + cost - last >= maximum)
                        continue;
                    if (!best || cost < best.cost || cost === best.cost && count < best.count)
                        best = { cost, count, items: n.flatMap((q, i) => Array(q).fill(meds[i].id)) };
                }
        return best ? { state: 'Ready', ...best } : { state: 'Supplies', reason: 'Permitted personal supplies and medical capacity cannot end hospitalization.' };
    }
    function modifiers(perks) {
        let bonus = 0, maximum = 21600;
        for (const values of Object.values(perks || {}))
            for (const text of Array.isArray(values) ? values : []) {
                if (typeof text !== 'string')
                    continue;
                if (/medical item effectiveness/i.test(text)) {
                    const match = text.match(/(\d+(?:\.\d+)?)\s*%/);
                    if (!match)
                        throw Error('Unrecognized medical bonus.');
                    bonus += Number(match[1]);
                }
                if (/medical.*cooldown|cooldown.*medical/i.test(text)) {
                    const h = text.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i), m = text.match(/(\d+)\s*(?:minutes?|mins?)\b/i);
                    if (!h && !m)
                        throw Error('Unrecognized medical capacity.');
                    maximum = 21600 + Number((h === null || h === void 0 ? void 0 : h[1]) || 0) * 3600 + Number((m === null || m === void 0 ? void 0 : m[1]) || 0) * 60;
                }
            }
        if (bonus > 50 || maximum > 32400)
            throw Error('Unsupported medical modifiers.');
        return { bonus, maximum };
    }
    function verify(before, after, itemId, beforeInventory, afterInventory, elapsed) {
        const item = meds.find(x => x.id === itemId);
        if (!item || elapsed < 0 || elapsed > 180 || before.owner !== after.owner)
            return false;
        const expected = Math.max(0, before.cooldown - elapsed) + item.cost;
        return beforeInventory[itemId] - Number(afterInventory[itemId] || 0) === 1 && Math.abs(after.cooldown - expected) <= 12 && (after.until <= after.at && before.until > before.at || after.until < before.until - 30);
    }
    function receipt(rows, owner, target, started, seen) {
        return (rows || []).find(a => { var _a, _b; return ((_a = a.attacker) === null || _a === void 0 ? void 0 : _a.id) === owner && ((_b = a.defender) === null || _b === void 0 ? void 0 : _b.id) === target && a.started >= Math.floor(started / 1000) && a.ended > 0 && !seen.includes(a.id); });
    }
    function validateSession(s, owner, claim, now) {
        if (!Number.isSafeInteger(Number(claim === null || claim === void 0 ? void 0 : claim.slots_claimed)) || Number(claim.slots_claimed) < 1 || Number(claim.slots_claimed) > 1000000 || !Number.isSafeInteger(Number(claim.slots_delivered)) || Number(claim.slots_delivered) < 0 || Number(claim.slots_delivered) > Number(claim.slots_claimed))
            throw Error('Claim delivery quota is missing or invalid.');
        if (!s || s.owner !== owner || String(claim === null || claim === void 0 ? void 0 : claim.id) !== String(s.remoteId) || Number(claim.target_player_id) !== s.target || claim.state !== 'active')
            throw Error('The owning account or active claim changed.');
        const deadline = Math.min(Number(claim.expires_at) || 0, Number(claim.idle_deadline_at) || Infinity) * 1000;
        if (!deadline || deadline <= now)
            throw Error('The claim expired. No new attack authorized.');
        return deadline;
    }
    root.FFMobileCore = { meds, plan, modifiers, verify, receipt, validateSession };
})(typeof module === 'object' ? module.exports : globalThis);
// Independent in-page entry point. No credentials or network during startup.
(function () {
    'use strict';
    var version = '0.9.5', old = window.__FFContractorBoot;
    if (old && typeof old.dispose === 'function')
        old.dispose();
    var stopped = false, failure = '', stage = 'script entered', bar = document.createElement('div'), button = document.createElement('button'), info = document.createElement('button');
    bar.id = 'ffcontractor-entry';
    bar.setAttribute('data-ff-version', version);
    bar.style.cssText = 'all:initial!important;display:block!important;position:relative!important;clear:both!important;box-sizing:border-box!important;width:100%!important;min-height:38px!important;padding:5px 8px!important;background:#15374a!important;color:#fff!important;font:13px -apple-system,system-ui,sans-serif!important;z-index:2147483647!important;visibility:visible!important;opacity:1!important;';
    button.type = info.type = 'button';
    button.style.cssText = info.style.cssText = 'all:initial!important;display:inline-block!important;box-sizing:border-box!important;min-height:30px!important;padding:6px 10px!important;margin:0 5px 0 0!important;border:1px solid #73c3e4!important;border-radius:5px!important;background:#125a7b!important;color:white!important;font:bold 13px -apple-system,system-ui,sans-serif!important;cursor:pointer!important;';
    info.textContent = 'Startup info';
    bar.appendChild(button);
    bar.appendChild(info);
    function label() { button.textContent = failure ? 'FF v' + version + ' startup failed' : window.__FFContractor && window.__FFContractor.version === version && window.__FFContractor.ready ? 'Open FFContractor v' + version : 'FF v' + version + ' starting...'; }
    function mount() {
        if (stopped)
            return;
        var parent = document.body || document.documentElement;
        if (parent && bar.parentNode !== parent)
            parent.insertBefore(bar, parent.firstChild);
        label();
    }
    button.onclick = function () {
        var app = window.__FFContractor;
        if (app && app.version === version && app.ready && typeof app.show === 'function') {
            try {
                app.show();
            }
            catch (e) {
                fail(e, 'open panel');
            }
        }
        else
            info.onclick();
    };
    info.onclick = function () {
        var diagnostic = { version: version, stage: stage, error: failure || null, launcher: !!document.getElementById('ffcontractor-launcher'), entryAttached: !!bar.isConnected, ready: !!(window.__FFContractor && window.__FFContractor.version === version && window.__FFContractor.ready), viewport: { width: window.innerWidth, height: window.innerHeight }, bridge: typeof PDA_httpGet === 'function' ? 'TornPDA' : typeof GM_xmlhttpRequest === 'function' ? 'Commander' : 'unavailable' };
        window.prompt('FFContractor startup information (no keys or account data)', JSON.stringify(diagnostic));
    };
    function fail(e, at) { stage = at || stage; failure = String(e && e.name || 'Error') + ' during ' + stage; mount(); }
    window.__FFContractorBoot = { stage: function (value) { stage = value; label(); }, fail: fail, mount: mount, dispose: function () { stopped = true; clearInterval(timer); bar.remove(); } };
    mount();
    var timer = setInterval(mount, 1500);
    if (document.readyState === 'loading')
        document.addEventListener('DOMContentLoaded', mount, { once: true });
    window.addEventListener('pageshow', mount);
})();
try {
    (function () {
        'use strict';
        // Keep v0.7's proven plain-DOM launcher bootstrap and reinjection pattern.
        // Position recoverability is handled independently of FFScouter API startup.
        const VERSION = '0.9.5';
        const ROOT_URL = 'https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js';
        const API = 'https://ffscouter.com/api/v1/losses/seller';
        const ID = 'ffcontractor-launcher';
        if (window.__FFContractorBoot)
            window.__FFContractorBoot.stage('launcher setup');
        const old = document.getElementById(ID);
        const previous = window.__FFContractor;
        if (old && old.getAttribute('data-ff-version') === VERSION && previous && previous.ready && typeof old.onclick === 'function') {
            previous.mount();
            return;
        }
        if (previous && typeof previous.dispose === 'function')
            previous.dispose();
        let disposed = false;
        const timers = [];
        function every(fn, ms) { const id = setInterval(() => { if (!disposed)
            fn(); }, ms); timers.push(id); return id; }
        if (old)
            old.remove();
        const launch = document.createElement('button');
        launch.id = ID;
        launch.type = 'button';
        launch.textContent = '⚔ FF';
        launch.title = 'FFContractor v' + VERSION;
        launch.setAttribute('data-ff-version', VERSION);
        const CLASSIC_STYLE = 'all:initial!important;display:flex!important;align-items:center!important;justify-content:center!important;position:fixed!important;left:10px!important;bottom:calc(104px + env(safe-area-inset-bottom,0px))!important;width:62px!important;height:45px!important;background:#125a7b!important;color:#fff!important;font:bold 16px -apple-system,system-ui,sans-serif!important;border:2px solid #6ac9ee!important;border-radius:12px!important;box-shadow:0 5px 16px #0009!important;z-index:2147483647!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;touch-action:manipulation!important;';
        const SIDE_STYLE = 'all:initial!important;box-sizing:border-box!important;display:flex!important;align-items:center!important;justify-content:center!important;position:fixed!important;right:0!important;left:auto!important;top:50%!important;bottom:auto!important;width:42px!important;height:64px!important;padding:0!important;margin:0!important;white-space:pre!important;text-align:center!important;line-height:22px!important;background:linear-gradient(180deg,#1b789a,#10445f)!important;color:#fff!important;font:bold 14px -apple-system,system-ui,sans-serif!important;border:1px solid #4c91ac!important;border-radius:12px 0 0 12px!important;box-shadow:0 2px 12px #0009,inset 0 1px 0 #ffffff22!important;z-index:2147483647!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;cursor:grab!important;user-select:none!important;-webkit-user-select:none!important;touch-action:none!important;';
        launch.style.cssText = CLASSIC_STYLE;
        // Store only side and proportional vertical position, never absolute pixels.
        // This survives orientation changes and stays separate from the payout ledger.
        // Reset only tab placement once after the invisible-tab report; v1's stale
        // coordinates are intentionally ignored. API key and payout keys are unchanged.
        const DOCK_KEY = 'ffcontractor-tab-position-v2';
        const DOCK_DEFAULT = { side: 'right', fraction: 0.52 };
        const MODE_KEY = 'ffcontractor-launcher-mode-v1';
        let launcherMode = 'classic';
        try {
            if (localStorage.getItem(MODE_KEY) === 'side')
                launcherMode = 'side';
        }
        catch (_) { }
        function setMode(mode) {
            launcherMode = mode === 'side' ? 'side' : 'classic';
            try {
                localStorage.setItem(MODE_KEY, launcherMode);
            }
            catch (_) { }
            drag = null;
            placeLauncher();
            placePanel();
        }
        const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
        function sanitizeDock(raw) {
            return raw && (raw.side === 'left' || raw.side === 'right') && Number.isFinite(Number(raw.fraction))
                ? { side: raw.side, fraction: clamp(Number(raw.fraction), 0.08, 0.92) }
                : { ...DOCK_DEFAULT };
        }
        let dockStored = false;
        let dock = { ...DOCK_DEFAULT };
        try {
            const raw = localStorage.getItem(DOCK_KEY);
            if (raw) {
                dock = sanitizeDock(JSON.parse(raw));
                dockStored = true;
            }
        }
        catch (_) { }
        let drag = null, suppressClickUntil = 0, dockTouched = false;
        function viewport() {
            // iOS WKWebView can expose a larger layout viewport than the visible
            // screen after zooming, rotating or navigating between Torn pages.
            const width = Math.max(240, window.innerWidth || document.documentElement.clientWidth || 400);
            const height = Math.max(260, window.innerHeight || document.documentElement.clientHeight || 700);
            const vv = window.visualViewport;
            const w = vv && vv.width > 120 ? Math.min(width, vv.width) : width;
            const h = vv && vv.height > 140 ? Math.min(height, vv.height) : height;
            const x = vv && Number.isFinite(vv.offsetLeft) ? clamp(vv.offsetLeft, 0, Math.max(0, width - w)) : 0;
            const y = vv && Number.isFinite(vv.offsetTop) ? clamp(vv.offsetTop, 0, Math.max(0, height - h)) : 0;
            return { w, h, x, y };
        }
        function launcherTop() {
            const v = viewport();
            const min = v.y + Math.min(24, Math.max(8, v.h - 64));
            const max = Math.max(min, v.y + v.h - 64 - 18);
            return Math.round(clamp(v.y + dock.fraction * v.h - 32, min, max));
        }
        function placeLauncher() {
            if (drag)
                return;
            if (launcherMode === 'classic') {
                launch.style.cssText = CLASSIC_STYLE;
                launch.textContent = '⚔ FF';
                return;
            }
            launch.style.cssText = SIDE_STYLE;
            launch.textContent = '⚔\nFF';
            const v = viewport(), x = dock.side === 'left' ? v.x : Math.max(v.x, v.x + v.w - 42);
            // Use pixel X rather than CSS right:0 (which can be outside the
            // visible area in a zoomed TornPDA WebView).
            launch.style.setProperty('position', 'fixed', 'important');
            launch.style.setProperty('top', launcherTop() + 'px', 'important');
            launch.style.setProperty('bottom', 'auto', 'important');
            launch.style.setProperty('left', Math.round(x) + 'px', 'important');
            launch.style.setProperty('right', 'auto', 'important');
            launch.style.setProperty('display', 'flex', 'important');
            launch.style.setProperty('visibility', 'visible', 'important');
            launch.style.setProperty('opacity', '1', 'important');
            launch.style.setProperty('border-radius', dock.side === 'left' ? '0 12px 12px 0' : '12px 0 0 12px', 'important');
        }
        function saveDock() {
            dockTouched = true;
            try {
                localStorage.setItem(DOCK_KEY, JSON.stringify(dock));
            }
            catch (_) { }
            try {
                if (typeof PDA_storage !== 'undefined' && typeof PDA_storage.set === 'function')
                    Promise.resolve(PDA_storage.set(DOCK_KEY, dock)).catch(() => { });
            }
            catch (_) { }
        }
        function setDock(side, fraction) {
            launcherMode = 'side';
            try {
                localStorage.setItem(MODE_KEY, 'side');
            }
            catch (_) { }
            dock = sanitizeDock({ side: side, fraction: fraction });
            saveDock();
            placeLauncher();
            placePanel();
        }
        // Read native TornPDA storage only as fallback; don't delay showing the tab.
        if (!dockStored) {
            try {
                if (typeof PDA_storage !== 'undefined' && typeof PDA_storage.get === 'function')
                    Promise.resolve(PDA_storage.get(DOCK_KEY, null)).then(value => {
                        if (!dockTouched && value) {
                            dock = sanitizeDock(value);
                            placeLauncher();
                            placePanel();
                        }
                    }).catch(() => { });
            }
            catch (_) { }
        }
        launch.addEventListener('pointerdown', e => {
            if (launcherMode !== 'side')
                return;
            if (e.button !== undefined && e.button !== 0)
                return;
            const rect = launch.getBoundingClientRect(), v = viewport();
            drag = { id: e.pointerId, x: e.clientX, y: e.clientY,
                left: Number.isFinite(rect.left) ? rect.left : (dock.side === 'left' ? 0 : v.w - 42),
                top: Number.isFinite(rect.top) ? rect.top : launcherTop(), moved: false, started: Date.now() };
            try {
                launch.setPointerCapture(e.pointerId);
            }
            catch (_) { }
        });
        launch.addEventListener('pointermove', e => {
            if (!drag || e.pointerId !== drag.id)
                return;
            const dx = e.clientX - drag.x, dy = e.clientY - drag.y, v = viewport();
            if (Math.hypot(dx, dy) > 7)
                drag.moved = true;
            if (!drag.moved)
                return;
            e.preventDefault();
            launch.style.setProperty('left', Math.round(clamp(drag.left + dx, v.x, v.x + v.w - 42)) + 'px', 'important');
            launch.style.setProperty('right', 'auto', 'important');
            launch.style.setProperty('top', Math.round(clamp(drag.top + dy, v.y + 12, Math.max(v.y + 12, v.y + v.h - 76))) + 'px', 'important');
        });
        function finishDrag(e, cancelled) {
            if (!drag || e.pointerId !== drag.id)
                return;
            const previous = drag;
            drag = null;
            try {
                launch.releasePointerCapture(e.pointerId);
            }
            catch (_) { }
            if (previous.moved) {
                suppressClickUntil = Date.now() + 650;
                if (!cancelled) {
                    const v = viewport();
                    const top = clamp(previous.top + (e.clientY - previous.y), v.y + 12, Math.max(v.y + 12, v.y + v.h - 76));
                    dock = { side: e.clientX < v.x + v.w / 2 ? 'left' : 'right',
                        fraction: clamp((top - v.y + 32) / v.h, 0.08, 0.92) };
                    saveDock();
                }
            }
            placeLauncher();
            if (opened)
                placePanel();
        }
        launch.addEventListener('pointerup', e => finishDrag(e, false));
        launch.addEventListener('pointercancel', e => finishDrag(e, true));
        launch.addEventListener('lostpointercapture', () => {
            // iOS may cancel touch capture when the app bar changes or a page reloads.
            if (drag) {
                drag = null;
                placeLauncher();
            }
        });
        if (!('PointerEvent' in window)) {
            const touchEvent = (e, end) => { const t = (end ? e.changedTouches : e.touches)[0]; return t ? { pointerId: 1, button: 0, clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault() } : null; };
            launch.addEventListener('touchstart', e => { if (launcherMode !== 'side')
                return; const t = touchEvent(e, false); if (t) {
                const r = launch.getBoundingClientRect();
                drag = { id: 1, x: t.clientX, y: t.clientY, left: r.left, top: r.top, moved: false, started: Date.now() };
            } }, { passive: true });
            launch.addEventListener('touchmove', e => { const t = touchEvent(e, false); if (!t || !drag)
                return; const v = viewport(), dx = t.clientX - drag.x, dy = t.clientY - drag.y; if (Math.hypot(dx, dy) > 7)
                drag.moved = true; if (drag.moved) {
                e.preventDefault();
                launch.style.setProperty('left', Math.round(clamp(drag.left + dx, v.x, v.x + v.w - 42)) + 'px', 'important');
                launch.style.setProperty('top', Math.round(clamp(drag.top + dy, v.y + 12, v.y + v.h - 76)) + 'px', 'important');
            } }, { passive: false });
            launch.addEventListener('touchend', e => { const t = touchEvent(e, true); if (t)
                finishDrag(t, false); });
            launch.addEventListener('touchcancel', e => { const t = touchEvent(e, true); if (t)
                finishDrag(t, true); });
        }
        function mount() {
            if (disposed)
                return;
            const parent = document.documentElement || document.body;
            if (parent && launch.parentNode !== parent)
                parent.appendChild(launch);
            if (drag && Date.now() - drag.started > 6500)
                drag = null;
            placeLauncher();
            // Panel reattachment happens after panel state initializes; mount() also
            // runs early before the dashboard's let bindings exist.
        }
        mount();
        if (window.__FFContractorBoot)
            window.__FFContractorBoot.stage('launcher mounted');
        if (document.readyState === 'loading')
            document.addEventListener('DOMContentLoaded', mount, { once: true });
        window.addEventListener('pageshow', mount);
        window.addEventListener('resize', mount);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', mount);
            window.visualViewport.addEventListener('scroll', mount);
        }
        window.addEventListener('focus', mount);
        window.addEventListener('hashchange', mount);
        window.addEventListener('popstate', mount);
        document.addEventListener('visibilitychange', function () { if (!document.hidden)
            mount(); });
        every(mount, 1500);
        let panel, status, tab = 'Overview', opened = false, apiKey = '', remember = false, busy = false;
        // Torn may replace its body after the modal has already opened.
        every(() => {
            if (opened && panel && !panel.isConnected) {
                buildPanel();
                render();
            }
            else if (opened && panel)
                placePanel();
        }, 1900);
        let contracts = [], claims = [], cap = 0, lastSync = 0, errorText = '', notice = '', verifying = false;
        let pendingAll = {}, claimsCheckedAt = 0, ownerPlayer = 0;
        const PENDING_STORAGE = 'ffcontractor-pending-v1';
        const pending = () => pendingAll[hash(apiKey)];
        async function setPending(value) { if (value)
            pendingAll[hash(apiKey)] = value;
        else
            delete pendingAll[hash(apiKey)]; await nativeSet(PENDING_STORAGE, pendingAll); if (value) {
            const saved = await nativeGet(PENDING_STORAGE, {});
            if (!saved[hash(apiKey)] || saved[hash(apiKey)].nonce !== value.nonce)
                throw Error('Could not save the request guard. No reservation sent.');
        } }
        let ledgerAll = {}, currentLedger = { claims: {}, receipts: [] };
        const KEY_STORAGE = 'ffscouter-loss-desk-key-v1';
        const LEDGER_STORAGE = 'ffscouter-loss-desk-ledger-v2';
        const stateKey = 'ffscouter-loss-desk-session-key-v1';
        const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        const money = v => '$' + (Number(v) || 0).toLocaleString('en-US');
        const isKey = k => /^[a-z0-9]{16}$/i.test(k || '');
        function hash(k) { let n = 2166136261; for (let i = 0; i < k.length; i++)
            n = Math.imul(n ^ k.charCodeAt(i), 16777619); return (n >>> 0).toString(36); }
        function getSession() { try {
            return sessionStorage.getItem(stateKey) || '';
        }
        catch (_) {
            return '';
        } }
        function setSession(k) { try {
            sessionStorage.setItem(stateKey, k);
        }
        catch (_) { } }
        function getStore(k, fallback) { try {
            return localStorage.getItem(k) ? JSON.parse(localStorage.getItem(k)) : fallback;
        }
        catch (_) {
            return fallback;
        } }
        function setStore(k, v) { try {
            localStorage.setItem(k, JSON.stringify(v));
        }
        catch (_) { } }
        async function nativeGet(k, fallback) { try {
            if (typeof PDA_storage !== 'undefined' && PDA_storage.get)
                return await PDA_storage.get(k, fallback);
        }
        catch (_) { } return getStore(k, fallback); }
        async function nativeSet(k, v) { try {
            if (typeof PDA_storage !== 'undefined' && PDA_storage.set)
                return await PDA_storage.set(k, v);
        }
        catch (_) { } setStore(k, v); }
        async function nativeDelete(k) { try {
            if (typeof PDA_storage !== 'undefined' && PDA_storage.delete)
                return await PDA_storage.delete(k);
        }
        catch (_) { } try {
            localStorage.removeItem(k);
        }
        catch (_) { } }
        function activateLedger() { const l = ledgerAll[hash(apiKey)]; currentLedger = l && typeof l === 'object' ? l : { claims: {}, receipts: [] }; if (!currentLedger.claims)
            currentLedger.claims = {}; if (!Array.isArray(currentLedger.receipts))
            currentLedger.receipts = []; }
        function saveLedger() { ledgerAll[hash(apiKey)] = currentLedger; return nativeSet(LEDGER_STORAGE, ledgerAll); }
        function paid(c) { return !c.payment_review_required && (c.payment_status === 'resolved' || Number(c.paid_at) > 0); }
        // The seller API may expose a target ID under different field names on a
        // contract, a newly reserved claim, or a refreshed active claim. Never use
        // the claim ID or order number as the target.
        function positiveTornId(v) {
            if (typeof v !== 'string' && typeof v !== 'number')
                return 0;
            const t = String(v).trim();
            if (!/^\d{1,12}$/.test(t))
                return 0;
            const n = Number(t);
            return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? n : 0;
        }
        function tornIdFromUrl(raw) {
            if (typeof raw !== 'string' || !raw || raw.length > 2048)
                return 0;
            try {
                const u = new URL(raw, 'https://www.torn.com');
                if (u.protocol !== 'https:' || !['torn.com', 'www.torn.com'].includes(u.hostname))
                    return 0;
                for (const key of ['user2ID', 'user2Id', 'XID', 'xid']) {
                    const id = positiveTornId(u.searchParams.get(key));
                    if (id)
                        return id;
                }
                return 0;
            }
            catch (_) {
                return 0;
            }
        }
        function targetIdFrom(c) {
            if (!c || typeof c !== 'object')
                return 0;
            for (const key of ['target_player_id', 'target_user_id', 'target_id', 'target_torn_id',
                'target_xid', 'targetId', 'targetPlayerId', 'targetUserId', 'user2ID', 'user2Id']) {
                const id = positiveTornId(c[key]);
                if (id)
                    return id;
            }
            if (c.target) {
                const scalar = positiveTornId(c.target);
                if (scalar)
                    return scalar;
                if (typeof c.target === 'object') {
                    for (const key of ['player_id', 'user_id', 'id', 'torn_id', 'xid', 'target_id']) {
                        const id = positiveTornId(c.target[key]);
                        if (id)
                            return id;
                    }
                }
            }
            for (const key of ['attack_url', 'target_url', 'target_profile_url', 'profile_url', 'target_link']) {
                const id = tornIdFromUrl(c[key]);
                if (id)
                    return id;
            }
            for (const key of ['order', 'contract']) {
                const nested = c[key];
                if (nested && typeof nested === 'object') {
                    const id = targetIdFrom(nested);
                    if (id)
                        return id;
                }
            }
            return 0;
        }
        function matchContract(c) {
            return contracts.find(x => String(x.order_number || '') === String(c.order_number || ''));
        }
        function claimWithTarget(c) {
            const ledger = currentLedger.claims[String(c.id || '')] || {};
            const id = targetIdFrom(c) || targetIdFrom(ledger) || targetIdFrom(matchContract(c));
            return id ? { ...c, target_player_id: id } : c;
        }
        function attackLink(id) {
            return 'https://www.torn.com/page.php?sid=attack&user2ID=' + id;
        }
        function mergeLedger(data) {
            let changed = false;
            for (const c of data) {
                const id = String(c.id || '');
                if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) <= 0)
                    continue;
                const prev = currentLedger.claims[id] || {};
                const next = { ...prev, id: c.id, order_number: c.order_number || prev.order_number || '', state: c.state || prev.state || '',
                    slots_delivered: Number(c.slots_delivered == null ? prev.slots_delivered || 0 : c.slots_delivered),
                    slots_claimed: Number(c.slots_claimed == null ? prev.slots_claimed || 0 : c.slots_claimed),
                    earnings: Number(c.earnings == null ? prev.earnings || 0 : c.earnings),
                    paid_at: Object.prototype.hasOwnProperty.call(c, 'paid_at') ? Number(c.paid_at || 0) : Number(prev.paid_at || 0), payment_status: Object.prototype.hasOwnProperty.call(c, 'payment_status') ? (c.payment_status || '') : (prev.payment_status || ''), payment_review_required: Object.prototype.hasOwnProperty.call(c, 'payment_review_required') ? !!c.payment_review_required : !!prev.payment_review_required,
                    claimed_at: Number(c.claimed_at || prev.claimed_at || 0),
                    price_per_loss: Number(c.price_per_loss == null ? prev.price_per_loss || 0 : c.price_per_loss),
                    expires_at: Number(c.expires_at == null ? prev.expires_at || 0 : c.expires_at),
                    idle_deadline_at: Object.prototype.hasOwnProperty.call(c, 'idle_deadline_at') ? Number(c.idle_deadline_at || 0) : Number(prev.idle_deadline_at || 0),
                    completed_at: Object.prototype.hasOwnProperty.call(c, 'completed_at') ? Number(c.completed_at || 0) : Number(prev.completed_at || 0),
                    hits: Array.from(new Map([...(prev.hits || []), ...(c.hits || [])].filter(x => Number.isSafeInteger(Number(x.attack_id)) && Number(x.attack_id) > 0).map(x => [String(x.attack_id), x])).values()),
                    target_player_id: targetIdFrom(c) || targetIdFrom(prev) || 0 };
                if (JSON.stringify(prev) !== JSON.stringify(next)) {
                    currentLedger.claims[id] = next;
                    changed = true;
                }
            }
            if (changed)
                void saveLedger();
        }
        function summarize() {
            const all = Object.values(currentLedger.claims);
            const due = all.filter(c => !paid(c) && Number(c.earnings) > 0);
            return [
                ['Total paid', money(all.filter(paid).reduce((a, c) => a + Number(c.earnings || 0), 0))],
                ['Outstanding', money(due.reduce((a, c) => a + Number(c.earnings || 0), 0))],
                ['Total earned', money(all.reduce((a, c) => a + Number(c.earnings || 0), 0))],
                ['Losses completed', String(all.reduce((a, c) => a + Number(c.slots_delivered || 0), 0))],
                ['Contracts finished', String(all.filter(c => c.state === 'fulfilled' || c.state === 'expired').length)],
                ['Available contracts', String(contracts.length)],
                ['Active claims', String(claims.filter(c => c.state === 'active').length)],
                ['Payments pending', String(due.length)]
            ];
        }
        function css() {
            if (document.getElementById('ffcontractor-css'))
                return;
            const st = document.createElement('style');
            st.id = 'ffcontractor-css';
            st.textContent = `
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
            if (!panel)
                return;
            const v = viewport(), width = Math.round(Math.max(180, Math.min(460, v.w - 60)));
            const height = Math.round(Math.max(180, Math.min(690, v.h * 0.68, v.h - 24)));
            const top = Math.round(clamp(launcherTop() + 32 - height * 0.53, v.y + 12, Math.max(v.y + 12, v.y + v.h - height - 12)));
            const left = Math.round(launcherMode === 'classic' ? v.x + 10 : dock.side === 'left' ? v.x + 48 : v.x + v.w - 48 - width);
            panel.style.setProperty('width', width + 'px', 'important');
            panel.style.setProperty('height', height + 'px', 'important');
            panel.style.setProperty('top', (launcherMode === 'classic' ? Math.max(v.y + 12, v.y + v.h - 104 - 45 - height - 10) : top) + 'px', 'important');
            panel.style.setProperty('bottom', 'auto', 'important');
            panel.style.setProperty('left', left + 'px', 'important');
            panel.style.setProperty('right', 'auto', 'important');
        }
        function buildPanel() {
            css();
            if (panel && panel.isConnected)
                return;
            panel = document.createElement('div');
            panel.id = 'ffcontractor-panel';
            panel.innerHTML = `<div class="ff-top"><strong style="flex:1">⚔ FFContractor <span class="ff-small">v${VERSION}</span></strong><button data-action="refresh">↻</button><button data-action="update">⇧</button><button data-action="close">✕</button></div><div class="ff-tabs">${['Overview', 'Contracts', 'Mobile Session', 'Payouts', 'Settings'].map(x => `<button data-tab="${x}">${x}</button>`).join('')}</div><div class="ff-scroll"></div>`;
            (document.documentElement || document.body).appendChild(panel);
            panel.addEventListener('click', handleClick);
            placePanel();
        }
        function render() {
            if (!panel)
                return;
            panel.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('current', b.dataset.tab === tab));
            const scroll = panel.querySelector('.ff-scroll');
            const oldScroll = scroll.scrollTop;
            const mobileDraft = Array.from(panel.querySelectorAll('[id^="ff-mobile-"]')).map(el => ({ id: el.id, value: el.value, checked: el.checked }));
            let html = '';
            if (errorText)
                html += `<div class="ff-error">${esc(errorText)}</div>`;
            else if (notice)
                html += `<div class="ff-note">${esc(notice)}</div>`;
            const active = claims.find(c => c.state === 'active');
            if (tab === 'Overview') {
                html += `<div class="ff-grid">${summarize().map(([name, v]) => `<div class="ff-stat"><div class="ff-label">${esc(name)}</div><div class="ff-number">${esc(v)}</div></div>`).join('')}</div>`;
                html += `<p class="ff-small">Locally recorded totals begin when FFContractor first records your claims. Confirmed paid status comes from FFScouter.</p>`;
                if (active)
                    html += activeMarkup(active);
                else
                    html += '<div class="ff-card">No active claim. Open Contracts to reserve losses.</div>';
                html += '<div class="ff-row"><button class="ff-primary" data-action="contracts">Browse contracts</button><button data-action="payouts">Payout history</button></div>';
            }
            else if (tab === 'Contracts') {
                if (active)
                    html += activeMarkup(active);
                html += `<h3>Available contracts</h3>`;
                if (!contracts.length)
                    html += '<div class="ff-card">No eligible contracts loaded or available. Tap ↻ to refresh.</div>';
                for (const c of contracts) {
                    const count = Math.max(0, Math.min(Number(c.slots_available) || 0, cap));
                    html += `<div class="ff-card"><strong>${esc(c.order_number || 'Contract')}</strong> · <strong>${money(c.price_per_loss)}/loss</strong><div class="ff-small">${Number(c.slots_available) || 0} slots available · You can claim up to ${count}</div><div class="ff-row"><input type="number" inputmode="numeric" min="1" max="${count}" value="${Math.min(4, count)}" data-order-input="${esc(c.order_number)}" style="flex:0 0 70px" ${active || busy || count === 0 ? 'disabled' : ''}><button data-action="claim" data-order="${esc(c.order_number)}" ${active || busy || count === 0 ? 'disabled' : ''}>Claim</button><button class="ff-primary" data-action="claimmax" data-order="${esc(c.order_number)}" ${active || busy || count === 0 ? 'disabled' : ''}>Claim max</button></div></div>`;
                }
                html += '<h3>Recent claims</h3>';
                for (const c of claims.slice(0, 10))
                    html += `<div class="ff-card"><strong>${esc(c.order_number || c.id)}</strong><div class="ff-small">${esc(c.state)} · ${c.slots_delivered || 0}/${c.slots_claimed || 0} verified · ${money(c.earnings)} · ${esc(c.payment_status || 'pending')}</div></div>`;
            }
            else if (tab === 'Mobile Session') {
                html += mobileHtml();
            }
            else if (tab === 'Payouts') {
                const entries = Object.values(currentLedger.claims).sort((a, b) => (b.claimed_at || 0) - (a.claimed_at || 0));
                html += '<p class="ff-small">FFScouter payment status is authoritative. Message matches are references only, not proof of payment.</p>';
                html += '<div class="ff-row"><button data-action="scanmail">Scan mail subjects & events</button><button data-action="export">Copy ledger</button></div>';
                html += '<h3>Paste a payout reference</h3><textarea id="ff-receipt" rows="3" placeholder="Paste a message containing a claim or order ID" style="width:100%"></textarea><button data-action="match" style="width:100%;margin-top:6px">Match payout message</button>';
                html += '<h3>Tracked claims</h3>';
                if (!entries.length)
                    html += '<div class="ff-card">No claims recorded yet.</div>';
                for (const c of entries)
                    html += `<div class="ff-card"><strong>${esc(c.order_number || c.id)}</strong> · ${money(c.earnings)}<div class="ff-small">${paid(c) ? 'Paid (FFScouter confirmed)' : 'Pending / unconfirmed'} · ${c.slots_delivered || 0} verified losses</div></div>`;
                if (currentLedger.receipts.length)
                    html += `<div class="ff-small">${currentLedger.receipts.length} matched message references retained locally.</div>`;
            }
            else {
                html += `<div class="ff-card"><div><strong>FFScouter API key</strong></div><div class="ff-row"><input id="ff-api-key" type="password" placeholder="16-character key" autocomplete="off" value="${esc(apiKey)}" style="width:100%"><button class="ff-primary" data-action="connect">${isKey(apiKey) ? 'Reconnect' : 'Connect'}</button></div><label class="ff-small"><input id="ff-remember" type="checkbox" ${remember ? 'checked' : ''}> Remember key on this device</label></div>`;
                html += `<div class="ff-card"><strong>Launcher</strong><p class="ff-small">Classic floating button is the previously working layout, above the bottom toolbar. Draggable side tab is optional. Switching back to Classic ignores saved side coordinates; credentials and history stay intact.</p><div class="ff-row"><button data-action="classiclauncher">Classic floating</button><button data-action="sidelauncher">Draggable side</button></div><p class="ff-small">Side-tab position:</p><div class="ff-row"><button data-action="dockleft">${dock.side === 'left' ? '✓ ' : ''}Left</button><button data-action="dockright">${dock.side === 'right' ? '✓ ' : ''}Right</button><button data-action="dockreset">Reset</button></div></div>`;
                html += `<div class="ff-card"><strong>GitHub updates</strong><p class="ff-small">Installed v${VERSION}. TornPDA handles updates from your original remote URL.</p><button data-action="update">Check GitHub for updates</button></div>`;
                html += '<div class="ff-card"><a href="https://ffscouter.com/sell-losses">Seller rules / data policy</a> · <a href="https://ffscouter.com/api-docs/guidance">API guidance</a><p class="ff-small">Standalone in TornPDA or optional inside Commander. The desktop can watch NEW claims when explicitly armed; no PC is required for mobile use. Older phone history is not automatically copied. Consider FFScouter premium to support the provider.</p></div>';
                html += '<button data-action="forget">Forget API key</button>';
            }
            if (!isKey(apiKey) && tab !== 'Settings')
                html = '<div class="ff-note">Add your FFScouter API key in Settings to load contracts.</div>' + html;
            if (pending())
                html = '<div class="ff-note">A reservation/completion may have succeeded. Refresh claims before retrying. <button data-action="clear-pending">Reviewed claims — clear request guard</button></div>' + html;
            scroll.innerHTML = html;
            for (const draft of mobileDraft) {
                const el = panel.querySelector('#' + draft.id);
                if (el) {
                    el.value = draft.value;
                    el.checked = draft.checked;
                }
            }
            scroll.scrollTop = oldScroll;
        }
        function activeMarkup(c) {
            const id = targetIdFrom(claimWithTarget(c));
            const action = id
                ? '<a class="ff-target-link" data-action="attack" href="' + attackLink(id) + '">⚔ Attack now</a>'
                : '<button type="button" data-action="locate-target" data-order="' + esc(c.order_number || '') + '" data-claim-id="' + esc(c.id || '') + '">Find target</button>';
            return '<div class="ff-card"><strong>Active: ' + esc(c.order_number || c.id) + '</strong>' +
                '<div class="ff-small">' + (Number(c.slots_delivered) || 0) + '/' + (Number(c.slots_claimed) || 0) +
                ' verified · ' + money(c.earnings || 0) + ' earned' + (id ? ' · Target [' + id + ']' : '') + '</div>' +
                '<div class="ff-row">' + action + '<button data-action="complete" data-id="' + Number(c.id) + '">Mark complete</button></div>' +
                (!id ? '<div class="ff-small">Target ID was not included with the refreshed claim. Tap Find target to check the order details. If unavailable, <a href="https://ffscouter.com/sell-losses">open your official FFScouter claims</a>.</div>' :
                    '<div class="ff-small">Opens the Torn attack page in this browser. Perform your losses manually.</div>') + '</div>';
        }
        function setOpen(value) {
            opened = !!value;
            buildPanel();
            panel.classList.toggle('ff-open', opened);
            launch.textContent = opened ? '×\nFF' : '⚔\nFF';
            placePanel();
            if (opened) {
                render();
                if (isKey(apiKey) && Date.now() - lastSync > 15000)
                    void refresh();
            }
        }
        async function sendHttp(method, url, headers, body) {
            if (method === 'GET' && typeof PDA_httpGet === 'function')
                return await PDA_httpGet(url, headers);
            if (method === 'POST' && typeof PDA_httpPost === 'function')
                return await PDA_httpPost(url, headers, body);
            if (typeof GM_xmlhttpRequest === 'function')
                return await new Promise((resolve, reject) => GM_xmlhttpRequest({ method, url, headers, data: body, timeout: 25000, onload: resolve, onerror: () => reject(Error('Connection interrupted; refresh claims before retrying.')), ontimeout: () => reject(Error('Request timed out; refresh claims before retrying.')) }));
            throw Error('Use TornPDA on mobile or install this script in Torn Commander. HTTP bridge unavailable.');
        }
        async function request(method, path, body, base = API) {
            if (!isKey(apiKey))
                throw Error('Enter your 16-character FFScouter API key in Settings.');
            let r;
            if (method === 'GET') {
                r = await sendHttp('GET', base + path + (path.includes('?') ? '&' : '?') + 'key=' + encodeURIComponent(apiKey), { Accept: 'application/json' });
            }
            else {
                r = await sendHttp('POST', base + path + '?key=' + encodeURIComponent(apiKey), { Accept: 'application/json', 'Content-Type': 'application/json' }, JSON.stringify(body || {}));
            }
            let json;
            try {
                json = typeof r.responseText === 'string' ? JSON.parse(r.responseText) : r.responseText;
            }
            catch (_) {
                throw Error('Server returned invalid JSON');
            }
            if (Number(r.status) < 200 || Number(r.status) >= 300 || !json || json.error)
                throw Error(String(json && json.error || json && json.message || 'HTTP ' + r.status).split(apiKey).join('[redacted]'));
            return json;
        }
        async function refresh() {
            if (busy || !isKey(apiKey))
                return;
            busy = true;
            notice = 'Loading FFScouter…';
            errorText = '';
            render();
            const results = await Promise.all([request('GET', '/contracts'), request('GET', '/claims')].map(p => p.then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }))));
            const fails = [];
            if (results[0].status === 'fulfilled') {
                const obj = results[0].value;
                contracts = Array.isArray(obj.contracts) ? obj.contracts : [];
                cap = Math.max(0, Number(obj.max_claim_slots) || 0);
            }
            else
                fails.push(String(results[0].reason.message || results[0].reason));
            if (results[1].status === 'fulfilled') {
                claims = Array.isArray(results[1].value.claims) ? results[1].value.claims.map(claimWithTarget) : [];
                mergeLedger(claims);
                claimsCheckedAt = Date.now();
                const p = pending();
                if (p && ((p.type === 'claim' && claims.some(c => String(c.order_number) === p.order && !(p.known || []).includes(String(c.id)) && Number(c.claimed_at) >= p.at - 5)) || (p.type === 'complete' && claims.some(c => String(c.id) === p.id && c.state !== 'active'))))
                    await setPending(null);
            }
            else
                fails.push(String(results[1].reason.message || results[1].reason));
            errorText = fails.join(' · ');
            notice = fails.length ? '' : 'Updated successfully';
            lastSync = Date.now();
            busy = false;
            render();
        }
        async function connect() {
            if (busy || pending()) {
                errorText = "Reconcile the current request before changing seller accounts.";
                render();
                return;
            }
            const key = String((panel.querySelector('#ff-api-key') || {}).value || '').trim();
            if (!isKey(key)) {
                errorText = 'API key must be 16 letters/numbers.';
                render();
                return;
            }
            ownerPlayer = 0;
            apiKey = key;
            remember = !!(panel.querySelector('#ff-remember') || {}).checked;
            setSession(key);
            activateLedger();
            if (remember)
                await nativeSet(KEY_STORAGE, key);
            else
                await nativeDelete(KEY_STORAGE);
            try {
                const identity = await request('GET', '/account/balance', null, 'https://ffscouter.com/api/v1');
                ownerPlayer = positiveTornId(identity.player_id);
            }
            catch (_) { }
            tab = 'Overview';
            await refresh();
        }
        async function claim(order, max) {
            const c = contracts.find(c => String(c.order_number) === order);
            if (!c || busy)
                return;
            if (pending()) {
                errorText = 'Previous request needs reconciliation. Refresh claims; do not reserve twice.';
                render();
                return;
            }
            if (claims.some(c => c.state === 'active' && Number(c.expires_at) > Date.now() / 1000)) {
                errorText = 'Only one active claim is allowed. Complete the existing claim first.';
                render();
                return;
            }
            if (Date.now() - lastSync > 45000 || !claimsCheckedAt || Date.now() - claimsCheckedAt > 45000) {
                errorText = 'Refresh seller data before reserving.';
                render();
                return;
            }
            const limit = Math.max(0, Math.min(Number(c.slots_available) || 0, cap));
            const input = panel.querySelectorAll('[data-order-input]');
            let num = 0;
            input.forEach(x => { if (x.getAttribute('data-order-input') === order)
                num = Number(x.value); });
            const count = max ? limit : num;
            if (!Number.isInteger(count) || count < 1 || count > limit) {
                errorText = 'Select a valid number of losses.';
                render();
                return;
            }
            if (!window.confirm('Reserve ' + count + ' losses on ' + order + '? FFScouter starts its claim timers immediately.'))
                return;
            busy = true;
            render();
            try {
                await setPending({ type: 'claim', order, known: claims.map(x => String(x.id)), at: Math.floor(Date.now() / 1000), nonce: Date.now() + '-' + Math.random() });
                const r = await request('POST', '/claim', { order_number: order, slots: count });
                if (!r.claim || !positiveTornId(r.claim.target_player_id) || !Number.isSafeInteger(Number(r.claim.id)) || Number(r.claim.id) <= 0 || ((pending() || {}).known || []).includes(String(r.claim.id)) || Number(r.claim.slots_claimed) < 1 || Number(r.claim.slots_claimed) > count || String(r.claim.order_number) !== order)
                    throw Error('Reservation response incomplete; refresh to reconcile.');
                notice = 'Claim reserved. If Commander is armed at home it can discover this claim; avoid attacking it on both devices at once.';
                errorText = '';
                if (r.claim) {
                    const fresh = claimWithTarget({ ...r.claim, state: r.claim.state || 'active', claimed_at: r.claim.claimed_at || Math.floor(Date.now() / 1000), price_per_loss: c.price_per_loss, order_number: r.claim.order_number || order });
                    mergeLedger([fresh]);
                    claims = [fresh, ...claims.filter(x => String(x.id) !== String(fresh.id))];
                }
                await saveLedger();
                await setPending(null);
                await refreshAfterAction();
            }
            catch (e) {
                errorText = String(e.message || e);
                busy = false;
                render();
            }
        }
        async function locateTarget(order, claimId) {
            if (!order) {
                errorText = 'This claim has no order reference. Open FFScouter Sell Losses for the official target link.';
                render();
                return;
            }
            notice = 'Checking FFScouter for target details…';
            errorText = '';
            render();
            try {
                const data = await request('GET', '/orders/' + encodeURIComponent(order));
                const candidates = [data, (data || {}).order, (data || {}).contract, (data || {}).claim,
                    ...(Array.isArray((data || {}).claims) ? data.claims.filter(c => String(c.id) === String(claimId)) : [])];
                const id = candidates.map(targetIdFrom).find(Boolean) || 0;
                if (!id)
                    throw Error('FFScouter returned no usable target ID. Use its Target link for this contract.');
                const item = claims.find(c => String(c.id) === String(claimId));
                if (item) {
                    item.target_player_id = id;
                    mergeLedger([item]);
                }
                notice = 'Target [' + id + '] found. Tap Attack now.';
                errorText = '';
                render();
            }
            catch (e) {
                errorText = String(e.message || e);
                notice = '';
                render();
            }
        }
        async function complete(id) {
            if (pending()) {
                errorText = 'Refresh/reconcile the previous request first.';
                render();
                return;
            }
            if (!window.confirm('Mark this claim complete and release unused slots?'))
                return;
            busy = true;
            render();
            try {
                await setPending({ type: 'complete', id: String(id), at: Math.floor(Date.now() / 1000), nonce: Date.now() + '-' + Math.random() });
                const result = await request('POST', '/claims/' + id + '/complete');
                if (!result.claim || String(result.claim.id) !== String(id))
                    throw Error('Completion response incomplete; refresh to reconcile.');
                mergeLedger([result.claim]);
                await saveLedger();
                await setPending(null);
                notice = 'Claim submitted for settlement.';
                errorText = '';
                await refreshAfterAction();
            }
            catch (e) {
                errorText = String(e.message || e);
                busy = false;
                render();
            }
        }
        async function refreshAfterAction() { busy = false; await refresh(); }
        function recordReceipt(value, source) {
            const text = String(value || '').slice(0, 2500).replace(/<[^>]*>/g, ' ');
            const entries = Object.values(currentLedger.claims);
            let added = 0;
            for (const c of entries) {
                const order = String(c.order_number || '');
                const id = String(c.id || '');
                const matched = order && text.toLowerCase().includes(order.toLowerCase()) || (/ffscouter|loss|claim|order/i.test(text) && new RegExp('(?:claim|order|id|#)\\s*[:#-]?\\s*' + id + '(?!\\d)', 'i').test(text));
                if (!matched)
                    continue;
                const ref = source + '|' + id;
                if (currentLedger.receipts.some(x => x.id === ref))
                    continue;
                currentLedger.receipts.push({ id: ref, claim_id: id, source, seen_at: Math.floor(Date.now() / 1000) });
                added++;
            }
            if (added)
                void saveLedger();
            return added;
        }
        async function scanMail() {
            const tornKey = String(window.prompt('Optional separate Torn API key for reading mail/events. Used only for this scan; not saved. Do not assume the FFScouter key is interchangeable.') || '').trim();
            if (!isKey(tornKey))
                return;
            busy = true;
            notice = 'Scanning message subjects and events…';
            render();
            let found = 0, errs = [];
            for (const [name, url, field] of [['Messages', 'https://api.torn.com/v2/user/messages?limit=100', 'messages'], ['Events', 'https://api.torn.com/v2/user/events?limit=100&striptags=true', 'events']]) {
                try {
                    const r = await sendHttp('GET', url, { Authorization: 'ApiKey ' + tornKey, Accept: 'application/json' });
                    const d = JSON.parse(r.responseText || '{}');
                    if (d.error)
                        throw Error(d.error.error || d.error.message);
                    for (const x of Array.isArray(d[field]) ? d[field] : []) {
                        found += recordReceipt(name === 'Events' ? x.event : x.topic, name + ':' + String(x.id || x.timestamp));
                    }
                }
                catch (e) {
                    errs.push(name + ': ' + String(e.message || e));
                }
            }
            busy = false;
            notice = 'Matched ' + found + ' new references.';
            errorText = errs.join(' · ');
            render();
        }
        function copyLedger() { const value = JSON.stringify({ schema_version: 1, provider: 'FFScouter', owner_player_id: ownerPlayer || null, exported_at: new Date().toISOString(), claims: currentLedger.claims, receipts: currentLedger.receipts }, null, 2); if (navigator.clipboard && navigator.clipboard.writeText)
            navigator.clipboard.writeText(value).then(() => { notice = 'Ledger copied.'; render(); }).catch(() => window.prompt('Copy ledger', value));
        else
            window.prompt('Copy ledger', value); }
        async function updateCheck() {
            tab = 'Settings';
            notice = 'Checking GitHub…';
            errorText = '';
            render();
            try {
                const r = await sendHttp('GET', ROOT_URL + '?v=' + Date.now(), { Accept: 'text/plain' });
                if (Number(r.status) !== 200)
                    throw Error('GitHub HTTP ' + r.status);
                const ver = (String(r.responseText || '').match(/^\/\/\s*@version\s+(\d+(?:\.\d+)*)/m) || [])[1];
                if (!ver)
                    throw Error('Version header not found');
                const newer = ver.split('.').some((x, i) => Number(x) > Number(VERSION.split('.')[i] || 0));
                notice = newer ? 'GitHub v' + ver + ' available. Install through TornPDA script updates.' : 'Current version: v' + VERSION;
            }
            catch (e) {
                errorText = String(e.message || e);
            }
            render();
        }
        async function handleClick(e) {
            var _a, _b, _c, _d;
            const b = e.target.closest('[data-action], [data-tab]');
            if (!b)
                return;
            if (b.hasAttribute('data-tab')) {
                tab = b.getAttribute('data-tab');
                render();
                return;
            }
            const action = b.getAttribute('data-action');
            if (action === null || action === void 0 ? void 0 : action.startsWith('mobile-')) {
                void mobileAction(action, b.getAttribute('data-id'));
                return;
            }
            if (action === 'close')
                setOpen(false);
            if (action === 'refresh')
                void refresh();
            if (action === 'clear-pending' && Date.now() - claimsCheckedAt < 45000 && window.confirm('Review your refreshed claims first. Clearing this guard permits another request; it does not undo an earlier reservation.')) {
                await setPending(null);
                render();
            }
            if (action === 'update')
                void updateCheck();
            if (action === 'classiclauncher') {
                setMode('classic');
                render();
            }
            if (action === 'sidelauncher') {
                setMode('side');
                render();
            }
            if (action === 'dockleft') {
                setDock('left', dock.fraction);
                render();
            }
            if (action === 'dockright') {
                setDock('right', dock.fraction);
                render();
            }
            if (action === 'dockreset') {
                setDock(DOCK_DEFAULT.side, DOCK_DEFAULT.fraction);
                render();
            }
            if (action === 'contracts') {
                tab = 'Contracts';
                render();
            }
            if (action === 'payouts') {
                tab = 'Payouts';
                render();
            }
            if (action === 'connect' && (mobileBusy || ((_b = (_a = mobileWorker()) === null || _a === void 0 ? void 0 : _a.getState()) === null || _b === void 0 ? void 0 : _b.running))) {
                errorText = 'Stop the mobile loop before changing seller accounts.';
                render();
                return;
            }
            if (action === 'connect')
                void connect();
            if (action === 'claim' || action === 'claimmax')
                void claim(b.getAttribute('data-order'), action === 'claimmax');
            if (action === 'complete')
                void complete(Number(b.getAttribute('data-id')));
            if (action === 'attack') {
                setOpen(false);
                return;
            } // native <a href> opens same TornPDA tab
            if (action === 'locate-target')
                void locateTarget(b.getAttribute('data-order'), b.getAttribute('data-claim-id'));
            if (action === 'forget' && (mobileBusy || ((_d = (_c = mobileWorker()) === null || _c === void 0 ? void 0 : _c.getState()) === null || _d === void 0 ? void 0 : _d.running))) {
                errorText = 'Stop the mobile loop before forgetting its key.';
                render();
                return;
            }
            if (action === 'forget' && pending()) {
                errorText = 'Reconcile the pending request before forgetting its key.';
                render();
                return;
            }
            if (action === 'forget') {
                ownerPlayer = 0;
                apiKey = '';
                setSession('');
                await nativeDelete(KEY_STORAGE);
                activateLedger();
                tab = 'Settings';
                render();
            }
            if (action === 'export')
                copyLedger();
            if (action === 'scanmail')
                void scanMail();
            if (action === 'match') {
                const value = (panel.querySelector('#ff-receipt') || {}).value || '';
                notice = 'Matched ' + recordReceipt(value, 'paste:' + Date.now()) + ' known claims. Message text not stored.';
                render();
            }
        }
        async function loadState() {
            apiKey = getSession();
            pendingAll = await nativeGet(PENDING_STORAGE, {});
            if (!pendingAll || typeof pendingAll !== 'object')
                pendingAll = {};
            ledgerAll = await nativeGet(LEDGER_STORAGE, {});
            if (!ledgerAll || typeof ledgerAll !== 'object')
                ledgerAll = {};
            const saved = await nativeGet(KEY_STORAGE, '');
            if (isKey(saved)) {
                remember = true;
                if (!isKey(apiKey))
                    apiKey = saved;
            }
            // Seller credentials are entered explicitly; never silently forward TornPDA's Torn key.
            activateLedger();
            restoreMobile();
            render();
            if (isKey(apiKey) && opened)
                void refresh();
        }
        if (getStore('ff-mobile-loss-host-v1', null) && getSession()) {
            loadState.done = true;
            void loadState().catch(() => { });
        }
        launch.onclick = function () {
            if (Date.now() < suppressClickUntil)
                return;
            try {
                setOpen(!opened);
                if (opened && !loadState.done) {
                    loadState.done = true;
                    void loadState().catch(e => { errorText = 'Startup issue: ' + String(e.message || e); render(); });
                }
            }
            catch (e) {
                launch.textContent = 'FF !';
                window.alert('FFContractor error: ' + String(e.message || e));
            }
        };
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && opened)
            setOpen(false); });
        every(() => { if (opened && panel && panel.isConnected && isKey(apiKey) && Date.now() - lastSync > 25000)
            void refresh(); }, 30000);
        let mountObserver = null;
        if (typeof MutationObserver === 'function' && document.documentElement) {
            mountObserver = new MutationObserver(() => { if (!disposed)
                mount(); });
            mountObserver.observe(document.documentElement, { childList: true });
        }
        window.__FFContractor = {
            version: VERSION, ready: true, mount,
            show() { mount(); setOpen(true); if (!loadState.done) {
                loadState.done = true;
                void loadState().catch(e => { errorText = 'Startup issue: ' + String(e.message || e); render(); });
            } },
            reset() { setMode('classic'); mount(); },
            setMode,
            diagnostic() { return { version: VERSION, launcherMode, launcherAttached: !!launch.isConnected, panelOpen: opened, bridge: typeof PDA_httpGet === 'function' ? 'TornPDA' : typeof GM_xmlhttpRequest === 'function' ? 'Commander' : 'unavailable', viewport: viewport() }; },
            dispose() { disposed = true; timers.forEach(clearInterval); if (mountObserver)
                mountObserver.disconnect(); launch.remove(); if (panel)
                panel.remove(); }
        };
        if (window.__FFContractorBoot)
            window.__FFContractorBoot.stage('ready');
        if (typeof GM_registerMenuCommand === 'function') {
            GM_registerMenuCommand('Open FFContractor', () => window.__FFContractor.show());
            GM_registerMenuCommand('Restore classic FF launcher', () => window.__FFContractor.reset());
        }
        // Included inside FFContractor's closure by BUILD_MOBILE.py.
        const MOBILE_STORE = 'ff-mobile-loss-host-v1', MOBILE_KEY = 'ff-mobile-torn-key-v1';
        let mobile = null, mobileBusy = false, mobileLastApi = 0, mobileStatus = 'Not started', mobileInstalled = false;
        function mobileSave() { setStore(MOBILE_STORE, mobile); }
        function mobileKey() { try {
            return sessionStorage.getItem(MOBILE_KEY) || '';
        }
        catch {
            return '';
        } }
        function mobileWorker() { return window.FFMobileLossCycle; }
        function mobileCount() { return mobile ? Math.max(mobile.baseline + mobile.local.length, Number(mobile.providerDelivered) || 0) : 0; }
        function mobilePause(reason) { var _a; mobileStatus = String(reason); (_a = mobileWorker()) === null || _a === void 0 ? void 0 : _a.pause(); if (mobile) {
            mobile.note = mobileStatus;
            mobileSave();
        } if (opened)
            render(); }
        async function mobileApi(route) {
            var _a;
            const key = mobileKey();
            if (!isKey(key))
                throw Error('Enter the separate Torn API key again in Mobile Session; the phone session key is missing.');
            const wait = mobileLastApi + 1500 - Date.now();
            if (wait > 0)
                await new Promise(r => setTimeout(r, wait));
            mobileLastApi = Date.now();
            const response = await sendHttp('GET', 'https://api.torn.com/v2/' + route, { Authorization: 'ApiKey ' + key, Accept: 'application/json' });
            let data;
            try {
                data = JSON.parse(response.responseText);
            }
            catch {
                throw Error('Torn returned unreadable API data.');
            }
            if (Number(response.status) < 200 || Number(response.status) >= 300 || data.error)
                throw Error('Torn API check failed' + (((_a = data.error) === null || _a === void 0 ? void 0 : _a.code) ? ' (code ' + Number(data.error.code) + ')' : '') + '. Pause and refresh; nothing retried.');
            return data;
        }
        async function mobileObservation() {
            var _a, _b, _c;
            const d = await mobileApi('user?selections=profile,cooldowns,perks'), p = d.profile;
            if (!p || p.id !== mobile.owner)
                throw Error('Torn key belongs to a different account. No item or fight authorized.');
            if (!['Hospital', 'Okay'].includes((_a = p.status) === null || _a === void 0 ? void 0 : _a.state))
                throw Error('Account is not in Hospital or Okay status.');
            if (/radiation|poison/i.test(JSON.stringify(p.status)))
                throw Error('Nonstandard hospitalization requires manual review.');
            if (!d.perks || typeof d.perks !== 'object' || Array.isArray(d.perks))
                throw Error('Medical perks were not returned. Check Torn API permissions.');
            const mods = FFMobileCore.modifiers(d.perks), now = Date.now();
            const o = { owner: p.id, at: now, until: p.status.state === 'Hospital' ? Number(p.status.until) * 1000 : now, cooldown: Number(d.cooldowns.medical), ...mods, energy: Number((_c = (_b = d.bars) === null || _b === void 0 ? void 0 : _b.energy) === null || _c === void 0 ? void 0 : _c.current) };
            if (!Number.isFinite(o.until) || !Number.isFinite(o.cooldown) || o.cooldown < 0)
                throw Error('Medical snapshot incomplete.');
            return o;
        }
        async function mobileClaimCheck(force = false) {
            var _a, _b;
            if (!mobile || mobile.seller !== hash(apiKey))
                throw Error('Seller account changed. Stop this mobile session before changing accounts.');
            if (force || Date.now() - Number(mobile.checked || 0) > 20000) {
                const data = await request('GET', '/claims'), rows = (data.claims || []).map(claimWithTarget), claim = rows.find(c => String(c.id) === String(mobile.remoteId));
                if (!claim)
                    throw Error('Owning claim unavailable. No new fight authorized.');
                mobile.deadline = FFMobileCore.validateSession(mobile, mobile.owner, claim, Date.now());
                mobile.providerDelivered = Number(claim.slots_delivered) || 0;
                mobile.checked = Date.now();
                mobile.claim = claim;
                mergeLedger(rows);
                mobileSave();
            }
            (_b = (_a = mobileWorker()) === null || _a === void 0 ? void 0 : _a.setExternalDeadline) === null || _b === void 0 ? void 0 : _b.call(_a, mobile.deadline);
            if (mobile.deadline <= Date.now())
                throw Error('Claim deadline reached. No new fight authorized.');
            return mobile.claim;
        }
        function mobileContext(m) {
            var _a, _b;
            return mobile && mobile.seller === hash(apiKey) && m.profileId === String(mobile.owner) && m.orderId === 'ff-mobile-' + mobile.remoteId && (!m.targetId || Number(m.targetId) === mobile.target) && Number((_b = (_a = mobileWorker()) === null || _a === void 0 ? void 0 : _a.getState()) === null || _b === void 0 ? void 0 : _b.targetId) === mobile.target && (!m.medicalSession || m.medicalSession === mobile.medicalSession);
        }
        async function mobileReceive(m) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            if (m.type === 'tc-loss-status') {
                if (mobile && m.profileId !== String(mobile.owner))
                    return;
                if (mobile && m.running && !document.hidden && Date.now() - Number(mobile.seenAt || 0) > 1000) {
                    mobile.seenAt = Date.now();
                    mobileSave();
                }
                const next = m.status || m.stage;
                if (next !== mobileStatus) {
                    mobileStatus = next;
                    if (opened && tab === 'Mobile Session')
                        render();
                }
                return;
            }
            if (m.type === 'tc-loss-finished') {
                if (mobile) {
                    mobile.note = 'Session complete. Refresh FFScouter to reconcile provider progress; completion/payment remain provider-controlled.';
                    mobileSave();
                }
                return;
            }
            if (!mobileContext(m))
                return;
            if (m.type === 'tc-loss-abandon') {
                if (((_a = mobile.lease) === null || _a === void 0 ? void 0 : _a.id) === m.claimId) {
                    mobile.lease = null;
                    mobileSave();
                }
                return;
            }
            if (mobileBusy)
                return;
            mobileBusy = true;
            try {
                const worker = mobileWorker();
                if (m.type === 'tc-loss-claim') {
                    await mobileClaimCheck();
                    const remaining = mobile.total - mobileCount();
                    if (remaining <= 0) {
                        worker.onClaim(m.requestId, false, '', 'Complete: requested losses delivered locally. Refresh provider progress.');
                        return;
                    }
                    if (mobile.lease) {
                        worker.onClaim(m.requestId, true, mobile.lease.id, 'Continuing the reserved mobile fight.');
                        return;
                    }
                    const self = await mobileApi('user?selections=profile,bars');
                    if (((_b = self.profile) === null || _b === void 0 ? void 0 : _b.id) !== mobile.owner)
                        throw Error('Torn account changed.');
                    if (((_c = self.profile.status) === null || _c === void 0 ? void 0 : _c.state) === 'Hospital') {
                        worker.recoverFromHospital();
                        return;
                    }
                    if (((_d = self.profile.status) === null || _d === void 0 ? void 0 : _d.state) !== 'Okay')
                        throw Error('Account unavailable for fighting.');
                    if (Number((_f = (_e = self.bars) === null || _e === void 0 ? void 0 : _e.energy) === null || _f === void 0 ? void 0 : _f.current) < 25) {
                        worker.onClaim(m.requestId, false, '', 'Complete: fewer than 25 energy remain.');
                        return;
                    }
                    if (!((_g = worker.getState()) === null || _g === void 0 ? void 0 : _g.running))
                        return;
                    mobile.lease = { id: 'mobile-' + Date.now() + '-' + Math.random().toString(36).slice(2), started: Date.now() };
                    mobileSave();
                    worker.onClaim(m.requestId, true, mobile.lease.id, 'Mobile target slot authorized.');
                    return;
                }
                if (m.type === 'tc-loss-commit' || m.type === 'tc-loss-terminal') {
                    if (mobile.local.some(x => x.lease === m.claimId)) {
                        const remaining = Math.max(0, mobile.total - mobileCount());
                        if (m.type === 'tc-loss-terminal')
                            worker.onLossTerminal({ kind: 'verified', claimId: m.claimId, ok: true, remaining, message: 'Previously recorded mobile loss.' });
                        else
                            worker.onCommit(m.claimId, true, remaining, 'Previously recorded mobile loss.');
                        return;
                    }
                    if (((_h = mobile.lease) === null || _h === void 0 ? void 0 : _h.id) !== m.claimId)
                        throw Error('No matching mobile attack reservation.');
                    let attackId = 0;
                    if (m.type === 'tc-loss-terminal' || m.visibleOutcome !== 'loss' || Number(m.lossObservedAt) < Number(m.fightStartedAt) || Number(m.fightStartedAt) < mobile.lease.started - 2000) {
                        const data = await mobileApi('user/attacks?filters=outgoing&limit=100&sort=desc&from=' + Math.floor(mobile.lease.started / 1000));
                        const receipt = FFMobileCore.receipt(data.attacks, mobile.owner, mobile.target, mobile.lease.started, mobile.local.map(x => x.attackId));
                        if (!receipt) {
                            worker.onLossTerminal({ kind: 'pending', claimId: m.claimId, retryAt: Date.now() + 8000, message: 'Waiting for an official loss receipt; no extra attack.' });
                            return;
                        }
                        if (receipt.result !== 'Lost')
                            throw Error('Fight was not a verified loss. No delivery counted.');
                        attackId = receipt.id;
                    }
                    mobile.local.push({ lease: m.claimId, attackId, at: Date.now(), provisional: attackId === 0 });
                    mobile.lease = null;
                    mobileSave();
                    const remaining = Math.max(0, mobile.total - mobileCount()), message = 'Mobile loss recorded; ' + remaining + ' remaining. Provider confirmation may lag.';
                    if (m.type === 'tc-loss-terminal')
                        worker.onLossTerminal({ kind: 'verified', claimId: m.claimId, ok: true, remaining, message });
                    else
                        worker.onCommit(m.claimId, true, remaining, message);
                    return;
                }
                if (m.type.startsWith('tc-medical-')) {
                    const reply = r => worker.onMedical(m.requestId, r);
                    if (m.browserPlayerId !== mobile.owner)
                        throw Error('Medical browser identity differs from the owning account.');
                    const inv = {};
                    for (const row of m.inventory || []) {
                        if (row.id !== 739 && !FFMobileCore.meds.some(x => x.id === row.id))
                            throw Error('Unsupported medical item. Blood bags/drugs are excluded.');
                        if (!Number.isSafeInteger(row.quantity) || row.quantity < 0)
                            throw Error('Invalid item count.');
                        inv[row.id] = row.quantity;
                    }
                    if (m.type === 'tc-medical-plan') {
                        if (((_j = mobile.op) === null || _j === void 0 ? void 0 : _j.issued) && !mobile.op.verified)
                            throw Error('The previous item still requires verification. No new plan authorized.');
                        const o = await mobileObservation(), p = FFMobileCore.plan(Math.max(0, Math.ceil((o.until - Date.now()) / 1000)), o.cooldown, o.maximum, o.bonus, inv, mobile.permissions);
                        if (p.state === 'Recovered') {
                            mobile.op = null;
                            mobileSave();
                            reply({ state: 'Recovered' });
                            return;
                        }
                        if (p.state === 'Cooldown') {
                            reply({ state: 'Cooldown', reason: 'Medical cooldown reached. No drugs will be used.', waitUntil: new Date(Date.now() + p.waitSeconds * 1000).toISOString(), autoResume: false });
                            return;
                        }
                        if (p.state !== 'Ready')
                            throw Error(p.reason || 'No permitted medical supplies can end hospitalization.');
                        const item = FFMobileCore.meds.find(x => x.id === p.items[0]);
                        mobile.op = { token: 'med-' + Date.now() + '-' + Math.random().toString(36).slice(2), id: item.id, before: o, inventory: inv, issued: false, verified: false, attempts: 0, expires: Date.now() + 40000 };
                        mobileSave();
                        reply({ state: 'Ready', token: mobile.op.token, itemId: item.id, name: item.name, quantity: inv[item.id], expires: new Date(mobile.op.expires).toISOString(), automatic: mobile.heal === true });
                        return;
                    }
                    const op = mobile.op;
                    if (!op || op.token !== m.token)
                        throw Error('Medical operation identity changed.');
                    if (m.type === 'tc-medical-authorize') {
                        if (!mobile.heal || !mobile.permissions[op.id] || op.issued)
                            throw Error('Medical permission missing or already issued.');
                        if (op.expires < Date.now() || inv[op.id] !== op.inventory[op.id]) {
                            mobile.op = null;
                            mobileSave();
                            reply({ state: 'Replan', reason: 'Unused medical plan changed. Recalculate remaining supplies.' });
                            return;
                        }
                        if (Date.now() - op.before.at > 10000) {
                            mobile.op = null;
                            mobileSave();
                            reply({ state: 'Replan', reason: 'Unused medical snapshot expired. Recalculate before dispatch.' });
                            return;
                        }
                        op.issued = true;
                        mobileSave();
                        reply({ state: 'Authorized', token: op.token, itemId: op.id, expires: new Date(Date.now() + 30000).toISOString() });
                        return;
                    }
                    if (m.type === 'tc-medical-verify') {
                        if (!op.issued)
                            throw Error('No item was authorized.');
                        if (op.verified) {
                            reply({ state: 'Verified', token: op.token });
                            return;
                        }
                        const after = await mobileObservation();
                        if (!FFMobileCore.verify(op.before, after, op.id, op.inventory, inv, (after.at - op.before.at) / 1000)) {
                            if (++op.attempts > 6)
                                throw Error('Item outcome remains uncertain. No second item or drug fallback.');
                            mobileSave();
                            reply({ state: 'PendingVerification', token: op.token, retryAfterMs: op.attempts < 3 ? 2500 : 8000, reason: 'Waiting for item/cooldown/hospital evidence; no repeat click.' });
                            return;
                        }
                        op.verified = true;
                        mobile.itemsUsed = Number(mobile.itemsUsed || 0) + 1;
                        mobile.cooldownUsed = Number(mobile.cooldownUsed || 0) + FFMobileCore.meds.find(x => x.id === op.id).cost;
                        mobileSave();
                        reply({ state: 'Verified', token: op.token });
                        return;
                    }
                }
            }
            catch (error) {
                mobilePause(mobileKey() ? String(error.message || error).split(mobileKey()).join('[redacted]') : String(error.message || error));
            }
            finally {
                mobileBusy = false;
            }
        }
        function installMobileWorker() {
            if (mobileInstalled)
                return;
            mobileInstalled = true;
            window.__FFMobileReceive = m => { void mobileReceive(m); };
            /* MOBILE_WORKER_BEGIN */
            (() => {
                'use strict';
                if (window.__ffMobileLossInstalled)
                    return;
                window.__ffMobileLossInstalled = true;
                const STORAGE_KEY = '__ff_mobile_loss_cycle_v1';
                const SESSION_KEY = '__ff_mobile_loss_cycle_session_v1';
                const ATTACK_URL = id => `https://www.torn.com/page.php?sid=attack&user2ID=${encodeURIComponent(id)}`;
                const ITEMS_URL = 'https://www.torn.com/item.php';
                const MAX_PILLOW_TURNS = 100;
                const TICK_MS = 250;
                const attackDelay = value => Number.isFinite(Number(value)) ? Math.max(500, Math.min(5000, Math.round(Number(value)))) : 1900;
                let busy = false;
                const now = () => Date.now();
                const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
                const bodyText = () => { var _a; return clean(((_a = document.body) === null || _a === void 0 ? void 0 : _a.innerText) || ''); };
                const visible = el => { var _a; return Boolean(el && ((_a = el.getClientRects) === null || _a === void 0 ? void 0 : _a.call(el).length) && getComputedStyle(el).visibility !== 'hidden' && getComputedStyle(el).display !== 'none'); };
                const click = el => {
                    var _a, _b;
                    if (!el || !visible(el) || el.disabled || ((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-disabled')) === 'true')
                        return false;
                    (_b = el.scrollIntoView) === null || _b === void 0 ? void 0 : _b.call(el, { block: 'center', inline: 'nearest', behavior: 'instant' });
                    if (typeof el.click === 'function')
                        el.click();
                    else
                        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                    return true;
                };
                const labelOf = el => { var _a, _b; return clean((el === null || el === void 0 ? void 0 : el.innerText) || (el === null || el === void 0 ? void 0 : el.value) || ((_a = el === null || el === void 0 ? void 0 : el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-label')) || ((_b = el === null || el === void 0 ? void 0 : el.getAttribute) === null || _b === void 0 ? void 0 : _b.call(el, 'title')) || '').toLowerCase(); };
                const post = payload => {
                    var _a, _b, _c;
                    try {
                        if (((_a = load()) === null || _a === void 0 ? void 0 : _a.mode) === 'level' && ((_b = payload.type) === null || _b === void 0 ? void 0 : _b.startsWith('tc-loss-')))
                            payload.type = payload.type.replace('tc-loss-', 'tc-level-');
                        (_c = window.__FFMobileReceive) === null || _c === void 0 ? void 0 : _c.call(window, payload);
                    }
                    catch { }
                };
                function load() {
                    try {
                        const raw = localStorage.getItem(STORAGE_KEY);
                        return raw ? JSON.parse(raw) : null;
                    }
                    catch {
                        return null;
                    }
                }
                function save(state) {
                    try {
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
                    }
                    catch { }
                    report(state);
                    return state;
                }
                function clear() {
                    try {
                        localStorage.removeItem(STORAGE_KEY);
                    }
                    catch { }
                }
                function report(state, extra = {}) {
                    post({
                        type: 'tc-loss-status',
                        profileId: (state === null || state === void 0 ? void 0 : state.profileId) || '',
                        slot: (state === null || state === void 0 ? void 0 : state.slot) || '',
                        orderId: (state === null || state === void 0 ? void 0 : state.orderId) || '',
                        claimId: (state === null || state === void 0 ? void 0 : state.claimId) || '',
                        stage: (state === null || state === void 0 ? void 0 : state.stage) || 'idle',
                        running: Boolean(state === null || state === void 0 ? void 0 : state.running),
                        status: (state === null || state === void 0 ? void 0 : state.status) || 'Idle',
                        pillowTurns: Number((state === null || state === void 0 ? void 0 : state.pillowTurns) || 0),
                        kitsThisLoss: Number((state === null || state === void 0 ? void 0 : state.kitsThisLoss) || 0),
                        ...extra
                    });
                }
                function challengeVisible() {
                    var _a;
                    const title = document.title.toLowerCase();
                    const text = (((_a = document.body) === null || _a === void 0 ? void 0 : _a.innerText) || '').slice(0, 1800).toLowerCase();
                    return title.includes('just a moment') || /verifying you are human|verify you are human|checking your browser|complete the security check/i.test(text);
                }
                function isAttackPage(targetId) {
                    try {
                        const u = new URL(location.href);
                        return u.pathname.endsWith('/page.php') && u.searchParams.get('sid') === 'attack' && Number(u.searchParams.get('user2ID')) === Number(targetId);
                    }
                    catch {
                        return false;
                    }
                }
                function isItemsPage() { return location.pathname === '/item.php'; }
                function hospitalBanner() {
                    return /you can(?:not|'t|â€™t) attack(?: anyone)? while (?:you are )?in (?:the )?hospital|you are (?:currently |still )?in (?:the )?hospital/i.test(bodyText());
                }
                function insufficientEnergy() {
                    // Use Torn's explicit refusal, never infer a balance from unrelated page numbers.
                    return /you (?:do not|don't|donâ€™t) have (?:enough|sufficient) energy|you have (?:insufficient|not enough) energy|not enough energy to (?:attack|start|join)|you need (?:at least )?25 energy to (?:attack|start|join)/i.test(bodyText());
                }
                function pauseForEnergy(state) {
                    return pauseState(state, 'Not enough energy to attack. This account is paused and its slot released; the other running account can continue. Resume this account after restoring energy.', true);
                }
                function joinFightCandidates() {
                    const action = /^(join fight|start fight|start attack|begin fight)$/i;
                    const buttons = Array.from(document.querySelectorAll('button,[role="button"],input[type="button"],a'))
                        .filter(el => { var _a; return visible(el) && enabledControl(el, (_a = document.body) === null || _a === void 0 ? void 0 : _a.parentElement); })
                        .filter(el => { var _a; return [el.innerText, el.value, (_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-label')].some(text => action.test(clean(text))); });
                    // A semantic wrapper and its nested real button describe one action, not two.
                    // Retain the innermost control; independent matching controls remain ambiguous.
                    return buttons.filter(el => !buttons.some(other => { var _a; return other !== el && ((_a = el.contains) === null || _a === void 0 ? void 0 : _a.call(el, other)); }));
                }
                function joinFightButton() {
                    const buttons = joinFightCandidates();
                    return buttons.length === 1 ? buttons[0] : null;
                }
                const outerRoots = nodes => [...new Set(nodes)].filter(a => !nodes.some(b => { var _a; return b !== a && ((_a = b.contains) === null || _a === void 0 ? void 0 : _a.call(b, a)); }));
                function playerArea() {
                    const roots = outerRoots(Array.from(document.querySelectorAll('[class*="playerArea"]')).filter(visible));
                    if (roots.length === 1)
                        return roots[0];
                    // Both combatants can use Torn's playerArea class. Only the attacker's
                    // actionable weapon slot identifies ownership; DOM order and Pillow artwork
                    // do not (the opponent may also equip a Pillow).
                    const slots = roots.flatMap(area => Array.from(area.querySelectorAll('[id="weapon_melee"]')).filter(visible).map(slot => ({ area, slot })));
                    if (slots.length) {
                        // Torn also renders weapon_melee on the opponent's unavailable weapon.
                        // The attack action name, not that duplicated ID, establishes ownership.
                        const attacks = slots.filter(({ slot }) => [slot, ...slot.querySelectorAll('[aria-label],[title],span')].some(el => { var _a, _b; return [(_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-label'), (_b = el.getAttribute) === null || _b === void 0 ? void 0 : _b.call(el, 'title'), el.innerText].some(v => /^attack with pillow[.!]?$/i.test(clean(v))); }));
                        if (attacks.length)
                            return attacks.length === 1 ? attacks[0].area : null;
                        return slots.length === 1 ? slots[0].area : null;
                    }
                    const actionable = roots.filter(area => Array.from(area.querySelectorAll('button,[role="button"],[aria-label]')).some(el => { var _a; return visible(el) && [(_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-label'), el.innerText].some(v => /^attack with pillow[.!]?$/i.test(clean(v))); }));
                    return actionable.length === 1 ? actionable[0] : null;
                }
                function enabledControl(el, boundary) {
                    var _a;
                    for (let node = el; node && node !== boundary; node = node.parentElement)
                        if (!visible(node) || node.disabled || ((_a = node.getAttribute) === null || _a === void 0 ? void 0 : _a.call(node, 'aria-disabled')) === 'true')
                            return false;
                    return true;
                }
                function pillowControl(reveal = true) {
                    var _a, _b, _c, _d, _e, _f, _g;
                    const area = playerArea();
                    if (!area)
                        return null;
                    if (reveal)
                        (_a = area.scrollIntoView) === null || _a === void 0 ? void 0 : _a.call(area, { block: 'center', inline: 'nearest' });
                    // Target the weapon slot itself, not a nested artwork/info button. Torn
                    // replaces descendants between turns; the stable slot owns the attack action.
                    const melee = Array.from(area.querySelectorAll('[id="weapon_melee"]')).filter(visible);
                    if (melee.length) {
                        if (melee.length !== 1)
                            return null;
                        const slot = melee[0];
                        const identity = [slot, ...slot.querySelectorAll('[aria-label],[title],[alt],img')].some(el => {
                            var _a;
                            return ['aria-label', 'title', 'alt'].some(k => { var _a; return /^(?:attack with )?pillow[.!]?$/i.test(clean((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, k))); }) ||
                                /\/(?:items|weapons)\/440(?:[/.?]|$)/i.test(((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'src')) || '');
                        }) ||
                            Array.from(slot.querySelectorAll('span,strong,p')).some(el => /^pillow$/i.test(clean(el.textContent)));
                        // A known melee slot holding another weapon must never fall through.
                        return identity && enabledControl(slot, area) ? slot : null;
                    }
                    // Torn may replace the weapon artwork with a turn animation. Its named attack
                    // control remains the authoritative target; resolve it afresh on every turn.
                    const named = Array.from(area.querySelectorAll('[aria-label],[title],button,[role="button"]'))
                        .filter(el => { var _a, _b; return visible(el) && [(_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-label'), (_b = el.getAttribute) === null || _b === void 0 ? void 0 : _b.call(el, 'title'), el.innerText].some(v => /^attack with pillow[.!]?$/i.test(clean(v))); });
                    const namedRoots = outerRoots(named);
                    if (namedRoots.length)
                        return namedRoots.length === 1 && enabledControl(namedRoots[0], area) ? namedRoots[0] : null;
                    const attributes = ['alt', 'title', 'aria-label', 'data-tooltip', 'data-tippy-content'];
                    const markers = Array.from(area.querySelectorAll('[data-item-id="440"],[data-id="440"],[data-itemid="440"],[alt],[title],[aria-label],[data-tooltip],[data-tippy-content],img'))
                        .filter(visible).filter(el => {
                        var _a;
                        return ['data-item-id', 'data-id', 'data-itemid'].some(k => { var _a; return ((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, k)) === '440'; }) ||
                            attributes.some(k => { var _a; return /^pillow(?:\s*\([^)]*\))?$/i.test(clean((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, k))); }) ||
                            /\/(?:items|weapons)\/440(?:[/.?]|$)/i.test(((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'src')) || '');
                    });
                    for (const leaf of area.querySelectorAll('span,div,strong,p'))
                        if (!((_b = leaf.children) === null || _b === void 0 ? void 0 : _b.length) && /^pillow$/i.test(clean(leaf.textContent)) && visible(leaf))
                            markers.push(leaf);
                    const candidates = [];
                    for (const marker of markers) {
                        let fallback = null, control = null;
                        for (let node = marker, depth = 0; node && node !== area && depth < 8; node = node.parentElement, depth++) {
                            if (!visible(node))
                                continue;
                            if (node.disabled || ((_c = node.getAttribute) === null || _c === void 0 ? void 0 : _c.call(node, 'aria-disabled')) === 'true') {
                                control = null;
                                fallback = null;
                                break;
                            }
                            const tag = String(node.tagName || '').toLowerCase(), role = (_d = node.getAttribute) === null || _d === void 0 ? void 0 : _d.call(node, 'role');
                            if (tag === 'button' || tag === 'a' || role === 'button') {
                                control = node;
                                break;
                            }
                            if (!fallback && /weapon|melee|slot|equipment/i.test(String((_g = (_f = (_e = node.className) === null || _e === void 0 ? void 0 : _e.baseVal) !== null && _f !== void 0 ? _f : node.className) !== null && _g !== void 0 ? _g : '')))
                                fallback = node;
                        }
                        if (control || fallback)
                            candidates.push(control || fallback);
                    }
                    const roots = outerRoots(candidates);
                    return roots.length === 1 && enabledControl(roots[0], area) ? roots[0] : null;
                }
                function levelingWeapon(state) {
                    const aliases = { weapon_primary: ['weapon_primary', 'weapon_main'], weapon_secondary: ['weapon_secondary', 'weapon_second'], weapon_melee: ['weapon_melee'] };
                    const ids = aliases[state.weaponSlot];
                    if (!ids)
                        return null;
                    const slots = outerRoots(Array.from(document.querySelectorAll(ids.map(id => '[id="' + id + '"]').join(','))).filter(visible));
                    const candidates = slots.filter(slot => {
                        var _a, _b;
                        if (!enabledControl(slot, slot.parentElement))
                            return false;
                        const names = [(_a = slot.getAttribute) === null || _a === void 0 ? void 0 : _a.call(slot, 'aria-label'), (_b = slot.getAttribute) === null || _b === void 0 ? void 0 : _b.call(slot, 'title'), ...Array.from(slot.querySelectorAll('[aria-label],[title],span')).map(x => { var _a, _b; return ((_a = x.getAttribute) === null || _a === void 0 ? void 0 : _a.call(x, 'aria-label')) || ((_b = x.getAttribute) === null || _b === void 0 ? void 0 : _b.call(x, 'title')) || x.textContent; })].map(clean);
                        return names.some(x => /^attack with (?!pillow\b).+/i.test(x)) && !names.some(x => /this weapon is not available/i.test(x)) && !/\bno ammo\b/i.test(labelOf(slot));
                    });
                    return candidates.length === 1 ? candidates[0] : null;
                }
                function levelingEmptyGun(state) {
                    const ids = state.weaponSlot === 'weapon_primary' ? ['weapon_primary', 'weapon_main'] : state.weaponSlot === 'weapon_secondary' ? ['weapon_secondary', 'weapon_second'] : [];
                    if (!ids.length)
                        return false;
                    const slots = outerRoots(Array.from(document.querySelectorAll(ids.map(id => '[id="' + id + '"]').join(','))).filter(visible));
                    const own = slots.filter(slot => [slot, ...slot.querySelectorAll('[aria-label],[title]')].some(el => { var _a, _b; return /^attack with (?!pillow\b).+/i.test(clean(((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-label')) || ((_b = el.getAttribute) === null || _b === void 0 ? void 0 : _b.call(el, 'title')))); }) && !/this weapon is not available/i.test(labelOf(slot)));
                    return own.length === 1 && /\bno ammo\b/i.test(labelOf(own[0]));
                }
                function levelingContinueControl() {
                    const roots = outerRoots(Array.from(document.querySelectorAll('[class*="playerArea"]')).filter(visible));
                    if (roots.length !== 1)
                        return null;
                    const buttons = Array.from(roots[0].querySelectorAll('button,a,[role="button"]')).filter(el => visible(el) && enabledControl(el, el.parentElement) && /^continue$/i.test(labelOf(el)));
                    return buttons.length === 1 ? buttons[0] : null;
                }
                function levelingLeaveControl(requireChoices = false) {
                    const controls = Array.from(document.querySelectorAll('button,a,[role="button"],input[type="button"]')).filter(el => visible(el) && enabledControl(el, el.parentElement));
                    const leave = controls.filter(el => /^leave(?:\s+(?:them|him|her|target|on the street).*)?$/i.test(labelOf(el)));
                    if (requireChoices && !controls.some(el => /^(?:mug|hospitalize|hospitalise)$/i.test(labelOf(el))))
                        return null;
                    return leave.length === 1 ? leave[0] : null;
                }
                function finishLevelingMedical(state) {
                    if (state.finishAfterRecovery) {
                        state.running = false;
                        state.stage = 'complete';
                        state.status = state.levelStopMessage || 'Leveling pass complete; recovery verified.';
                        save(state);
                        post({ type: 'tc-loss-finished', profileId: state.profileId, orderId: state.orderId });
                    }
                    else {
                        state.stage = state.claimId ? 'attack-open' : 'claim';
                        state.status = 'Recovery verified. Checking the next leveling target.';
                        state.navigationUrl = '';
                        save(state);
                    }
                }
                function lossTerminalCheck(state) {
                    if (state.stage !== 'loss-verify') {
                        state.stage = 'loss-verify';
                        state.lossVerifyAttempts = 0;
                        state.lossVerifyAt = 0;
                    }
                    if (now() < Number(state.lossVerifyAt || 0))
                        return;
                    if (Number(state.lossVerifyAttempts || 0) >= 6) {
                        pauseState(state, 'Ended fight could not be verified after six checks. No loss counted; Resume rechecks this same fight.', false);
                        return;
                    }
                    state.lossVerifyAttempts = Number(state.lossVerifyAttempts || 0) + 1;
                    state.lossVerifyAt = now() + 45000;
                    state.status = 'Fight ended. Checking Torn attack log before counting a loss (' + state.lossVerifyAttempts + '/6).';
                    save(state);
                    post({ type: 'tc-loss-terminal', profileId: state.profileId, slot: state.slot, orderId: state.orderId, claimId: state.claimId, fightStartedAt: state.fightOpenedAt || state.fightStartedAt });
                }
                function postVisibleLoss(state) {
                    post({ type: 'tc-loss-commit', profileId: state.profileId, slot: state.slot, orderId: state.orderId, claimId: state.claimId,
                        visibleOutcome: state.localLossTracking && state.lossObservedAt ? 'loss' : undefined,
                        fightStartedAt: state.fightOpenedAt || state.fightStartedAt, lossObservedAt: state.lossObservedAt });
                }
                function levelCommit(state, terminal = false) { state.levelTerminalSeen = terminal; state.stage = 'commit-wait'; state.commitAttempts = 1; state.replyWaitAt = now(); state.status = 'Verifying the completed leveling fight with Torn.'; save(state); post({ type: 'tc-loss-commit', profileId: state.profileId, slot: state.slot, orderId: state.orderId, claimId: state.claimId, terminal }); }
                function detectFightResult(state) {
                    const text = bodyText();
                    const self = clean(state.selfName || '');
                    if (!text)
                        return null;
                    if (self) {
                        const escaped = self.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\ /g, '\\s+');
                        const rx = new RegExp('(?:^|\\b)' + escaped + '\\s+(lost to|defeated|won against)\\s+([^.!?\\n\\r]+)', 'i');
                        const m = text.match(rx);
                        if (m)
                            return /^lost to$/i.test(m[1]) ? 'loss' : 'win';
                    }
                    if (/\byou\s+(?:have\s+)?lost\s+to\b/i.test(text) || /\bdefeat(?:ed)?\b.*\byou lost\b/i.test(text))
                        return 'loss';
                    if (/\byou\s+(?:have\s+)?defeated\b/i.test(text) || /\byou won against\b/i.test(text))
                        return 'win';
                    return null;
                }
                // Closed personal-medical executor. Planning/consent live in the native backend.
                const medicalPage = () => isItemsPage() && new URL(location.href).origin === 'https://www.torn.com';
                const medicalNames = { 66: 'Morphine', 67: 'First Aid Kit', 68: 'Small First Aid Kit', 739: 'Blood Bag : O-' };
                const sameMedicalName = (text, name) => clean(text).replace(/\s*:\s*/g, ':').toLowerCase() === clean(name).replace(/\s*:\s*/g, ':').toLowerCase();
                function medicalIdentity() {
                    var _a;
                    const labeled = new Set(), sidebar = new Set(), named = new Set(), chatIds = new Set(), pageAccounts = new Set();
                    // Torn exposes the logged-in account on script[uid][name], also used by
                    // TornTools getUserDetails. This does not depend on incidental profile links.
                    for (const script of document.querySelectorAll('script[uid][name]')) {
                        const uid = script.getAttribute('uid'), name = clean(script.getAttribute('name'));
                        if (!/^\d{1,9}$/.test(uid || '') || !name || name.length > 100)
                            continue;
                        const id = Number(uid);
                        if (Number.isSafeInteger(id) && id > 0)
                            pageAccounts.add(id);
                    }
                    const inChat = link => { var _a; for (let node = link; node; node = node.parentElement) {
                        const id = ((_a = node.getAttribute) === null || _a === void 0 ? void 0 : _a.call(node, "id")) || "";
                        if (id.startsWith("chat_panel_button:") || id.startsWith("chat_panel:"))
                            return true;
                    } return false; };
                    const idOf = link => { try {
                        const u = new URL(link.getAttribute('href'), location.href);
                        return u.protocol === 'https:' && (u.hostname === 'www.torn.com' || u.hostname === 'torn.com') ? Number(u.searchParams.get('XID')) : 0;
                    }
                    catch {
                        return 0;
                    } };
                    // The responsive account Name link can expose its label through ARIA rather than textContent.
                    for (const link of document.querySelectorAll('a[href*="profiles.php"]')) {
                        if (inChat(link))
                            continue;
                        const labels = [link.getAttribute('aria-label'), link.getAttribute('title'), link.textContent].map(clean);
                        if (!labels.some(text => text.length <= 300 && /^(?:name|username)\s*:/i.test(text)))
                            continue;
                        const id = idOf(link);
                        if (Number.isSafeInteger(id) && id > 0)
                            labeled.add(id);
                    }
                    // Torn's own Name row remains identifiable even when responsive sidebar wrappers change.
                    for (const label of document.querySelectorAll('span,strong,b,div,dt,td,p,li,dd,label,th,section')) {
                        if (inChat(label) || clean(label.textContent).length > 300 || !/^(?:name|username)\s*:/i.test(clean(label.textContent)))
                            continue;
                        let scope = label;
                        for (let depth = 0; scope && depth < 3; depth++, scope = scope.parentElement) {
                            const text = clean(scope.textContent);
                            if (text.length > 300 || !/^(?:name|username)\s*:/i.test(text))
                                break;
                            const ids = new Set(Array.from(scope.querySelectorAll('a[href*="profiles.php"]')).filter(link => !inChat(link)).map(idOf).filter(id => Number.isSafeInteger(id) && id > 0));
                            if (ids.size === 1) {
                                labeled.add([...ids][0]);
                                break;
                            }
                        }
                    }
                    const self = clean((_a = load()) === null || _a === void 0 ? void 0 : _a.selfName).toLowerCase();
                    for (const link of document.querySelectorAll('[id="sidebar"] a[href*="profiles.php"],[id="sidebarroot"] a[href*="profiles.php"],[class*="sidebar"] a[href*="profiles.php"]')) {
                        const id = idOf(link);
                        if (!Number.isSafeInteger(id) || id <= 0)
                            continue;
                        if (inChat(link)) {
                            chatIds.add(id);
                            continue;
                        }
                        sidebar.add(id);
                        const text = clean(link.textContent).toLowerCase();
                        if (self && (text === self || text === 'name: ' + self))
                            named.add(id);
                    }
                    // A single sidebar profile identity is usable even when Torn decorates or hides its name text.
                    // Never select the expected ID from multiple candidates or override explicit Name fields.
                    const authoritative = new Set([...pageAccounts, ...labeled]);
                    const conflict = authoritative.size > 1;
                    const uniqueSidebar = !authoritative.size && !named.size && sidebar.size === 1;
                    const owner = conflict ? null : authoritative.size === 1 ? [...authoritative][0] : named.size === 1 ? [...named][0] : uniqueSidebar ? [...sidebar][0] : null;
                    return { owner, strategy: conflict ? 'conflicting-account-fields' : pageAccounts.size ? 'page-account' : labeled.size ? 'name-field' : named.size ? 'sidebar-name' : uniqueSidebar ? 'sidebar-unique' : 'unavailable', pageAccountIds: [...pageAccounts], labeledIds: [...labeled], sidebarIds: [...sidebar], excludedChatIds: [...chatIds] };
                }
                function medicalOwnId() { return medicalIdentity().owner; }
                function medicalRow(id) {
                    const name = medicalNames[id];
                    if (!name || !medicalPage())
                        return null;
                    const markers = Array.from(document.querySelectorAll('span,strong,b,h3,h4,a,div')).filter(el => { var _a; return visible(el) && !((_a = el.children) === null || _a === void 0 ? void 0 : _a.length) && sameMedicalName(el.textContent, name); });
                    const rows = [];
                    for (const marker of markers)
                        for (let node = marker, depth = 0; node && depth < 8; node = node.parentElement, depth++) {
                            if (!visible(node))
                                continue;
                            const tag = String(node.tagName || '').toLowerCase();
                            if (!['li', 'tr'].includes(tag))
                                continue;
                            if (/faction|armory|borrowed/i.test(clean(node.textContent)) || ['data-faction-owned', 'data-armory', 'data-borrowed'].some(k => { var _a; return ['true', '1'].includes((_a = node.getAttribute) === null || _a === void 0 ? void 0 : _a.call(node, k)); }))
                                break;
                            const ids = [node, ...node.querySelectorAll('[data-item-id],[data-itemid],[data-item]')].flatMap(n => ['data-item-id', 'data-itemid', 'data-item'].map(k => { var _a; return (_a = n.getAttribute) === null || _a === void 0 ? void 0 : _a.call(n, k); }).filter(Boolean));
                            if (ids.some(x => String(x) !== String(id)))
                                break;
                            rows.push(node);
                            break;
                        }
                    const roots = outerRoots(rows);
                    return roots.length === 1 ? roots[0] : null;
                }
                function medicalCount(id) {
                    var _a;
                    const row = medicalRow(id);
                    if (!row)
                        return null;
                    const text = clean(row.innerText || row.textContent).replace(/\s*:\s*/g, ':'), name = medicalNames[id].replace(/\s*:\s*/g, ':').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const m = text.match(new RegExp('(?:^|\\s)[x×]\\s*(\\d+)\\s*' + name + '(?=\\s|$)', 'i')) || text.match(new RegExp(name + '\\s*[x×]\\s*(\\d+)\\b', 'i'));
                    if (m)
                        return Number(m[1]);
                    // A consumed final item can remain as a remove-act row, with its old data quantity.
                    // Require the row's own successful-use text and no visible quantity before treating it as zero.
                    const rowText = text.toLowerCase();
                    if (/(?:^|\s)remove-act(?:\s|$)/.test(String(row.className || '')) && rowText.includes('you use your ' + medicalNames[id].toLowerCase()))
                        return 0;
                    // Visible quantities update before Torn refreshes its cached quantity attributes.
                    for (const node of [row, ...row.querySelectorAll('[data-qty],[data-quantity]')])
                        for (const key of ['data-qty', 'data-quantity']) {
                            const q = (_a = node.getAttribute) === null || _a === void 0 ? void 0 : _a.call(node, key);
                            if (q != null && /^\d+$/.test(q))
                                return Number(q);
                        }
                    if (medicalUse(id) && !rowText.includes('you use your '))
                        return 1;
                    return null;
                }
                function medicalInventory() {
                    const rows = [];
                    for (const id of Object.keys(medicalNames).map(Number)) {
                        const q = medicalCount(id);
                        if (q !== null)
                            rows.push({ id, quantity: q });
                    }
                    return rows;
                }
                function medicalUse(id) {
                    const row = medicalRow(id);
                    if (!row)
                        return null;
                    const candidates = Array.from(row.querySelectorAll('button,a,[role="button"],[data-action],span,div')).filter(el => {
                        var _a;
                        return visible(el) && enabledControl(el, row.parentElement) &&
                            (/^(use|use item)$/i.test(labelOf(el)) || labelOf(el) === 'use ' + medicalNames[id].toLowerCase() || ((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'data-action')) === 'use' || (!labelOf(el) && /\b(use|check|consume)\b/.test(String(el.className || '').replace(/[-_]/g, ' '))));
                    });
                    const roots = outerRoots(candidates);
                    return roots.length === 1 ? roots[0] : null;
                }
                function medicalExpand(id) {
                    const row = medicalRow(id);
                    if (!row)
                        return null;
                    if ([row, ...row.querySelectorAll('[aria-expanded]')].some(x => { var _a; return ((_a = x.getAttribute) === null || _a === void 0 ? void 0 : _a.call(x, 'aria-expanded')) === 'true'; }))
                        return null;
                    const headers = outerRoots(Array.from(row.querySelectorAll('[role="tab"],[id*="ui-accordion-"]')).filter(el => { var _a, _b; return visible(el) && enabledControl(el, row.parentElement) && (((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'role')) === 'tab' || /-header-/.test(((_b = el.getAttribute) === null || _b === void 0 ? void 0 : _b.call(el, 'id')) || '')); }));
                    if (headers.length)
                        return headers.length === 1 ? headers[0] : null;
                    const names = Array.from(row.querySelectorAll('span,strong,b,h3,h4,a')).filter(el => { var _a; return visible(el) && !((_a = el.children) === null || _a === void 0 ? void 0 : _a.length) && sameMedicalName(el.textContent, medicalNames[id]); });
                    return names.length === 1 ? names[0] : null;
                }
                function medicalConfirm(id) {
                    const row = medicalRow(id), name = medicalNames[id];
                    if (!row || !name)
                        return null;
                    // Torn's inline medical prompt uses an empty confirmation link labelled by wai-action-desc.
                    const question = text => clean(text).replace(/\s+\?/g, '?').toLowerCase() === 'would you like to use the ' + name.toLowerCase() + '?' || clean(text).toLowerCase() === 'would you like to use ' + name.toLowerCase() + '?';
                    const prompts = Array.from(row.querySelectorAll('[id="wai-action-desc"],[role="status"]')).filter(el => visible(el) && question(el.textContent));
                    if (prompts.length === 1) {
                        const prompt = prompts[0], promptId = prompt.getAttribute('id');
                        const inline = Array.from(row.querySelectorAll('button,a,[role="button"]')).filter(el => {
                            if (!visible(el) || !enabledControl(el, row.parentElement))
                                return false;
                            const labels = [labelOf(el), el.getAttribute('aria-label'), el.getAttribute('title')];
                            const refs = clean(el.getAttribute('aria-labelledby')).split(' ');
                            return labels.some(question) || (promptId && refs.includes(promptId) && !labels.some(x => /cancel|no|send|trash/i.test(clean(x))));
                        });
                        if (inline.length)
                            return inline.length === 1 ? inline[0] : null;
                    }
                    const roots = outerRoots(Array.from(document.querySelectorAll('[role="dialog"],[class*="confirm"],[class*="Confirm"],[class*="modal"],[class*="dialog"]')).filter(el => visible(el) && clean(el.textContent).length < 1200 && clean(el.textContent).toLowerCase().includes(name.toLowerCase()) &&
                        !Object.entries(medicalNames).some(([other, label]) => Number(other) !== id && clean(el.textContent).toLowerCase().includes(label.toLowerCase()) && (id !== 68 || Number(other) !== 67))));
                    if (roots.length !== 1)
                        return null;
                    const buttons = Array.from(roots[0].querySelectorAll('button,a,[role="button"]')).filter(el => visible(el) && enabledControl(el, roots[0].parentElement) && /^(okay|ok|confirm|use)$/i.test(labelOf(el)));
                    return buttons.length === 1 ? buttons[0] : null;
                }
                function requestMedical(state, type, extra = {}, identity = medicalIdentity()) {
                    var _a;
                    const owner = identity.owner;
                    if (owner === null) {
                        if (state.stage !== 'smart-medical-identity')
                            state.medicalIdentityWaitAt = now();
                        state.medicalIdentityWaitAt = state.medicalIdentityWaitAt || now();
                        state.medicalIdentityRequest = { type, extra };
                        state.stage = 'smart-medical-identity';
                        state.status = 'Waiting for Torn to show this account\u2019s Name / profile identity. No item authorized.';
                        save(state);
                        return;
                    }
                    if (owner !== Number(state.playerId)) {
                        pauseState(state, 'Medical page belongs to player ' + owner + '; this worker expects ' + state.playerId + ' (profile ' + state.profileId + '). Check this profile\u2019s Torn login and API key. No item authorized.', true);
                        return;
                    }
                    state.medicalIdentityWaitAt = 0;
                    state.medicalIdentityLostAt = 0;
                    state.medicalIdentityReloads = 0;
                    state.medicalIdentityRequest = null;
                    state.medicalRequest = 'med_' + now() + '_' + Math.random().toString(36).slice(2);
                    state.medicalReplyAt = now();
                    state.stage = 'smart-medical-await';
                    state.status = type === 'tc-medical-plan' ? 'Checking hospital time and medical cooldown with Torn API.' : type === 'tc-medical-authorize' ? 'Checking medical permission before use.' : 'Verifying item use and hospital recovery with Torn API.';
                    save(state);
                    const continueVerifiedMedical = type === 'tc-medical-plan' && state.medicalContinueVerified === true;
                    if (type === 'tc-medical-plan') {
                        state.medicalContinueVerified = false;
                        save(state);
                    }
                    const cancelBeforeDispatch = type === 'tc-medical-plan' && state.medicalCancelBeforeDispatch === true;
                    if (type === 'tc-medical-plan') {
                        state.medicalCancelBeforeDispatch = false;
                        save(state);
                    }
                    post({ cancelBeforeDispatch, type, requestId: state.medicalRequest, profileId: state.profileId, orderId: state.orderId, medicalSession: state.medicalSession, browserPlayerId: owner, inventory: medicalInventory(), operationToken: ((_a = state.medicalOp) === null || _a === void 0 ? void 0 : _a.token) || '', medicalDispatched: state.medicalDispatched === true, continueVerifiedMedical, ...extra });
                }
                function replanMedical(state, reason, cancelBeforeDispatch = false) {
                    state.medicalReplans = Number(state.medicalReplans || 0) + 1;
                    if (state.medicalReplans > 3) {
                        pauseState(state, 'Medical state changed repeatedly; review before continuing. No uncertain item was retried.', true);
                        return;
                    }
                    beginHealing(state);
                    state.medicalCancelBeforeDispatch = cancelBeforeDispatch;
                    state.medicalReplanAt = now() + 3000;
                    state.status = reason;
                    save(state);
                }
                function waitMedicalIdentity(state, started) {
                    // Refresh only before dispatch. A dispatched operation must retain its receipt/token.
                    const elapsed = now() - Number(started || now());
                    if (state.medicalDispatched) {
                        if (elapsed > 60000)
                            pauseState(state, 'Account identity unavailable while verifying the previous medicine. No additional item used; resume after the sidebar returns.', true);
                        return;
                    }
                    if (elapsed < 15000)
                        return;
                    if (Number(state.medicalIdentityReloads || 0) >= 2) {
                        pauseState(state, 'Account identity is still unavailable after two safe Medical page refreshes. No item consumed.', true);
                        return;
                    }
                    state.medicalIdentityReloads = Number(state.medicalIdentityReloads || 0) + 1;
                    state.medicalIdentityWaitAt = 0;
                    state.medicalIdentityLostAt = 0;
                    state.medicalIdentityRequest = null;
                    state.stage = 'heal-open';
                    state.healEnteredAt = 0;
                    state.medicalClickedAt = 0;
                    state.medicalInventorySignature = '';
                    state.medicalInventorySettledAt = 0;
                    state.status = 'Refreshing Medical to restore account identity (' + state.medicalIdentityReloads + '/2). No item clicked.';
                    save(state);
                    location.assign(ITEMS_URL);
                }
                function smartMedicalTick(state) {
                    if (state.stage === 'smart-medical-identity') {
                        if (!medicalPage()) {
                            pauseState(state, 'Medical page changed while waiting for account identity.', true);
                            return;
                        }
                        const identity = medicalIdentity(), owner = identity.owner;
                        if (owner !== null) {
                            const request = state.medicalIdentityRequest;
                            if (!request) {
                                pauseState(state, 'Medical identity request was lost; stop and restart the worker.', true);
                                return;
                            }
                            requestMedical(state, request.type, request.extra || {}, identity);
                            return;
                        }
                        waitMedicalIdentity(state, state.medicalIdentityWaitAt);
                        return;
                    }
                    if (!medicalPage()) {
                        pauseState(state, 'Medical page changed. No further item clicks allowed.', true);
                        return;
                    }
                    const owner = medicalOwnId();
                    if (owner === null) {
                        state.medicalIdentityLostAt = state.medicalIdentityLostAt || now();
                        waitMedicalIdentity(state, state.medicalIdentityLostAt);
                        if (!state.running)
                            return;
                        state.status = 'Waiting for the medical account identity to finish refreshing. No item clicked.';
                        save(state);
                        return;
                    }
                    state.medicalIdentityLostAt = 0;
                    state.medicalIdentityReloads = 0;
                    if (owner !== Number(state.playerId)) {
                        pauseState(state, 'Medical page belongs to another account. No further item clicks allowed.', true);
                        return;
                    }
                    if (state.stage === 'medical-cooldown') {
                        if (now() < state.medicalWakeAt)
                            return;
                        state.medicalOp = null;
                        requestMedical(state, 'tc-medical-plan');
                        return;
                    }
                    if (state.stage === 'smart-medical-await') {
                        if (now() - state.medicalReplyAt > 45000)
                            pauseState(state, 'Medical backend did not verify state within 45 seconds. No action was retried.', true);
                        return;
                    }
                    const op = state.medicalOp;
                    if (!op || !medicalNames[op.itemId] || !sameMedicalName(op.name, medicalNames[op.itemId])) {
                        pauseState(state, 'Medical operation is missing or outside the allowlist. No item retry.', true);
                        return;
                    }
                    if (!state.medicalDispatched && now() > Date.parse(op.expires)) {
                        replanMedical(state, 'Unused medical plan expired; refreshing before any click.');
                        return;
                    }
                    if (state.stage === 'smart-medical-ready') {
                        if (medicalCount(op.itemId) !== op.quantity) {
                            replanMedical(state, 'Medical stock changed before dispatch; recalculating without a click.');
                            return;
                        }
                        const use = medicalUse(op.itemId);
                        if (!use) {
                            if (!state.medicalExpandedAt) {
                                const header = medicalExpand(op.itemId);
                                if (header) {
                                    state.medicalExpandedAt = now();
                                    save(state);
                                    click(header);
                                    return;
                                }
                            }
                            if (now() - Number(state.medicalExpandedAt || state.medicalReadyAt || state.medicalReplyAt) > 15000)
                                pauseState(state, 'Selected medical item did not expose one verified Use control. No item consumed.', true);
                            return;
                        }
                        requestMedical(state, 'tc-medical-authorize', { token: op.token });
                        return;
                    }
                    if (state.stage === 'smart-medical-execute') {
                        if (state.medicalDispatched) {
                            pauseState(state, 'Medical item already dispatched. Await verification before another item.', true);
                            return;
                        }
                        if (medicalCount(op.itemId) !== op.quantity) {
                            replanMedical(state, 'Selected medical supply changed or ran out. Recalculating from remaining permitted supplies.', true);
                            return;
                        }
                        const use = medicalUse(op.itemId);
                        if (!use) {
                            replanMedical(state, 'Unused medical control disappeared. Refreshing the remaining personal supplies.', true);
                            return;
                        }
                        state.medicalDispatched = true;
                        state.medicalUseAt = now();
                        state.medicalConfirmed = false;
                        state.stage = 'smart-medical-wait';
                        save(state);
                        if (!click(use))
                            pauseState(state, 'Medical click could not be dispatched; review before restarting.', true);
                        return;
                    }
                    if (state.stage === 'smart-medical-receipt-wait') {
                        if (now() < state.medicalVerifyAt)
                            return;
                        requestMedical(state, 'tc-medical-verify', { token: op.token });
                        return;
                    }
                    if (state.stage === 'smart-medical-wait') {
                        let count = medicalCount(op.itemId);
                        if (count === null && op.quantity === 1 && medicalVisible() && !medicalRow(op.itemId))
                            count = 0; // Backend still requires cooldown AND hospital evidence.
                        if (count === op.quantity - 1) {
                            requestMedical(state, 'tc-medical-verify', { token: op.token });
                            return;
                        }
                        if (count !== null && count !== op.quantity) {
                            pauseState(state, 'Medical stock changed by an unexpected amount; no retry.', true);
                            return;
                        }
                        const confirm = medicalConfirm(op.itemId);
                        if (confirm && !state.medicalConfirmed) {
                            state.medicalConfirmed = true;
                            save(state);
                            click(confirm);
                            return;
                        }
                        if (now() - state.medicalUseAt > 20000)
                            pauseState(state, 'Medical consumption not verified. No second item or drug fallback.', true);
                    }
                }
                function firstAidRow() {
                    var _a, _b;
                    const markers = Array.from(document.querySelectorAll('[data-item-id="67"],[data-id="67"],[data-item="67"],[data-itemid="67"]')).filter(visible);
                    for (const leaf of document.querySelectorAll('span,div,strong,b,h3,h4,p'))
                        if (visible(leaf) && !((_a = leaf.children) === null || _a === void 0 ? void 0 : _a.length) && clean(leaf.textContent) === 'First Aid Kit')
                            markers.push(leaf);
                    const rows = [];
                    for (const marker of markers) {
                        for (let node = marker, depth = 0; node && depth < 8; node = node.parentElement, depth++) {
                            const text = clean(node.textContent);
                            if (text.length > 1500 || /\bSmall First Aid Kit\b/i.test(text))
                                break;
                            const id = ['data-item-id', 'data-item', 'data-itemid'].map(k => { var _a; return (_a = node.getAttribute) === null || _a === void 0 ? void 0 : _a.call(node, k); }).find(Boolean);
                            if (id && id !== '67')
                                break;
                            const structural = ['li', 'tr'].includes(String(node.tagName || '').toLowerCase()) || id === '67' || ((_b = node.getAttribute) === null || _b === void 0 ? void 0 : _b.call(node, 'data-id')) === '67';
                            const hasUse = Array.from(node.querySelectorAll('button,a,[role="button"],[data-action]')).some(el => { var _a; return /^(use|use item|use first aid kit)$/i.test(labelOf(el)) || ((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'data-action')) === 'use'; });
                            const others = Array.from(node.querySelectorAll('[data-item-id],[data-item],[data-itemid]')).some(el => ['data-item-id', 'data-item', 'data-itemid'].some(k => { var _a; const v = (_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, k); return v && v !== '67'; }));
                            if (others)
                                break;
                            if ((structural || hasUse) && (id === '67' || /\bFirst Aid Kit\b/i.test(text))) {
                                rows.push(node);
                                break;
                            }
                        }
                    }
                    const roots = outerRoots(rows);
                    return roots.length === 1 ? roots[0] : null;
                }
                function firstAidExpandControl() {
                    const row = firstAidRow();
                    if (!row)
                        return null;
                    // An open or temporarily disabled item must not be toggled closed while its controls settle.
                    if ([row, ...row.querySelectorAll('[aria-expanded]')].some(el => { var _a; return ((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-expanded')) === 'true'; }))
                        return null;
                    if (Array.from(row.querySelectorAll('button,a,[role="button"]')).some(el => {
                        var _a;
                        return visible(el) &&
                            /^(use|use item|use first aid kit)$/i.test(labelOf(el)) && (el.disabled || ((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-disabled')) === 'true');
                    }))
                        return null;
                    // Click only the verified item's own name/image/header; never a generic page control.
                    const names = Array.from(row.querySelectorAll('span,strong,b,h3,h4,a,button,div'))
                        .filter(el => { var _a; return visible(el) && !((_a = el.children) === null || _a === void 0 ? void 0 : _a.length) && /^first aid kit$/i.test(clean(el.textContent)); });
                    const expanded = Array.from(row.querySelectorAll('[aria-expanded]')).filter(el => { var _a; return visible(el) && ((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-expanded')) === 'false'; });
                    const own = expanded.filter(el => /first aid kit/i.test(clean(el.textContent)) && !/small first aid kit/i.test(clean(el.textContent)));
                    if (own.length === 1)
                        return own[0];
                    // The item-name span is only a label in Torn's accordion layout.
                    // Activate the verified row's tab/header, where the expand handler lives.
                    const headers = Array.from(row.querySelectorAll('[role="tab"],[id*="ui-accordion-"]'))
                        .filter(el => {
                        var _a, _b;
                        return visible(el) && enabledControl(el, row.parentElement) &&
                            (((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'role')) === 'tab' || /-header-/.test(((_b = el.getAttribute) === null || _b === void 0 ? void 0 : _b.call(el, 'id')) || '')) &&
                            /\bFirst Aid Kit\b/i.test(clean(el.textContent)) && !/\bSmall First Aid Kit\b/i.test(clean(el.textContent));
                    });
                    const headerRoots = outerRoots(headers);
                    if (headerRoots.length)
                        return headerRoots.length === 1 ? headerRoots[0] : null;
                    if (names.length === 1)
                        return names[0];
                    const images = Array.from(row.querySelectorAll('img')).filter(el => {
                        var _a, _b, _c;
                        return visible(el) &&
                            (/^first aid kit$/i.test(clean(((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'alt')) || ((_b = el.getAttribute) === null || _b === void 0 ? void 0 : _b.call(el, 'title')))) || /\/items\/67(?:[/.?]|$)/i.test(((_c = el.getAttribute) === null || _c === void 0 ? void 0 : _c.call(el, 'src')) || ''));
                    });
                    return images.length === 1 ? images[0] : null;
                }
                function aidCount() {
                    var _a;
                    const row = firstAidRow();
                    if (!row)
                        return null;
                    const counts = [row, ...row.querySelectorAll('[data-qty],[data-quantity]')];
                    for (const node of counts)
                        for (const key of ['data-qty', 'data-quantity']) {
                            const value = (_a = node.getAttribute) === null || _a === void 0 ? void 0 : _a.call(node, key);
                            if (value !== null && value !== undefined && /^\d+$/.test(value))
                                return Number(value);
                        }
                    const match = clean(row.textContent).match(/First Aid Kit\s*[xÃ—]\s*(\d+)\b/i);
                    if (match)
                        return Number(match[1]);
                    const before = clean(row.textContent).match(/(?:^|\s)[xÃ—]\s*(\d+)\s*First Aid Kit\b/i);
                    return before ? Number(before[1]) : null;
                }
                function firstAidUseButton() {
                    const row = firstAidRow();
                    if (!row)
                        return null;
                    const candidates = Array.from(row.querySelectorAll('button,a,[role="button"],[tabindex],label,span,div'))
                        .filter(visible)
                        .filter(el => enabledControl(el, row.parentElement));
                    const exact = candidates.filter(el => {
                        var _a;
                        const label = labelOf(el);
                        const action = clean(((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'data-action')) || '').toLowerCase();
                        const cls = String(el.className || '').toLowerCase().replace(/[-_]/g, ' ');
                        return /^(use|use item|use first aid kit)$/i.test(label) || /^use$/i.test(action) || (!label && /\b(use|check|consume)\b/.test(cls));
                    });
                    const unique = exact.filter((el, i) => !exact.some((other, j) => { var _a; return i !== j && ((_a = other.contains) === null || _a === void 0 ? void 0 : _a.call(other, el)) && other !== el; }));
                    return unique.length === 1 ? unique[0] : (exact.length === 1 ? exact[0] : null);
                }
                function medicalTab() {
                    const nodes = Array.from(document.querySelectorAll('button,a,[role="tab"],[role="button"],li'))
                        .filter(visible)
                        .filter(el => { var _a, _b; return /^(medical|medicine|medical items)$/i.test(clean(((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'title')) || ((_b = el.getAttribute) === null || _b === void 0 ? void 0 : _b.call(el, 'aria-label')) || el.innerText || '')); });
                    const actions = nodes.filter(el => { var _a; return ['a', 'button'].includes(String(el.tagName || '').toLowerCase()) || ['tab', 'button'].includes((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'role')); });
                    const unique = (actions.length ? actions : nodes).filter(a => !(actions.length ? actions : nodes).some(b => { var _a; return b !== a && ((_a = a.contains) === null || _a === void 0 ? void 0 : _a.call(a, b)); }));
                    return unique.length === 1 ? unique[0] : null;
                }
                function medicalVisible() {
                    var _a;
                    const text = bodyText();
                    return /your items\s*[-â€\u201câ€\u201d]\s*medical\b/i.test(text) || firstAidRow() !== null || (((_a = load()) === null || _a === void 0 ? void 0 : _a.smartMedical) && medicalInventory().length > 0);
                }
                function confirmUseButton() {
                    // Confirm only inside a visible First Aid Kit dialog/inline confirmation.
                    const possibleRoots = Array.from(document.querySelectorAll('[role="dialog"],[class*="dialog"],[class*="Dialog"],[class*="modal"],[class*="Modal"],[class*="confirm"],[class*="Confirm"]'))
                        .filter(visible)
                        .filter(el => /\bFirst Aid Kit\b/i.test(clean(el.textContent)) && !/\bSmall First Aid Kit\b/i.test(clean(el.textContent)));
                    const roots = possibleRoots.length === 1 ? possibleRoots : [];
                    if (!roots.length) {
                        const buttons = Array.from(document.querySelectorAll('button,[role="button"],input[type="button"],a')).filter(visible);
                        const anchored = buttons.filter(el => {
                            var _a;
                            if (!/^(okay|ok|confirm)$/i.test(clean(el.innerText || el.value || ((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-label')) || '')))
                                return false;
                            let node = el;
                            for (let d = 0; node && d < 7; d++, node = node.parentElement) {
                                const text = clean(node.textContent);
                                if (text.length > 900)
                                    continue;
                                if (/\bFirst Aid Kit\b/i.test(text) && !/\bSmall First Aid Kit\b/i.test(text))
                                    return true;
                            }
                            return false;
                        });
                        return anchored.length === 1 ? anchored[0] : null;
                    }
                    const buttons = Array.from(roots[0].querySelectorAll('button,[role="button"],input[type="button"],a'))
                        .filter(visible)
                        .filter(el => { var _a; return !el.disabled && ((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-disabled')) !== 'true'; })
                        .filter(el => { var _a; return /^(okay|ok|confirm|use)$/i.test(clean(el.innerText || el.value || ((_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'aria-label')) || '')); });
                    return buttons.length === 1 ? buttons[0] : null;
                }
                function pauseState(state, reason, abandonClaim = false) {
                    state.lastFailure = { stage: state.stage, reason, at: now() };
                    state.running = false;
                    if (state.stage !== 'paused')
                        state.previousStage = state.stage;
                    state.stage = 'paused';
                    state.pendingClaimRequest = '';
                    state.status = reason;
                    if (abandonClaim && state.claimId) {
                        post({ type: 'tc-loss-abandon', profileId: state.profileId, slot: state.slot, orderId: state.orderId, claimId: state.claimId, reason });
                        state.claimId = '';
                    }
                    return save(state);
                }
                function openPage(state, url, label, abandon = false) {
                    const time = now();
                    if (state.navigationUrl !== url) {
                        state.navigationUrl = url;
                        state.navigationStartedAt = time;
                        state.navigationAttempts = 0;
                    }
                    if (time - state.navigationStartedAt >= 30000) {
                        pauseState(state, label + ' did not open within 30 seconds. Inspect the worker browser for login, verification or navigation errors.', abandon);
                        return;
                    }
                    if (state.navigationAttempts && time - Number(state.navigationLastAt || 0) < 15000)
                        return;
                    if (Number(state.navigationAttempts || 0) >= 2)
                        return;
                    state.navigationAttempts = Number(state.navigationAttempts || 0) + 1;
                    state.navigationLastAt = time;
                    state.status = 'Opening ' + label + ' (' + state.navigationAttempts + '/2).';
                    save(state);
                    try {
                        location.assign(url);
                    }
                    catch (error) {
                        pauseState(state, 'Navigation failed: ' + error.message, abandon);
                    }
                }
                function beginHealing(state) {
                    state.stage = 'heal-open';
                    state.healEnteredAt = 0;
                    state.aidExpandedAt = 0;
                    state.medicalClickedAt = 0;
                    state.medicalInventorySignature = '';
                    state.medicalInventorySettledAt = 0;
                    state.medicalContinueVerified = false;
                    state.medicalCancelBeforeDispatch = false;
                    state.medicalIdentityWaitAt = 0;
                    state.medicalIdentityLostAt = 0;
                    state.medicalIdentityReloads = 0;
                    state.medicalIdentityRequest = null;
                    state.healClickedAt = 0;
                    state.healBeforeCount = null;
                    state.confirmClicked = false;
                }
                function openAttack(state) { openPage(state, ATTACK_URL(state.targetId), 'attack page', true); }
                function levelingChoice(state) {
                    if (state.mode !== 'level')
                        return false;
                    const dialogs = [...document.querySelectorAll('[role="dialog"],[class*="ui-dialog"]')].filter(visible);
                    for (const dialog of dialogs) {
                        if (!/level/i.test(clean(dialog.textContent)))
                            continue;
                        const controls = [...dialog.querySelectorAll('button,a,input[type="button"],input[type="submit"]')].filter(visible);
                        const label = el => clean(el.textContent || el.value).toLowerCase();
                        const hold = controls.filter(el => /^(hold(?: (?:my |current )?level)?|remain (?:at )?(?:this|current) level)$/.test(label(el)));
                        const accept = controls.filter(el => /^(level up|upgrade(?: level)?|accept level(?: up)?)$/.test(label(el)));
                        if (hold.length !== 1 || accept.length !== 1)
                            continue;
                        if (medicalOwnId() !== Number(state.playerId)) {
                            pauseState(state, 'Level-up choice needs verified account identity. No choice clicked.', false);
                            return true;
                        }
                        if (state.levelChoiceAt) {
                            if (now() - state.levelChoiceAt > 15000)
                                pauseState(state, 'Level-up choice did not close. Check the dialog; no repeated click.', false);
                            return true;
                        }
                        const target = state.acceptLevelUps === true ? accept[0] : hold[0];
                        if (!enabledControl(target, dialog))
                            return true;
                        state.levelChoiceAt = now();
                        state.status = state.acceptLevelUps ? 'Accepting the offered level-up.' : 'Holding the current level.';
                        save(state);
                        target.click();
                        return true;
                    }
                    if (state.levelChoiceAt) {
                        state.levelChoiceAt = 0;
                        save(state);
                    }
                    return false;
                }
                async function tick() {
                    var _a;
                    if (document.hidden)
                        return;
                    if (busy)
                        return;
                    busy = true;
                    try {
                        let state = load();
                        if (!state)
                            return;
                        report(state);
                        if (!state.running)
                            return;
                        if (state.navigationUrl && ((state.navigationUrl === ITEMS_URL && isItemsPage()) ||
                            (state.navigationUrl !== ITEMS_URL && isAttackPage(state.targetId)))) {
                            state.navigationUrl = '';
                            if (state.stage === 'recovery-probe' || state.stage === 'final-recovery')
                                state.probeStartedAt = now();
                            save(state);
                        }
                        const session = sessionStorage.getItem(SESSION_KEY);
                        if (!session || session !== state.sessionToken) {
                            state.running = false;
                            state.previousStage = state.stage;
                            state.stage = 'paused';
                            state.status = 'Previous auto-cycle session detected after browser/app restart. Press Resume explicitly.';
                            save(state);
                            return;
                        }
                        if (challengeVisible()) {
                            pauseState(state, 'Verification screen detected. Auto-cycle paused; resolve it manually before resuming.', state.stage !== 'fight');
                            return;
                        }
                        if (state.externalDeadline > 0 && now() >= state.externalDeadline && ['claim', 'attack-open', 'fight'].includes(state.stage) && !levelingContinueControl() && detectFightResult(state) !== 'loss') {
                            pauseState(state, 'External claim deadline reached. No further attack authorized; refresh seller status.', false);
                            return;
                        }
                        if (levelingChoice(state))
                            return;
                        if (isItemsPage() && /^TORN\s*[-\u2013\u2014]\s*50[0-4]\s*Error$/i.test(clean(document.title))) {
                            if (state.medicalDispatched) {
                                pauseState(state, 'Torn returned a server error after an item dispatch. Resume only after the page recovers; no item will be repeated.', true);
                                return;
                            }
                            state.medicalServerSince = state.medicalServerSince || now();
                            if (now() - state.medicalServerSince < 3000) {
                                state.status = 'Torn returned a server error. Waiting before a safe page reload; no item clicked.';
                                save(state);
                                return;
                            }
                            if (state.medicalServerLastAt && now() - state.medicalServerLastAt < 15000)
                                return;
                            if (Number(state.medicalServerAttempts || 0) >= 2) {
                                pauseState(state, 'Torn medical page still returns a server error after two reloads. Try again later; no item consumed.', true);
                                return;
                            }
                            state.medicalServerAttempts = Number(state.medicalServerAttempts || 0) + 1;
                            state.medicalServerLastAt = now();
                            state.status = 'Retrying Torn medical server error (' + state.medicalServerAttempts + '/2). No item clicked.';
                            save(state);
                            location.assign(ITEMS_URL);
                            return;
                        }
                        if (now() - Number(state.startedAt || now()) > 12 * 60 * 60 * 1000) {
                            pauseState(state, '12-hour auto-cycle safety limit reached. Review the order before resuming.', true);
                            return;
                        }
                        if (state.mode === 'level' && state.stage === 'level-target-wait') {
                            if (now() < state.levelTargetWakeAt)
                                return;
                            state.stage = 'claim';
                            state.status = 'A hospitalized target is due out. Rechecking availability.';
                            save(state);
                            return;
                        }
                        if (state.mode === 'level' && state.stage === 'level-api-wait') {
                            if (now() < state.levelApiWakeAt)
                                return;
                            state.stage = state.levelApiReturnStage;
                            state.replyWaitAt = now();
                            if (state.stage === 'level-verify')
                                state.levelVerifyAt = now();
                            save(state);
                            return;
                        }
                        if (state.stage === 'claim') {
                            if (now() < Number(state.retryAt || 0))
                                return;
                            const requestId = 'claim_' + now() + '_' + Math.random().toString(36).slice(2);
                            state.claimAttempts = Number(state.claimAttempts || 0) + 1;
                            state.replyWaitAt = now();
                            state.pendingClaimRequest = requestId;
                            state.stage = 'claim-wait';
                            state.status = state.mode === 'level' ? 'Checking target availability with Commander.' : 'Requesting the next loss slot from Commander.';
                            save(state);
                            post({ type: 'tc-loss-claim', requestId, profileId: state.profileId, slot: state.slot, orderId: state.orderId, targetId: state.targetId });
                            return;
                        }
                        if (state.mode === 'level' && state.claimId && ['level-finish', 'level-verify'].includes(state.stage) && levelingContinueControl())
                            state.levelTerminalSeen = true;
                        if (state.mode === 'level' && state.stage === 'level-finish') {
                            if (levelingContinueControl()) {
                                levelCommit(state, true);
                                return;
                            }
                            const leave = levelingLeaveControl();
                            if (leave) {
                                state.levelLeaveClicked = true;
                                save(state);
                                if (click(leave))
                                    levelCommit(state);
                                else
                                    pauseState(state, 'Leave control changed before dispatch. Review the fight.', false);
                                return;
                            }
                            if (now() - state.levelFinishAt > 20000)
                                pauseState(state, 'A single verified Leave control did not appear. Finish the fight manually, then Resume to verify its receipt.', false);
                            return;
                        }
                        if (state.mode === 'level' && state.stage === 'level-verify') {
                            if (now() < state.levelVerifyAt)
                                return;
                            if (Number(state.commitAttempts || 1) >= 8) {
                                pauseState(state, 'Official attack log did not update after eight checks. Resume verifies this same fight; no new attack will start.', false);
                                return;
                            }
                            state.commitAttempts = Number(state.commitAttempts || 1) + 1;
                            state.stage = 'commit-wait';
                            state.replyWaitAt = now();
                            save(state);
                            post({ type: 'tc-loss-commit', profileId: state.profileId, orderId: state.orderId, claimId: state.claimId, terminal: !!state.levelTerminalSeen });
                            return;
                        }
                        if (state.stage === 'claim-wait' || state.stage === 'commit-wait') {
                            if (!state.replyWaitAt) {
                                state.replyWaitAt = now();
                                save(state);
                                return;
                            }
                            if (now() - state.replyWaitAt < (state.mode === 'level' ? 60000 : 10000))
                                return;
                            if (state.stage === 'claim-wait') {
                                state.pendingClaimRequest = '';
                                if (Number(state.claimAttempts || 0) >= 3) {
                                    pauseState(state, 'Commander did not acknowledge the slot after three requests. No attack started; check the worker connection.', true);
                                }
                                else {
                                    state.stage = 'claim';
                                    state.retryAt = now();
                                    state.status = 'Slot reply missing; retrying the same worker reservation.';
                                    save(state);
                                }
                            }
                            else {
                                if (Number(state.commitAttempts || 1) >= 3) {
                                    pauseState(state, 'Loss acknowledgement missing after three requests. The visible loss is retained for reconciliation; Resume retries this same claim, never a new attack.', false);
                                }
                                else {
                                    state.commitAttempts = Number(state.commitAttempts || 1) + 1;
                                    state.replyWaitAt = now();
                                    state.status = 'Loss reply missing; replaying the same commit receipt without a new fight.';
                                    save(state);
                                    postVisibleLoss(state);
                                }
                            }
                            return;
                        }
                        if (state.mode !== 'level' && state.stage === 'loss-verify') {
                            lossTerminalCheck(state);
                            return;
                        }
                        if (state.stage === 'attack-open') {
                            if (!isAttackPage(state.targetId)) {
                                openAttack(state);
                                return;
                            }
                            if (hospitalBanner()) {
                                if (Number(state.kitsThisLoss || 0) >= Number(state.maxKits || 4)) {
                                    pauseState(state, `Still hospitalized after ${state.kitsThisLoss || 0} First Aid Kits. Kit limit reached.`, true);
                                    return;
                                }
                                beginHealing(state);
                                state.status = 'Hospital block detected. Opening Items for recovery.';
                                save(state);
                                openPage(state, ITEMS_URL, 'Items / Medical');
                                return;
                            }
                            if (state.mode === 'level' && /a mission is needed to be activated in order to attack this npc/i.test(bodyText())) {
                                const claimId = state.claimId;
                                state.claimId = '';
                                state.stage = 'claim';
                                state.pendingClaimRequest = '';
                                state.status = 'Mission-only NPC skipped. Looking for a player target.';
                                save(state);
                                post({ type: 'tc-loss-skip', profileId: state.profileId, orderId: state.orderId, claimId, reason: 'Mission-only NPC' });
                                return;
                            }
                            if (state.mode === 'level' && /(?:this player|this person|your target|the target) (?:is |is currently |has been )?(?:in (?:the )?hospital|in jail|traveling|travelling|abroad|unavailable|already in a fight)/i.test(bodyText())) {
                                const claimId = state.claimId;
                                state.claimId = '';
                                state.stage = 'claim';
                                state.pendingClaimRequest = '';
                                state.status = 'Target became unavailable. Skipping to the next account.';
                                save(state);
                                post({ type: 'tc-loss-skip', profileId: state.profileId, orderId: state.orderId, claimId });
                                return;
                            }
                            if (insufficientEnergy()) {
                                pauseForEnergy(state);
                                return;
                            }
                            const join = joinFightButton();
                            if (!join) {
                                if (!state.attackWaitStartedAt) {
                                    state.attackWaitStartedAt = now();
                                    state.status = 'Waiting for a verified Join Fight control.';
                                    save(state);
                                }
                                if (now() - state.attackWaitStartedAt > 60000) {
                                    pauseState(state, 'JOIN FIGHT was not found for 60 seconds. Torn layout may have changed.', true);
                                }
                                return;
                            }
                            state.attackWaitStartedAt = 0;
                            state.stage = 'fight';
                            state.fightStartedAt = now();
                            state.fightOpenedAt = state.fightStartedAt;
                            state.lossObservedAt = 0;
                            state.lastPillowAt = 0;
                            state.pillowTurns = 0;
                            state.status = 'JOIN FIGHT clicked. Looking for the equipped Pillow.';
                            save(state);
                            click(join);
                            return;
                        }
                        if (state.stage === 'fight') {
                            if (!isAttackPage(state.targetId)) {
                                pauseState(state, 'Attack page changed during the fight. Paused rather than guessing the result.', false);
                                return;
                            }
                            if (state.mode === 'level' && levelingContinueControl()) {
                                levelCommit(state, true);
                                return;
                            }
                            if (state.mode === 'level' && levelingLeaveControl(true)) {
                                state.stage = 'level-finish';
                                state.levelFinishAt = now();
                                state.status = 'Finishing choices are visible. Preparing Leave.';
                                save(state);
                                return;
                            }
                            const outcome = detectFightResult(state);
                            if (outcome === 'loss' && state.requireOfficialLoss) {
                                lossTerminalCheck(state);
                                return;
                            }
                            if (outcome === 'loss') {
                                state.lossObservedAt = now();
                                state.stage = 'commit-wait';
                                state.commitAttempts = 1;
                                state.replyWaitAt = now();
                                state.status = 'Visible loss detected. Committing exactly one loss to Commander.';
                                save(state);
                                postVisibleLoss(state);
                                return;
                            }
                            if (outcome === 'win' && state.mode === 'level') {
                                state.stage = 'level-finish';
                                state.levelFinishAt = now();
                                state.status = 'Fight won. Looking for a single Leave control.';
                                save(state);
                                return;
                            }
                            if (outcome === 'win') {
                                pauseState(state, 'Fight result was NOT a loss. Nothing was counted; review the order.', true);
                                return;
                            }
                            if (state.mode !== 'level' && levelingContinueControl()) {
                                lossTerminalCheck(state);
                                return;
                            }
                            if (state.mode === 'level' && hospitalBanner()) {
                                if (Number(state.pillowTurns || 0) > 0) {
                                    levelCommit(state);
                                    return;
                                }
                                beginHealing(state);
                                state.status = 'Hospitalized before combat began. Recovering before retrying this target.';
                                save(state);
                                openPage(state, ITEMS_URL, 'Items / Medical');
                                return;
                            }
                            if (insufficientEnergy()) {
                                pauseForEnergy(state);
                                return;
                            }
                            if (now() - Number(state.fightStartedAt || now()) > 9 * 60 * 1000) {
                                pauseState(state, 'No clear fight result after nine minutes. Paused rather than guessing.', false);
                                return;
                            }
                            if (Number(state.pillowTurns || 0) >= MAX_PILLOW_TURNS) {
                                pauseState(state, state.mode === 'level' ? '100 combat actions reached without a verified result. Paused for review; no win counted.' : '100 Pillow attempts reached without a visible result. Fight paused; check the combat page before resuming. Nothing was counted.', false);
                                return;
                            }
                            if (now() - Number(state.lastPillowAt || 0) < attackDelay((_a = state.attackDelayMs) !== null && _a !== void 0 ? _a : 1900))
                                return;
                            if (state.mode === 'level' && levelingEmptyGun(state)) {
                                pauseState(state, 'Selected gun has no ammo. Equip ammunition or choose an equipped melee weapon; no empty-gun clicks or win counted.', false);
                                return;
                            }
                            const pillow = state.mode === 'level' ? levelingWeapon(state) : pillowControl();
                            if (!pillow) {
                                state.pillowMissingSince = state.pillowMissingSince || now();
                                state.status = state.mode === 'level' ? 'Selected fighting weapon is unavailable, empty, or ambiguous. Waiting for its verified attack control.' : 'Pillow control not found or not ready yet. Waiting for Torn combat UI to settle.';
                                save(state);
                                if (now() - state.pillowMissingSince > 45000)
                                    pauseState(state, state.mode === 'level' ? 'Selected fighting weapon could not be verified for 45 seconds. Check equipment/ammo; no alternative weapon was clicked.' : 'Pillow control could not be identified for 45 seconds. Auto-cycle paused.', false);
                                return;
                            }
                            if (state.mode === 'level' && /\breload\b/i.test(labelOf(pillow))) {
                                const signature = labelOf(pillow);
                                if (state.levelReloadSignature === signature) {
                                    if (now() - state.levelReloadAt > 10000)
                                        pauseState(state, 'Selected gun still shows Reload after ten seconds. No repeated reload click or win counted.', false);
                                    return;
                                }
                                state.levelReloadSignature = signature;
                                state.levelReloadAt = now();
                                save(state);
                            }
                            else if (state.mode === 'level') {
                                state.levelReloadSignature = '';
                            }
                            if (!click(pillow)) {
                                state.status = 'Pillow changed before the click. Rechecking the current weapon control.';
                                save(state);
                                return;
                            }
                            state.pillowMissingSince = 0;
                            state.pillowTurns = Number(state.pillowTurns || 0) + 1;
                            state.lastPillowAt = now();
                            state.status = state.mode === 'level' ? `Leveling turn ${state.pillowTurns}; watching for the fight result.` : `Pillow turn ${state.pillowTurns}; watching for the visible loss result.`;
                            save(state);
                            return;
                        }
                        if (state.smartMedical && (state.stage.startsWith('smart-medical-') || state.stage === 'medical-cooldown')) {
                            smartMedicalTick(state);
                            return;
                        }
                        if (state.stage === 'heal-open') {
                            if (!isItemsPage()) {
                                state.status = 'Opening Items / Medical.';
                                save(state);
                                openPage(state, ITEMS_URL, 'Items / Medical');
                                return;
                            }
                            if (!state.healEnteredAt) {
                                state.healEnteredAt = now();
                                save(state);
                            }
                            if (!medicalVisible()) {
                                if (!state.medicalClickedAt) {
                                    const tab = medicalTab();
                                    if (!tab) {
                                        if (now() - state.healEnteredAt > 45000)
                                            pauseState(state, 'Medical tab could not be identified. Auto-cycle paused before using any item.', true);
                                        return;
                                    }
                                    state.medicalClickedAt = now();
                                    state.status = 'Opening the Medical category.';
                                    save(state);
                                    click(tab);
                                    return;
                                }
                                if (now() - state.medicalClickedAt > 10000) {
                                    pauseState(state, 'Medical category did not open after the click. No medicine was consumed.', true);
                                }
                                return;
                            }
                            state.medicalClickedAt = 0;
                            if (state.smartMedical) {
                                if (now() < Number(state.medicalReplanAt || 0))
                                    return;
                                const signature = JSON.stringify(medicalInventory());
                                if (state.medicalInventorySignature !== signature) {
                                    state.medicalInventorySignature = signature;
                                    state.medicalInventorySettledAt = now();
                                    save(state);
                                    return;
                                }
                                if (now() - Number(state.medicalInventorySettledAt || 0) < 1250)
                                    return;
                                state.medicalInventorySignature = '';
                                state.medicalExpandedAt = 0;
                                if (!state.medicalOp)
                                    state.medicalDispatched = false;
                                requestMedical(state, 'tc-medical-plan');
                                return;
                            }
                            if (Number(state.kitsThisLoss || 0) >= Number(state.maxKits || 4)) {
                                pauseState(state, 'First Aid Kit limit reached. Review hospital time before continuing.', true);
                                return;
                            }
                            const existingConfirm = confirmUseButton();
                            if (existingConfirm && state.healClickedAt) {
                                state.stage = 'heal-wait';
                                save(state);
                                return;
                            }
                            const use = firstAidUseButton();
                            if (!use) {
                                if (aidCount() === 0) {
                                    pauseState(state, 'No First Aid Kits remain in the verified item row.', true);
                                    return;
                                }
                                if (state.aidExpandedAt) {
                                    if (now() - state.aidExpandedAt > 15000)
                                        pauseState(state, 'First Aid Kit expansion was requested, but its Use control did not appear within 15 seconds. Copy the worker diagnostic; no item was consumed.', true);
                                    return;
                                }
                                const expand = firstAidExpandControl();
                                if (expand) {
                                    state.aidExpandedAt = now();
                                    state.status = 'Requested First Aid Kit expansion; waiting for its Use control.';
                                    save(state);
                                    click(expand);
                                    return;
                                }
                                if (now() - state.healEnteredAt > 65000)
                                    pauseState(state, 'First Aid Kit Use/checkmark or item header could not be identified. Auto-cycle paused before consuming anything.', true);
                                return;
                            }
                            state.aidExpandedAt = 0;
                            state.healBeforeCount = aidCount();
                            state.healClickedAt = now();
                            state.confirmClicked = false;
                            state.stage = 'heal-wait';
                            state.status = `Using one First Aid Kit (${state.kitsThisLoss || 0}/${state.maxKits || 4} used for this recovery so far).`;
                            save(state);
                            click(use);
                            return;
                        }
                        if (state.stage === 'heal-wait') {
                            if (!isItemsPage()) {
                                pauseState(state, 'Items page changed during healing. Paused to avoid double-using medicine.', true);
                                return;
                            }
                            if (now() - Number(state.healClickedAt || now()) > 25000) {
                                pauseState(state, 'First Aid Kit use was not visibly confirmed within 25 seconds. Paused to avoid double-using medicine.', true);
                                return;
                            }
                            const confirm = confirmUseButton();
                            if (confirm && !state.confirmClicked) {
                                state.confirmClicked = true;
                                state.status = 'Confirming First Aid Kit use.';
                                save(state);
                                click(confirm);
                                return;
                            }
                            const current = aidCount();
                            const before = state.healBeforeCount;
                            if (before !== null && before !== undefined && current !== null && current < before) {
                                if (current !== before - 1) {
                                    pauseState(state, 'First Aid Kit count changed by more than one. Paused for manual review.', true);
                                    return;
                                }
                                state.kitsThisLoss = Number(state.kitsThisLoss || 0) + 1;
                                state.stage = 'recovery-probe';
                                state.probeStartedAt = now();
                                state.status = `One First Aid Kit consumed. Checking hospital status before the next attack.`;
                                save(state);
                                openPage(state, ATTACK_URL(state.targetId), 'attack recovery page');
                                return;
                            }
                            // Some inventory layouts hide the count. Once the confirmation disappears, probe the attack page rather than consuming another kit blindly.
                            if (state.confirmClicked && !confirm && now() - Number(state.healClickedAt || now()) > 3500) {
                                state.kitsThisLoss = Number(state.kitsThisLoss || 0) + 1;
                                state.stage = 'recovery-probe';
                                state.probeStartedAt = now();
                                state.status = 'Item confirmation closed. Probing the attack page before deciding whether another kit is needed.';
                                save(state);
                                openPage(state, ATTACK_URL(state.targetId), 'attack recovery page');
                            }
                            return;
                        }
                        if (state.stage === 'recovery-probe' || state.stage === 'final-recovery') {
                            if (!isAttackPage(state.targetId)) {
                                openPage(state, ATTACK_URL(state.targetId), 'attack recovery page');
                                return;
                            }
                            if (now() - Number(state.probeStartedAt || now()) < 1600)
                                return;
                            if (hospitalBanner()) {
                                if (Number(state.kitsThisLoss || 0) >= Number(state.maxKits || 4)) {
                                    pauseState(state, `Still hospitalized after ${state.kitsThisLoss || 0} First Aid Kits. Kit limit reached.`, true);
                                    return;
                                }
                                beginHealing(state);
                                state.medicalClickedAt = 0;
                                state.status = 'Still hospitalized. Returning to Medical for one more First Aid Kit.';
                                save(state);
                                openPage(state, ITEMS_URL, 'Items / Medical');
                                return;
                            }
                            const join = joinFightButton();
                            if (join || insufficientEnergy()) {
                                if (state.finishAfterRecovery) {
                                    state.running = false;
                                    state.stage = 'complete';
                                    state.claimId = '';
                                    state.status = 'All requested losses are recorded and final recovery is confirmed.';
                                    save(state);
                                    post({ type: 'tc-loss-finished', profileId: state.profileId, slot: state.slot, orderId: state.orderId });
                                    return;
                                }
                                if (insufficientEnergy()) {
                                    pauseForEnergy(state);
                                    return;
                                }
                                // Recovery before a fight still owns its reservation. Keep it until
                                // a visible loss is committed or it is explicitly abandoned.
                                state.stage = state.claimId ? 'attack-open' : 'claim';
                                state.claimAttempts = 0;
                                state.attackWaitStartedAt = 0;
                                state.kitsThisLoss = 0;
                                state.status = state.claimId ? 'Recovered. Continuing the reserved attack.' : 'Recovered. Requesting the next loss slot.';
                                save(state);
                                return;
                            }
                            state.recoveryProbe = { elapsedMs: now() - Number(state.probeStartedAt || now()), readyState: document.readyState || 'unknown', startControls: joinFightCandidates().length };
                            if (now() - Number(state.probeStartedAt || now()) > 60000) {
                                pauseState(state, 'Recovery page did not expose one verified Start Fight control within 60 seconds. No extra item was used. Copy worker diagnostic.', true);
                            }
                            return;
                        }
                        pauseState(state, `Unexpected auto-cycle state: ${state.stage}.`, true);
                    }
                    catch (e) {
                        const state = load();
                        if (state === null || state === void 0 ? void 0 : state.running)
                            pauseState(state, `Auto-cycle error: ${String((e === null || e === void 0 ? void 0 : e.message) || e).slice(0, 180)}`, true);
                    }
                    finally {
                        busy = false;
                    }
                }
                window.FFMobileLossCycle = {
                    start(config) {
                        var _a;
                        const token = 'sess_' + now() + '_' + Math.random().toString(36).slice(2);
                        sessionStorage.setItem(SESSION_KEY, token);
                        const state = {
                            requireOfficialLoss: config.requireOfficialLoss === true, localLossTracking: config.localLossTracking === true, externalDeadline: Number(config.externalDeadline) || 0, mode: config.mode === 'level' ? 'level' : 'loss', acceptLevelUps: config.acceptLevelUps === true, weaponSlot: String(config.weaponSlot || 'weapon_primary'),
                            profileId: String(config.profileId || ''),
                            slot: String(config.slot || ''),
                            orderId: String(config.orderId || ''),
                            targetId: String(config.targetId || ''),
                            selfName: String(config.selfName || ''),
                            smartMedical: config.smartMedical === true, playerId: Number(config.playerId || 0), medicalSession: String(config.medicalSession || ''),
                            attackDelayMs: attackDelay((_a = config.attackDelayMs) !== null && _a !== void 0 ? _a : 1900),
                            maxKits: Math.max(1, Math.min(8, Number(config.maxKits || 4))),
                            running: true,
                            stage: config.smartMedical === true ? 'heal-open' : 'claim',
                            claimId: '',
                            startedAt: now(),
                            sessionToken: token,
                            kitsThisLoss: 0,
                            pillowTurns: 0,
                            status: 'Auto-cycle armed. Requesting the first loss slot from Commander.'
                        };
                        save(state);
                        return true;
                    },
                    setExternalDeadline(milliseconds) { const state = load(); if (!state || !Number.isFinite(Number(milliseconds)))
                        return false; state.externalDeadline = Math.max(0, Number(milliseconds)); save(state); return true; },
                    recoverFromHospital() { const state = load(); if (!(state === null || state === void 0 ? void 0 : state.running) || state.claimId)
                        return false; state.pendingClaimRequest = ''; beginHealing(state); save(state); openPage(state, ITEMS_URL, 'Items / Medical'); return true; },
                    setAttackDelay(milliseconds) {
                        const value = Number(milliseconds);
                        if (!Number.isFinite(value) || value < 500 || value > 5000)
                            return false;
                        const state = load();
                        if (!state)
                            return false;
                        state.attackDelayMs = attackDelay(value);
                        save(state);
                        return true;
                    },
                    pause() {
                        const state = load();
                        if (!state)
                            return false;
                        pauseState(state, 'Paused from Torn Commander.', false);
                        return true;
                    },
                    resume() {
                        const state = load();
                        if (!state || state.running)
                            return false;
                        const token = sessionStorage.getItem(SESSION_KEY) || ('sess_' + now() + '_' + Math.random().toString(36).slice(2));
                        sessionStorage.setItem(SESSION_KEY, token);
                        state.sessionToken = token;
                        state.running = true;
                        const reconcile = (state.previousStage === 'commit-wait' || state.mode === 'level' && ['level-verify', 'level-finish'].includes(state.previousStage)) && !!state.claimId;
                        const resumeLossReceipt = state.mode !== 'level' && state.previousStage === 'loss-verify' && !!state.claimId;
                        const resumeFight = state.claimId && state.previousStage === 'fight' && isAttackPage(state.targetId);
                        // Resume the pending medical operation before requesting another attack.
                        // A dispatched item is observed/verified only; it must never be clicked again.
                        const resumeMedical = state.smartMedical && (state.medicalOp || state.previousStage === 'smart-medical-identity') && String(state.previousStage || '').startsWith('smart-medical-');
                        state.stage = resumeLossReceipt ? 'loss-verify' : resumeMedical ? (state.medicalDispatched ? 'smart-medical-wait' : 'heal-open') : reconcile ? 'commit-wait' : resumeFight ? 'fight' : state.claimId ? 'recovery-probe' : 'claim';
                        if (resumeMedical && !state.medicalDispatched) {
                            state.medicalIdentityWaitAt = 0;
                            state.medicalIdentityLostAt = 0;
                            state.medicalIdentityReloads = 0;
                            state.medicalIdentityRequest = null;
                            state.medicalInventorySignature = '';
                            state.medicalExpandedAt = 0;
                            state.healEnteredAt = 0;
                        }
                        if (resumeLossReceipt) {
                            state.lossVerifyAttempts = 0;
                            state.lossVerifyAt = 0;
                        }
                        if (resumeFight) {
                            state.pillowMissingSince = 0;
                            state.fightStartedAt = now();
                        }
                        state.claimAttempts = 0;
                        state.commitAttempts = 1;
                        state.replyWaitAt = now();
                        state.pendingClaimRequest = '';
                        state.probeStartedAt = now();
                        state.status = 'Resumed from Commander. Rechecking page state before the next action.';
                        save(state);
                        if (reconcile)
                            postVisibleLoss(state);
                        return true;
                    },
                    stop() {
                        const state = load();
                        if (!state)
                            return false;
                        if (state.claimId)
                            post({ type: 'tc-loss-abandon', profileId: state.profileId, slot: state.slot, orderId: state.orderId, claimId: state.claimId, reason: 'Stopped from Commander' });
                        state.running = false;
                        state.previousStage = state.stage;
                        state.stage = 'stopped';
                        state.pendingClaimRequest = '';
                        state.claimId = '';
                        state.status = 'Stopped from Torn Commander.';
                        save(state);
                        return true;
                    },
                    reset() { clear(); return true; },
                    onClaim(requestId, ok, claimId, message) {
                        const state = load();
                        if (!state || !state.running || state.stage !== 'claim-wait' || state.pendingClaimRequest !== requestId) {
                            // A late grant cannot wake a stopped/paused worker. Release only when no
                            // active request/fight could still own the same reservation.
                            if (ok && claimId && (!state || !state.running) && (state === null || state === void 0 ? void 0 : state.claimId) !== claimId)
                                post({ type: 'tc-loss-abandon', profileId: (state === null || state === void 0 ? void 0 : state.profileId) || '', slot: (state === null || state === void 0 ? void 0 : state.slot) || '', orderId: (state === null || state === void 0 ? void 0 : state.orderId) || '', claimId, reason: 'Late grant after stop/pause' });
                            return false;
                        }
                        state.claimAttempts = 0;
                        state.pendingClaimRequest = '';
                        if (!ok) {
                            if (/complete|finished|no remaining/i.test(String(message || ''))) {
                                state.running = false;
                                state.stage = 'complete';
                                state.status = message || 'No losses remain.';
                                save(state);
                                if (state.mode === 'level')
                                    post({ type: 'tc-loss-finished', profileId: state.profileId, orderId: state.orderId });
                                return true;
                            }
                            if (/paused|no longer exists|assigned to/i.test(String(message || ''))) {
                                pauseState(state, message || 'Order cannot run.', false);
                                return true;
                            }
                            state.stage = 'claim';
                            state.retryAt = now() + 1800;
                            state.status = message || 'Loss slot is busy; waiting to retry.';
                            save(state);
                            return true;
                        }
                        if (!claimId) {
                            pauseState(state, 'Commander granted an empty claim. No attack started.', false);
                            return false;
                        }
                        state.claimId = String(claimId || '');
                        state.levelTerminalSeen = false;
                        state.levelReloadSignature = '';
                        state.kitsThisLoss = 0;
                        state.healClickedAt = 0;
                        state.healBeforeCount = null;
                        state.confirmClicked = false;
                        state.aidExpandedAt = 0;
                        state.stage = 'attack-open';
                        state.navigationUrl = '';
                        state.status = 'Loss slot granted. Opening target attack page.';
                        save(state);
                        if (!isAttackPage(state.targetId))
                            openAttack(state);
                        return true;
                    },
                    onLossTerminal(reply) {
                        const state = load();
                        if (!(state === null || state === void 0 ? void 0 : state.running) || state.mode === 'level' || state.stage !== 'loss-verify' || state.claimId !== reply.claimId)
                            return false;
                        if (reply.kind === 'pending') {
                            state.lossVerifyAt = Math.max(now() + 2000, Number(reply.retryAt) || now() + 12000);
                            state.status = reply.message;
                            save(state);
                            return true;
                        }
                        if (reply.kind !== 'verified') {
                            pauseState(state, reply.message || 'Ended fight was not a confirmed loss. Nothing counted.', false);
                            return true;
                        }
                        state.stage = 'commit-wait';
                        save(state);
                        return window.FFMobileLossCycle.onCommit(reply.claimId, !!reply.ok, reply.remaining, reply.message);
                    },
                    onCommit(claimId, ok, remaining, message) {
                        const state = load();
                        if (!state || !state.running || state.stage !== 'commit-wait' || state.claimId !== claimId)
                            return false;
                        if (!ok) {
                            pauseState(state, message || 'Commander rejected the loss commit. Paused for review.', false);
                            return true;
                        }
                        state.claimId = '';
                        state.commitAttempts = 0;
                        state.replyWaitAt = 0;
                        state.finishAfterRecovery = Number(remaining || 0) <= 0;
                        state.stage = state.mode === 'level' ? 'heal-open' : state.finishAfterRecovery ? 'final-recovery' : 'heal-open';
                        state.probeStartedAt = now();
                        state.healEnteredAt = 0;
                        state.aidExpandedAt = 0;
                        state.medicalClickedAt = 0;
                        state.healClickedAt = 0;
                        state.healBeforeCount = null;
                        state.confirmClicked = false;
                        state.aidExpandedAt = 0;
                        state.kitsThisLoss = 0;
                        state.status = state.mode === 'level' ? (message || 'Fight verified. Recovering before the next target.') : state.finishAfterRecovery
                            ? 'Final loss committed. Verifying recovery before completing the order.'
                            : `Loss committed. ${remaining} remaining; opening Items to recover.`;
                        save(state);
                        if (state.finishAfterRecovery && state.mode !== 'level')
                            openPage(state, ATTACK_URL(state.targetId), 'attack recovery page');
                        else
                            openPage(state, ITEMS_URL, 'Items / Medical');
                        return true;
                    },
                    onLevelReply(reply) {
                        const state = load();
                        if (!(state === null || state === void 0 ? void 0 : state.running) || state.mode !== 'level')
                            return false;
                        if (reply.kind === 'api-wait') {
                            const claimWait = state.stage === 'claim-wait' && state.pendingClaimRequest === reply.requestId;
                            const commitWait = ['commit-wait', 'level-verify'].includes(state.stage) && state.claimId === reply.claimId;
                            if (!claimWait && !commitWait)
                                return false;
                            const at = Date.parse(reply.waitUntil);
                            if (!Number.isFinite(at))
                                return false;
                            state.levelApiReturnStage = claimWait ? 'claim' : 'level-verify';
                            state.levelApiWakeAt = Math.max(now() + 1000, at);
                            state.stage = 'level-api-wait';
                            state.status = reply.message;
                            save(state);
                            return true;
                        }
                        if (reply.kind === 'paused') {
                            pauseState(state, reply.message || 'Leveling verification failed.', false);
                            return true;
                        }
                        if (reply.kind === 'wait') {
                            if (state.stage !== 'claim-wait' || state.pendingClaimRequest !== reply.requestId)
                                return false;
                            const at = Date.parse(reply.waitUntil);
                            if (!Number.isFinite(at)) {
                                pauseState(state, 'Invalid target availability time.', false);
                                return false;
                            }
                            state.stage = 'level-target-wait';
                            state.levelTargetWakeAt = Math.max(now() + 1000, at);
                            state.status = reply.message;
                            save(state);
                            return true;
                        }
                        if (reply.kind === 'scan') {
                            if (state.stage !== 'claim-wait' || state.pendingClaimRequest !== reply.requestId)
                                return false;
                            state.replyWaitAt = now();
                            state.status = reply.message;
                            save(state);
                            return true;
                        }
                        if (reply.kind === 'claim' || reply.kind === 'heal') {
                            if (state.stage !== 'claim-wait' || state.pendingClaimRequest !== reply.requestId)
                                return false;
                            if (reply.kind === 'heal') {
                                beginHealing(state);
                                state.pendingClaimRequest = '';
                                save(state);
                                openPage(state, ITEMS_URL, 'Items / Medical');
                                return true;
                            }
                            if (reply.ok) {
                                if (!Number.isSafeInteger(Number(reply.targetId)) || Number(reply.targetId) <= 0 || Number(reply.targetId) === state.playerId) {
                                    pauseState(state, 'Invalid leveling target grant.', false);
                                    return false;
                                }
                                state.targetId = String(reply.targetId);
                                save(state);
                            }
                            return window.FFMobileLossCycle.onClaim(reply.requestId, !!reply.ok, reply.claimId || '', reply.message || '');
                        }
                        if (state.claimId !== reply.claimId || !['commit-wait', 'level-verify'].includes(state.stage))
                            return false;
                        if (reply.kind === 'pending') {
                            state.stage = 'level-verify';
                            state.levelVerifyAt = now() + 12000;
                            state.status = reply.message;
                            save(state);
                            return true;
                        }
                        if (reply.kind === 'commit') {
                            state.stage = 'commit-wait';
                            if (reply.stop)
                                state.levelStopMessage = reply.message;
                            save(state);
                            return window.FFMobileLossCycle.onCommit(reply.claimId, true, reply.remaining, reply.message);
                        }
                        return false;
                    },
                    onMedical(requestId, reply) {
                        var _a, _b, _c, _d;
                        const state = load();
                        if (!medicalPage() || !(state === null || state === void 0 ? void 0 : state.running) || !state.smartMedical || state.stage !== 'smart-medical-await' || state.medicalRequest !== requestId)
                            return false;
                        if (!state.medicalDispatched && /^TORN\s*[-\u2013\u2014]\s*50[0-4]\s*Error$/i.test(clean(document.title)) && reply.state !== 'Ready' && reply.state !== 'Authorized') {
                            state.stage = 'heal-open';
                            state.status = 'Torn medical server error; waiting for page recovery without an item click.';
                            save(state);
                            return true;
                        }
                        if (reply.state === 'Ready') {
                            if (!medicalNames[reply.itemId] || !sameMedicalName(reply.name, medicalNames[reply.itemId])) {
                                pauseState(state, 'Backend medical item is outside the fixed allowlist.', true);
                                return false;
                            }
                            state.medicalVerification = null;
                            state.medicalOp = reply;
                            state.medicalDispatched = false;
                            state.medicalExpandedAt = 0;
                            state.medicalReadyAt = now();
                            if (!reply.automatic) {
                                pauseState(state, 'Recommendation only: ' + reply.name + '. Enable automatic consumption explicitly in Smart Medical Management to use it.', true);
                                return true;
                            }
                            state.stage = 'smart-medical-ready';
                            state.status = 'Plan: ' + reply.name + '. Verifying personal inventory and account.';
                            save(state);
                            return true;
                        }
                        if (reply.state === 'Authorized' && ((_a = state.medicalOp) === null || _a === void 0 ? void 0 : _a.token) === reply.token && state.medicalOp.itemId === reply.itemId) {
                            state.medicalOp.expires = reply.expires;
                            state.stage = 'smart-medical-execute';
                            save(state);
                            return true;
                        }
                        if (reply.verification)
                            state.medicalVerification = reply.verification;
                        if (reply.state === 'PendingVerification' && state.medicalDispatched && ((_b = state.medicalOp) === null || _b === void 0 ? void 0 : _b.token) === reply.token) {
                            state.stage = 'smart-medical-receipt-wait';
                            state.medicalVerifyAt = now() + Math.max(2000, Math.min(10000, Number(reply.retryAfterMs) || 10000));
                            state.status = reply.reason;
                            save(state);
                            return true;
                        }
                        if (reply.state === 'Verified' && ((_c = state.medicalOp) === null || _c === void 0 ? void 0 : _c.token) === reply.token && state.mode === 'level') {
                            state.medicalOp = null;
                            state.medicalDispatched = false;
                            state.medicalInventorySignature = '';
                            state.medicalReplans = 0;
                            beginHealing(state);
                            state.medicalContinueVerified = true;
                            save(state);
                            return true;
                        }
                        if (reply.state === 'Verified' && ((_d = state.medicalOp) === null || _d === void 0 ? void 0 : _d.token) === reply.token) {
                            state.medicalOp = null;
                            state.medicalDispatched = false;
                            state.medicalReplans = 0;
                            state.stage = 'recovery-probe';
                            state.probeStartedAt = now();
                            state.status = 'Medical quantity, cooldown and hospital changes verified. Rechecking recovery.';
                            save(state);
                            openPage(state, ATTACK_URL(state.targetId), 'attack recovery page');
                            return true;
                        }
                        if (reply.state === 'Replan') {
                            replanMedical(state, reply.reason || 'Recalculating medical plan before dispatch.');
                            return true;
                        }
                        if (reply.state === 'Recovered' && state.mode === 'level') {
                            finishLevelingMedical(state);
                            return true;
                        }
                        if (reply.state === 'Recovered') {
                            state.stage = 'recovery-probe';
                            state.probeStartedAt = now();
                            save(state);
                            openPage(state, ATTACK_URL(state.targetId), 'attack recovery page');
                            return true;
                        }
                        if (reply.state === 'Cooldown' && reply.autoResume && Number.isFinite(Date.parse(reply.waitUntil))) {
                            if (state.claimId) {
                                post({ type: 'tc-loss-abandon', profileId: state.profileId, slot: state.slot, orderId: state.orderId, claimId: state.claimId, reason: 'Medical cooldown waiting' });
                                state.claimId = '';
                            }
                            state.stage = 'medical-cooldown';
                            state.medicalWakeAt = Math.max(now() + 1000, Date.parse(reply.waitUntil));
                            state.status = 'Medical cooldown/reserve wait until ' + new Date(state.medicalWakeAt).toLocaleTimeString() + '. Drugs permanently disabled.';
                            save(state);
                            return true;
                        }
                        pauseState(state, (reply.reason || 'Medical state could not be verified.') + (reply.waitUntil ? ' Available after ' + new Date(reply.waitUntil).toLocaleString() : ''), true);
                        return true;
                    },
                    diagnostics() {
                        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3;
                        const summary = el => { var _a, _b, _c; return el ? { tag: el.tagName, id: (_a = el.getAttribute) === null || _a === void 0 ? void 0 : _a.call(el, 'id'), disabled: Boolean(el.disabled) || ((_b = el.getAttribute) === null || _b === void 0 ? void 0 : _b.call(el, 'aria-disabled')) === 'true', className: String(el.className || ''), role: (_c = el.getAttribute) === null || _c === void 0 ? void 0 : _c.call(el, 'role'), label: labelOf(el).slice(0, 100) } : null; };
                        return { lossVerifyAttempts: (_a = load()) === null || _a === void 0 ? void 0 : _a.lossVerifyAttempts, lastFailure: (_b = load()) === null || _b === void 0 ? void 0 : _b.lastFailure, medicalIdentityWaitAt: (_c = load()) === null || _c === void 0 ? void 0 : _c.medicalIdentityWaitAt, medicalIdentityLostAt: (_d = load()) === null || _d === void 0 ? void 0 : _d.medicalIdentityLostAt, medicalIdentityReloads: (_e = load()) === null || _e === void 0 ? void 0 : _e.medicalIdentityReloads, levelTerminalSeen: (_f = load()) === null || _f === void 0 ? void 0 : _f.levelTerminalSeen, levelContinue: summary(levelingContinueControl()), levelEmptyGun: levelingEmptyGun(load() || {}), medicalServerAttempts: (_g = load()) === null || _g === void 0 ? void 0 : _g.medicalServerAttempts, healEnteredAt: (_h = load()) === null || _h === void 0 ? void 0 : _h.healEnteredAt, medicalClickedAt: (_j = load()) === null || _j === void 0 ? void 0 : _j.medicalClickedAt, medicalWakeAt: (_k = load()) === null || _k === void 0 ? void 0 : _k.medicalWakeAt, medicalVisible: medicalVisible(), recoveryProbe: (_l = load()) === null || _l === void 0 ? void 0 : _l.recoveryProbe, joinCandidates: joinFightCandidates().map(summary), medicalProfileId: (_m = load()) === null || _m === void 0 ? void 0 : _m.profileId, medicalExpectedPlayerId: (_o = load()) === null || _o === void 0 ? void 0 : _o.playerId, medicalIdentity: medicalIdentity(), mode: (_p = load()) === null || _p === void 0 ? void 0 : _p.mode, weaponSlot: (_q = load()) === null || _q === void 0 ? void 0 : _q.weaponSlot, medicalSession: (_r = load()) === null || _r === void 0 ? void 0 : _r.medicalSession, medicalPlannedQuantity: (_t = (_s = load()) === null || _s === void 0 ? void 0 : _s.medicalOp) === null || _t === void 0 ? void 0 : _t.quantity, medicalVerification: (_u = load()) === null || _u === void 0 ? void 0 : _u.medicalVerification, medicalItem: (_w = (_v = load()) === null || _v === void 0 ? void 0 : _v.medicalOp) === null || _w === void 0 ? void 0 : _w.itemId, medicalOwner: medicalOwnId(), medicalInventory: medicalInventory(), medicalDispatched: (_x = load()) === null || _x === void 0 ? void 0 : _x.medicalDispatched, pillowTurns: Number(((_y = load()) === null || _y === void 0 ? void 0 : _y.pillowTurns) || 0), previousStage: (_z = load()) === null || _z === void 0 ? void 0 : _z.previousStage, stage: (_0 = load()) === null || _0 === void 0 ? void 0 : _0.stage, status: (_1 = load()) === null || _1 === void 0 ? void 0 : _1.status, path: location.pathname,
                            playerAreas: Array.from(document.querySelectorAll('[class*="playerArea"]')).filter(visible).map(el => String(el.className || '')),
                            combatAreas: Array.from(document.querySelectorAll('[class*="playerArea"]')).filter(visible).map(area => { var _a; return ({ id: (_a = area.getAttribute) === null || _a === void 0 ? void 0 : _a.call(area, 'id'), className: String(area.className || ''), controls: Array.from(area.querySelectorAll('[id="weapon_melee"],button,[role="button"]')).filter(visible).map(summary).slice(0, 12) }); }), pillow: summary(pillowControl(false)), firstAidRow: summary(firstAidRow()), firstAidUse: summary(firstAidUseButton()), firstAidExpand: summary(firstAidExpandControl()), attackDelayMs: attackDelay((_3 = (_2 = load()) === null || _2 === void 0 ? void 0 : _2.attackDelayMs) !== null && _3 !== void 0 ? _3 : 1900), medicalTab: summary(medicalTab()), confirmation: summary(confirmUseButton()) };
                    },
                    pump() { void tick(); return true; },
                    getState() { return load(); }
                };
                const prior = load();
                if (prior === null || prior === void 0 ? void 0 : prior.running) {
                    const session = sessionStorage.getItem(SESSION_KEY);
                    if (!session || session !== prior.sessionToken) {
                        prior.running = false;
                        prior.previousStage = prior.stage;
                        prior.stage = 'paused';
                        prior.status = 'Previous auto-cycle session detected after browser/app restart. Press Resume explicitly.';
                        save(prior);
                    }
                }
                setInterval(tick, TICK_MS);
                setTimeout(tick, 250);
            })();
            /* MOBILE_WORKER_END */
        }
        async function startMobile(id) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            if ((_a = window.chrome) === null || _a === void 0 ? void 0 : _a.webview) {
                errorText = 'Use Commander desktop Loss Desk here. Mobile sessions run in TornPDA.';
                render();
                return;
            }
            const claim = claims.find(c => String(c.id) === String(id));
            if (!claim || busy || pending())
                throw Error('Refresh active claims before starting.');
            if (mobileBusy)
                throw Error('Wait for the pending mobile verification to finish.');
            if (((_b = mobile === null || mobile === void 0 ? void 0 : mobile.op) === null || _b === void 0 ? void 0 : _b.issued) && !mobile.op.verified)
                throw Error('Resume to verify the previous medical item before starting a new session.');
            if ((_d = (_c = mobileWorker()) === null || _c === void 0 ? void 0 : _c.getState()) === null || _d === void 0 ? void 0 : _d.running)
                throw Error('Stop the existing mobile session first.');
            const torn = String(((_e = panel.querySelector('#ff-mobile-torn-key')) === null || _e === void 0 ? void 0 : _e.value) || mobileKey()).trim();
            if (!isKey(torn))
                throw Error('Enter a separate Torn API key for identity, energy and medical checks.');
            if (!((_f = panel.querySelector('#ff-mobile-home-off')) === null || _f === void 0 ? void 0 : _f.checked))
                throw Error('Confirm that this claim is not running on your PC or another device.');
            const heal = !!((_g = panel.querySelector('#ff-mobile-heal')) === null || _g === void 0 ? void 0 : _g.checked);
            if (!window.confirm('Start the mobile loss loop for this claim? It spends energy' + (heal ? ' and permitted personal medical items' : '') + '. Keep TornPDA visible and do not run the same claim on your PC. This automation is not compliant with Torn scripting rules.'))
                return;
            sessionStorage.setItem(MOBILE_KEY, torn);
            const identity = await request('GET', '/account/balance', null, 'https://ffscouter.com/api/v1'), owner = positiveTornId(identity.player_id), target = targetIdFrom(claimWithTarget(claim));
            if (!owner || !target)
                throw Error('Claim target or seller identity is missing.');
            const self = await mobileApi('user/profile');
            if (((_h = self.profile) === null || _h === void 0 ? void 0 : _h.id) !== owner)
                throw Error('Torn key and seller account do not match.');
            const permission = {};
            for (const item of FFMobileCore.meds)
                permission[item.id] = !!((_j = panel.querySelector('#ff-mobile-item-' + item.id)) === null || _j === void 0 ? void 0 : _j.checked);
            const candidate = { seller: hash(apiKey), owner, target, remoteId: Number(claim.id), baseline: Number(claim.slots_delivered) || 0, total: Number(claim.slots_claimed), local: [], permissions: permission, heal, medicalSession: 'mobile-med-' + Date.now(), claim };
            if ((mobile === null || mobile === void 0 ? void 0 : mobile.seller) === candidate.seller && mobile.remoteId === candidate.remoteId && mobile.owner === owner) {
                candidate.baseline = mobile.baseline;
                candidate.local = mobile.local;
                candidate.itemsUsed = mobile.itemsUsed;
                candidate.cooldownUsed = mobile.cooldownUsed;
            }
            candidate.deadline = FFMobileCore.validateSession(candidate, owner, claim, Date.now());
            mobile = candidate;
            mobile.seenAt = Date.now();
            mobileSave();
            await mobileClaimCheck(true);
            if (mobileCount() >= mobile.total)
                throw Error('This claim already has all losses recorded. Refresh provider progress rather than restarting it.');
            installMobileWorker();
            mobileWorker().reset();
            mobileWorker().start({ profileId: String(owner), slot: 'MOBILE', orderId: 'ff-mobile-' + mobile.remoteId, targetId: String(target), selfName: self.profile.name, playerId: owner, smartMedical: true, medicalSession: mobile.medicalSession, attackDelayMs: 1000, localLossTracking: true, externalDeadline: mobile.deadline });
            errorText = '';
            notice = 'Mobile session started on this phone.';
            setOpen(false);
        }
        function mobileHtml() {
            var _a;
            const active = claims.find(c => c.state === 'active'), state = (_a = mobileWorker()) === null || _a === void 0 ? void 0 : _a.getState(), owned = mobile && mobile.seller === hash(apiKey);
            return '<h3>Phone-native loss session</h3><p class="ff-small">Runs on this phone, not your home PC. Keep TornPDA foreground and unlocked. Do not run this claim on another device. Automatic attacks/healing are contrary to Torn scripting rules.</p>' +
                '<div class="ff-card"><strong>' + esc(owned ? mobileStatus : 'Not started') + '</strong><div class="ff-small">' + (owned ? mobileCount() + '/' + mobile.total + ' tracked losses · ' + Math.max(0, mobileCount() - mobile.baseline) + ' locally recorded this session · ' + Number(mobile.itemsUsed || 0) + ' medical items · ' + Math.round(Number(mobile.cooldownUsed || 0) / 60) + ' minutes added medical cooldown' : 'No mobile session for this seller account.') + '</div><div class="ff-row"><button data-action="mobile-pause">Pause</button><button data-action="mobile-resume">Resume</button><button data-action="mobile-stop">Stop</button></div></div>' +
                '<div class="ff-card"><label><input id="ff-mobile-home-off" type="checkbox"> I stopped home-PC execution for this claim</label><label>Separate Torn API key (this browser session only)<input id="ff-mobile-torn-key" type="password" autocomplete="off" placeholder="Identity, bars, cooldowns and perks access required"></label><label><input id="ff-mobile-heal" type="checkbox"> I permit automatic personal medical consumption</label><div class="ff-small">Drug use is permanently disabled. No blood bags or faction supplies.</div>' + FFMobileCore.meds.map(x => '<label><input id="ff-mobile-item-' + x.id + '" type="checkbox" checked> ' + esc(x.name) + '</label>').join('') + (active ? '<button class="ff-primary" data-action="mobile-start" data-id="' + Number(active.id) + '">Start mobile loss loop</button>' : '<p>No active claim. Refresh Contracts or reserve one first.</p>') + '</div>';
        }
        async function mobileAction(action, id) {
            var _a, _b;
            try {
                if (action === 'mobile-start') {
                    await startMobile(id);
                    return;
                }
                if (!mobile || mobile.seller !== hash(apiKey))
                    throw Error('No matching mobile session.');
                installMobileWorker();
                if (action === 'mobile-pause')
                    mobileWorker().pause();
                if (action === 'mobile-stop') {
                    mobileWorker().stop();
                    mobile.note = 'Stopped explicitly';
                    mobileSave();
                }
                if (action === 'mobile-resume') {
                    const entered = String(((_a = panel.querySelector('#ff-mobile-torn-key')) === null || _a === void 0 ? void 0 : _a.value) || '').trim();
                    if (entered) {
                        if (!isKey(entered))
                            throw Error('Invalid Torn key.');
                        sessionStorage.setItem(MOBILE_KEY, entered);
                    }
                    await mobileClaimCheck(true);
                    const self = await mobileApi('user/profile');
                    if (((_b = self.profile) === null || _b === void 0 ? void 0 : _b.id) !== mobile.owner)
                        throw Error('Account changed.');
                    const state = mobileWorker().getState();
                    if ((state === null || state === void 0 ? void 0 : state.profileId) !== String(mobile.owner) || (state === null || state === void 0 ? void 0 : state.orderId) !== 'ff-mobile-' + mobile.remoteId || Number(state === null || state === void 0 ? void 0 : state.targetId) !== mobile.target)
                        throw Error('Saved worker does not match this mobile claim. Start a new session after reviewing pending actions.');
                    if (!mobileWorker().resume())
                        throw Error('No paused mobile session is available to resume.');
                    setOpen(false);
                }
            }
            catch (error) {
                errorText = mobileKey() ? String(error.message || error).split(mobileKey()).join('[redacted]') : String(error.message || error);
                render();
            }
        }
        function restoreMobile() {
            var _a, _b;
            const saved = getStore(MOBILE_STORE, null);
            if (!saved || saved.seller !== hash(apiKey))
                return;
            mobile = saved;
            const stale = Date.now() - Number(mobile.seenAt || 0) > 15000;
            installMobileWorker();
            if (stale && ((_b = (_a = mobileWorker()) === null || _a === void 0 ? void 0 : _a.getState()) === null || _b === void 0 ? void 0 : _b.running))
                mobilePause('Mobile session was interrupted. Review the page and Resume explicitly.');
        }
        document.addEventListener('visibilitychange', () => { var _a, _b; if (document.hidden && ((_b = (_a = mobileWorker()) === null || _a === void 0 ? void 0 : _a.getState()) === null || _b === void 0 ? void 0 : _b.running))
            mobilePause('Phone left the foreground. Return to TornPDA and Resume explicitly.'); });
        // FF_TEST_EXPORT_POINT
    })();
}
catch (error) {
    if (window.__FFContractorBoot)
        window.__FFContractorBoot.fail(error);
}
