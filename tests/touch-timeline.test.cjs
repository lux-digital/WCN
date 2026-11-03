const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');

// Execute the actual controller from index.html with rendering/network boundaries
// stubbed. These tests exercise gestures and time, not a second implementation.
function controller() {
  const names = ['SCROLL_FRAME_COUNT', 'SCROLL_SENSITIVITY', 'STORY_SEQUENCE_START_FRAME', 'STORY_SEQUENCE_START',
    'STORY_SEQUENCE_END', 'STORY_SEQUENCE_FRAME_COUNT', 'STORY_LAST_FRAME', 'STORY_SEQUENCE_AUTOPLAY_FPS',
    'STORY_FIRST_AUTOPLAY_END_FRAME', 'STORY_MID_AUTOPLAY_START_FRAME', 'STORY_MID_AUTOPLAY_END_FRAME',
    'STORY_THIRD_AUTOPLAY_START_FRAME', 'STORY_THIRD_AUTOPLAY_END_FRAME', 'STORY_FOURTH_AUTOPLAY_START_FRAME',
    'STORY_FOURTH_AUTOPLAY_END_FRAME', 'STORY_FIFTH_AUTOPLAY_START_FRAME', 'STORY_FIFTH_AUTOPLAY_END_FRAME',
    'STORY_MANUAL_SPAN_1', 'STORY_MANUAL_SPAN_2', 'STORY_MANUAL_SPAN_3', 'STORY_MANUAL_SPAN_4', 'STORY_MANUAL_TOTAL_SPAN',
    'MOOD_WHITE_START', 'MOOD_CLIP_DURATION', 'HOLD_ENV_AUTOPLAY_FADE_START_FRAME', 'BACKGROUND_SCROLL_SLOWDOWN',
    'BACKGROUND_AUTOPLAY_START_FRAME', 'BACKGROUND_AUTOPLAY_FPS', 'HERO_TYPE_CONTINUE_END_FRAME',
    'PANORAMA_FADE_END_FRAME', 'HOLD_ENV_MOUSE_YAW_DEG', 'HOLD_ENV_MOUSE_PITCH_DEG', 'HOLD_ENV_ROTATION_EASE'];
  // Dependencies precede their consumers.
  const ordered = names.filter(n => n !== 'HERO_TYPE_CONTINUE_END_FRAME').concat('HERO_TYPE_CONTINUE_END_FRAME');
  let declarations = '';
  for (const name of ordered) {
    const expression = html.match(new RegExp('\\b' + name + '\\s*=\\s*([^;\\n,]+)'));
    assert.ok(expression, name);
    declarations += `const ${name} = ${expression[1]};\n`;
  }
  declarations += html.slice(html.indexOf('const STORY_AUTOPLAY_RANGES ='), html.indexOf('];', html.indexOf('const STORY_AUTOPLAY_RANGES =')) + 2);
  let now = 0;
  class Target { closest() { return null; } }
  const context = vm.createContext({
    performance: { now: () => now }, MOBILE_RUNTIME: true, scrollingReady: true, storySquareLottieReady: true,
    previousAnimationTime: 0, panoramaIntroReveal: 1, panoramaLoaded: true, pendingTouchStoryFrame: null,
    window: { __wcnStartupRecovery: { isRecovering: () => false } }, document: { hidden: false },
    experienceInView: true, parentOverlayProgress: 0, volumeDocked: true,
    requestAnimationFrame(){}, stopExperienceMedia(){}, getTimelineAutoplayLockY:()=>null,
    updatePanoramaMotion(){}, updateLensFlare(){}, hideLensFlare(){}, resumeVisibleMoodVideo(){},
    updateWoodStripLoop(){}, wcnFastTick(){}, wcnFastUpdateLinks(){}, updateHoldHotspots(){},
    updateMoodBackgroundParallax(){}, syncVolumePositionWithScroll(){}, updateSoundscape(){},
    wcnFast: { active: false, starting: false }, parentOverlayActive: false, parentScrollHandoffEnabled: true, parentHandoffRate: 1,
    viewportHeight: 1000, viewportWidth: 1000, mobileSequenceDirection: 1, scrollFrames: Array(109).fill({}), currentScrollFrame: -1,
    moodClipComplete: false, moodClipActive: false, moodClipProgress: 0, paints: [], handoffs: [], backgroundUpdates: 0,
    holdEnvLoaded: true, holdEnvYaw: 0, holdEnvPitch: 0, mouseX: 0, mouseY: 0, holdEnvCameraDistance: 1,
    holdEnvCanvas: { style: {} }, stage: { contains:()=>true, classList:{toggle(){}} }, Element: Target,
    holdEnvCamera: { position:{set(){}}, rotation:{} }, holdEnvScene: {}, holdRenders: 0,
    holdEnvRenderer: { render(){context.holdRenders++;} }, hideHoldLensFlare(){}, mediaIsVisible:()=>true,
    woodViewerInteractionEnabled: false, woodPanVelocity: 0, THREE:{MathUtils:{degToRad:x=>x*Math.PI/180}},
    clamp: (v,a,b) => Math.max(a,Math.min(b,v)), lerp: (a,b,t) => a+(b-a)*t,
    rangeProgress: (v,a,b) => Math.max(0,Math.min(1,(v-a)/(b-a))), smootherstep01: x=>x*x*x*(x*(6*x-15)+10),
    clearMoodExitSettle(){}, clearMoodReturnHold(){}, beginMoodExitSettle(){},
    notifyParentMoodHandoffReady(){}, postElementorHandoffMessage(type){ context.handoffs.push(type); },
    loadMobileSequencePair: () => new Promise(()=>{}), prefetchMobileSequenceWindow(){},
    renderFrame: f=>context.paints.push(f), updatePanoramaOpacity(){}, updateHeroScrollTypography(){context.backgroundUpdates++;},
    updateOpeningTextLottie(){}, updateTextMode(){}, updateStoryTextMotion(){}, updateMoodSectionMotion(){}
  });
  vm.runInContext(declarations + '\n' +
    html.slice(html.indexOf('const TOUCH_FLOW ='), html.indexOf("      if (MOBILE_RUNTIME) {\n        window.addEventListener('touchstart'")) + '\n' +
    html.slice(html.indexOf('function masterAnimationLoop(time)'), html.indexOf('async function init()')) + '\n' +
    `function storyFrameToRawProgress(frame) { return STORY_SEQUENCE_START + (STORY_SEQUENCE_END - STORY_SEQUENCE_START) * frame / STORY_LAST_FRAME; }
     function updateHoldEnvironment(dt) { updateTouchHoldEnvironment(dt); }
     globalThis.api = {
       state: () => ({ position: touchFlow.position, displayed: touchFlow.displayedPosition,
         frame: currentScrollFrame, story: touchStoryFrameAt(touchFlow.displayedPosition),
         clip: touchFlow.autoplay && {...touchFlow.autoplay}, complete: moodClipComplete,
         hold: TOUCH_HOLD_POSITION, end: TOUCH_END_POSITION, sequenceEnd: TOUCH_FLOW.sequenceEnd,
         canPan: touchCanPanHold(), gesture: touchFlow.gesture, yaw: holdEnvYaw, pitch: holdEnvPitch }),
       seek: p => { touchFlow.autoplay = null; setTouchPosition(p); updateTouchTimeline(true); },
       swipe: px => { advanceTouchTimeline(px, {stopped:false}); updateTouchTimeline(); },
       tickAt: masterAnimationLoop,
       holdTick: updateTouchHoldEnvironment,
       invalidate: () => { touchHoldRenderState.dirty = true; },
       begin: beginTouchFlowGesture, move: moveTouchFlowGesture, release: finishTouchFlowGesture,
       raw: touchRawAt, position: touchPositionAtRaw, framePosition: touchPositionAtStoryFrame
     };`, context);
  context.api.seek(0);
  context.api.tick = dt => { now += dt * 1000; context.api.tickAt(now); };
  const event = (x,y) => ({ target:new Target(), touches:[{identifier:1,clientX:x,clientY:y}], cancelable:true, preventDefault(){} });
  return { api:context.api, context, event };
}

function finish(api) { for(let i=0;i<1000 && api.state().clip;i++) api.tick(1/60); assert.equal(api.state().clip,null); }

test('all inline scripts parse', () => {
  for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
});

test('one swipe autoplays every image before starting the first story clip', () => {
  const {api}=controller(); api.swipe(30);
  assert.equal(api.state().clip.kind,'sequence');
  for(let i=0;i<260;i++) { api.tick(1/60); assert.equal(api.state().story,0); }
  assert.ok(api.state().frame>100 && api.state().frame<108);
  while(api.state().clip.kind==='sequence') api.tick(1/60);
  assert.equal(api.state().frame,108);assert.equal(api.state().story,0);
  assert.equal(api.state().clip.id,'first');assert.equal(api.state().canPan,true);
  finish(api);assert.equal(Math.round(api.state().story),72);
});

test('all five story clips autoplay in both directions without moving the image sequence', () => {
  const {api}=controller();
  for(const direction of [1,-1]) {
    if(direction===1) api.seek(api.state().sequenceEnd); else api.seek(api.state().hold);
    const ranges=direction===1?['first','mid','third','fourth','fifth']:['fifth','fourth','third','mid','first'];
    for(const id of ranges) {
      api.swipe(direction*5000);
      const s=api.state(); assert.equal(s.clip.id,id);
      finish(api); assert.equal(api.state().frame,108,'background stays on the final image');
      assert.notEqual(api.state().story,s.story);
    }
  }
  assert.equal(api.state().story,0); api.swipe(-5000); assert.equal(api.state().clip.kind,'sequence');
  finish(api);assert.equal(api.state().frame,0);
});

test('semi-panorama holds; reveal and reverse reveal run on a fresh swipe; exit needs a further swipe', () => {
  const {api,context}=controller(); api.seek(api.state().hold);
  for(let i=0;i<600;i++) api.tick(1/60);
  assert.equal(api.state().position,api.state().hold);
  api.swipe(100); assert.equal(api.state().clip.kind,'mood'); finish(api);
  assert.equal(api.state().complete,true); assert.equal(context.handoffs.length,0);
  api.swipe(100); assert.equal(context.handoffs[0],'scroll-parent-end');
  api.swipe(-100); finish(api); assert.equal(api.state().position,api.state().hold); assert.equal(api.state().complete,false);
});

test('mid-clip reversal is continuous and later forward playback re-arms', () => {
  const {api}=controller(); api.seek(api.state().sequenceEnd);api.swipe(50); for(let i=0;i<35;i++)api.tick(1/60);
  const from=api.state(); api.swipe(-30); assert.equal(api.state().position,from.position);
  api.tick(1/60); assert.ok(api.state().position<from.position); finish(api);
  assert.equal(api.state().story,0); api.swipe(50); assert.equal(api.state().clip.id,'first'); finish(api);
  assert.equal(Math.round(api.state().story),72);
});

test('loading and parent overlay do not silently advance autoplay', () => {
  const {api,context}=controller(); context.scrollFrames[108]=null;
  api.seek(api.state().sequenceEnd);api.swipe(30); const start=api.state().position;
  for(let i=0;i<120;i++)api.tick(1/60); assert.equal(api.state().position,start);
  context.scrollFrames[108]={}; api.tick(1/60); api.tick(1/60); assert.ok(api.state().position>start);
  context.parentOverlayActive=true; const position=api.state().position; for(let i=0;i<120;i++)api.tick(1/60);
  assert.equal(api.state().position,position);
});

test('timeline coordinates remain reversible throughout the experience', () => {
  const {api}=controller(); for(let i=0;i<=1000;i++) {
    const p=i/1000*api.state().end; assert.ok(Math.abs(api.position(api.raw(p))-p)<1e-8);
  }
});

test('late Lottie readiness starts the first clip without another gesture', () => {
  const {api,context}=controller(); context.storySquareLottieReady=false;api.swipe(40);
  for(let i=0;i<400;i++)api.tick(1/60);
  assert.equal(api.state().frame,108);assert.equal(api.state().story,0);assert.equal(api.state().clip.id,'first');
  context.storySquareLottieReady=true;api.tick(.1);assert.ok(api.state().story>0);
});

test('story timing stays the same at 60 fps and 10 fps, with no background redraws', () => {
  const results=[];
  for(const fps of [60,10]) {
    const {api,context}=controller();api.seek(api.state().sequenceEnd);api.swipe(30);
    const paints=context.paints.length, updates=context.backgroundUpdates;
    for(let i=0;i<fps;i++)api.tick(1/fps);
    results.push(api.state().story);assert.equal(context.paints.length,paints);assert.equal(context.backgroundUpdates,updates);
  }
  assert.ok(Math.abs(results[0]-38)<.00001);assert.ok(Math.abs(results[1]-38)<.00001);
});

test('the panorama is pannable in every story section and a clip ending does not stop the drag', () => {
  const {api,event}=controller();
  for(const frame of [0,73,145,266,321,368]) {
    api.seek(api.framePosition(frame));assert.equal(api.state().canPan,true);
    api.begin(event(100,200));api.move(event(160,202));
    assert.equal(api.state().gesture.mode,'hold-pan');
    const position=api.state().position;api.move(event(180,300));assert.equal(api.state().position,position);
    api.release();
  }
  api.seek(api.state().sequenceEnd);api.swipe(30);api.begin(event(100,200));api.move(event(160,202));
  finish(api);assert.equal(api.state().gesture.stopped,false);
  api.move(event(180,210));assert.equal(api.state().gesture.mode,'hold-pan');
});

test('idle panorama draws once, moves while panning, then stops drawing; resize invalidates it', () => {
  const {api,context}=controller();api.seek(api.state().sequenceEnd);
  for(let i=0;i<120;i++)api.tick(1/60);assert.equal(context.holdRenders,1);
  context.mouseX=.5;for(let i=0;i<240;i++)api.tick(1/60);
  const count=context.holdRenders;assert.ok(count>1);
  for(let i=0;i<120;i++)api.tick(1/60);assert.equal(context.holdRenders,count);
  api.invalidate();api.tick(1/60);assert.equal(context.holdRenders,count+1);
});

test('reverse sequence realigns the panorama before showing earlier images', () => {
  const {api,context}=controller();api.seek(api.state().sequenceEnd);context.mouseX=.8;
  for(let i=0;i<120;i++)api.tick(1/60);
  api.swipe(-40);api.tick(1/60);assert.equal(api.state().frame,108);
  for(let i=0;i<1000 && api.state().frame===108;i++)api.tick(1/60);
  assert.ok(api.state().frame<108);assert.equal(Math.abs(api.state().yaw),0);finish(api);assert.equal(api.state().frame,0);
});

test('vertical touch gestures start playback and a stationary opening does not autoplay', () => {
  const {api,event}=controller();for(let i=0;i<120;i++)api.tick(1/60);
  assert.equal(api.state().frame,0);assert.equal(api.state().clip,null);
  api.begin(event(100,400));api.move(event(101,350));
  assert.equal(api.state().gesture.mode,'timeline');assert.equal(api.state().clip.kind,'sequence');
  api.release();finish(api);assert.equal(Math.round(api.state().story),72);
});

test('hidden and offscreen pages pause the story clock', () => {
  const {api,context}=controller();api.seek(api.state().sequenceEnd);api.swipe(30);api.tick(.25);
  const position=api.state().position;
  context.document.hidden=true;api.tick(30);assert.equal(api.state().position,position);
  context.document.hidden=false;context.experienceInView=false;api.tick(20);assert.equal(api.state().position,position);
  context.experienceInView=true;api.tick(.25);assert.ok(Math.abs(api.state().story-19)<.00001);
});
