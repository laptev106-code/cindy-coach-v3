const {execFileSync}=require('child_process');
const path=require('path');
const child=path.join(__dirname,'run_real_post_test_browser_lifecycle.cjs');
for(const flag of ['CINDY_TEST_COACH_OFF','CINDY_TEST_COACH_OFF_FAILURE','CINDY_TEST_COACH_OFF_CONFIG_FAILURE','CINDY_TEST_CROSS_TAB_OFF','CINDY_TEST_START_OFF_BEFORE_COMMIT','CINDY_TEST_START_COMMIT_SAVE_FAILURE']){
  execFileSync(process.execPath,[child],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',env:{...process.env,[flag]:'1'}});
}
execFileSync(process.execPath,[child],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',env:{...process.env,CINDY_TEST_HISTORY_OFF_BASELINE:'v3-invalid'}});
console.log('COACH_OFF_SESSION_TESTS_PASS');
