const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');

function soundscape(mobile = true) {
  let progress = 0, now = 0;
  const ambient = { level:0 }, ocean = { level:0 };
  const video = { level:0, paused:false, pause(){this.paused=true;} };
  const context = vm.createContext({
    MOBILE_RUNTIME:mobile, soundEnabled:true, performance:{now:()=>now}, mediaIsVisible:()=>true,
    parentOverlayProgress:0, volumeSlider:{value:'80'}, soundscapeTracks:new Map([['ambient',ambient],['ocean',ocean]]),
    backgroundAutoplayActive:false, smoothScrollFrame:108, backgroundAutoplayFrame:0,
    moodAudioTransition:null, activeMoodIndex:0, moodVideoPlayers:[video],
    getMoodVisualProgress:()=>progress,
    clamp:(x,a,b)=>Math.max(a,Math.min(b,x)), lerp:(a,b,t)=>a+(b-a)*t,
    rangeProgress:(x,a,b)=>Math.max(0,Math.min(1,(x-a)/(b-a))), smootherstep01:x=>x*x*x*(x*(6*x-15)+10),
    setSoundscapeTrackLevel:(track,level)=>{track.level=level;}, tryPlaySoundscapeTrack(){}, stopExperienceMedia(){},
    setMoodVideoAudioLevel:(item,level)=>{item.level=level;}, playMoodVideo:item=>{item.paused=false;}
  });
  const names=['BACKGROUND_AUTOPLAY_START_FRAME','OCEAN_START_LEVEL','MOOD_WHITE_START','MOOD_VIDEO_END',
    'MOOD_AMBIENT_BED_LEVEL','MOOD_OCEAN_BED_LEVEL','SOUND_AMBIENT_MIX','SOUND_OCEAN_MIX',
    'MOOD_VIDEO_AUDIO_MIX','MOOD_VIDEO_AUDIO_CROSSFADE_MS'];
  let declarations='';
  for(const name of names) {
    const expression=html.match(new RegExp('\\b'+name+'\\s*=\\s*([^;\\n,]+)'));
    assert.ok(expression,name);declarations+=`const ${name}=${expression[1]};\n`;
  }
  vm.runInContext(declarations+html.slice(html.indexOf('const SOUND_RETURN_FADE_MS ='),html.indexOf('function setSoundEnabled(')),context);
  return {ambient,ocean,video,context,
    update:(time,p=progress)=>{now=time;progress=p;vm.runInContext('updateSoundscape()',context);},
    reset:()=>vm.runInContext('resetAudioReturnFades()',context)
  };
}

test('fast upward scrolling fades ambient and ocean in over 2.8 seconds on desktop and touch', () => {
  for(const mobile of [true,false]) {
    const s=soundscape(mobile);s.update(0,0);
    const fullAmbient=s.ambient.level, fullOcean=s.ocean.level;
    s.update(100,1);assert.equal(s.ambient.level,0);assert.equal(s.ocean.level,0);
    s.update(200,0);assert.equal(s.ambient.level,0);assert.equal(s.ocean.level,0);
    s.update(1600);assert.ok(Math.abs(s.ambient.level/fullAmbient-.5)<.00001);
    assert.ok(Math.abs(s.ocean.level/fullOcean-.5)<.00001);
    s.update(3000);assert.equal(s.ambient.level,fullAmbient);assert.equal(s.ocean.level,fullOcean);
  }
});

test('turning around mid-fade returns to silence and can restart without a volume jump', () => {
  const s=soundscape();s.update(0,1);s.update(100,0);s.update(1100);
  assert.ok(s.ambient.level>0);s.update(1200,1);assert.equal(s.ambient.level,0);
  s.update(1300,0);assert.equal(s.ambient.level,0);s.update(2700);assert.ok(s.ambient.level>0);
  s.context.volumeSlider.value='0';s.update(2800);assert.equal(s.ambient.level,0);assert.equal(s.ocean.level,0);
});

test('audio returning from the parent gallery fades in and hidden playback resets the fade', () => {
  const s=soundscape();s.update(0,1);const full=s.video.level;
  s.context.parentOverlayProgress=1;s.update(100);assert.equal(s.video.level,0);
  s.context.parentOverlayProgress=0;s.update(200);assert.equal(s.video.level,0);
  s.update(1600);assert.ok(Math.abs(s.video.level/full-.5)<.00001);
  s.reset();s.update(20000);assert.equal(s.video.level,0);s.update(22800);assert.equal(s.video.level,full);
});
