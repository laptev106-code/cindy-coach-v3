const fs=require('fs');
const path=require('path');
const {execFileSync}=require('child_process');
const root=path.resolve(__dirname,'..');
let pass=0,fail=0;
function T(name,fn){try{fn();console.log('PASS',name);pass++;}catch(error){console.log('FAIL',name,'-',error.message);fail++;}}
T('release artifact integrity and both manifest identities',()=>{
  const out=execFileSync(process.execPath,[path.join(__dirname,'run_release_integrity_tests.cjs')],{cwd:root,encoding:'utf8'});
  if(!out.includes('RELEASE_INTEGRITY_TESTS_PASS'))throw Error('release integrity marker missing');
});
T('all declared JavaScript artifacts pass syntax check',()=>{
  const release=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8'));
  for(const relative of Object.keys(release.artifactHashes).filter(file=>/\.(?:js|cjs)$/.test(file)))execFileSync(process.execPath,['--check',path.join(root,relative)],{stdio:'pipe'});
});
T('every inline HTML script passes syntax check',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(match=>match[1]).filter(Boolean);
  for(let i=0;i<scripts.length;i+=1){const temporary=path.join('/tmp',`cindy_stage1_inline_${i}.js`);fs.writeFileSync(temporary,scripts[i]);execFileSync(process.execPath,['--check',temporary],{stdio:'pipe'});}
});
T('program pack contains no reload call',()=>{const source=fs.readFileSync(path.join(root,'coach_core_v3/program_pack_v3.js'),'utf8');if(/location\.reload\s*\(/.test(source))throw Error('reload call present');});
T('program pack uses explicit runtime boundary',()=>{const source=fs.readFileSync(path.join(root,'coach_core_v3/program_pack_v3.js'),'utf8');if(!/boundRuntime|options\.runtime/.test(source))throw Error('explicit runtime boundary missing');});
T('program pack does not use raw localStorage',()=>{const source=fs.readFileSync(path.join(root,'coach_core_v3/program_pack_v3.js'),'utf8');if(/localStorage\./.test(source))throw Error('raw localStorage dependency present');});
T('decomposition Stage 1 test suite passes',()=>{const out=execFileSync(process.execPath,[path.join(__dirname,'run_decomposition_stage1_tests.cjs')],{cwd:root,encoding:'utf8'});if(!out.includes('DECOMPOSITION_STAGE1_PASS'))throw Error('Stage 1 marker missing');});
console.log(JSON.stringify({total:pass+fail,pass,fail},null,2));
process.exit(fail?1:0);
