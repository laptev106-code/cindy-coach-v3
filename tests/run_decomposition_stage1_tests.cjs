const fs=require('fs');
const vm=require('vm');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
function pass(name){console.log('PASS',name)}
function test(name,fn){try{fn();pass(name)}catch(e){console.error('FAIL',name,'-',e.message);process.exitCode=1}}

test('catalog module exists',()=>fs.accessSync(path.join(root,'src/domain/exercises/exercise_catalog_v3.js')));
test('feedback adapter exists',()=>fs.accessSync(path.join(root,'src/infrastructure/browser/feedback_v3.js')));
test('external modules load before application runtime',()=>{
  const a=index.indexOf('<script src="./src/domain/exercises/exercise_catalog_v3.js"></script>');
  const b=index.indexOf('<script src="./src/infrastructure/browser/feedback_v3.js"></script>');
  const main=index.indexOf('<script>',b+1);
  if(!(a>=0&&b>a&&main>b))throw new Error('module order invalid');
});
test('catalog no longer declared inside monolith',()=>{
  if(/const\s+EXERCISES=/.test(index))throw new Error('EXERCISES still declared inline');
  if(/const\s+CINDY_FINAL_COACH_MATRIX=/.test(index))throw new Error('matrix still declared inline');
  if(/const\s+EXERCISE_GUIDE=/.test(index))throw new Error('EXERCISE_GUIDE still declared inline');
});
test('feedback implementation no longer inline',()=>{
  if(/function haptic\(kind\)/.test(index))throw new Error('haptic implementation still inline');
  if(/function toneSequence\(sequence\)/.test(index))throw new Error('toneSequence implementation still inline');
});
test('raw LocalStorage read/write implementation no longer inline',()=>{
  if(/function read\(key,fallback\)/.test(index))throw new Error('read implementation still inline');
  if(/function write\(key,value\)/.test(index))throw new Error('write implementation still inline');
  if(/localStorage\.setItem\(key,serialized\)/.test(index))throw new Error('raw storage write still inline');
});
test('storage adapter exists before application runtime',()=>{
  const a=index.indexOf('<script src="./src/infrastructure/storage/local_storage_v3.js"></script>');
  const main=index.indexOf('<script>',a+1);
  if(!(a>=0&&main>a))throw new Error('storage adapter order invalid');
});
test('legacy matrix compatibility surface retained',()=>{
  const ctx={window:{}};ctx.window.window=ctx.window;
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/domain/exercises/exercise_catalog_v3.js'),'utf8'),ctx);
  const c=ctx.window.CINDYExerciseCatalogV3;
  assert(c && c.EXERCISES.length===6);
  assert.strictEqual(ctx.window.CindyFinalCoachMatrix,c.CINDY_FINAL_COACH_MATRIX);
  assert(c.CINDY_FINAL_COACH_MATRIX.variants.pull_pronated);
});
test('storage adapter has explicit ports',()=>{
  const ctx={window:{localStorage:{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}}};ctx.window.window=ctx.window;
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/infrastructure/storage/local_storage_v3.js'),'utf8'),ctx);
  assert(ctx.window.CINDYLocalStorageV3&&typeof ctx.window.CINDYLocalStorageV3.create==='function');
  const port=ctx.window.CINDYLocalStorageV3.create({storage:ctx.window.localStorage,now:()=>123});
  ['read','write','remove'].forEach(k=>assert.strictEqual(typeof port[k],'function'));
});
test('feedback adapter has explicit config port',()=>{
  const ctx={window:{},navigator:{vibrate:()=>{}}};ctx.window.window=ctx.window;ctx.window.AudioContext=null;ctx.window.webkitAudioContext=null;
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/infrastructure/browser/feedback_v3.js'),'utf8'),ctx);
  assert(ctx.window.CINDYBrowserFeedbackV3&&typeof ctx.window.CINDYBrowserFeedbackV3.create==='function');
  const config={sound:false,hapticMode:1,cueTone:'soft'};
  const fb=ctx.window.CINDYBrowserFeedbackV3.create({getConfig:()=>config});
  ['haptic','toneSequence','feedback'].forEach(k=>assert.strictEqual(typeof fb[k],'function'));
});
test('V3 core syntax and adapter syntax',()=>{
  for(const f of ['coach_core_v3.js','coach_integration_v3.js','program_pack_v3.js']){
    const s=fs.readFileSync(path.join(root,'coach_core_v3',f),'utf8');
    new vm.Script(s,{filename:f});
  }
});
if(process.exitCode)process.exit(1);
console.log('DECOMPOSITION_STAGE1_PASS');
