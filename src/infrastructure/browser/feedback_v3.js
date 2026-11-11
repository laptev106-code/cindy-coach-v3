(() => {
  'use strict';
  const create=({getConfig})=>{
    let audioContext=null;
    const getAudioContext=()=>{
      try{
        const A=window.AudioContext||window.webkitAudioContext;
        if(!A)return null;
        if(!audioContext)audioContext=new A();
        if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
        return audioContext;
      }catch(_){return null;}
    };
    if(typeof window!=='undefined'&&typeof window.addEventListener==='function'){
      ['pointerdown','keydown','touchstart'].forEach(type=>{
        window.addEventListener(type,getAudioContext,{once:true,passive:true});
      });
      if(typeof document!=='undefined'&&typeof document.addEventListener==='function'){
        document.addEventListener('visibilitychange',()=>{
          if(document.visibilityState==='visible'&&audioContext&&audioContext.state==='suspended'){
            audioContext.resume().catch(()=>{});
          }
        });
      }
    }
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
        const ctx=getAudioContext();
        if(!ctx)return;
        const play=()=>{
          const now=ctx.currentTime;
          sequence.forEach(([frequency,at,length,volume])=>{
            const oscillator=ctx.createOscillator(),gain=ctx.createGain();
            oscillator.type='sine';
            oscillator.frequency.value=frequency;
            gain.gain.setValueAtTime(Math.max(0.001,volume),now+at);
            gain.gain.exponentialRampToValueAtTime(.0001,now+at+length);
            oscillator.connect(gain);
            gain.connect(ctx.destination);
            oscillator.start(now+at);
            oscillator.stop(now+at+length+.02);
          });
        };
        if(ctx.state==='suspended'){
          ctx.resume().then(play).catch(()=>{});
        }else{
          play();
        }
      }catch(_){}
    };
    const feedback=(kind='lap')=>{
      const config=typeof getConfig==='function'?getConfig():null;
      haptic(kind);
      if(!config)return;
      if(kind==='cue'){
        const tone={
          click:[[1200,0,.03,.32]],
          soft:[[560,0,.09,.30]],
          double:[[720,0,.035,.28],[880,.07,.04,.30]],
          tone:[[680,0,.12,.32]]
        }[config.cueTone]||[[560,0,.09,.30]];
        toneSequence(tone);
        return;
      }
      if(kind==='pace'){toneSequence([[640,0,.06,.26]]);return;}
      if(kind==='pause'){toneSequence([[520,0,.07,.28],[420,.08,.09,.25]]);return;}
      if(kind==='voice-start'){toneSequence([[880,0,.04,.25]]);return;}
      if(kind==='voice-recognized'){toneSequence([[660,0,.04,.28],[880,.05,.07,.30]]);return;}
      toneSequence(
        kind==='finish'?[[520,0,.08,.30],[660,.09,.08,.32],[880,.18,.22,.38]]:
        kind==='start'?[[520,0,.08,.32],[780,.09,.14,.35]]:
        [[660,0,.09,.35]]
      );
    };
    return Object.freeze({haptic,toneSequence,feedback});
  };
  window.CINDYBrowserFeedbackV3=Object.freeze({create});
})();
