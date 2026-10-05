(() => {
  'use strict';

  const createAggregateRepository = ({storagePort,key,deserialize=value=>value,serialize=value=>value,fallback=null}) => {
    if (!storagePort || typeof storagePort.read !== 'function' || typeof storagePort.write !== 'function' || typeof storagePort.remove !== 'function') {
      throw new TypeError(`Invalid storage port for ${key}`);
    }
    const load = () => {
      const raw = storagePort.read(key, fallback);
      return deserialize(raw);
    };
    const save = value => storagePort.write(key, serialize(value));
    const remove = () => storagePort.remove(key);
    const capture = () => storagePort.read(key, null);
    const restore = raw => {
      if (raw === null || typeof raw === 'undefined') return storagePort.remove(key);
      return storagePort.write(key, raw);
    };
    return Object.freeze({key,load,save,remove,capture,restore});
  };

  const createRepositories = ({storagePort,codecs={}}={}) => {
    const cfg=codecs.config||{};
    const ses=codecs.session||{};
    const hist=codecs.history||{};
    const cloud=codecs.cloud||{};
    const config=createAggregateRepository({storagePort,key:'cindyCfg',fallback:cfg.fallback??null,deserialize:cfg.deserialize||((x)=>x),serialize:cfg.serialize||((x)=>x)});
    const session=createAggregateRepository({storagePort,key:'cindyActiveSession',fallback:ses.fallback??null,deserialize:ses.deserialize||((x)=>x),serialize:ses.serialize||((x)=>x)});
    const history=createAggregateRepository({storagePort,key:'cindyHistory',fallback:hist.fallback??[],deserialize:hist.deserialize||((x)=>x),serialize:hist.serialize||((x)=>x)});
    const cloudRepository=createAggregateRepository({storagePort,key:'cindyCloudSync',fallback:cloud.fallback??null,deserialize:cloud.deserialize||((x)=>x),serialize:cloud.serialize||((x)=>x)});

    const captureKeys=keys=>keys.map(key=>({key,raw:{config,session,history,cloud:cloudRepository}[key]?.capture()})).filter(item=>item.raw!==undefined);
    const restoreCaptured=entries=>entries.every(({key,raw})=>({config,session,history,cloud:cloudRepository}[key])?.restore(raw));
    const transaction=({writes=[]}={})=>{
      const repos={config,session,history,cloud:cloudRepository};
      const keys=[...new Set(writes.map(item=>item.key))];
      const backup=captureKeys(keys);
      for(const item of writes){
        const repo=repos[item.key];
        if(!repo||(item.remove? !repo.remove() : !repo.save(item.value))){
          restoreCaptured(backup);
          return false;
        }
      }
      return true;
    };

    return Object.freeze({config,session,history,cloud:cloudRepository,captureKeys,restoreCaptured,transaction});
  };

  window.CINDYRepositoriesV3=Object.freeze({create:createRepositories,createRepositories,createAggregateRepository});
})();
