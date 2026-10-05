const fs=require('fs');
const path=require('path');
const assert=require('assert');
const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
const notes=fs.readFileSync(path.join(root,'CINDY_LITE_V1_RELEASE_NOTES.md'),'utf8');

assert(html.includes('data-cindy-build="lite"'),'Lite presentation marker missing');
assert(html.includes('CINDY_LITE_BUILD=true'),'Lite presentation flag missing');
assert(html.includes("coachEnabledChoice:'default',coachEnabled:true"),'fresh Coach preference must default ON with provenance');
assert(html.includes("x.coachEnabledChoice==='user'?x.coachEnabled===true:true"),'only explicit user preference may override default ON');
assert(html.includes("function coachInterfaceEnabled(){try{return Boolean(config&&config.coachEnabled===true&&window.CindyCoachIntegration&&window.CindyCoachIntegration.isEnabled())}catch(_){return false}}"),'Coach UI must use persisted preference and runtime fail-closed gate');
assert(!html.includes('coachApi=CINDY_LITE_BUILD?null:window.CindyCoachIntegration'),'Lite must not suppress Coach start lifecycle');
assert(!html.includes('if(CINDY_LITE_BUILD)return raw;'),'Lite must not suppress Coach History provenance');
assert(!html.includes('if(!CINDY_LITE_BUILD){try{const coachApi=window.CindyCoachIntegration;'),'Lite must not suppress Coach completion lifecycle');
assert(!html.includes('if(!CINDY_LITE_BUILD){try{const coachApi=window.CindyCoachIntegration;if(coachApi&&typeof coachApi.onConfigMutation'),'Lite must not suppress Coach config invalidation');
assert(html.includes('id="coachPreferenceCard"')&&html.includes('id="coachEnabledSwitch"'),'global Coach switch must be available in Profile→Settings');
assert(!html.includes('body[data-cindy-build="lite"] .coach-card'),'Lite must not hide Coach Plan cards');
assert(!html.includes('body[data-cindy-build="lite"] .coach-toggle'),'Lite must not hide the persistent Coach switch');
assert(!html.includes('body[data-cindy-build="lite"] .composer-coach-exclusion'),'Lite must not hide contextual Plan variant controls');
assert(html.includes('body[data-cindy-build="lite"] .workout-coach-host'),'only the optional workout-local Coach overlay stays hidden');
assert(html.includes("show('settings',{focusSettings:true})")&&html.includes("stage2SetSettingsCategory('interface');stage2Focus('profileSettingsSection')"),'Settings shortcut must focus Profile→Settings→Interface');
for(const token of ['requestBaseline(minutes)','stage4ApplyFreshCoach','НЕ СЕЙЧАС','КАК ЭТО РАБОТАЕТ?','id="coachPreferenceStatus"','src="./src/infrastructure/storage/coach_state_migration_v3.js"'])assert(html.includes(token),`Coach/migration surface missing: ${token}`);
assert(manifest.name==='CINDY / LITE','Manifest name is not Lite');
assert(manifest.short_name==='CINDY Lite','Manifest short name is not Lite');
assert(fs.existsSync(path.join(root,'START_CINDY_LITE.bat')),'Lite launcher missing');
assert(notes.includes('Fresh Coach preference defaults to **ON**')&&notes.includes('fail-closed'),'Release notes must document current Coach policy');
assert(html.includes('id="cindy-lite-clean-ui-v1"'),'Clean UI pass missing');
assert(html.includes('#progress .progress-view-mode,')&&html.includes('display:none!important;'),'Progress mode switch is not hidden in Lite');
assert(html.includes('#idleSessionContext,')&&html.includes('#workoutCoachHost,'),'Workout-local Coach overlay should remain hidden in Lite');
assert(html.includes('#profile .profile-head>p,'),'Profile subtitle cleanup is not present');

const syntaxTargets=[
  path.join(root,'coach_core_v3','coach_integration_v3.js'),
  path.join(root,'src','infrastructure','storage','coach_state_migration_v3.js'),
  path.join(root,'src','composition','bootstrap_v3.js'),
  path.join(root,'service-worker.js')
];
for(const file of syntaxTargets){
  try{execFileSync('node',['--check',file],{stdio:'pipe'})}
  catch(error){throw new Error(`Syntax check failed: ${file}\n${error.stdout||''}${error.stderr||''}`)}
}
execFileSync(process.execPath,[path.join(root,'tests','run_final_html_runtime_smoke.cjs')],{stdio:'inherit'});
console.log('CINDY_LITE_STATIC_GATES_PASS');
console.log(JSON.stringify({build:'CINDY Lite presentation track',coach:'default ON; explicit user preference + migration/runtime fail-closed gates',history:'preserved with frozen provenance',progress:'preserved',plan:'Coach enabled',launcher:'present'},null,2));
