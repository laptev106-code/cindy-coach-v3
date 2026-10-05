(function(global){
  'use strict';
  var aliases=Object.freeze({history:'progress',settings:'profile'}),routes=Object.freeze(['workout','programs','progress','profile']);
  function normalize(id){var key=String(id||'workout');return aliases[key]||key;}
  function activate(id){var route=normalize(id);if(routes.indexOf(route)<0)route='workout';document.querySelectorAll('.screen').forEach(function(node){node.classList.toggle('active',node.id===route);});document.querySelectorAll('.nav button').forEach(function(button){var on=button.id==='nav'+route.charAt(0).toUpperCase()+route.slice(1);button.classList.toggle('active',on);if(on)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});document.documentElement.dataset.cindyRoute=route;return route;}
  function current(){return normalize(document.documentElement.dataset.cindyRoute||'workout');}
  global.CindyScreenRouterV3=Object.freeze({aliases:aliases,routes:routes,normalize:normalize,activate:activate,current:current});
})(window);
