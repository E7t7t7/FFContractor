// Real browser navigation with synthetic pages only; no Torn or FFScouter requests.
const fs=require('fs'),assert=require('assert'),{chromium}=require(process.env.FF_PLAYWRIGHT_MODULE||'playwright');
const original=fs.readFileSync('FFContractor.user.js','utf8');
const expose="window.__navFixture=function(to){apiKey='0123456789ABCDEF';setSession(apiKey);sessionStorage.setItem('ff-mobile-torn-key-v1','0123456789ABCDEF');const at=Date.now();mobile={seller:hash(apiKey),owner:1,target:2,remoteId:9,total:2,baseline:0,local:[],seenAt:at,medicalSession:'nav-med'};mobileSave();const state={running:true,mode:'loss',profileId:'1',playerId:1,slot:'MOBILE',orderId:'ff-mobile-9',targetId:'2',stage:to.includes('/item.php')?'heal-open':'attack-open',claimId:'lease',sessionToken:'nav-token',navigationUrl:to,navigationLastAt:at,navigationStartedAt:at,navigationAttempts:1,startedAt:at,medicalSession:'nav-med'};localStorage.setItem('__ff_mobile_loss_cycle_v1',JSON.stringify(state));sessionStorage.setItem('__ff_mobile_loss_cycle_session_v1','nav-token');window.FFMobileLossCycle={getState:()=>JSON.parse(localStorage.getItem('__ff_mobile_loss_cycle_v1')),pause:(reason)=>{const s=JSON.parse(localStorage.getItem('__ff_mobile_loss_cycle_v1'));s.running=false;s.previousStage=s.stage;s.stage='paused';s.status=reason||'Paused';localStorage.setItem('__ff_mobile_loss_cycle_v1',JSON.stringify(s));}};location.assign(to);};";
const adapted=original.replace('// FF_TEST_EXPORT_POINT',expose).replace(/[“”]/g,'"').replace(/[’]/g,"'");
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.FF_BROWSER_EXECUTABLE?{executablePath:process.env.FF_BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});let apis=0;
  await page.route('**/*',r=>{if(new URL(r.request().url()).pathname.includes('/v2/'))apis++;return r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>Local fixture only</body></html>'});});
  await page.addInitScript('document.addEventListener("DOMContentLoaded",function(){'+adapted+'},{once:true});');
  await page.goto('https://www.torn.com/item.php');await page.waitForFunction(()=>!!window.__navFixture);
  await Promise.all([page.waitForURL('**/page.php?sid=attack&user2ID=2'),page.evaluate(()=>window.__navFixture('https://www.torn.com/page.php?sid=attack&user2ID=2'))]);
  await page.waitForFunction(()=>!!window.__FFContractor?.ready);await page.waitForTimeout(700);
  const state=await page.evaluate(()=>JSON.parse(localStorage.getItem('__ff_mobile_loss_cycle_v1')));
  assert(state.running,'Expected Items → target navigation stopped the worker: '+state.status);
  await Promise.all([page.waitForURL('**/item.php'),page.evaluate(()=>window.__navFixture('https://www.torn.com/item.php'))]);
  await page.waitForFunction(()=>!!window.__FFContractor?.ready);await page.waitForTimeout(500);
  assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('__ff_mobile_loss_cycle_v1')).running),'Attack → Medical replacement stopped the session');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await page.waitForTimeout(350);
  const background=await page.evaluate(()=>JSON.parse(localStorage.getItem('__ff_mobile_loss_cycle_v1')));
  assert(!background.running&&background.status.includes('left the foreground'),'Actual background transition was not paused');
  assert.equal(apis,0,'Navigation fixture unexpectedly read API data');
  console.log('MOBILE NAVIGATION PASSED: real document replacement continues the same target session; no live requests.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
