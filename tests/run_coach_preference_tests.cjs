const {execFileSync}=require('child_process');
const path=require('path');
const child=path.join(__dirname,'run_real_post_test_browser_lifecycle.cjs');
for(const fixture of ['absent','legacy-unmarked-false','explicit-off','explicit-on']){
  execFileSync(process.execPath,[child],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',env:{...process.env,CINDY_TEST_COACH_PREF:fixture}});
}
for(const fixture of ['training-experience-invalid']){
  execFileSync(process.execPath,[child],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',env:{...process.env,CINDY_TEST_COACH_PREF:fixture}});
}
execFileSync(process.execPath,[child],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',env:{...process.env,CINDY_TEST_COACH_PREF:'',CINDY_TEST_PUBLIC_COACH_OFF:'1'}});
execFileSync(process.execPath,[child],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',env:{...process.env,CINDY_TEST_COACH_PREF:'',CINDY_TEST_HISTORY_IMPORT:'1'}});
for(const fixture of ['v3-invalid','history-mutation']){
  execFileSync(process.execPath,[child],{cwd:path.resolve(__dirname,'..'),stdio:'inherit',env:{...process.env,CINDY_TEST_COACH_PREF:'',CINDY_TEST_HISTORY_IMPORT:'',CINDY_TEST_HISTORY_OFF_BASELINE:fixture}});
}
console.log('COACH_PREFERENCE_TESTS_PASS');
