(() => {
  'use strict';

  const LEGACY_KEY = 'cindy.focus.coach.v28.state';
  const STATE_KEY = 'cindyCoachV3State';
  const BACKUP_KEY = 'cindyCoachV3MigrationBackupV1';
  const RECEIPT_KEY = 'cindyCoachV3MigrationReceiptV1';
  const MAPPING_VERSION = 'v2.8-to-v3.0.0-mapping-2';
  const K = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const rotr = (x,n) => (x >>> n) | (x << (32-n));
  const utf8 = text => {
    const encoded = unescape(encodeURIComponent(String(text)));
    const bytes = new Uint8Array(encoded.length);
    for (let i=0;i<encoded.length;i+=1) bytes[i]=encoded.charCodeAt(i);
    return bytes;
  };
  const sha256 = text => {
    const source=utf8(text), bitLength=source.length*8, paddedLength=Math.ceil((source.length+9)/64)*64;
    const bytes=new Uint8Array(paddedLength); bytes.set(source); bytes[source.length]=0x80;
    const view=new DataView(bytes.buffer); const high=Math.floor(bitLength/0x100000000),low=bitLength>>>0;
    view.setUint32(paddedLength-8,high); view.setUint32(paddedLength-4,low);
    const h=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],w=new Uint32Array(64);
    for(let offset=0;offset<paddedLength;offset+=64){
      for(let i=0;i<16;i+=1)w[i]=view.getUint32(offset+i*4);
      for(let i=16;i<64;i+=1){const a=w[i-15],b=w[i-2],s0=rotr(a,7)^rotr(a,18)^(a>>>3),s1=rotr(b,17)^rotr(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
      let [a,b,c,d,e,f,g,hh]=h;
      for(let i=0;i<64;i+=1){const s1=rotr(e,6)^rotr(e,11)^rotr(e,25),choice=(e&f)^(~e&g),t1=(hh+s1+choice+K[i]+w[i])>>>0,s0=rotr(a,2)^rotr(a,13)^rotr(a,22),majority=(a&b)^(a&c)^(b&c),t2=(s0+majority)>>>0;hh=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
      h[0]=(h[0]+a)>>>0;h[1]=(h[1]+b)>>>0;h[2]=(h[2]+c)>>>0;h[3]=(h[3]+d)>>>0;h[4]=(h[4]+e)>>>0;h[5]=(h[5]+f)>>>0;h[6]=(h[6]+g)>>>0;h[7]=(h[7]+hh)>>>0;
    }
    return h.map(x=>x.toString(16).padStart(8,'0')).join('');
  };
  const canonical = value => {
    if(value===null||typeof value!=='object')return value;
    if(Array.isArray(value))return value.map(canonical);
    const out={};Object.keys(value).sort().forEach(key=>{out[key]=canonical(value[key])});return out;
  };
  const canonicalJson = value => JSON.stringify(canonical(value));

  const create = () => {
    const migrate = ({storage,stateRepository,now=()=>new Date().toISOString()}={}) => {
      if(!storage||typeof storage.getItem!=='function'||typeof stateRepository?.load!=='function'||typeof stateRepository?.save!=='function')return{ready:false,blocker:'migration-dependencies-unavailable'};
      let legacyRaw,priorV3Raw;
      try{legacyRaw=storage.getItem(LEGACY_KEY);priorV3Raw=storage.getItem(STATE_KEY)}catch(_){return{ready:false,blocker:'migration-storage-read-failed'}}
      if(legacyRaw===null){
        if(priorV3Raw!==null){try{const parsed=JSON.parse(priorV3Raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return{ready:false,migrated:false,blocker:'preexisting-v3-state-corrupt'};}catch(_){return{ready:false,migrated:false,blocker:'preexisting-v3-state-corrupt'};}}
        return{ready:true,migrated:false,blocker:null};
      }
      const sourceChecksum=sha256(legacyRaw),priorChecksum=priorV3Raw===null?null:sha256(priorV3Raw);
      let backup;
      try{
        const existingBackupRaw=storage.getItem(BACKUP_KEY);
        if(existingBackupRaw){backup=JSON.parse(existingBackupRaw);if(backup.sourceChecksum!==sourceChecksum||backup.sourceRaw!==legacyRaw)return{ready:false,blocker:'migration-backup-conflict'};}
        else{backup={version:1,sourceKey:LEGACY_KEY,sourceVersion:'V2.8',sourceRaw:legacyRaw,sourceChecksum,priorV3Raw,priorV3Checksum:priorChecksum,savedAt:now()};storage.setItem(BACKUP_KEY,JSON.stringify(backup));}
        const verifiedBackup=JSON.parse(storage.getItem(BACKUP_KEY)||'null');
        if(!verifiedBackup||verifiedBackup.sourceRaw!==legacyRaw||verifiedBackup.sourceChecksum!==sourceChecksum||sha256(verifiedBackup.sourceRaw)!==verifiedBackup.sourceChecksum)return{ready:false,blocker:'migration-backup-verification-failed'};
      }catch(_){return{ready:false,blocker:'migration-backup-write-failed'}}
      let legacy;
      try{legacy=JSON.parse(legacyRaw)}catch(_){return{ready:false,blocker:'unsupported-v28-corrupt-json',backupKey:BACKUP_KEY}}
      if(!legacy||typeof legacy!=='object'||Array.isArray(legacy))return{ready:false,blocker:'unsupported-v28-payload-shape',backupKey:BACKUP_KEY};
      const keys=Object.keys(legacy),unknown=keys.filter(key=>key!=='calibrationRequested');
      if(unknown.length)return{ready:false,blocker:`unsupported-v28-fields:${unknown.sort().join(',')}`,backupKey:BACKUP_KEY};
      if(!Object.prototype.hasOwnProperty.call(legacy,'calibrationRequested'))return{ready:false,blocker:'unsupported-v28-schema-no-calibration-field',backupKey:BACKUP_KEY};
      if(typeof legacy.calibrationRequested!=='boolean')return{ready:false,blocker:'unsupported-v28-calibrationRequested-type',backupKey:BACKUP_KEY};
      if(keys.length!==1)return{ready:false,blocker:'unsupported-v28-schema',backupKey:BACKUP_KEY};
      let priorState,candidate,receipt;
      try{
        if(priorV3Raw!==null){const parsed=JSON.parse(priorV3Raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return{ready:false,blocker:'preexisting-v3-state-corrupt',backupKey:BACKUP_KEY};}
        priorState=stateRepository.load();
        candidate=stateRepository.normalize?stateRepository.normalize(priorState):JSON.parse(JSON.stringify(priorState));
        candidate=stateRepository.normalize?stateRepository.normalize(candidate):candidate;
        if(priorV3Raw===null&&!stateRepository.save(candidate))throw new Error('migration-state-write-failed');
        const readBack=stateRepository.load();
        if(canonicalJson(readBack)!==canonicalJson(candidate))throw new Error('migration-state-readback-mismatch');
        const resultChecksum=sha256(canonicalJson(readBack));
        receipt={status:'pending',sourceVersion:'V2.8',sourceChecksum,mappingVersion:MAPPING_VERSION,resultChecksum,preparedAt:now(),mappedFields:[],legacyMetadata:{calibrationRequested:legacy.calibrationRequested,baselineAuthorityCreated:false},unsupportedFields:[]};
        storage.setItem(RECEIPT_KEY,JSON.stringify(receipt));
        const verifiedReceipt=JSON.parse(storage.getItem(RECEIPT_KEY)||'null');
        if(!verifiedReceipt||verifiedReceipt.status!=='pending'||verifiedReceipt.sourceChecksum!==sourceChecksum||verifiedReceipt.resultChecksum!==resultChecksum||verifiedReceipt.mappingVersion!==MAPPING_VERSION)throw new Error('migration-receipt-verification-failed');
        storage.removeItem(LEGACY_KEY);
        if(storage.getItem(LEGACY_KEY)!==null)throw new Error('migration-legacy-removal-failed');
        receipt={...receipt,status:'success',completedAt:now()};
        storage.setItem(RECEIPT_KEY,JSON.stringify(receipt));
        const completedReceipt=JSON.parse(storage.getItem(RECEIPT_KEY)||'null');
        if(!completedReceipt||completedReceipt.status!=='success'||completedReceipt.sourceChecksum!==sourceChecksum||completedReceipt.resultChecksum!==resultChecksum||completedReceipt.mappingVersion!==MAPPING_VERSION)throw new Error('migration-receipt-verification-failed');
        return{ready:true,migrated:true,blocker:null,sourceChecksum,resultChecksum,receiptKey:RECEIPT_KEY,backupKey:BACKUP_KEY};
      }catch(error){
        let rollbackVerified=false,rollbackStateRaw=null;
        try{
          if(storage.getItem(LEGACY_KEY)===null)storage.setItem(LEGACY_KEY,legacyRaw);
          const current=storage.getItem(STATE_KEY);
          if(priorV3Raw===null){if(current!==null)storage.removeItem(STATE_KEY);}
          else if(current!==priorV3Raw)storage.setItem(STATE_KEY,priorV3Raw);
          rollbackStateRaw=storage.getItem(STATE_KEY);
          rollbackVerified=storage.getItem(LEGACY_KEY)===legacyRaw&&rollbackStateRaw===priorV3Raw;
        }catch(_){}
        try{
          const persistedReceipt=JSON.parse(storage.getItem(RECEIPT_KEY)||'null');
          const sourceReceipt=persistedReceipt&&persistedReceipt.sourceChecksum===sourceChecksum?persistedReceipt:receipt;
          if(sourceReceipt&&sourceReceipt.sourceChecksum===sourceChecksum){
            const rollbackReceipt={...sourceReceipt,status:rollbackVerified?'rolled_back':'failed',failureReason:String(error&&error.message||'migration-failed'),rollbackVerified,rolledBackAt:now(),rolledBackStateChecksum:rollbackStateRaw===null?null:sha256(rollbackStateRaw)};
            storage.setItem(RECEIPT_KEY,JSON.stringify(rollbackReceipt));
          }
        }catch(_){}
        return{ready:false,blocker:String(error&&error.message||'migration-failed'),backupKey:BACKUP_KEY};
      }
    };
    const rollback = ({storage}={}) => {
      try{
        const backup=JSON.parse(storage.getItem(BACKUP_KEY)||'null');
        if(!backup||backup.sourceRaw==null||sha256(backup.sourceRaw)!==backup.sourceChecksum)return{ok:false,reason:'migration-backup-invalid'};
        const priorV3Verified=backup.priorV3Raw===null
          ? backup.priorV3Checksum===null
          : typeof backup.priorV3Raw==='string'&&typeof backup.priorV3Checksum==='string'&&sha256(backup.priorV3Raw)===backup.priorV3Checksum;
        if(!priorV3Verified){
          const reason='migration-backup-prior-v3-checksum-mismatch';
          try{
            const receipt=JSON.parse(storage.getItem(RECEIPT_KEY)||'null');
            if(receipt&&receipt.sourceChecksum===backup.sourceChecksum)storage.setItem(RECEIPT_KEY,JSON.stringify({...receipt,status:'failed',failureReason:reason,rollbackVerified:false}));
          }catch(_){}
          return{ok:false,reason};
        }
        storage.setItem(LEGACY_KEY,backup.sourceRaw);
        if(backup.priorV3Raw===null)storage.removeItem(STATE_KEY);else storage.setItem(STATE_KEY,backup.priorV3Raw);
        return{ok:storage.getItem(LEGACY_KEY)===backup.sourceRaw&&storage.getItem(STATE_KEY)===backup.priorV3Raw,reason:null};
      }catch(_){return{ok:false,reason:'migration-rollback-failed'}}
    };
    return Object.freeze({migrate,rollback,sha256,canonicalJson,keys:Object.freeze({legacy:LEGACY_KEY,state:STATE_KEY,backup:BACKUP_KEY,receipt:RECEIPT_KEY}),mappingVersion:MAPPING_VERSION});
  };
  if(typeof window!=='undefined'&&window)window.CINDYCoachStateMigrationV3=Object.freeze({version:'cindy-coach-state-migration-v3.0',create});
})();
