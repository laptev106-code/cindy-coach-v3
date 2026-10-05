/* CINDY V3 composition root — explicit runtime/module binding, no lifecycle monkey-patching. */
(()=>{
  'use strict';
  const runtime=window.CINDYAppRuntimeV3;
  const coach=window.CindyCoachIntegration;
  const program=window.CindyProgramPackV3;
  const programService=window.CINDYProgramServiceV3;
  const metaRepositoryApi=window.CINDYProgramMetaRepositoryV3;
  if(!runtime) throw new Error('CINDY V3 composition runtime missing');
  if(!coach||typeof coach.bindRuntime!=='function') throw new Error('CINDY V3 Coach integration missing');
  if(!programService||typeof programService.bindRuntime!=='function') throw new Error('CINDY V3 Program service missing');
  if(!metaRepositoryApi||typeof metaRepositoryApi.create!=='function') throw new Error('CINDY V3 Program metadata repository missing');
  coach.bindRuntime(runtime);
  programService.bindRuntime(runtime);
  const programMetaRepository=metaRepositoryApi.create();
  if(program&&typeof program.init==='function') program.init({runtime,metaRepository:programMetaRepository});
  if(typeof programService.bindTransitionPorts==='function'){
    programService.bindTransitionPorts({programPack:program||null,metaRepository:programMetaRepository});
  }
  if(typeof runtime.renderAll==='function') runtime.renderAll({markers:true});
  window.CINDYBootstrapV3=Object.freeze({
    version:'cindy-bootstrap-v3.0',
    ready:true,
    authority:coach.authority,
    coachIntegration:coach.integrationVersion,
    programVersion:program&&program.version||null,
    programService:programService.version
  });
  try{
    window.dispatchEvent(new CustomEvent('cindy:v3-ready',{detail:window.CINDYBootstrapV3}));
  }catch(_){}
})();
