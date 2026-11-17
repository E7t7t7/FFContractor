// Optional real-DOM integration test. Set FF_PLAYWRIGHT_MODULE / FF_BROWSER_EXECUTABLE for a local browser.
const fs=require('fs'),assert=require('assert');
const {chromium}=require(process.env.FF_PLAYWRIGHT_MODULE||'playwright');
const source=fs.readFileSync('FFContractor.user.js','utf8');
const testSource=source.replace('// FF_TEST_EXPORT_POINT',"window.__mobileFixture=function(){apiKey='0123456789ABCDEF';claims=[{id:9,state:'active',target_player_id:2,slots_claimed:2,slots_delivered:0,expires_at:Math.floor(Date.now()/1000)+300}];tab='Mobile Session';render();};");
const adapted=testSource.replace(/[“”]/g,'"').replace(/[‘’]/g,"'");
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.FF_BROWSER_EXECUTABLE?{executablePath:process.env.FF_BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let network=0;await page.route('**/*',r=>{network++;return r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><header>Torn fixture</header><main>Map fixture</main></body></html>'});});
  await page.goto('https://www.torn.com/index.php');const before=network;
  await page.evaluate(adapted);
  assert(await page.locator('#ffcontractor-entry').isVisible(),'Inline entry not visible');
  const rect=await page.locator('#ffcontractor-entry').boundingBox();assert(rect.y>=0&&rect.y<100&&rect.width<=390,'Inline entry outside viewport');
  assert((await page.locator('#ffcontractor-entry').innerText()).includes('0.9.6'));
  await page.locator('#ffcontractor-entry button').first().click();
  assert(await page.locator('#ffcontractor-panel').isVisible(),'Inline entry cannot open real panel');
  assert((await page.locator('#ffcontractor-panel').innerText()).includes('Add your FFScouter API key'));
  assert.equal(network,before,'Startup/open made external requests without credentials');
  await page.evaluate(()=>window.__mobileFixture());
  assert(await page.getByRole('button',{name:'Start mobile loss loop',exact:true}).isVisible());
  await page.locator('#ff-mobile-torn-key').fill('0123456789ABCDEF');
  await page.getByRole('button',{name:'Start mobile loss loop',exact:true}).click();
  await page.waitForFunction(()=>document.getElementById('ffcontractor-panel').textContent.includes('Confirm that this claim is not running'));
  assert.equal(await page.locator('#ff-mobile-torn-key').inputValue(),'0123456789ABCDEF','Mobile key draft lost on validation refresh');
  assert.equal(network,before,'Missing consent sent external requests');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'Mobile panel creates horizontal overflow');

  await page.evaluate(()=>document.getElementById('ffcontractor-entry').remove());
  await page.waitForFunction(()=>!!document.getElementById('ffcontractor-entry'));
  assert.deepEqual(errors,[],'Real DOM startup failed');
  await page.goto('https://www.torn.com/index.php');
  await page.evaluate(()=>{const create=document.createElement.bind(document);let count=0;document.createElement=function(tag){if(tag==='button'&&++count===3)throw new TypeError('Synthetic main-startup failure');return create(tag);};});
  await page.evaluate(adapted);
  assert(await page.locator('#ffcontractor-entry').isVisible(),'Startup failure removed the independent entry');
  assert((await page.locator('#ffcontractor-entry').innerText()).includes('startup failed'),'Failure remained silent');
  console.log('BROWSER RENDER PASSED: real mobile-sized DOM, visible inline entry/version, full panel opening, removal recovery and visible injected startup failure. No live Torn or API requests.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
