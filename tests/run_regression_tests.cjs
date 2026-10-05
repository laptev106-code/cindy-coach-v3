const {execFileSync}=require('child_process');
const path=require('path');
const root=path.resolve(__dirname,'..');
const node=process.execPath;
const checks=[
  ['Stage 2 static','run_decomposition_stage2_tests.cjs','DECOMPOSITION_STAGE2_STATIC_PASS'],
  ['Stage 2 repositories','run_stage2_repository_tests.cjs','DECOMPOSITION_STAGE2_REPOSITORY_PASS'],
  ['Stage 1 regression','run_stage1_regression.cjs','"fail": 0'],
  ['Stage 3 vertical slice','run_stage3_vertical_slice_tests.cjs','DECOMPOSITION_STAGE3_UNIT_PASS'],
  ['Stage 4 Coach boundary','run_stage4_coach_boundary_tests.cjs','DECOMPOSITION_STAGE4_COACH_BOUNDARY_PASS'],
  ['Stage 5 presentation','run_stage5_presentation_tests.cjs','DECOMPOSITION_STAGE5_PRESENTATION_PASS'],
  ['Confirmed UX browser interactions','run_confirmed_ux_dom_tests.cjs','CONFIRMED_UX_DOM_TESTS_PASS'],
  ['Plan pace-guidance DOM/runtime','run_pace_guidance_dom_runtime_tests.cjs','PACE_GUIDANCE_DOM_RUNTIME_PASS'],
  ['Coach pace-guidance frozen session/reload','run_pace_guidance_coach_freeze_tests.cjs','PACE_GUIDANCE_COACH_FREEZE_TESTS_PASS'],
  ['Stage 6 legacy retirement','run_stage6_legacy_retirement_tests.cjs','DECOMPOSITION_STAGE6_LEGACY_RETIREMENT_PASS'],
  ['Stage 7 hardening','run_stage7_hardening_tests.cjs','DECOMPOSITION_STAGE7_HARDENING_PASS'],
  ['V3 acceptance','run_v3_acceptance_tests.cjs','"fail": 0'],
  ['Program four-day definition + rotation','run_v3_program_tests.cjs','V3 PROGRAM FIXED TEST: PASS'],
  ['Program transition hardening','run_program_transition_hardening_tests.cjs','PROGRAM_TRANSITION_HARDENING_PASS'],
  ['Coach cold start','run_coach_cold_start_tests.cjs','COACH_COLD_START_TESTS_PASS'],
  ['Coach test engine','run_coach_test_engine_tests.cjs','COACH_TEST_ENGINE_TESTS_PASS'],
  ['Final HTML runtime smoke','run_final_html_runtime_smoke.cjs','FINAL_HTML_RUNTIME_SMOKE_PASS'],
  ['Domain boundary','run_domain_boundary_tests.cjs','DOMAIN_BOUNDARY_PASS'],
  ['Integration E2E','run_inprocess_e2e.cjs','IN_PROCESS_E2E_PASS'],
  ['Real post-test browser lifecycle','run_real_post_test_browser_lifecycle.cjs','REAL_POST_TEST_BROWSER_LIFECYCLE_PASS'],
  ['Recoverable V2.8 migration','run_coach_migration_tests.cjs','COACH_MIGRATION_TESTS_PASS'],
  ['Coach preference provenance','run_coach_preference_tests.cjs','COACH_PREFERENCE_TESTS_PASS'],
  ['Coach OFF lifecycle and failures','run_coach_off_session_tests.cjs','COACH_OFF_SESSION_TESTS_PASS'],
  ['Lite presentation/runtime gates','run_lite_build_tests.cjs','CINDY_LITE_STATIC_GATES_PASS'],
  ['Release artifact integrity','run_release_integrity_tests.cjs','RELEASE_INTEGRITY_TESTS_PASS']
];
let pass=0,fail=0;
for(const [name,file,marker] of checks){
  try{
    const out=execFileSync(node,[path.join(__dirname,file)],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
    if(!out.includes(marker)) throw new Error(`marker missing: ${marker}`);
    console.log('PASS',name);pass++;
  }catch(error){
    console.log('FAIL',name,'-',String(error.stdout||error.stderr||error.message).slice(-1400));fail++;
  }
}
console.log(JSON.stringify({total:pass+fail,pass,fail},null,2));
process.exit(fail?1:0);
