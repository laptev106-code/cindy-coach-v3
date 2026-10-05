/* CINDY PROGRAM PACK V3.0.0 — explicit application runtime, fixed no-reload rotation */
(()=>{
  'use strict';

  const META_KEY='cindyV3ProgramMeta';
  const PROGRAM_ID='cindy-v3-four-day-rotation';
  const CLASSIC_ID='cindy-classic';
  const VERSION='cindy-program-v3.0.0-four-day-canonical-r1';

  // Один канонический четырёхдневный цикл. Program Pack только собирает
  // существующие встроенные тренировки в программу и не создаёт дубликаты.
  const CYCLES=[
    [
      ['cindy-classic-10'],
      ['cindy-variant'],
      ['cindy-mixed-15']
    ]
  ];

  let boundRuntime=null;
  let metaRepository=null;
  const readJson=(key,fallback)=>{
    if(key===META_KEY&&metaRepository&&typeof metaRepository.read==='function'){const value=metaRepository.read();return value===null?fallback:value}
    return fallback;
  };
  const writeRaw=(key,value)=>key===META_KEY&&metaRepository&&typeof metaRepository.save==='function' ? Boolean(metaRepository.save(value)) : false;

  const daysForCycle=cycleIndex=>{
    const cycle=CYCLES[cycleIndex % CYCLES.length];
    return [
      {kind:'template',templateId:CLASSIC_ID},
      {kind:'template',templateId:cycle[0][0]},
      {kind:'template',templateId:cycle[1][0]},
      {kind:'template',templateId:cycle[2][0]}
    ];
  };

  function readMeta(){
    const meta=readJson(META_KEY,{cycleIndex:0,lastDayIndex:0,lastRotatedRecordId:null,version:VERSION});
    return {
      cycleIndex:Math.max(0,Number(meta&&meta.cycleIndex)||0)%CYCLES.length,
      lastDayIndex:Math.max(0,Number(meta&&meta.lastDayIndex)||0),
      lastRotatedRecordId:meta&&typeof meta.lastRotatedRecordId==='string'?meta.lastRotatedRecordId:null,
      version:VERSION
    };
  }

  function writeMeta(meta){writeRaw(META_KEY,{...meta,version:VERSION});}

  function buildPatch(cfg,cycleIndex,activateIfEmpty=true){
    const next={
      ...cfg,
      templates:Array.isArray(cfg.templates)?cfg.templates.slice():[],
      programs:Array.isArray(cfg.programs)?cfg.programs.slice():[],
      programState:cfg.programState&&typeof cfg.programState==='object'?{...cfg.programState}:undefined
    };
    const activeIndex=next.programs.findIndex(x=>x&&x.id===PROGRAM_ID);
    const days=daysForCycle(cycleIndex);
    if(activeIndex<0){
      next.programs.push({id:PROGRAM_ID,name:'Cindy — 4-дневная программа',days,createdAt:null,updatedAt:null});
    }else{
      const existing=next.programs[activeIndex];
      const sig=a=>JSON.stringify((Array.isArray(a)?a:[]).map(x=>x&&x.templateId));
      if(sig(existing.days)!==sig(days)) next.programs[activeIndex]={...existing,days};
    }

    const state=next.programState&&typeof next.programState==='object'
      ? next.programState
      : {activeProgramId:'',currentDayIndex:0,completedAt:null};
    if(activateIfEmpty && !state.activeProgramId){
      state.activeProgramId=PROGRAM_ID;
      state.currentDayIndex=0;
      state.completedAt=null;
    }
    next.programState=state;
    return next;
  }

  function samePlan(a,b){
    if(!a||!b)return false;
    const sig=x=>JSON.stringify({
      program:(x.programs||[]).find(p=>p&&p.id===PROGRAM_ID)?.days?.map(d=>d&&d.templateId)||[],
      state:x.programState||null
    });
    return sig(a)===sig(b);
  }

  function runtime(){return boundRuntime;}

  function canMutateRuntime(){
    const rt=runtime();
    if(!rt)return false;
    try{
      const session=rt.getSession&&rt.getSession();
      return !(session&&(session.status==='running'||session.status==='paused'));
    }catch(_){return false}
  }

  function applyConfigPatch(next){
    const rt=runtime();
    if(!rt||typeof rt.setConfig!=='function'||!canMutateRuntime())return false;
    const patch={
      templates:next.templates,
      programs:next.programs,
      programState:next.programState
    };
    try{return Boolean(rt.setConfig(patch))}catch(_){return false}
  }

  function ensurePlan(){
    const current=boundRuntime&&typeof boundRuntime.getConfig==='function' ? boundRuntime.getConfig() : null;
    if(!current)return false;
    const meta=readMeta();
    const prepared=buildPatch(current,meta.cycleIndex,true);
    if(samePlan(current,prepared)){
      // Keep metadata aligned with the current program state without touching app config.
      writeMeta({
        cycleIndex:meta.cycleIndex,
        lastDayIndex:Math.max(0,Number(current.programState&&current.programState.currentDayIndex)||0),
        lastRotatedRecordId:meta.lastRotatedRecordId
      });
      return true;
    }
    const ok=applyConfigPatch(prepared);
    if(ok){
      writeMeta({
        cycleIndex:meta.cycleIndex,
        lastDayIndex:Math.max(0,Number(prepared.programState&&prepared.programState.currentDayIndex)||0),
        lastRotatedRecordId:meta.lastRotatedRecordId
      });
    }
    return ok;
  }

  function rotateAfterCompletedDay4(record){
    return false;
  }

  function prepareCycleRotation({record,config,meta,now}={}){
    if(!record||!record.id||!record.source||record.source.programId!==PROGRAM_ID||Number(record.source.dayIndex)!==3){
      return {ok:false,reason:'invalid-event'};
    }
    const current=config&&typeof config==='object'?config:null;
    if(!current) return {ok:false,reason:'missing-config'};
    const state=current.programState&&typeof current.programState==='object'?current.programState:null;
    if(!state||state.activeProgramId!==PROGRAM_ID) return {ok:false,reason:'inactive-program'};
    const currentDayIndex=Number(state.currentDayIndex);
    if(currentDayIndex!==3) return {ok:false,reason:'day-mismatch'};
    const currentMeta=meta&&typeof meta==='object'?meta:{cycleIndex:0,lastDayIndex:0,lastRotatedRecordId:null};
    if(currentMeta.lastRotatedRecordId===record.id||currentMeta.lastTransitionRecordId===record.id){
      return {ok:false,reason:'duplicate'};
    }
    const nextCycle=(Math.max(0,Number(currentMeta.cycleIndex)||0)+1)%CYCLES.length;
    const prepared=buildPatch(current,nextCycle,false);
    prepared.programState={
      ...state,
      activeProgramId:PROGRAM_ID,
      currentDayIndex:0,
      completedAt:state.completedAt||now||null
    };
    return {
      ok:true,
      config:prepared,
      meta:{
        cycleIndex:nextCycle,
        lastDayIndex:0,
        lastRotatedRecordId:record.id,
        lastTransitionRecordId:record.id,
        processedRecordIds:[...new Set([...(Array.isArray(currentMeta.processedRecordIds)?currentMeta.processedRecordIds:[]),record.id])],
        version:VERSION
      }
    };
  }

  function onWorkoutFinished(record){
    return false;
  }

  function init(options={}){
    if(options.runtime)boundRuntime=options.runtime;
    if(options.metaRepository)metaRepository=options.metaRepository;
    return ensurePlan();
  }

  window.CindyProgramPackV3=Object.freeze({
    version:VERSION,
    programId:PROGRAM_ID,
    cycleCount:CYCLES.length,
    init,
    ensurePlan,
    daysForCycle,
    rotateAfterCompletedDay4,
    prepareCycleRotation,
    onWorkoutFinished
  });
})();
