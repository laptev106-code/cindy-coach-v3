const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const root=path.resolve(__dirname,'..');
const load=(file,ctx)=>vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx,{filename:file});

function setup({legacyRaw,initialV3,failSetKey=null,failRemoveKey=null,corruptV3Readback=false}={}){
  const data=new Map(),operations=[];let activeFailRemoveKey=failRemoveKey;
  if(legacyRaw!==undefined)data.set('cindy.focus.coach.v28.state',legacyRaw);
  if(initialV3!==undefined)data.set('cindyCoachV3State',initialV3);
  const storage={
    getItem(key){return data.has(key)?data.get(key):null;},
    setItem(key,value){operations.push(['set',key,String(value)]);if(key===failSetKey)throw new Error(`injected-set-failure:${key}`);if(key==='cindyCoachV3State'&&corruptV3Readback){data.set(key,JSON.stringify({baselineAuthority:true}));return;}data.set(key,String(value));},
    removeItem(key){operations.push(['remove',key]);if(key===activeFailRemoveKey)throw new Error(`injected-remove-failure:${key}`);data.delete(key);}
  };
  const ctx=vm.createContext({window:{},console,JSON,Object,Array,String,Number,Boolean,Math,Date,Uint8Array,DataView,encodeURIComponent,unescape,Error,TypeError});
  load('src/infrastructure/storage/coach_state_repository_v3.js',ctx);
  load('src/infrastructure/storage/coach_state_migration_v3.js',ctx);
  const storagePort={
    read(key,fallback){const raw=storage.getItem(key);if(raw===null)return fallback;try{return JSON.parse(raw)}catch(_){return fallback}},
    write(key,value){try{storage.setItem(key,JSON.stringify(value));return true}catch(_){return false;}}
  };
  const repository=ctx.window.CINDYCoachStateRepositoryV3.create({storagePort});
  return{storage,data,operations,repository,migration:ctx.window.CINDYCoachStateMigrationV3.create(),setFailRemoveKey:key=>{activeFailRemoveKey=key;}};
}
const legacy=value=>JSON.stringify(value);
const fixedNow=()=> '2026-10-04T00:00:00.000Z';

assert.strictEqual(setup().migration.sha256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad','migration SHA-256 implementation matches the standard vector');

{
  const x=setup();
  const result=x.migration.migrate({storage:x.storage,stateRepository:x.repository,now:fixedNow});
  assert.strictEqual(result.ready,true);assert.strictEqual(result.migrated,false);assert.strictEqual(result.blocker,null);
}
{
  const raw='{corrupt-v3',x=setup({initialV3:raw});
  const result=x.migration.migrate({storage:x.storage,stateRepository:x.repository,now:fixedNow});
  assert.strictEqual(result.ready,false);assert.strictEqual(result.blocker,'preexisting-v3-state-corrupt');
  assert.strictEqual(x.storage.getItem('cindyCoachV3State'),raw,'corrupt V3 bytes remain untouched');
}
{
  const raw=legacy({calibrationRequested:true}),x=setup({legacyRaw:raw});
  const result=x.migration.migrate({storage:x.storage,stateRepository:x.repository,now:fixedNow});
  assert.strictEqual(result.ready,true);assert.strictEqual(result.migrated,true);
  assert.strictEqual(x.repository.load().baselineAuthority,false,'legacy calibrationRequested must never grant V3 baseline authority');
  assert.strictEqual(x.storage.getItem('cindyCfg'),null,'Coach-state migration must not fabricate a Coach user-preference origin');
  assert.strictEqual(x.storage.getItem('cindy.focus.coach.v28.state'),null);
  const backup=JSON.parse(x.storage.getItem('cindyCoachV3MigrationBackupV1'));
  assert.strictEqual(backup.sourceRaw,raw);assert.strictEqual(backup.sourceChecksum,x.migration.sha256(raw));
  const receipt=JSON.parse(x.storage.getItem('cindyCoachV3MigrationReceiptV1'));
  assert.strictEqual(receipt.status,'success');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(receipt.legacyMetadata)),{calibrationRequested:true,baselineAuthorityCreated:false});
  assert.deepStrictEqual(JSON.parse(JSON.stringify(receipt.mappedFields)),[]);
  const receiptIndex=x.operations.findIndex(([kind,key])=>kind==='set'&&key==='cindyCoachV3MigrationReceiptV1');
  const deleteIndex=x.operations.findIndex(([kind,key])=>kind==='remove'&&key==='cindy.focus.coach.v28.state');
  assert(receiptIndex>=0&&deleteIndex>receiptIndex,'legacy key removal follows verified receipt persistence');
  const receiptWriteIndexes=x.operations.map(([kind,key],index)=>kind==='set'&&key==='cindyCoachV3MigrationReceiptV1'?index:-1).filter(index=>index>=0);
  assert.strictEqual(JSON.parse(x.operations[receiptWriteIndexes[0]][2]).status,'pending');
  assert.strictEqual(JSON.parse(x.operations[receiptWriteIndexes[1]][2]).status,'success');
  assert(receiptWriteIndexes[1]>deleteIndex,'success receipt is persisted only after V2.8 deletion is verified');
  const rollback=x.migration.rollback({storage:x.storage});assert.strictEqual(rollback.ok,true);
  assert.strictEqual(x.storage.getItem('cindy.focus.coach.v28.state'),raw);assert.strictEqual(x.storage.getItem('cindyCoachV3State'),null);
}
{
  const raw=legacy({calibrationRequested:true}),prior=JSON.stringify({version:1,ownership:'COACH',baselineAuthority:false,baselineCompletedAt:'2026-10-03T10:00:00.000Z',baselineRecordId:'valid-baseline-id',baselineTestMinutes:5,starterApplied:false,preparedSpec:null,preparedFingerprint:null,appliedConfigFingerprint:'fp',pendingIntervention:null}),x=setup({legacyRaw:raw,initialV3:prior});
  const migrated=x.migration.migrate({storage:x.storage,stateRepository:x.repository,now:fixedNow});
  assert.strictEqual(migrated.ready,true);
  const currentV3Raw=x.storage.getItem('cindyCoachV3State'),backup=JSON.parse(x.storage.getItem('cindyCoachV3MigrationBackupV1'));
  backup.priorV3Raw=JSON.stringify({version:1,ownership:'COACH',baselineAuthority:false,baselineCompletedAt:'2026-10-03T10:00:00.000Z',baselineRecordId:'CORRUPTED',baselineTestMinutes:5,starterApplied:false,preparedSpec:null,preparedFingerprint:null,appliedConfigFingerprint:'fp',pendingIntervention:null});
  x.storage.setItem('cindyCoachV3MigrationBackupV1',JSON.stringify(backup));
  const v3WritesBefore=x.operations.filter(([kind,key])=>key==='cindyCoachV3State').length;
  const rollback=x.migration.rollback({storage:x.storage});
  assert.strictEqual(rollback.ok,false,'a tampered prior V3 backup blocks rollback');
  assert.strictEqual(rollback.reason,'migration-backup-prior-v3-checksum-mismatch');
  assert.strictEqual(x.storage.getItem('cindyCoachV3State'),currentV3Raw,'checksum failure preserves the exact live V3 state and baselineRecordId');
  assert.strictEqual(x.storage.getItem('cindy.focus.coach.v28.state'),null,'checksum failure performs no partial legacy restore');
  assert.strictEqual(x.operations.filter(([kind,key])=>key==='cindyCoachV3State').length,v3WritesBefore,'checksum failure performs no V3 write');
  const failedReceipt=JSON.parse(x.storage.getItem('cindyCoachV3MigrationReceiptV1'));
  assert.strictEqual(failedReceipt.status,'failed','tampered rollback is recorded as failed recovery');
  assert.strictEqual(failedReceipt.failureReason,rollback.reason);
  assert.strictEqual(failedReceipt.rollbackVerified,false);
  console.log('PASS migration rejects prior-V3 checksum tampering without changing live state');
}
{
  const x=setup({legacyRaw:legacy({calibrationRequested:false})});
  const result=x.migration.migrate({storage:x.storage,stateRepository:x.repository,now:fixedNow});
  assert.strictEqual(result.ready,true);assert.strictEqual(x.repository.load().baselineAuthority,false);
}
{
  const raw=legacy({calibrationRequested:true,workoutPlan:{unknown:true}}),x=setup({legacyRaw:raw});
  const result=x.migration.migrate({storage:x.storage,stateRepository:x.repository,now:fixedNow});
  assert.strictEqual(result.ready,false);assert.strictEqual(result.blocker,'unsupported-v28-fields:workoutPlan');
  assert.strictEqual(x.storage.getItem('cindy.focus.coach.v28.state'),raw);assert.strictEqual(x.storage.getItem('cindyCoachV3State'),null);
  assert.strictEqual(JSON.parse(x.storage.getItem('cindyCoachV3MigrationBackupV1')).sourceRaw,raw);
}
{
  const raw='{not-json',x=setup({legacyRaw:raw});
  const result=x.migration.migrate({storage:x.storage,stateRepository:x.repository,now:fixedNow});
  assert.strictEqual(result.ready,false);assert.strictEqual(result.blocker,'unsupported-v28-corrupt-json');
  assert.strictEqual(x.storage.getItem('cindy.focus.coach.v28.state'),raw);
}
{
  const raw=legacy({calibrationRequested:'true'}),x=setup({legacyRaw:raw});
  assert.strictEqual(x.migration.migrate({storage:x.storage,stateRepository:x.repository,now:fixedNow}).blocker,'unsupported-v28-calibrationRequested-type');
  assert.strictEqual(x.storage.getItem('cindy.focus.coach.v28.state'),raw);
}
{
  const raw=legacy({calibrationRequested:true}),prior=JSON.stringify({version:1,ownership:'COACH',baselineAuthority:false,baselineCompletedAt:'2026-01-01T00:00:00.000Z',baselineRecordId:'canonical',baselineTestMinutes:10,starterApplied:true,preparedSpec:null,preparedFingerprint:null,appliedConfigFingerprint:'fp',pendingIntervention:null}),x=setup({legacyRaw:raw,initialV3:prior});
  const result=x.migration.migrate({storage:x.storage,stateRepository:x.repository,now:fixedNow});
  assert.strictEqual(result.ready,true);assert.strictEqual(x.storage.getItem('cindyCoachV3State'),prior,'pre-existing V3 state is preserved byte-for-byte');
  assert.strictEqual(x.repository.load().baselineAuthority,false,'legacy defaults never overwrite valid V3 authority');
}
for(const failure of [
  {name:'state write failure',opts:{failSetKey:'cindyCoachV3State'},blocker:'migration-state-write-failed'},
  {name:'receipt write failure',opts:{failSetKey:'cindyCoachV3MigrationReceiptV1'},blocker:'injected-set-failure:cindyCoachV3MigrationReceiptV1'},
  {name:'legacy deletion failure',opts:{failRemoveKey:'cindy.focus.coach.v28.state'},blocker:'injected-remove-failure:cindy.focus.coach.v28.state'},
  {name:'state read-back mismatch',opts:{corruptV3Readback:true},blocker:'migration-state-readback-mismatch'}
]){
  const raw=legacy({calibrationRequested:true}),x=setup({legacyRaw:raw,...failure.opts});
  const result=x.migration.migrate({storage:x.storage,stateRepository:x.repository,now:fixedNow});
  assert.strictEqual(result.ready,false,`${failure.name} blocks Coach`);assert.strictEqual(result.blocker,failure.blocker);
  assert.strictEqual(x.storage.getItem('cindy.focus.coach.v28.state'),raw,`${failure.name} retains legacy source`);
  assert.strictEqual(x.storage.getItem('cindyCoachV3State'),null,`${failure.name} restores the pre-migration V3 value`);
  if(failure.name==='legacy deletion failure'){
    const failedReceipt=JSON.parse(x.storage.getItem('cindyCoachV3MigrationReceiptV1'));
    assert.strictEqual(failedReceipt.status,'rolled_back','a failed legacy-key deletion cannot leave a success receipt');
    assert.strictEqual(failedReceipt.rollbackVerified,true,'the fixture verifies legacy and V3 state were restored');
    x.setFailRemoveKey(null);
    const retry=x.migration.migrate({storage:x.storage,stateRepository:x.repository,now:fixedNow});
    assert.strictEqual(retry.ready,true);assert.strictEqual(retry.migrated,true,'a later retry must complete after the injected deletion failure is removed');
    const retriedReceipt=JSON.parse(x.storage.getItem('cindyCoachV3MigrationReceiptV1'));
    assert.strictEqual(retriedReceipt.status,'success','only the fully committed retry receives success status');
    assert.strictEqual(x.storage.getItem('cindy.focus.coach.v28.state'),null);
    assert.strictEqual(x.repository.load().baselineAuthority,false);
  }
}
console.log('COACH_MIGRATION_TESTS_PASS');
