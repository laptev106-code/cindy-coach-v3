(() => {
  'use strict';
  const create=({storage=window.localStorage,now=()=>Date.now(),notify=()=>{},onDiagnostic=()=>{},onFailureUntil=()=>{}}={})=>{
    const storageFailureKind=(error,stage)=>{
      if(stage==='serialize')return'serialization';
      const name=String(error&&error.name||''),code=Number(error&&error.code);
      if(name==='QuotaExceededError'||code===22||code===1014)return'quota';
      if(name==='SecurityError')return'security';
      if(name==='InvalidStateError')return'unavailable';
      return'unknown';
    };
    const recordStorageDiagnostic=(key,error,stage)=>{
      const diagnostic={ok:false,key:String(key),stage,kind:storageFailureKind(error,stage),name:String(error&&error.name||'Error'),code:Number.isFinite(Number(error&&error.code))?Number(error.code):null,at:now()};
      onFailureUntil(diagnostic.at+2200);
      onDiagnostic(diagnostic);
      return diagnostic;
    };
    const read=(key,fallback)=>{try{const x=storage.getItem(key);if(!x)return fallback;const y=JSON.parse(x);return y&&typeof y==='object'?y:fallback}catch(_){return fallback}};
    const write=(key,value)=>{
      let serialized;
      try{serialized=JSON.stringify(value)}
      catch(error){recordStorageDiagnostic(key,error,'serialize');notify('Данные не удалось сохранить на этом устройстве.');return false}
      try{
        storage.setItem(key,serialized);
        onDiagnostic({ok:true,key:String(key),stage:'write',at:now()});
        return true;
      }catch(error){
        recordStorageDiagnostic(key,error,'write');
        notify('Данные не удалось сохранить на этом устройстве.');
        return false;
      }
    };
    const remove=key=>{try{storage.removeItem(key);return true}catch(_){return false}};
    return Object.freeze({read,write,remove,storageFailureKind,recordStorageDiagnostic});
  };
  window.CINDYLocalStorageV3=Object.freeze({create});
})();
