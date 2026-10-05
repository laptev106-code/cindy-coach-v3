const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');

const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function extractScripts(source){
  const scripts=[];
  const re=/<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  while((match=re.exec(source))){
    const attrs=match[1]||'';
    const srcMatch=attrs.match(/\bsrc=["']([^"']+)["']/i);
    if(srcMatch){
      scripts.push({kind:'external',src:srcMatch[1].replace(/^\.\//,'')});
    }else{
      const code=(match[2]||'').trim();
      if(code) scripts.push({kind:'inline',code,start:match.index});
    }
  }
  return scripts;
}

function createElement(){
  const target={
    id:'',
    className:'',
    hidden:false,
    disabled:false,
    checked:false,
    value:'',
    textContent:'',
    innerHTML:'',
    dataset:Object.create(null),
    children:[],
    parentElement:null,
    offsetWidth:320,
    offsetHeight:48
  };
  const proxy=new Proxy(target,{
    get(obj,prop){
      if(prop in obj) return obj[prop];
      if(prop==='style') return obj.style || (obj.style=new Proxy({},{get:(_,k)=>k==='setProperty'||k==='removeProperty'?()=>{}:'',set:()=>true}));
      if(prop==='classList') return obj.classList || (obj.classList={add(){},remove(){},toggle(){return false;},contains(){return false;}});
      if(prop==='addEventListener'||prop==='removeEventListener'||prop==='focus'||prop==='blur'||prop==='click'||prop==='remove') return ()=>{};
      if(prop==='setAttribute') return (name,value)=>{obj[name]=value; if(name==='data-color-theme') obj.dataset.colorTheme=value;};
      if(prop==='removeAttribute') return ()=>{};
      if(prop==='getAttribute') return ()=>null;
      if(prop==='append') return (...nodes)=>{nodes.flat(Infinity).forEach(node=>{if(node){obj.children.push(node);try{node.parentElement=proxy}catch(_){}}});};
      if(prop==='replaceChildren') return (...nodes)=>{obj.children=[];nodes.flat(Infinity).forEach(node=>{if(node){obj.children.push(node);try{node.parentElement=proxy}catch(_){}}});};
      if(prop==='appendChild') return node=>{if(node){obj.children.push(node);try{node.parentElement=proxy}catch(_){}};return node||proxy;};
      if(prop==='insertAdjacentElement') return (_pos,node)=>{if(node){obj.children.push(node);try{node.parentElement=proxy}catch(_){}};return node||proxy;};
      if(prop==='querySelector') return ()=>createElement();
      if(prop==='querySelectorAll') return ()=>[];
      if(prop==='closest') return ()=>null;
      if(prop==='getBoundingClientRect') return ()=>({left:0,top:0,width:100,height:48,right:100,bottom:48});
      if(typeof prop==='symbol') return undefined;
      const next=createElement();
      obj[prop]=next;
      return next;
    },
    set(obj,prop,value){
      obj[prop]=value;
      return true;
    }
  });
  target.parentElement=proxy;
  return proxy;
}

function createBrowserLikeSandbox(){
  const storage=new Map();
  const localStorage={
    getItem(k){return storage.has(k)?storage.get(k):null;},
    setItem(k,v){storage.set(k,String(v));},
    removeItem(k){storage.delete(k);},
    clear(){storage.clear();},
    key(i){return Array.from(storage.keys())[i]||null;},
    get length(){return storage.size;}
  };
  const listeners=new Map();
  const document={
    documentElement:{classList:{add(){},remove(){},toggle(){},contains(){return false;}},style:{setProperty(){},backgroundColor:''},dataset:Object.create(null)},
    body:{classList:{add(){},remove(){},toggle(){},contains(){return false;}},appendChild(){},style:{},dataset:Object.create(null)},
    visibilityState:'visible',
    getElementById(){return createElement();},
    querySelector(){return createElement();},
    querySelectorAll(){return [];},
    createElement(){return createElement();},
    createTextNode(text){const node=createElement();node.textContent=String(text??'');node.nodeValue=String(text??'');return node;},
    createTreeWalker(root){const nodes=[];const walk=(node)=>{if(!node)return;for(const child of (node.children||[])){if(child&&('nodeValue' in child)&&child.nodeValue!=null)nodes.push(child);walk(child)}};walk(root);let index=0;return{nextNode(){return index<nodes.length?nodes[index++]:null;}};},
    addEventListener(type,fn){listeners.set(type,fn);},
    removeEventListener(){}
  };
  const sandbox={
    console,
    Date,
    Intl,
    JSON,
    Math,
    Number,
    String,
    Boolean,
    Object,
    Array,
    RegExp,
    Error,
    TypeError,
    ReferenceError,
    Set,
    Map,
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
    structuredClone,
    encodeURIComponent,
    decodeURIComponent,
    setTimeout(){return 0;},
    clearTimeout(){},
    setInterval(){return 0;},
    clearInterval(){},
    queueMicrotask(fn){if(typeof fn==='function')fn();},
    requestAnimationFrame(fn){return 0;},
    cancelAnimationFrame(){},
    localStorage,
    sessionStorage:localStorage,
    navigator:{userAgent:'CINDY-HTML-SMOKE',vibrate(){return false;},serviceWorker:undefined},
    location:{protocol:'https:',href:'https://cindy.local/index.html',pathname:'/index.html',reload(){}},
    history:{replaceState(){},pushState(){}},
    CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init&&init.detail;}},
    Event:class Event{constructor(type){this.type=type;}},
    document,
    Node:function Node(){},
    NodeFilter:{SHOW_TEXT:4},
    HTMLElement:function HTMLElement(){},
    AudioContext:undefined,
    webkitAudioContext:undefined,
    MutationObserver:function MutationObserver(){this.observe=()=>{};this.disconnect=()=>{};this.takeRecords=()=>[];},
    matchMedia(){return {matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}};},
    getComputedStyle(){return {getPropertyValue(){return '';}};},
    alert(){},
    confirm(){return false;},
    prompt(){return null;},
    innerWidth:390,
    innerHeight:844
  };
  sandbox.window=sandbox;
  sandbox.self=sandbox;
  sandbox.globalThis=sandbox;
  sandbox.dispatchEvent=()=>true;
  sandbox.addEventListener=(type,fn)=>document.addEventListener(type,fn);
  sandbox.removeEventListener=()=>{};
  return {sandbox,storage};
}

const scripts=extractScripts(html);
assert(scripts.length>0,'no scripts found in index.html');
assert(!html.includes('cindyCoachCoreIntegrationLegacyV1Module'),'stale V1 identifier remains in index.html');

const {sandbox}=createBrowserLikeSandbox();
vm.createContext(sandbox);

const executed=[];
const scriptErrors=[];
for(const script of scripts){
  if(script.kind==='external'){
    const file=path.join(root,script.src);
    assert(fs.existsSync(file),`missing script file ${script.src}`);
    try{
      vm.runInContext(fs.readFileSync(file,'utf8'),sandbox,{filename:script.src});
    }catch(error){
      if(error instanceof ReferenceError) throw error;
      scriptErrors.push({src:script.src,name:error.name,message:String(error.message||error)});
    }
    executed.push(script.src);
  }else{
    try{
      vm.runInContext(script.code,sandbox,{filename:'index.html#inline'});
    }catch(error){
      if(error instanceof ReferenceError) throw error;
      scriptErrors.push({src:'inline',name:error.name,message:String(error.message||error).slice(0,240)});
    }
    executed.push('inline');
  }
}

assert.strictEqual(scriptErrors.length,0,`script errors during HTML execution: ${JSON.stringify(scriptErrors)}`);
assert(sandbox.CINDYAppRuntimeV3,'CINDYAppRuntimeV3 was not created');
assert(sandbox.CindyCoachIntegration,'CindyCoachIntegration missing after HTML execution');
assert(sandbox.CINDYProgramServiceV3,'CINDYProgramServiceV3 missing after HTML execution');
assert(sandbox.CindyProgramPackV3,'CindyProgramPackV3 missing after HTML execution');
assert(sandbox.CINDYBootstrapV3&&sandbox.CINDYBootstrapV3.ready===true,'CINDYBootstrapV3.ready !== true');
assert.strictEqual(sandbox.CindyCoachIntegration.isBound(),true,'Coach integration was not bound by bootstrap');
assert.strictEqual(typeof sandbox.CINDYProgramServiceV3.completeWorkoutTransition,'function','authoritative Program transition missing');
assert.strictEqual(typeof sandbox.CindyProgramPackV3.prepareCycleRotation,'function','Program Pack rotation provider missing');
assert(!html.includes('cindyCoachCoreIntegrationLegacyV1Module'),'stale V1 identifier remains after execution');

console.log('FINAL_HTML_RUNTIME_SMOKE_PASS');
console.log(JSON.stringify({
  scripts:executed.length,
  runtime:Boolean(sandbox.CINDYAppRuntimeV3),
  bootstrapReady:Boolean(sandbox.CINDYBootstrapV3&&sandbox.CINDYBootstrapV3.ready),
  coachBound:sandbox.CindyCoachIntegration.isBound(),
  verification:'browser-like VM harness, not real Chromium/WebView'
},null,2));
