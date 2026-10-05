/* CINDY V3 Program Application Service — single authoritative ProgramState transition owner. */
(()=>{
  'use strict';
  const VERSION='cindy-program-service-v3.1';
  let boundRuntime=null;
  let boundPack=null;
  let boundMetaRepository=null;
  let persistHook=null;
  let lastAcceptedRecordId=null;

  function clone(value){
    if(value==null)return value;
    try{return JSON.parse(JSON.stringify(value));}catch(_){return value;}
  }

  function bindRuntime(runtime){
    if(!runtime||typeof runtime.getConfig!=='function'||typeof runtime.setConfig!=='function'||typeof runtime.now!=='function'){
      throw new Error('ProgramService requires explicit runtime ports');
    }
    boundRuntime=runtime;
    return true;
  }

  function bindTransitionPorts({programPack=null,metaRepository=null,persist=null}={}){
    if(programPack) boundPack=programPack;
    if(metaRepository) boundMetaRepository=metaRepository;
    if(typeof persist==='function') persistHook=persist;
    return true;
  }

  function normalizeSource(source){
    if(!source||typeof source!=='object')return null;
    const programId=typeof source.programId==='string'?source.programId:'';
    const dayIndex=Number(source.dayIndex);
    if(!programId||!Number.isInteger(dayIndex))return null;
    return {programId,dayIndex};
  }

  function readMeta(){
    if(!boundMetaRepository||typeof boundMetaRepository.read!=='function')return null;
    try{
      const raw=boundMetaRepository.read();
      return raw&&typeof raw==='object'?raw:null;
    }catch(_){
      return null;
    }
  }

  function processedIds(meta){
    const ids=meta&&Array.isArray(meta.processedRecordIds)?meta.processedRecordIds:[];
    return [...new Set(ids.filter(id=>typeof id==='string'&&id))];
  }

  function withProcessedId(meta,recordId){
    const ids=processedIds(meta);
    if(recordId&& !ids.includes(recordId)) ids.push(recordId);
    return ids;
  }

  function defaultResult(extra){
    return Object.assign({
      ok:false,
      accepted:false,
      dayAdvanced:false,
      rotated:false,
      duplicate:false,
      reason:'rejected',
      fromDayIndex:null,
      toDayIndex:null,
      cycleIndex:null
    },extra||{});
  }

  function persist(configPatch,nextMeta){
    if(typeof persistHook==='function'){
      return Boolean(persistHook({configPatch,nextMeta,runtime:boundRuntime,metaRepository:boundMetaRepository}));
    }
    const runtime=boundRuntime;
    const beforeConfig=clone(runtime.getConfig());
    const beforeMeta=clone(readMeta());
    if(!runtime.setConfig(configPatch)) return false;
    if(nextMeta&&boundMetaRepository&&typeof boundMetaRepository.save==='function'){
      let saved=false;
      try{saved=Boolean(boundMetaRepository.save(nextMeta));}catch(_){saved=false;}
      if(!saved){
        runtime.setConfig({
          templates:beforeConfig.templates,
          programs:beforeConfig.programs,
          programState:beforeConfig.programState,
          pendingSource:beforeConfig.pendingSource
        });
        if(beforeMeta&&typeof boundMetaRepository.save==='function'){
          try{boundMetaRepository.save(beforeMeta);}catch(_){ }
        }
        return false;
      }
    }
    return true;
  }

  function alreadyAccepted(recordId){
    if(!recordId)return false;
    if(lastAcceptedRecordId===recordId)return true;
    const meta=readMeta();
    return Boolean(meta&&(meta.lastTransitionRecordId===recordId||meta.lastRotatedRecordId===recordId||processedIds(meta).includes(recordId)));
  }

  function completeWorkoutTransition(result){
    const runtime=boundRuntime;
    if(!runtime) return defaultResult({reason:'missing-runtime'});
    const source=normalizeSource(result&&result.source);
    if(!source||!result||typeof result.id!=='string'||!result.id) return defaultResult({reason:'invalid-event'});
    if(alreadyAccepted(result.id)){
      return defaultResult({ok:true,duplicate:true,reason:'duplicate'});
    }

    const cfg=runtime.getConfig&&runtime.getConfig();
    if(!cfg) return defaultResult({reason:'missing-config'});
    const programs=Array.isArray(cfg.programs)?cfg.programs:[];
    const program=programs.find(item=>item&&item.id===source.programId);
    const state=cfg.programState&&typeof cfg.programState==='object'?cfg.programState:null;
    if(!program||!state||state.activeProgramId!==program.id) return defaultResult({reason:'inactive-program'});
    if(!Array.isArray(program.days)||program.days.length<1) return defaultResult({reason:'malformed-program'});

    const currentDayIndex=Number(state.currentDayIndex);
    if(!Number.isInteger(currentDayIndex)||currentDayIndex<0||currentDayIndex>=program.days.length){
      return defaultResult({reason:'malformed-day-index'});
    }
    if(source.dayIndex!==currentDayIndex) return defaultResult({reason:'day-mismatch',fromDayIndex:currentDayIndex});

    const now=runtime.now();
    const fromDayIndex=currentDayIndex;
    const currentMeta=readMeta()||{};
    const packId=boundPack&&typeof boundPack.programId==='string'?boundPack.programId:null;
    const shouldRotate=Boolean(packId&&source.programId===packId&&currentDayIndex===3&&typeof boundPack.prepareCycleRotation==='function');

    let configPatch=null;
    let nextMeta=null;
    let rotated=false;
    let toDayIndex=currentDayIndex;
    let cycleIndex=Number.isFinite(Number(currentMeta.cycleIndex))?Number(currentMeta.cycleIndex):0;

    if(shouldRotate){
      const prepared=boundPack.prepareCycleRotation({record:result,config:cfg,meta:currentMeta,now});
      if(!prepared||!prepared.ok||!prepared.config||!prepared.meta){
        return defaultResult({reason:(prepared&&prepared.reason)||'rotation-unavailable',fromDayIndex});
      }
      configPatch={
        templates:prepared.config.templates,
        programs:prepared.config.programs,
        programState:prepared.config.programState,
        pendingSource:null
      };
      nextMeta=prepared.meta;
      rotated=true;
      toDayIndex=0;
      cycleIndex=prepared.meta.cycleIndex;
    }else{
      toDayIndex=(currentDayIndex+1)%program.days.length;
      configPatch={
        programState:{...state,activeProgramId:program.id,currentDayIndex:toDayIndex,completedAt:now},
        pendingSource:null
      };
      nextMeta={
        cycleIndex,
        lastDayIndex:toDayIndex,
        lastRotatedRecordId:currentMeta.lastRotatedRecordId||null,
        lastTransitionRecordId:result.id,
        processedRecordIds:withProcessedId(currentMeta,result.id),
        version:currentMeta.version||null
      };
    }

    if(!persist(configPatch,nextMeta)){
      return defaultResult({reason:'persist-failed',fromDayIndex,toDayIndex,cycleIndex});
    }
    lastAcceptedRecordId=result.id;
    return {
      ok:true,
      accepted:true,
      dayAdvanced:true,
      rotated,
      duplicate:false,
      reason:rotated?'rotated':'advanced',
      fromDayIndex,
      toDayIndex,
      cycleIndex
    };
  }

  function advanceAfterWorkout(result){
    return Boolean(completeWorkoutTransition(result).accepted);
  }

  window.CINDYProgramServiceV3=Object.freeze({
    version:VERSION,
    bindRuntime,
    bindTransitionPorts,
    completeWorkoutTransition,
    advanceAfterWorkout
  });
})();
