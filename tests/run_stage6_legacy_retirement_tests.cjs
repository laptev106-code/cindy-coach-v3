const fs=require('fs');
const path=require('path');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const integration=fs.readFileSync(path.join(root,'coach_core_v3','coach_integration_v3.js'),'utf8');
const program=fs.readFileSync(path.join(root,'coach_core_v3','program_pack_v3.js'),'utf8');
const bootstrap=fs.readFileSync(path.join(root,'src','composition','bootstrap_v3.js'),'utf8');
const service=fs.readFileSync(path.join(root,'src','application','coach','coach_application_service_v3.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'src','infrastructure','storage','coach_state_migration_v3.js'),'utf8');

function assertNot(text,re,label){assert(!re.test(text),label)}
function assertHas(text,re,label){assert(re.test(text),label)}

// 1. Embedded V2.8 implementation and old public compatibility surfaces are gone from the app bundle.
[
  /CINDY_COACH_V28_RUNTIME/,
  /V28_VERSION\s*=/,
  /window\.CindyCoachV28/,
  /window\.__CINDY_V28_TEST_API/,
  /CindyCoachCoreIntegrationV1/,
  /v28State\b/,
  /cindy\.focus\.coach\.v28\.state/
].forEach((re,i)=>assertNot(index,re,`legacy V2.8 marker remains #${i+1}`));
assertNot(index,/cindyCoachCoreIntegrationLegacyV1Module/,'stale executable V1 integration identifier remains');
assertNot(index,/cindyCoachIntegrationLegacyV1\b/,'stale V1 bridge construction remains');

// 2. No V3 lifecycle monkey-patching or wrapper markers remain.
[
  /__cindyV3(?:SetConfig|Start|Record|Finish|Session)Wrapped/,
  /installSetConfigGuard|installSessionNormalization|installStart\b|installRecord\b|installFinish\b/,
  /(?:^|\n)\s*finish\s*=\s*function/,
  /(?:^|\n)\s*startResume\s*=\s*function/,
  /(?:^|\n)\s*record\s*=\s*function/,
  /(?:^|\n)\s*setConfig\s*=\s*function/,
  /(?:^|\n)\s*normalizeSession\s*=\s*function/
].forEach((re,i)=>assertNot(index,re,`lifecycle wrapper remains #${i+1}`));

// 3. Explicit runtime and composition root exist.
assertHas(index,/window\.CINDYAppRuntimeV3\s*=\s*Object\.freeze/,'explicit app runtime missing');
assertHas(index,/src="\.\/src\/composition\/bootstrap_v3\.js"/,'composition bootstrap script not loaded');
assertHas(bootstrap,/coach\.bindRuntime\(runtime\)/,'bootstrap does not bind Coach runtime');
assertHas(bootstrap,/CINDYBootstrapV3/,'bootstrap readiness surface missing');
assertHas(bootstrap,/runtime\.renderAll\(\{markers:true\}\)/,'bootstrap does not refresh initial UI');

// 4. Adapter has an explicit bind boundary and no auto-bind/legacy lifecycle installer.
assertHas(integration,/function bindRuntime\(next\)/,'bindRuntime missing');
assertHas(integration,/isBound:\s*\(\)\s*=>\s*Boolean\(runtime\)/,'explicit bound-state API missing');
assertNot(integration,/if\s*\(window\.CINDYAppRuntimeV3\)\s*window\.CindyCoachIntegration\.bindRuntime/,'adapter still auto-binds from ambient window');
[
  /installSetConfigGuard/,/installSessionNormalization/,/installStart\b/,/installRecord\b/,/installFinish\b/
].forEach((re,i)=>assertNot(integration,re,`adapter lifecycle installer remains #${i+1}`));

// 5. Program pack uses explicit runtime and has no reload/storage monkey-patch or legacy globals.
assertHas(program,/boundRuntime|options\.runtime/,'program pack does not use explicit runtime');
assertHas(program,/function init\(options=\{\}\)/,'program pack explicit init missing');
assertHas(program,/metaRepository/,'program pack metadata port missing');
assertNot(program,/window\.setConfig/,'program pack still calls legacy window.setConfig');
assertNot(program,/window\.renderAll/,'program pack still calls legacy window.renderAll');
assertNot(program,/location\.reload/,'program pack still reloads page');
assertNot(program,/localStorage\.setItem\s*=|const\s+originalSetItem|originalSetItem\(/,'program pack still monkey-patches localStorage.setItem');
assertNot(program,/ensurePlan\(\);\s*\n\}\)\(\);/,'program pack still auto-initializes outside composition root');

// 6. Stage-6 application service owns baseline migration rather than V2 runtime.
assertHas(service,/requestBaseline\s*=\s*\(\s*minutes/,'V3 baseline authority API missing');
assertHas(service,/markCoachOwned\s*=\s*\(spec, sourceConfig\)/,'Coach ownership API missing');
assertNot(service,/cindy\.focus\.coach\.v28\.state/,'application service must not depend on V2 storage key');

// 7. Exact script order: domain -> storage/migration -> application -> adapter -> program -> composition.
const order=[
  'coach_core_v3/coach_core_v3.js',
  'src/infrastructure/storage/coach_state_repository_v3.js',
  'src/infrastructure/storage/coach_state_migration_v3.js',
  'src/infrastructure/storage/program_meta_repository_v3.js',
  'src/application/coach/coach_application_service_v3.js',
  'src/application/program/program_service_v3.js',
  'coach_core_v3/coach_integration_v3.js',
  'coach_core_v3/program_pack_v3.js',
  'src/composition/bootstrap_v3.js'
].map(src=>index.indexOf(src));
assert(order.every(x=>x>=0),'not all V3 bootstrap scripts found');
for(let i=1;i<order.length;i++)assert(order[i-1]<order[i],`bootstrap order invalid at ${i}`);

// 8. V2.8 key access belongs only to the explicit recoverable migrator; calibration remains non-authoritative metadata.
const allJs=[integration,program,bootstrap,service].join('\n');
assertNot(allJs,/window\.CindyCoachV28|window\.__CINDY_V28_TEST_API|CindyCoachCoreIntegrationV1/,'legacy public Coach surfaces remain in V3 modules');
assertNot(allJs,/cindy\.focus\.coach\.v28\.state/,'runtime adapter/application must not access the V2.8 key');
assertHas(migration,/const LEGACY_KEY = 'cindy\.focus\.coach\.v28\.state'/,'dedicated migrator must retain the original key');
assertHas(migration,/baselineAuthorityCreated:false/,'legacy calibration intent must be retained as metadata only');
assertNot(migration,/baselineAuthority\s*:\s*true/,'legacy calibration must never create V3 baseline authority');
assertHas(index,/onHistoryMutation\(\{kind:'clear'\}\)/,'successful History clear must notify Coach invalidation');
assertHas(service,/kind === 'clear'/,'application service must handle canonical History clear');

console.log('DECOMPOSITION_STAGE6_LEGACY_RETIREMENT_PASS');
