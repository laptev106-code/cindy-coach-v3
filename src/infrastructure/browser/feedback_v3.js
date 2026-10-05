(() => {
  'use strict';
  const create=({getConfig})=>{
    let audioContext=null;
    const haptic=(kind)=>{
      const config=typeof getConfig==='function'?getConfig():null;
      if(!navigator.vibrate||!config?.hapticMode)return;
      const allowed=kind==='lap'||kind==='finish'?config.hapticMode>=1:kind==='start'?config.hapticMode>=2:kind==='cue'?config.hapticMode>=3:false;
      if(!allowed)return;
      navigator.vibrate(kind==='finish'?[28,32,40]:kind==='cue'?10:kind==='start'?14:24);
    };
    const toneSequence=(sequence)=>{
      const config=typeof getConfig==='function'?getConfig():null;
      if(!config?.sound)return;
      try{
        const A=window.AudioContext||window.webkitAudioContext;
        if(!A)return;
        audioContext=audioContext||new A();
        if(audioContext.state==='suspended')audioContext.resume();
        const now=audioContext.currentTime;
        sequence.forEach(([frequency,at,length,volume])=>{
          const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
          oscillator.type='sine';
          oscillator.frequency.value=frequency;
          gain.gain.setValueAtTime(volume,now+at);
          gain.gain.exponentialRampToValueAtTime(.001,now+at+length);
          oscillator.connect(gain);
          gain.connect(audioContext.destination);
          oscillator.start(now+at);
          oscillator.stop(now+at+length+.01);
        });
      }catch(_){}
    };
    const feedback=(kind='lap')=>{
      const config=typeof getConfig==='function'?getConfig():null;
      haptic(kind);
      if(!config)return;
      if(kind==='cue'){
        const tone={click:[[880,0,.025,.017]],soft:[[560,0,.07,.019]],double:[[720,0,.025,.016],[880,.07,.025,.014]],tone:[[680,0,.1,.018]]}[config.cueTone]||[];
        toneSequence(tone);
        return;
      }
      if(kind==='pace'){toneSequence([[640,0,.055,.015]]);return;}
      toneSequence(kind==='finish'?[[780,0,.1,.025]]:kind==='start'?[[520,0,.07,.018]]:[[620,0,.09,.024]]);
    };
    return Object.freeze({haptic,toneSequence,feedback});
  };
  window.CINDYBrowserFeedbackV3=Object.freeze({create});
})();
