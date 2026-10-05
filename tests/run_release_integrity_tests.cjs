const assert=require('assert');
const crypto=require('crypto');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'..');
const release=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8'));
const decomp=JSON.parse(fs.readFileSync(path.join(root,'decomposition-manifest.json'),'utf8'));
const RUNTIME_SOURCE_PATHS=['coach_core_v3','src'].flatMap(base=>{
  const output=[];
  function walk(directory){for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){const relative=path.posix.join(directory,entry.name);if(entry.isDirectory())walk(relative);else if(entry.isFile()&&entry.name.endsWith('.js'))output.push(relative)}}
  walk(base);return output;
}).sort();
const SHELL_PATHS=['index.html','manifest.webmanifest','service-worker.js'];
const shaBytes=value=>crypto.createHash('sha256').update(value).digest('hex');
const shaFile=relative=>shaBytes(fs.readFileSync(path.join(root,relative)));
function canonical(value){
  if(value===null||typeof value!=='object')return value;
  if(Array.isArray(value))return value.map(canonical);
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
}
const hashJson=value=>shaBytes(Buffer.from(JSON.stringify(canonical(value)),'utf8'));
function normalizedManifestHash(value){return hashJson({...value,manifestHash:''})}
function normalizedAdapter(){
  let text=fs.readFileSync(path.join(root,'coach_core_v3/coach_integration_v3.js'),'utf8');
  const source=text.replace(/(const V3_RELEASE_SOURCE_HASH = ')[0-9a-f]{64}(';)/g,'$1<PROJECT_RELEASE_SOURCE_HASH>$2');
  const result=source.replace(/(const V3_RELEASE_BUILD_HASH = ')[0-9a-f]{64}(';)/g,'$1<PROJECT_RELEASE_BUILD_HASH>$2');
  assert.notStrictEqual(source,text,'project release source normalization anchor must match');
  assert.notStrictEqual(result,source,'project release build normalization anchor must match');
  return Buffer.from(result,'utf8');
}
function T(name,fn){fn();console.log('PASS',name)}
T('declared artifact set exactly matches runtime sources, shell and current test/process files',()=>{
  assert.deepStrictEqual(release.runtimeSourcePaths,RUNTIME_SOURCE_PATHS);
  const tests=fs.readdirSync(path.join(root,'tests')).filter(name=>name.endsWith('.cjs')).map(name=>`tests/${name}`);
  const verification=[...tests,'scripts/update_release_manifests.py','RELEASE_INTEGRITY.md','RELEASE_README.md','RELEASE_NOTES.md','SHA256SUMS.txt','CINDY_LITE_V1_RELEASE_NOTES.md','CINDY_Adaptive_Coach_V3.0.0_NORMATIVE_SPECIFICATION.md','CINDY_V30_PACE_GUIDANCE_BASELINE_VALIDATION_FIX_REPORT_20261004.md','CINDY_V30_CONFIRMED_UX_IMPLEMENTATION_REPORT_20261004.md','CINDY_V30_CONFIRMED_UX_DIFF_INVENTORY_20261004.md'].sort();
  assert.deepStrictEqual(release.verificationArtifactPaths,verification);
  const expected=[...new Set([...RUNTIME_SOURCE_PATHS,...SHELL_PATHS,...verification])].sort();
  assert.deepStrictEqual(Object.keys(release.artifactHashes).sort(),expected);
});
T('every declared artifact hash matches exact candidate bytes',()=>{
  for(const [relative,expected] of Object.entries(release.artifactHashes))assert.strictEqual(shaFile(relative),expected,`artifact mismatch: ${relative}`);
});
T('both shipped SHA-256 lists match their exact file bytes',()=>{
  for(const list of ['SHA256SUMS.txt','CINDY_V30_COACH_4DAY_PROGRAM_SHA256.txt']){
    const lines=fs.readFileSync(path.join(root,list),'utf8').trim().split(/\r?\n/);
    assert(lines.length>0,`${list} must not be empty`);
    for(const line of lines){const match=line.trim().match(/^([0-9a-f]{64})\s+\*?(\.\/)?(.+)$/);assert(match,`${list} has an invalid entry: ${line}`);assert.strictEqual(shaFile(match[3]),match[1],`${list} checksum mismatch: ${match[3]}`)}
  }
});
T('declared PWA icons are package-local and the missing branded asset is not referenced',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.webmanifest'),'utf8'));
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert(!html.includes('/manus-storage/cindy-focus-mark_1b73771f.png'),'broken favicon/background reference remains');
  for(const icon of manifest.icons||[]){
    assert(icon&&typeof icon.src==='string'&&!/^https?:/i.test(icon.src),`icon must be a local package path: ${icon&&icon.src}`);
    const local=icon.src.replace(/^\/+/, '');
    assert(fs.existsSync(path.join(root,local)),`declared PWA icon is absent from the candidate: ${icon.src}`);
  }
});
T('normative core identity remains pinned while project source/build hashes recompute',()=>{
  const sourceHashes={};
  for(const relative of RUNTIME_SOURCE_PATHS){const bytes=relative==='coach_core_v3/coach_integration_v3.js'?normalizedAdapter():fs.readFileSync(path.join(root,relative));sourceHashes[relative]=shaBytes(bytes)}
  const releaseSourceHash=hashJson(sourceHashes);
  assert.strictEqual(release.releaseSourceHash,releaseSourceHash);
  const shell={};for(const relative of SHELL_PATHS)shell[relative]=shaFile(relative);
  const releaseBuildHash=hashJson({integrityVersion:release.integrityVersion,runtimeSourceHash:releaseSourceHash,shellArtifactHashes:shell});
  assert.strictEqual(release.releaseBuildHash,releaseBuildHash);
  const serviceWorker=fs.readFileSync(path.join(root,'service-worker.js'),'utf8');
  const normalizedServiceWorker=serviceWorker.replace(/cindy-coach-v3-[0-9a-f]{12}-shell/,'cindy-coach-v3-<CACHE_ID>-shell');
  assert.notStrictEqual(normalizedServiceWorker,serviceWorker,'service-worker cache token normalization anchor must match');
  const cacheIdentityHash=hashJson({integrityVersion:release.integrityVersion,runtimeSourceHash:releaseSourceHash,shellArtifactHashes:{'index.html':shell['index.html'],'manifest.webmanifest':shell['manifest.webmanifest']},serviceWorkerTemplateHash:shaBytes(normalizedServiceWorker)});
  assert.strictEqual(release.cacheIdentityHash,cacheIdentityHash);
  assert.strictEqual(release.sourceHash,release.coachCoreSourceHash);
  assert.strictEqual(release.buildHash,release.coachCoreBuildHash);
  const core=fs.readFileSync(path.join(root,'coach_core_v3/coach_core_v3.js'),'utf8');
  assert(core.includes(`const EXPECTED_SOURCE_HASH = '${release.sourceHash}'`));
  assert(core.includes(`const EXPECTED_BUILD_HASH = '${release.buildHash}'`));
  const adapter=fs.readFileSync(path.join(root,'coach_core_v3/coach_integration_v3.js'),'utf8');
  assert(adapter.includes(`const V3_SOURCE_HASH = '${release.sourceHash}'`));
  assert(adapter.includes(`const V3_BUILD_HASH = '${release.buildHash}'`));
  assert(adapter.includes(`const V3_RELEASE_SOURCE_HASH = '${releaseSourceHash}'`));
  assert(adapter.includes(`const V3_RELEASE_BUILD_HASH = '${releaseBuildHash}'`));
  assert(adapter.includes(`releaseCandidateId: '${release.releaseCandidateId}'`));
  assert(serviceWorker.includes(`cindy-coach-v3-${cacheIdentityHash.slice(0,12)}-shell`));
});
T('artifact-set digest and release-manifest self-hash verify',()=>{
  assert.strictEqual(release.artifactSetHash,hashJson(release.artifactHashes));
  assert.strictEqual(release.manifestHash,normalizedManifestHash(release));
  assert.strictEqual(release.coachCoreHash,release.artifactHashes['coach_core_v3/coach_core_v3.js']);
  assert.strictEqual(release.coachIntegrationHash,release.artifactHashes['coach_core_v3/coach_integration_v3.js']);
  assert.strictEqual(release.coachStateMigrationHash,release.artifactHashes['src/infrastructure/storage/coach_state_migration_v3.js']);
  assert.strictEqual(release.indexHash,release.artifactHashes['index.html']);
  assert.strictEqual(release.webManifestHash,release.artifactHashes['manifest.webmanifest']);
  assert.strictEqual(release.serviceWorkerHash,release.artifactHashes['service-worker.js']);
});
T('decomposition manifest exact references and self-hash verify',()=>{
  assert.strictEqual(decomp.manifestHash,normalizedManifestHash(decomp));
  assert.strictEqual(decomp.releaseManifestHash,shaFile('release-manifest.json'));
  assert.strictEqual(decomp.releaseArtifactSetHash,release.artifactSetHash);
  assert.strictEqual(decomp.releaseBuildHash,release.releaseBuildHash);
  assert.strictEqual(decomp.releaseSourceHash,release.releaseSourceHash);
  assert.strictEqual(decomp.indexHash,release.indexHash);
  assert.strictEqual(decomp.serviceWorkerHash,release.serviceWorkerHash);
  assert.strictEqual(decomp.currentCoreHash,release.coachCoreHash);
  assert.strictEqual(decomp.currentIntegrationHash,release.coachIntegrationHash);
  assert.strictEqual(decomp.coachApplicationServiceHash,release.coachApplicationServiceHash);
  assert.strictEqual(decomp.coachStateRepositoryHash,release.coachStateRepositoryHash);
  assert.strictEqual(decomp.historyProvenanceHash,release.historyProvenanceHash);
  assert.strictEqual(decomp.masterRegressionGates,26);
});
T('release procedure documents schema blockers and distinguishes tested UX, independent QA and ZIP coverage',()=>{
  assert.strictEqual(release.integrityVersion,'CINDY_RELEASE_HASH_V1');
  assert(release.integrityProcedure.runtimeSourceInput.includes('V3_RELEASE_SOURCE_HASH/V3_RELEASE_BUILD_HASH'));
  assert(release.integrityProcedure.embeddedAdapterIdentity.includes('normative core-pinned'));
  assert(release.integrityProcedure.manifestSelfHashNormalization.includes('manifestHash'));
  assert(release.knownImplementationBlockers.some(item=>item.includes('calibrationRequested')));
  assert(release.realBrowserVerification.includes('PASS')&&release.realBrowserVerification.includes('NOT_VERIFIED'));
  assert(release.finalZipVerification.startsWith('PENDING')||release.finalZipVerification.startsWith('PASS'));
  assert.strictEqual(release.finalZipVerification.startsWith('PASS'),decomp.currentCandidateVerification.zipExtraction.startsWith('PASS'));
  const zipPendingGap=decomp.remainingKnownGaps.some(item=>item.startsWith('The final source ZIP remains PENDING'));
  assert.strictEqual(zipPendingGap,release.finalZipVerification.startsWith('PENDING'),'decomposition ZIP gap must match generated ZIP verification status');
  assert.strictEqual(release.coachEnabledDefault,true);
  assert.strictEqual(release.v3AcceptanceFixtureCount,102);
  if(release.masterRegressionStatus.startsWith('PASS')){
    assert(release.v3AcceptanceStatus.includes('102/102'));
    assert(decomp.stage7Tests.v3Acceptance.includes('102/102'));
  }else{
    assert(release.masterRegressionStatus.startsWith('PENDING'));
    assert(release.v3AcceptanceStatus.startsWith('PENDING'));
    assert(decomp.stage7Tests.v3Acceptance.startsWith('PENDING'));
  }
  assert.strictEqual(decomp.v3AcceptanceStatus,release.v3AcceptanceStatus);
});
console.log('RELEASE_INTEGRITY_TESTS_PASS');
