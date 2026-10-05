/* CINDY V3 program metadata repository — explicit storage port. */
(()=>{
  'use strict';
  const KEY='cindyV3ProgramMeta';
  function create(storage){
    const area=storage|| (typeof window!=='undefined' ? window.localStorage : null);
    const read=()=>{try{const raw=area&&area.getItem?area.getItem(KEY):null;return raw?JSON.parse(raw):null}catch(_){return null}};
    const save=value=>{try{if(!area||!area.setItem)return false;area.setItem(KEY,JSON.stringify(value));return true}catch(_){return false}};
    const remove=()=>{try{if(!area||!area.removeItem)return false;area.removeItem(KEY);return true}catch(_){return false}};
    return Object.freeze({key:KEY,read,save,remove});
  }
  window.CINDYProgramMetaRepositoryV3=Object.freeze({version:'cindy-program-meta-repository-v3.0',create});
})();
