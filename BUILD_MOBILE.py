from pathlib import Path
root=Path(__file__).resolve().parent
base=(root/'FFContractor.template.js').read_text(encoding='utf8')
host=(root/'MobileLossHost.js').read_text(encoding='utf8')
core=(root/'MobileLossCore.js').read_text(encoding='utf8')
worker=(root/'CommanderLossWorker.source.js').read_text(encoding='utf8')
worker=worker.replace('__tcLossAutoInstalled','__ffMobileLossInstalled').replace('__tc_loss_auto_cycle','__ff_mobile_loss_cycle').replace('TornCommanderLossCycle','FFMobileLossCycle')
worker=worker.replace("window.chrome?.webview?.postMessage(JSON.stringify(payload));","window.__FFMobileReceive?.(payload);")
worker=worker.replace("  async function tick() {","  async function tick() {\n    if(document.hidden)return;")
worker=worker.replace("    setAttackDelay(milliseconds) {","    recoverFromHospital(){const state=load();if(!state?.running||state.claimId)return false;state.pendingClaimRequest='';beginHealing(state);save(state);openPage(state,ITEMS_URL,'Items / Medical');return true;},\n    setAttackDelay(milliseconds) {")
# Avoid TornPDA smart-quote rewriting turning punctuation inside JS strings into delimiters.
worker=worker.replace('\u2019',r'\u2019').replace('\u2018',r'\u2018').replace('\u201c',r'\u201c').replace('\u201d',r'\u201d')
host=host.replace('/* MOBILE_WORKER */','/* MOBILE_WORKER_BEGIN */\n'+worker+'\n/* MOBILE_WORKER_END */')
out=base.replace('/* MOBILE_HOST */',host)
out=out.replace('// ==/UserScript==','// ==/UserScript==\n'+core,1)
import hashlib,os,subprocess,tempfile,urllib.request
compiler=Path(os.environ.get('FF_TYPESCRIPT',str(Path(tempfile.gettempdir())/'ff-typescript-5.9.3.js')))
if not compiler.exists():urllib.request.urlretrieve('https://unpkg.com/typescript@5.9.3/lib/typescript.js',compiler)
if hashlib.sha256(compiler.read_bytes()).hexdigest()!='3ae902c92cc44dace175c0e69e13a4b0899f6983c6121d76b9ab8dd5795e7675':raise RuntimeError('Pinned build compiler integrity mismatch')
generated=root/'FFContractor.generated.js'
try:
 generated.write_text(out,encoding='utf8')
 subprocess.run([os.environ.get('NODE_BINARY','node'),str(root/'BUILD_MOBILE.cjs'),str(compiler)],check=True,cwd=root)
finally:
 if generated.exists():generated.unlink()
