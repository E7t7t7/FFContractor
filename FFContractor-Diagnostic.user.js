// ==UserScript==
// @name         FFContractor Injection Test
// @namespace    https://github.com/E7t7t7/FFContractor
// @version      1.0.0
// @description  Tiny diagnostic: verifies TornPDA is injecting custom scripts on Torn pages.
// @match        https://www.torn.com/*
// @match        https://torn.com/*
// @include      *://*.torn.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==
(function () {
  'use strict';
  function show() {
    if (document.getElementById('ffcontractor-injection-test')) return;
    var el=document.createElement('button');
    el.id='ffcontractor-injection-test';
    el.type='button';
    el.textContent='FF TEST ✓';
    el.title='TornPDA custom scripts are running';
    el.style.cssText='all:initial!important;display:block!important;position:fixed!important;top:225px!important;left:12px!important;z-index:2147483647!important;background:#ffdd34!important;color:#111!important;border:2px solid #111!important;padding:12px!important;border-radius:10px!important;font:bold 15px sans-serif!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;';
    el.onclick=function(){ alert('FFContractor injection test passed!'); };
    (document.body || document.documentElement).appendChild(el);
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',show,{once:true});
  else show();
  setInterval(show,3000);
})();
