const {execFileSync}=require('child_process');
const path=require('path');
const root=path.resolve(__dirname,'..');
const node=process.execPath;
const checks=[
  ['V3 acceptance','run_v3_acceptance_tests.cjs','"fail": 0'],
  ['Stage1 static decomposition','run_decomposition_stage1_tests.cjs','DECOMPOSITION_STAGE1_PASS'],
  ['Stage2 repositories','run_stage2_repository_tests.cjs','DECOMPOSITION_STAGE2_REPOSITORY_PASS'],
  ['Stage3 vertical slice','run_stage3_vertical_slice_tests.cjs','DECOMPOSITION_STAGE3_UNIT_PASS'],
  ['Coach boundary Stage4','run_stage4_coach_boundary_tests.cjs','DECOMPOSITION_STAGE4_COACH_BOUNDARY_PASS'],
  ['Program rotation','run_v3_program_tests.cjs','V3 PROGRAM FIXED TEST: PASS'],
  ['Integration E2E','run_inprocess_e2e.cjs','IN_PROCESS_E2E_PASS']
];
let pass=0,fail=0;
for(const [name,file,marker] of checks){
  try{
    const out=execFileSync(node,[path.join(__dirname,file)],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
    if(!out.includes(marker)) throw new Error(`marker missing: ${marker}`);
    console.log('PASS',name);pass++;
  }catch(error){
    console.log('FAIL',name,'-',String(error.stdout||error.stderr||error.message).slice(-1200));fail++;
  }
}
console.log(JSON.stringify({total:pass+fail,pass,fail},null,2));
process.exit(fail?1:0);
