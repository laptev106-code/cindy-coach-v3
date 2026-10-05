const fs=require('fs');
const path=require('path');
const vm=require('vm');
const assert=require('assert');
const root=path.resolve(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const presenter=fs.readFileSync(path.join(root,'src/presentation/navigation/screen_presenter_v3.js'),'utf8');
const router=fs.readFileSync(path.join(root,'src/presentation/navigation/screen_router_v3.js'),'utf8');
const hosts=fs.readFileSync(path.join(root,'src/presentation/screens/screen_hosts_v3.js'),'utf8');
const leaves=fs.readFileSync(path.join(root,'src/presentation/components/leaf_components_v3.js'),'utf8');
const coachService=fs.readFileSync(path.join(root,'src/application/coach/coach_application_service_v3.js'),'utf8');
const checks=[];
function pass(name,fn){try{fn();console.log('PASS',name);checks.push(true)}catch(e){console.error('FAIL',name,'-',e.message);checks.push(false)}}

pass('presentation modules syntax',()=>{
  for(const file of [
    'src/presentation/navigation/screen_presenter_v3.js',
    'src/presentation/navigation/screen_router_v3.js',
    'src/presentation/screens/screen_hosts_v3.js',
    'src/presentation/components/leaf_components_v3.js'
  ]) require('child_process').execFileSync(process.execPath,['--check',path.join(root,file)]);
});

pass('stable screen roots exist in HTML',()=>{
  for(const id of ['workout','programs','progress','profile','profileContent','profileSettingsSection','profileSettingsDetails','progressAnalytics','progressHistorySection','trainingSetup']){
    assert(index.includes(`id="${id}"`),`missing ${id}`);
  }
});

pass('legacy settings screen is removed and aliases are explicit',()=>{
  assert(!/<section[^>]+id="settings"/.test(index),'standalone settings screen still exists');
  assert(router.includes("history:'progress'"));
  assert(router.includes("settings:'profile'"));
  assert(index.includes('CindyScreenRouterV3'));
});

pass('training controls have stable Plan ownership',()=>{
  const setup=index.indexOf('<div class="training-setup" id="trainingSetup">');
  const zone=index.indexOf('<section id="trainingFormatZone"',setup);
  assert(setup>=0&&zone>setup);
  const zoneEnd=index.indexOf('</section>',zone);
  for(const id of ['trainingFormatSetting','timeSetting','roundSetting']){
    const pos=index.indexOf(`id="${id}"`,zone);
    assert(pos>zone&&pos<zoneEnd,`${id} escaped trainingFormatZone`);
  }
  assert(index.includes('id="trainingTimeReveal"'));
  assert(index.includes('id="trainingRoundReveal"'));
});

pass('profile settings are statically owned by Profile screen',()=>{
  const profile=index.indexOf('<section class="screen" id="profile"');
  const progress=index.indexOf('<section class="screen" id="progress"');
  const settings=index.indexOf('id="profileSettingsSection"',profile);
  assert(settings>profile&&settings<progress);
  for(const id of ['profileSettingsDetail-appearance','profileSettingsDetail-soundVoice','profileSettingsDetail-data','profileSettingsDetail-help','profileSettingsDetail-about']){
    const pos=index.indexOf(`id="${id}"`,settings); assert(pos>settings&&pos<progress,`${id} not in Profile host`);
  }
});

pass('one global Coach switch and Classic/Pro mode live in Profile Settings',()=>{
  const settings=index.indexOf('id="profileSettingsSection"');
  const interfaceStart=index.indexOf('id="profileSettingsDetail-interface"');
  const interfaceEnd=index.indexOf('</section>',interfaceStart);
  assert(settings>=0&&interfaceStart>settings&&interfaceEnd>interfaceStart);
  for(const token of ['id="experienceSimple"','id="experiencePro"','id="coachPreferenceCard"','id="coachEnabledSwitch"','id="coachPreferenceStatus"','id="developmentViewCard"','id="developmentViewSwitch"']){
    const pos=index.indexOf(token,interfaceStart);assert(pos>interfaceStart&&pos<interfaceEnd,`${token} must be in Profile→Settings→Interface`);
  }
  assert.strictEqual((index.match(/id="coachEnabledSwitch"/g)||[]).length,1,'there must be one persistent Coach switch');
  assert.strictEqual((index.match(/id="experienceSimple"/g)||[]).length,1,'there must be one persisted Classic/Pro mode selector');
  assert.strictEqual((index.match(/id="developmentViewSwitch"/g)||[]).length,1,'Development mode must have one persistent Settings control');
  assert(index.includes("$('experienceSimple')?.addEventListener('click',()=>stage5SetExperience('simple'))")&&index.includes("$('experiencePro')?.addEventListener('click',()=>stage5SetExperience('pro'))"),'Classic and Pro buttons must invoke the persisted mode setter');
  assert(index.includes("simple.setAttribute('aria-pressed',String(experience==='simple'))")&&index.includes("pro.setAttribute('aria-pressed',String(experience==='pro'))"),'mode buttons must expose their active state accessibly');
  assert(!index.includes('function cindyCoachToggleCard()'),'superseded Profile Coach toggle factory must be removed');
  assert(index.includes("developmentSwitch.addEventListener('change',()=>{const before=config;if(!saveProfilePatch({developmentView:developmentSwitch.checked})"),'Development mode must persist through Profile state');
  assert(index.includes("if(config.profile&&config.profile.developmentView){const analytics=profileAnalytics()"),'enabled Development mode must retain its Profile display');
  assert(index.includes('id="soundEnabled"'),'other persistent sound preference remains in Profile Settings');
  assert(index.includes('stage2SetSettingsCategory(\'interface\');stage2Focus(\'profileSettingsSection\')'),'shortcut focuses the intended settings section');
  assert(index.includes("show('settings',{focusSettings:true})"),'settings shortcut routes through focused settings navigation');
});

pass('Profile groups personal data; exercise exclusions are edited in Plan using the existing restriction contract',()=>{
  const editorStart=index.indexOf('function openProfileEditor()'),editorEnd=index.indexOf('function renderProfile()',editorStart),editor=index.slice(editorStart,editorEnd);
  for(const token of ['personalGroup.className=\'profile-editor-group full\'','ЛИЧНЫЕ ДАННЫЕ','trainingExperience','ДОСТУПНОЕ ОБОРУДОВАНИЕ','ИСКЛЮЧЁННЫЕ ГРУППЫ','{equipment,userRestrictions}'])assert(editor.includes(token),`missing Profile editor contract: ${token}`);
  assert(!editor.includes('exerciseGroup')&&!editor.includes('restriction-exercise-editor'),'Profile editor must not duplicate exercise exclusions');
  assert(!editor.includes('excludedExerciseIds:['),'Profile save must preserve the existing exercise restriction value');
  const composerStart=index.indexOf('function renderCompositionSettings()'),composerEnd=index.indexOf('function commitComposer()',composerStart),composer=index.slice(composerStart,composerEnd);
  assert(composer.includes('exerciseExclusionEditor')&&composer.includes('currentUserExcludedExerciseIds'),'Plan composer exposes exercise exclusions through userRestrictions');
  assert(composer.includes('is-user-excluded')&&composer.includes('button.disabled=locked||blocked||isUserExcluded'),'excluded exercises remain visible and unavailable in the selection list');
  assert(!index.includes('sex:field('),'Profile editor must not add an unsupported sex control');
});

pass('NO_ACTION remains a preserve state and never exposes Apply/open-workout controls',()=>{
  const presentationStart=index.indexOf('function coachPresentation('),presentationEnd=index.indexOf('\n    /* CINDY_STAGE4_COACH_UI_RUNTIME */',presentationStart);
  assert(presentationStart>=0&&presentationEnd>presentationStart,'Coach presentation function is located');
  const presentation=vm.runInNewContext(`(${index.slice(presentationStart,presentationEnd)})`,{});
  const recommendation={decisionMode:'NO_ACTION',state:'UNRESOLVED',action:{type:'increase_count',exerciseId:'pull'},application:{allowed:true},workoutSpec:{decisionMode:'NO_ACTION'},explanation:{why:'test-only contradictory payload'}};
  const model=presentation(recommendation);
  assert.strictEqual(model.title,'Сейчас без изменений');assert.strictEqual(model.action,null);assert(model.summary.includes('Текущий состав'));
  const widgetStart=index.indexOf('function stage5RenderWorkoutCoach(){'),widgetEnd=index.indexOf('\nlet stage2Initialized=false;',widgetStart);
  assert(widgetStart>=0&&widgetEnd>widgetStart,'workout Coach widget is located');
  const node=()=>({className:'',textContent:'',children:[],append(...items){this.children.push(...items)},replaceChildren(...items){this.children=[...items]}}),host=node();
  const render=vm.runInNewContext(`(${index.slice(widgetStart,widgetEnd)})`,{document:{createElement:node},$:()=>host,CINDY_LITE_BUILD:false,deriveProductionCoach:()=>recommendation,coachPresentation:()=>model});
  render();
  const textOf=item=>[item.textContent||'',...(item.children||[]).map(textOf)].join(' '),text=host.children.map(textOf).join(' ');
  assert(text.includes('Сейчас без изменений'));assert(text.includes('Текущий состав'));
  assert(!text.includes('Следующая тренировка готова'));assert(!text.includes('ПРИМЕНИТЬ'));assert(!text.includes('ОТКРЫТЬ ТРЕНИРОВКУ'));
  const planStart=index.indexOf('stage4RenderPrograms=function(){'),planEnd=index.indexOf('\n    };',planStart),plan=index.slice(planStart,planEnd);
  const noActionAt=plan.indexOf("if(decisionMode==='NO_ACTION')"),specAt=plan.indexOf('if(!spec)',noActionAt);
  assert(noActionAt>=0&&specAt>noActionAt,'active Plan renderer handles NO_ACTION before displaying a workout spec');
  const noActionBranch=plan.slice(noActionAt,specAt);
  assert(noActionBranch.includes('Сейчас без изменений'));assert(!noActionBranch.includes('ПРИМЕНИТЬ'));assert(!noActionBranch.includes('Следующая тренировка готова'));
  assert(plan.includes("decisionMode==='ADAPT'&&recommendation&&recommendation.action&&recommendation.application&&recommendation.application.allowed===true"),'Plan Apply requires an allowed ADAPT decision');
});

pass('paceGuidance stays a workout-specific control in Plan, not Profile Settings',()=>{
  const plan=index.indexOf('<section class="screen" id="programs"'),progress=index.indexOf('<section class="screen" id="progress"'),profile=index.indexOf('<section class="screen" id="profile"'),pace=index.indexOf('id="paceGuidance"'),card=index.indexOf('id="paceGuideSetting"');
  assert(plan>=0&&profile>plan&&progress>profile);assert(pace>plan&&pace<profile);assert(card>plan&&card<profile);
  assert(index.includes('<input class="workout-setting" id="paceGuidance" type="checkbox">'));
  assert(!index.includes('<article class="card setting-card hidden" id="paceGuideSetting">'),'the Plan control must not be permanently hidden in its markup');
  assert(index.includes("$('paceGuideSetting').classList.toggle('hidden',!combined)"),'the Plan control must be shown only when its combined mode is supported');
});

pass('trainingExperience stays opaque in Profile but inert for Coach until values are approved',()=>{
  assert(index.includes('COACH_TRAINING_EXPERIENCE_VALUES=Object.freeze([])'),'the current normative specification defines no allowed enum values');
  assert(index.includes("trainingExperience:typeof x.trainingExperience==='string'?x.trainingExperience:''"),'Profile normalization must preserve a stored string exactly');
  assert(index.includes("experience.disabled=true;experience.value='';experience.removeAttribute('placeholder');experience.setAttribute('aria-describedby','trainingExperienceHelp')"),'trainingExperience remains disabled/blank, has no explanatory placeholder, and describes its helper');
  assert(index.includes("experienceHelp.textContent='Варианты выбора пока не заданы в нормативной спецификации.'")&&index.includes("experienceHelp.className='profile-experience-help'"),'the exact approved helper is rendered separately below the field');
  assert(index.includes('.profile-experience-help{grid-column:1/-1;')&&index.includes('overflow-wrap:anywhere}'),'the helper spans the form grid and wraps instead of clipping');
  assert(index.includes('@media(max-width:430px){#actionModal:has(#trainingExperienceHelp) .action-sheet{display:flex;flex-direction:column;overflow:hidden}')&&index.includes('#actionModal:has(#trainingExperienceHelp) .sheet-body{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}')&&index.includes('#actionModal:has(#trainingExperienceHelp) .result-actions{flex:0 0 auto}'),'small-screen Profile content scrolls independently above its persistent sticky actions without changing other dialogs');
  assert(!index.includes('trainingExperience:normalizeCoachTrainingExperience(experience.value)'),'saving the disabled/blank control must not overwrite opaque Profile data');
  assert(coachService.includes('trainingExperience: normalizeTrainingExperience(profile.trainingExperience)'),'Coach application still receives only the specification-approved normalized value');
  assert(coachService.includes('return TRAINING_EXPERIENCE_VALUES.includes(candidate) ? candidate : \'\';'),'unsupported Profile strings remain semantically inert for Coach');
});

pass('Coach Help briefly explains readiness and evidence',()=>{
  assert(index.includes("stage4ExplainRow('ГОТОВНОСТЬ','После теста для дальнейших изменений нужны 3 завершённые сопоставимые тренировки в 3 разных тренировочных днях."));
  assert(index.includes("stage4ExplainRow('ФАКТЫ','Тренер сравнивает фактические результаты и темп по кругам;"));
});

pass('no runtime MutationObserver remains',()=>{
  assert(!/new\s+MutationObserver\s*\(/.test(index),'runtime MutationObserver still instantiated');
  assert(!/MutationObserver/.test(index),'runtime MutationObserver reference remains');
});

pass('legacy reparent helpers are inert and not called',()=>{
  assert.strictEqual((index.match(/stage5Move\(/g)||[]).length,1);
  assert.strictEqual((index.match(/stage2Move\(/g)||[]).length,1);
  assert(!/stage5Move\([^)]*\)/.test(index.slice(index.indexOf('/* CINDY_STAGE5_IA_RUNTIME */')+1).replace('function stage5Move(){','')),'stage5Move call detected');
  assert(!/stage2Move\([^)]*\)/.test(index.slice(index.indexOf('let stage2Initialized=false')) .replace('function stage2Move(){','')),'stage2Move call detected');
});

pass('show delegates route dispatch to Screen Presenter',()=>{
  assert(index.includes('window.CindyScreenPresenterV3.present(id,options)'));
  assert(index.includes('window.CindyScreenPresenterV3.bind({workout:'));
  assert(index.includes('window.CindyScreenPresenterV3.present(window.CindyScreenRouterV3?window.CindyScreenRouterV3.current()'));
});

pass('Screen Presenter has no browser-state dependency',()=>{
  const impl=presenter.split('global.CindyScreenPresenterV3')[0];
  assert(!/localStorage|window\.location|document\.getElementById|config|session|records\(\)/.test(impl));
  assert(presenter.includes('bind:bind'));
  assert(presenter.includes('present:present'));
});

pass('leaf components are standalone DOM factories',()=>{
  const impl=leaves.split('global.CindyPresentationLeafV3')[0];
  assert(!/localStorage|config|session|records\(\)/.test(impl));
  for(const name of ['exerciseTotalNode','lapRow','metricCard','insightCard'])assert(leaves.includes(name));
  assert(index.includes('window.CindyPresentationLeafV3.metricCard'));
  assert(index.includes('window.CindyPresentationLeafV3.insightCard'));
});

pass('progress analytics is rendered into its own host',()=>{
  assert(index.includes('function renderProgressAnalyticsV3()'));
  assert(index.includes("renderProgressAnalyticsV3();"));
  const override=index.slice(index.indexOf('renderProfile=function(){'), index.indexOf('const stage2BaseSyncVisibility'));
  assert(override.includes("renderProgressAnalyticsV3();"));
  assert(!/progressHost\.append/.test(override));
});

pass('format-zone synchronization is explicit, not DOM reparenting',()=>{
  assert(index.includes('window.__cindySyncTrainingFormatZone'));
  assert(index.includes('window.__cindySyncTrainingFormatZone?.();'));
});

pass('route aliases work in presenter integration harness',()=>{
  const sandbox={window:{},document:{querySelectorAll:()=>[],documentElement:{dataset:{}},getElementById:()=>null},console,Error,TypeError,String,Array,Object};
  vm.createContext(sandbox);
  vm.runInContext(router,sandbox);
  vm.runInContext(presenter,sandbox);
  const calls=[];
  sandbox.window.CindyScreenRouterV3.activate=id=>{calls.push('activate:'+id);return sandbox.window.CindyScreenRouterV3.normalize(id)};
  sandbox.window.CindyScreenRouterV3.normalize=id=>({history:'progress',settings:'profile'}[id]||id);
  sandbox.window.CindyScreenRouterV3.routes=['workout','programs','progress','profile'];
  sandbox.window.CindyScreenPresenterV3.bind({workout:()=>calls.push('workout'),programs:()=>calls.push('programs'),progress:()=>calls.push('progress'),profile:()=>calls.push('profile')});
  const route=sandbox.window.CindyScreenPresenterV3.present('history',{});
  assert.strictEqual(route,'progress');assert(calls.includes('progress'));
});

const result={total:checks.length,pass:checks.filter(Boolean).length,fail:checks.filter(v=>!v).length};
console.log(JSON.stringify(result,null,2));
if(result.fail)process.exit(1);
console.log('DECOMPOSITION_STAGE5_PRESENTATION_PASS');
