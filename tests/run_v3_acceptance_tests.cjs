const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const coreSrc=path.join(root,'coach_core_v3','coach_core_v3.js');
const localCore=path.join(__dirname,'coach_core_v3.js');
fs.copyFileSync(coreSrc,localCore);
try{
  const {tests}=require('./v3_acceptance_fixtures.cjs');
  let pass=0,fail=0;
  for(const [i,t] of tests.entries()){
    try{t.fn();pass++;console.log(`PASS T${String(i+1).padStart(2,'0')} ${t.name}`);}catch(e){fail++;console.error(`FAIL T${String(i+1).padStart(2,'0')} ${t.name}\n  ${e.stack}`);}
  }
  console.log(JSON.stringify({total:tests.length,pass,fail},null,2));
  if(fail)process.exitCode=1;
} finally { try{fs.unlinkSync(localCore)}catch(_){} }
