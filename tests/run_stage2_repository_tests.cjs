const fs=require('fs');
const vm=require('vm');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/infrastructure/storage/repositories_v3.js'),'utf8');

function makeStorage(initial={}){
  const map=new Map(Object.entries(initial));
  let failKey=null;
  let failMode='write';
  const clone=value=>value===null?null:JSON.parse(JSON.stringify(value));
  return {
    get failKey(){return failKey},
    setFailure(key,mode='write'){failKey=key;failMode=mode},
    clearFailure(){failKey=null},
    getItem(key){return map.has(key)?JSON.stringify(map.get(key)):null},
    setItem(key,value){
      if(failMode==='write'&&key===failKey){const e=new Error('quota');e.name='QuotaExceededError';throw e}
      map.set(key,JSON.parse(value));
    },
    removeItem(key){
      if(failMode==='remove'&&key===failKey){const e=new Error('remove');e.name='QuotaExceededError';throw e}
      map.delete(key);
    },
    raw(key){return clone(map.get(key))}
  };
}
function loadRepo(storage){
  const ctx={window:{}};ctx.window.window=ctx.window;
  vm.runInNewContext(source,ctx,{filename:'repositories_v3.js'});
  const port={read:(k,f)=>{const x=storage.getItem(k);return x?JSON.parse(x):f},write:(k,v)=>{try{storage.setItem(k,JSON.stringify(v));return true}catch(_){return false}},remove:k=>{try{storage.removeItem(k);return true}catch(_){return false}}};
  return ctx.window.CINDYRepositoriesV3.create({storagePort:port,codecs:{config:{fallback:{}},session:{fallback:null},history:{fallback:[]},cloud:{fallback:{}}}});
}
function pass(name,fn){try{fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,'-',e.message);process.exitCode=1}}

pass('repository module loads',()=>{const ctx={window:{}};ctx.window.window=ctx.window;vm.runInNewContext(source,ctx);assert(ctx.window.CINDYRepositoriesV3)});
pass('all four repositories save/load losslessly',()=>{
  const st=makeStorage();const r=loadRepo(st);
  const config={version:8,mode:'time',minutes:10,programState:{currentDayIndex:2}};
  const session={version:7,status:'paused',rounds:3,v3Spec:{specId:'spec-1'}};
  const history=[{id:'h1',rounds:3,v3:{specId:'spec-1',executionFidelity:'EXACT'}}];
  const cloud={version:1,fileId:'g1',updatedAt:123};
  assert(r.config.save(config));assert(r.session.save(session));assert(r.history.save(history));assert(r.cloud.save(cloud));
  assert.deepStrictEqual(r.config.load(),config);assert.deepStrictEqual(r.session.load(),session);assert.deepStrictEqual(r.history.load(),history);assert.deepStrictEqual(r.cloud.load(),cloud);
});
pass('transaction rollback restores prior aggregates on write failure',()=>{
  const st=makeStorage();const r=loadRepo(st);
  const base={config:{version:8,minutes:20},session:{status:'paused',rounds:1},history:[{id:'old',rounds:1}],cloud:{updatedAt:1}};
  for(const [k,v] of Object.entries(base))r[k].save(v);
  st.setFailure('cindyHistory');
  const ok=r.transaction({writes:[{key:'config',value:{version:8,minutes:10}},{key:'history',value:[{id:'new',rounds:2}]},{key:'session',value:{status:'running',rounds:2}},{key:'cloud',value:{updatedAt:2}}]});
  assert.strictEqual(ok,false);
  assert.deepStrictEqual(r.config.load(),base.config);assert.deepStrictEqual(r.history.load(),base.history);assert.deepStrictEqual(r.session.load(),base.session);assert.deepStrictEqual(r.cloud.load(),base.cloud);
});
pass('transaction supports remove without losing rollback',()=>{
  const st=makeStorage();const r=loadRepo(st);r.config.save({v:1});r.session.save({status:'paused'});r.history.save([{id:'x'}]);r.cloud.save({v:1});
  const ok=r.transaction({writes:[{key:'config',value:{v:2}},{key:'session',remove:true},{key:'history',value:[]},{key:'cloud',value:{v:2}}]});
  assert.strictEqual(ok,true);assert.deepStrictEqual(r.config.load(),{v:2});assert.deepStrictEqual(r.session.load(),null);assert.deepStrictEqual(r.history.load(),[]);assert.deepStrictEqual(r.cloud.load(),{v:2});
});
pass('index contains repository boundary and no application-level raw aggregate reads',()=>{
  const s=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert(s.includes('./src/infrastructure/storage/repositories_v3.js'));
  assert(s.includes('CINDYRepositoriesV3.create'));
  assert(!s.includes('read(STORE.config'));
  assert(!s.includes('read(STORE.active'));
  assert(!s.includes('read(STORE.history'));
  assert(!s.includes('localStorage.removeItem(STORE.history)'));
  assert(s.includes('repositories.transaction'));
});
if(process.exitCode)process.exit(1);console.log('DECOMPOSITION_STAGE2_REPOSITORY_PASS');
