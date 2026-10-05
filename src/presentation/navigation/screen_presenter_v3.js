(function(global){
  'use strict';
  var bound=null;
  function ensure(){
    if(!bound) throw new Error('CindyScreenPresenterV3 is not bound to renderers');
    return bound;
  }
  function bind(renderers){
    if(!renderers || typeof renderers!=='object') throw new TypeError('renderers object required');
    var keys=['workout','programs','progress','profile'];
    var next={};
    keys.forEach(function(key){
      if(typeof renderers[key]!=='function') throw new TypeError('renderer missing: '+key);
      next[key]=renderers[key];
    });
    bound=Object.freeze(next);
    return global.CindyScreenPresenterV3;
  }
  function present(id, options){
    var router=global.CindyScreenRouterV3;
    var route=router?router.normalize(id):String(id||'workout');
    var activeRoutes=router?router.routes:['workout','programs','progress','profile'];
    if(activeRoutes.indexOf(route)<0)route='workout';
    if(router)router.activate(route);
    var renderer=ensure()[route];
    renderer(options||{});
    return route;
  }
  global.CindyScreenPresenterV3=Object.freeze({bind:bind,present:present});
})(window);
