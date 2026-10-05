(function(global){
  'use strict';
  var ids=Object.freeze({workout:'workout',programs:'programs',trainingSetup:'trainingSetup',profile:'profile',profileContent:'profileContent',profileSettings:'profileSettingsSection',profileSettingsCategories:'profileSettingsCategories',profileSettingsDetails:'profileSettingsDetails',progress:'progress',progressGoal:'progressGoalControls',progressAnalytics:'progressAnalytics',history:'historyContent'});
  function get(){var out={};Object.keys(ids).forEach(function(key){out[key]=document.getElementById(ids[key])||null;});return Object.freeze(out);}
  global.CindyScreenHostsV3=Object.freeze({ids:ids,get:get});
})(window);
