const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync('FFContractor.user.js','utf8');
assert(source.includes('@version      0.9.1')&&source.includes("const VERSION = '0.9.1'"));
for(const tag of ['@updateURL','@downloadURL'])assert(new RegExp(tag+'\\s+https://raw.githubusercontent.com/E7t7t7/FFContractor/main/FFContractor.user.js').test(source));
function harness(storage=new Map(),view={}){
 class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.events={};this.style={setProperty:(k,v)=>this.style[k]=v};}
  setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]??null}
  appendChild(n){n.remove();this.children.push(n);n.parentNode=this;return n}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);this.parentNode=null}
  get isConnected(){return !!this.parentNode}
  addEventListener(k,fn){this.events[k]=fn}
  getBoundingClientRect(){return {left:parseFloat(this.style.left)||0,top:parseFloat(this.style.top)||0}}
  querySelector(){return null}querySelectorAll(){return []}
 }
 const root=new Node('html'),body=new Node('body');root.appendChild(body);
 const walk=(n,id)=>n.id===id?n:n.children.map(c=>walk(c,id)).find(Boolean);
 const document={body,documentElement:root,readyState:'complete',createElement:t=>new Node(t),getElementById:id=>walk(root,id),addEventListener:()=>{}};
 const localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
 const intervals=[],calls=[];let responder=(m,u,b)=>({status:200,responseText:JSON.stringify(u.includes('/contracts')?{contracts:[],max_claim_slots:10}:{claims:[]})});
 const context={document,localStorage,sessionStorage:localStorage,URL,console,Date,Math,navigator:{},setInterval:fn=>intervals.push(fn),setTimeout:()=>{},clearTimeout:()=>{},clearInterval:()=>{},innerWidth:400,innerHeight:800,addEventListener:()=>{},confirm:()=>true,...view};
 context.window=context;context.visualViewport={width:context.innerWidth,height:context.innerHeight,offsetLeft:0,offsetTop:0,addEventListener:()=>{},...(view.visualViewport||{})};
 context.PDA_httpGet=async(u,h)=>{calls.push({method:'GET',url:u});return responder('GET',u)};
 context.PDA_httpPost=async(u,h,b)=>{calls.push({method:'POST',url:u,body:JSON.parse(b)});return responder('POST',u,b)};
 const expose=[
 'window.test={launch,mount,placeLauncher,setDock,targetIdFrom,tornIdFromUrl,claimWithTarget,attackLink,mergeLedger,paid,summarize,claim,complete,refresh,sendHttp,recordReceipt,pending,',
 "setup(x={}){apiKey=x.key||'0123456789ABCDEF';activateLedger();contracts=x.contracts||[];claims=x.claims||[];cap=x.cap??10;lastSync=Date.now();claimsCheckedAt=x.stale?Date.now()-60000:Date.now();busy=false;render=()=>{};panel={querySelectorAll:()=>[{getAttribute:()=>x.order||'ORDER-A',value:x.count||2}]};},",
 'state:()=>({claims,currentLedger,errorText,busy,pending:pending()}),loadPending:async()=>{pendingAll=await nativeGet(PENDING_STORAGE,{})}};'].join('\n');
 vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,expose+'\n})();'),context);
 return {test:context.test,context,storage,intervals,calls,respond:fn=>responder=fn,reinject:()=>vm.runInNewContext(source.replace(/\}\)\(\);\s*$/,expose+'\n})();'),context)};
}
(async()=>{
 for(const view of [{},{innerWidth:900,innerHeight:1400,visualViewport:{width:320,height:500,offsetLeft:120,offsetTop:200}},{innerWidth:260,innerHeight:300}]){
  const h=harness(new Map(),view),t=h.test,v=h.context.visualViewport;
  const left=parseFloat(t.launch.style.left),top=parseFloat(t.launch.style.top);
  assert(left>=v.offsetLeft&&left+42<=v.offsetLeft+v.width,'launcher off visible viewport');assert(top>=v.offsetTop&&top+64<=v.offsetTop+v.height);
  t.launch.remove();t.mount();assert(t.launch.isConnected,'launcher remount failed');
 }
 const h=harness();let t=h.test;
 const event=(x,y)=>({button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){}});
 t.launch.events.pointerdown(event(380,400));t.launch.events.pointermove(event(10,260));t.launch.events.pointerup(event(10,260));
 assert(t.launch.events.touchstart&&t.launch.events.touchmove,'Legacy iOS touch fallback missing');
 assert(h.context.__FFContractor.ready&&h.context.__FFContractor.diagnostic().launcherAttached);
 const mounted=t.launch;
 h.reinject();assert.strictEqual(h.context.test.launch,mounted,'Healthy reinjection duplicated tab');
 const oldTimers=h.intervals.slice();
 mounted.onclick=null;h.reinject();assert.notStrictEqual(h.context.test.launch,mounted,'Orphaned tab prevented recovery');t=h.context.test;
 oldTimers.forEach(fn=>fn());assert(!mounted.isConnected,'Disposed launcher was recreated by an old timer');
 assert.strictEqual(h.context.document.getElementById('ffcontractor-launcher'),t.launch);
 const touch=(x,y)=>({touches:[{clientX:x,clientY:y}],changedTouches:[{clientX:x,clientY:y}],preventDefault(){}});
 t.launch.events.touchstart(touch(10,250));t.launch.events.touchmove(touch(20,300));t.launch.events.touchend(touch(20,300));
 assert.equal(JSON.parse(h.storage.get('ffcontractor-tab-position-v2')).side,'left','Legacy touch drag did not persist');

 const reload=harness(h.storage);assert.strictEqual(parseFloat(reload.test.launch.style.left),0,'drag position not persisted');
 t.setup();t.mergeLedger([{id:42,order_number:'ORDER-A',target_player_id:3003,slots_delivered:2,earnings:700000}]);
 assert.strictEqual(t.claimWithTarget({id:42}).target_player_id,3003);
 assert.strictEqual(t.targetIdFrom({id:42,order_number:'3003'}),0,'claim/order used as target');
 assert.strictEqual(t.tornIdFromUrl('https://evil.example/page.php?user2ID=3003'),0);
 assert.strictEqual(t.attackLink(3003),'https://www.torn.com/page.php?sid=attack&user2ID=3003');
 assert(!t.paid({payment_status:'resolved',payment_review_required:true}));
 t.recordReceipt('FFScouter ORDER-A payment', 'fixture');assert(!t.paid(t.state().currentLedger.claims['42']),'message marked paid');
 assert.strictEqual(t.summarize().length,8);
 t.setup({contracts:[{order_number:'ORDER-A',slots_available:8,price_per_loss:350000}],cap:3});
 h.respond((m,u,b)=>({status:200,responseText:JSON.stringify(m==='POST'?{claim:{id:99,order_number:'ORDER-A',target_player_id:3003,slots_claimed:3}}:u.includes('/contracts')?{contracts:[],max_claim_slots:3}:{claims:[]})}));
 await t.claim('ORDER-A',true);
 const post=h.calls.find(x=>x.method==='POST');assert.strictEqual(post.body.slots,3,'Claim Max zero/unbounded');
 assert(post.url.startsWith('https://ffscouter.com/api/v1/losses/seller/claim?key='));assert(!('key' in post.body));
 const before=h.calls.filter(x=>x.method==='POST').length;
 t.setup({contracts:[{order_number:'ORDER-A',slots_available:8}],claims:[{id:99,state:'active',expires_at:Date.now()/1000+300}]});
 await t.claim('ORDER-A',true);assert.strictEqual(h.calls.filter(x=>x.method==='POST').length,before);
 t.setup({contracts:[{order_number:'ORDER-A',slots_available:8}],stale:true});
 await t.claim('ORDER-A',true);assert.strictEqual(h.calls.filter(x=>x.method==='POST').length,before,'stale claims permitted reservation');
 t.setup({contracts:[{order_number:'ORDER-A',slots_available:8}]});
 h.respond(()=>{throw Error('Synthetic interrupted response')});await t.claim('ORDER-A',true);
 assert(t.state().pending,'interrupted mutation lost pending guard');
 const restart=harness(h.storage);restart.test.setup({contracts:[{order_number:'ORDER-A',slots_available:8}]});await restart.test.loadPending();
 await restart.test.claim('ORDER-A',true);assert.strictEqual(restart.calls.length,0,'restart repeated uncertain POST');
 delete restart.context.PDA_httpGet;let gm=false;
 restart.context.GM_xmlhttpRequest=r=>{gm=true;r.onload({status:200,responseText:'{}'})};
 await restart.test.sendHttp('GET','https://ffscouter.com/api/v1/check-key',{});assert(gm,'Commander HTTP fallback missing');
 assert(!source.includes('?.')&&!source.includes('Promise.allSettled'),'Older WebKit unsupported dependency returned');
 console.log('FFCONTRACTOR PASSED: viewport/remount/drag persistence, target retention, 8 statistics, payment evidence, bounded Claim Max, active/stale guards, interrupted restart and desktop transport. Simulated only.');
})().catch(e=>{console.error(e);process.exitCode=1});
