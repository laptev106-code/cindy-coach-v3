const fs=require('fs');
const vm=require('vm');
const path=require('path');
const assert=require('assert');
const root=path.join(__dirname,'..');

function pass(name,fn){fn();console.log('PASS',name);}

pass('exercise catalog loads without browser window',()=>{
  const ctx={console};
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/domain/exercises/exercise_catalog_v3.js'),'utf8'),ctx,{filename:'exercise_catalog_v3.js'});
  assert.strictEqual(ctx.CINDYExerciseCatalogV3,undefined);
});

pass('session contract loads without browser window',()=>{
  const ctx={console,JSON,structuredClone};
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/domain/workout/session_contract_v3.js'),'utf8'),ctx,{filename:'session_contract_v3.js'});
  assert.strictEqual(ctx.CINDYSessionContractV3,undefined);
});

pass('history provenance loads without browser window',()=>{
  const ctx={console,JSON,structuredClone};
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/domain/history/history_provenance_v3.js'),'utf8'),ctx,{filename:'history_provenance_v3.js'});
  assert.strictEqual(ctx.CINDYHistoryProvenanceV3,undefined);
});

pass('exercise catalog still publishes through window when present',()=>{
  const ctx={window:{},console};
  ctx.window.window=ctx.window;
  vm.runInNewContext(fs.readFileSync(path.join(root,'src/domain/exercises/exercise_catalog_v3.js'),'utf8'),ctx,{filename:'exercise_catalog_v3.js'});
  assert(ctx.window.CINDYExerciseCatalogV3);
  assert.strictEqual(ctx.window.CindyFinalCoachMatrix,ctx.window.CINDYExerciseCatalogV3.CINDY_FINAL_COACH_MATRIX);
});

pass('domain files do not throw on missing window',()=>{
  for(const rel of [
    'src/domain/exercises/exercise_catalog_v3.js',
    'src/domain/workout/session_contract_v3.js',
    'src/domain/history/history_provenance_v3.js'
  ]){
    vm.runInNewContext(fs.readFileSync(path.join(root,rel),'utf8'),{console,JSON,structuredClone},{filename:rel});
  }
});

console.log('DOMAIN_BOUNDARY_PASS');
