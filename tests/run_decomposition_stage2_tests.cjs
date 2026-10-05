const fs=require('fs');
const crypto=require('crypto');
const path=require('path');
const {execFileSync}=require('child_process');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
function sha(file){return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}
function pass(name,fn){try{fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'-',e.message);process.exitCode=1}}
const stage1Manifest=JSON.parse(fs.readFileSync(path.join(root,'decomposition-manifest.json'),'utf8'));
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');

pass('repositories module syntax',()=>execFileSync(process.execPath,['--check',path.join(root,'src/infrastructure/storage/repositories_v3.js')]));
pass('current CoachCore matches release pin',()=>assert.strictEqual(sha(path.join(root,'coach_core_v3/coach_core_v3.js')),stage1Manifest.currentCoreHash||stage1Manifest.preservedCoreHash));
pass('stage2 integration baseline is recorded',()=>{assert(stage1Manifest.currentIntegrationHash||stage1Manifest.previousIntegrationHash||stage1Manifest.stage2IntegrationHash||stage1Manifest.preservedIntegrationHash)});
pass('program pack remains present as evolving module',()=>assert(fs.existsSync(path.join(root,'coach_core_v3/program_pack_v3.js'))));
pass('repositories loaded before application runtime',()=>{const marker=index.indexOf('src="./src/infrastructure/storage/repositories_v3.js"');const firstRuntime=index.indexOf('<script',marker+1);assert(marker>=0&&firstRuntime>marker)});
pass('four explicit aggregate repositories are wired',()=>{for(const x of ['configRepository','sessionRepository','historyRepository','cloudRepository'])assert(index.includes(x));});
pass('config/session/history reads use repositories',()=>{assert(!index.includes('read(STORE.config'));assert(!index.includes('read(STORE.active'));assert(!index.includes('read(STORE.history'));assert(index.includes('configRepository.load()'));assert(index.includes('sessionRepository.load()'));assert(index.includes('historyRepository.load()'));});
pass('cloud reads/writes use repository',()=>{assert(index.includes('cloudRepository.load()'));assert(index.includes('cloudRepository.save(cloud)'));});
pass('snapshot application uses repository transaction',()=>{assert(index.includes('repositories.transaction({writes:'));assert(index.includes("{key:'config',value:nextConfig}"));assert(index.includes("{key:'history',value:nextHistory}"));assert(index.includes("{key:'session',value:nextSession,remove:!activeSnapshot}"));assert(index.includes("{key:'cloud',value:nextCloud}"));});
pass('legacy V2.8 direct storage is retired from runtime',()=>{assert(!index.includes('V28_STORE'));assert(!index.includes('function v28Save()'));});
pass('no application-level direct history removal',()=>assert(!index.includes('localStorage.removeItem(STORE.history)')));
pass('stage2 report exists',()=>assert(fs.existsSync(path.join(root,'CINDY_V3_DECOMPOSITION_STAGE2.md'))));
if(process.exitCode)process.exit(1);console.log('DECOMPOSITION_STAGE2_STATIC_PASS');
