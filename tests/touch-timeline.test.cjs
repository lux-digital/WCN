const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');

// Execute the actual controller from index.html with rendering/network boundaries
// stubbed. These tests exercise gestures and time, not a second implementation.
function controller() {
  const names = ['SCROLL_FRAME_COUNT', 'SCROLL_SENSITIVITY', 'STORY_SEQUENCE_START_FRAME', 'STORY_SEQUENCE_START',
    'STORY_SEQUENCE_END', 'STORY_SEQUENCE_HOLD_END',
    'MOOD_WHITE_START', 'MOOD_CLIP_DURATION', 'HOLD_ENV_AUTOPLAY_FADE_START_FRAME', 'BACKGROUND_SCROLL_SLOWDOWN',
    'BACKGROUND_AUTOPLAY_START_FRAME', 'BACKGROUND_AUTOPLAY_FPS', 'HERO_TYPE_CONTINUE_END_FRAME',
    'PANORAMA_FADE_END_FRAME', 'HOLD_ENV_MOUSE_YAW_DEG', 'HOLD_ENV_MOUSE_PITCH_DEG', 'HOLD_ENV_ROTATION_EASE',
    'DRAG_SENSITIVITY', 'MAX_DRAG_VELOCITY', 'MAX_PITCH'];
  // Dependencies precede their consumers.
  const ordered = names.filter(n => n !== 'HERO_TYPE_CONTINUE_END_FRAME').concat('HERO_TYPE_CONTINUE_END_FRAME');
  let declarations = '';
  for (const name of ordered) {
    const expression = html.match(new RegExp('\\b' + name + '\\s*=\\s*([^;\\n,]+)'));
    assert.ok(expression, name);
    declarations += `const ${name} = ${expression[1]};\n`;
  }
  declarations += "const STORY_CLIP_FILES = ['square_01.json', 'square_02.json', 'square_03.json', 'square_04.json'];\n";
  declarations += html.slice(html.indexOf('const STORY_CLIP_SPAN ='), html.indexOf('const HOLD_ENV_HOTSPOT_IMAGE_WIDTH'));
  let now = 0;
  class Target { closest() { return null; } }
  const clips = [71,80,107,115].map((totalFrames, index) => {
    const readFrame = index === 3 ? 76 : totalFrames - 1;
    return {
      state:'ready', readFrame, duration:readFrame/30, frame:-1, container:{style:{visibility:'hidden'}},
      animation:{totalFrames, goToAndStop(frame){assert.ok(frame>=0 && frame<totalFrames);}}
    };
  });
  const context = vm.createContext({
    performance: { now: () => now }, MOBILE_RUNTIME: true, scrollingReady: true, storyClips: clips, visibleStoryClip:null,
    storySequenceLottie:{style:{}}, storySequenceAutoplayActive:false, activeHoldHotspotIndex:-1,
    previousAnimationTime: 0, panoramaIntroReveal: 1, panoramaLoaded: true,
    window: { __wcnStartupRecovery: { isRecovering: () => false } }, document: { hidden: false },
    experienceInView: true, parentOverlayProgress: 0, volumeDocked: true,
    requestAnimationFrame(){}, stopExperienceMedia(){}, getTimelineAutoplayLockY:()=>null,
    updatePanoramaMotion(){}, updateLensFlare(){}, hideLensFlare(){}, resumeVisibleMoodVideo(){},
    updateWoodStripLoop(){}, wcnFastTick(){}, wcnFastUpdateLinks(){}, updateHoldHotspots(){},
    updateMoodBackgroundParallax(){}, syncVolumePositionWithScroll(){}, updateSoundscape(){},
    wcnFast: { active: false, starting: false }, parentOverlayActive: false, parentScrollHandoffEnabled: true, parentHandoffRate: 1,
    fastRequests:[],wcnFastBegin:(destination,direction)=>{context.fastRequests.push({destination,direction});context.wcnFast.starting=true;},
    yaw:0,pitch:0,smoothMouseX:0,smoothMouseY:0,inertialYawVelocity:0,inertialPitchVelocity:0,isDragging:false,
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
    updateOpeningTextLottie(){}, updateTextMode(){}, updateMoodSectionMotion(){}
  });
  vm.runInContext(declarations + '\n' +
    html.slice(html.indexOf('const TOUCH_FIRST_STORY_IMAGE ='), html.indexOf("      if (MOBILE_RUNTIME) {\n        window.addEventListener('touchstart'")) + '\n' +
    html.slice(html.indexOf('function storyClipDuration('), html.indexOf('function easeOutQuint01')) + '\n' +
    html.slice(html.indexOf('const TOUCH_STORY_PAINT_INTERVAL_MS ='), html.indexOf('// Retry transient network failures')) + '\n' +
    html.slice(html.indexOf('function masterAnimationLoop(time)'), html.indexOf('async function init()')) + '\n' +
    `function storyFrameToRawProgress(frame) { return STORY_SEQUENCE_START + (STORY_SEQUENCE_END - STORY_SEQUENCE_START) * frame / STORY_LAST_FRAME; }
     function updateHoldEnvironment(dt) { updateTouchHoldEnvironment(dt); }
     globalThis.api = {
       state: () => ({ position: touchFlow.position, displayed: touchFlow.displayedPosition,
         frame: currentScrollFrame, story: touchStoryFrameAt(touchFlow.displayedPosition),
         clip: touchFlow.autoplay && {...touchFlow.autoplay}, complete: moodClipComplete,
         hold: TOUCH_HOLD_POSITION, end: TOUCH_END_POSITION, sequenceEnd: TOUCH_FLOW.sequenceEnd,
         canPan: touchCanPanHold(), visibleClip: storyClips.indexOf(visibleStoryClip), gesture: touchFlow.gesture, yaw: holdEnvYaw, pitch: holdEnvPitch }),
       seek: p => { touchFlow.autoplay = touchFlow.storyHold = null; setTouchPosition(p); updateTouchTimeline(true); },
       swipe: px => { advanceTouchTimeline(px, {stopped:false}); updateTouchTimeline(); },
       tickAt: masterAnimationLoop,
       holdTick: updateTouchHoldEnvironment,
       invalidate: () => { touchHoldRenderState.dirty = true; },
       begin: beginTouchFlowGesture, move: moveTouchFlowGesture, release: finishTouchFlowGesture,
       raw: touchRawAt, position: touchPositionAtRaw, framePosition: touchPositionAtStoryFrame
     };`, context);
  context.api.seek(0);
  context.api.tick = dt => { now += dt * 1000; context.api.tickAt(now); };
  context.api.elapse = ms => { now += ms; };
  const event = (x,y) => ({ target:new Target(), touches:[{identifier:1,clientX:x,clientY:y}], cancelable:true, preventDefault(){} });
  return { api:context.api, context, event };
}

function finish(api) { for(let i=0;i<1000 && api.state().clip;i++) api.tick(1/60); assert.equal(api.state().clip,null); }

test('all inline scripts parse', () => {
  for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
});

test('clip 01 starts early and plays at its own speed across image decoding stalls', () => {
  const {api,context}=controller();
  api.swipe(30);
  while(api.state().clip.kind==='sequence' && api.state().visibleClip!==0) api.tick(1/60);
  assert.ok(api.state().frame>=43 && api.state().frame<=45);
  context.scrollFrames.fill(null,46);
  api.tick(.2);
  const heldImage=api.state().frame;
  api.swipe(-5000);
  api.tick(.5);
  assert.equal(api.state().frame,heldImage);
  assert.equal(context.storyClips[0].frame,21);
  context.scrollFrames.fill({});
  finish(api);
  assert.equal(api.state().frame,108);
  assert.equal(context.storyClips[0].frame,70);
  assert.equal(api.state().canPan,true);
});

test('all four exports hold their reading frames forward and first frames in reverse', () => {
  const {api,context}=controller();
  for(const direction of [1,-1]) {
    api.seek(direction===1?api.state().sequenceEnd:api.state().hold);
    const indices=direction===1?[0,1,2,3]:[3,2,1,0];
    for(const index of indices) {
      api.swipe(direction*5000);
      assert.equal(api.state().clip.index,index);
      finish(api);
      assert.equal(api.state().frame,108);
      const clip=context.storyClips[index];
      assert.equal(clip.frame,direction===1?clip.readFrame:0);
      assert.equal(api.state().visibleClip,index);
      api.tick(2.6);
    }
  }
  assert.equal(api.state().story,0);
  api.swipe(-5000);assert.equal(api.state().clip.kind,'sequence');
  finish(api);assert.equal(api.state().frame,0);
});

test('the previous clip holds its last frame until the incoming SVG has painted', () => {
  const {api,context}=controller();
  api.seek(api.framePosition(100));
  const [outgoing,incoming]=context.storyClips;
  incoming.state='loading';
  api.swipe(5000);api.tick(.5);
  assert.equal(outgoing.frame,70);
  assert.equal(outgoing.container.style.visibility,'visible');
  assert.equal(incoming.container.style.visibility,'hidden');
  incoming.animation.goToAndStop=()=>assert.equal(outgoing.container.style.visibility,'visible');
  incoming.state='ready';
  api.tick(1/60);
  assert.equal(incoming.container.style.visibility,'visible');
  assert.equal(outgoing.container.style.visibility,'hidden');
  assert.equal(context.storySequenceLottie.style.opacity,'1');
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

test('swipes cannot reverse, speed up, or skip the clip or its 2.5 second hold', () => {
  const {api,context,event}=controller();
  api.seek(api.state().sequenceEnd);
  api.swipe(50);
  api.tick(.5);
  assert.equal(context.storyClips[0].frame,15);
  api.swipe(-5000);
  api.swipe(5000);
  api.tick(.5);
  assert.equal(context.storyClips[0].frame,30);
  finish(api);
  assert.equal(context.storyClips[0].frame,70);
  const held=api.state().position;
  api.tick(2.4);
  api.swipe(5000);
  assert.equal(api.state().position,held);
  api.begin(event(100,400));
  api.tick(.2);
  api.move(event(101,250));
  assert.equal(api.state().position,held);
  api.release();
  api.swipe(5000);
  assert.equal(api.state().clip.index,1);
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
  const {api,context}=controller(); context.storyClips[0].state='loading';api.swipe(40);
  for(let i=0;i<400;i++)api.tick(1/60);
  assert.equal(api.state().frame,108);assert.equal(api.state().story,0);assert.equal(api.state().clip.index,0);
  context.storyClips[0].state='ready';api.tick(.1);assert.ok(api.state().story>0);
});

test('story timing stays the same at 60 fps and 10 fps, with no background redraws', () => {
  const results=[];
  for(const fps of [60,10]) {
    const {api,context}=controller();api.seek(api.state().sequenceEnd);api.swipe(30);
    const paints=context.paints.length, updates=context.backgroundUpdates;
    for(let i=0;i<fps;i++)api.tick(1/fps);
    results.push(api.state().story);assert.equal(context.paints.length,paints);assert.equal(context.backgroundUpdates,updates);
  }
  assert.ok(Math.abs(results[0]-100/(70/30))<.00001);assert.ok(Math.abs(results[1]-100/(70/30))<.00001);
});

test('the panorama is pannable in every story section and a clip ending does not stop the drag', () => {
  const {api,event}=controller();
  for(const frame of [0,100,108,208,316,424]) {
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
  api.release();finish(api);assert.equal(Math.round(api.state().story),100);
});

test('hidden and offscreen pages pause the story clock', () => {
  const {api,context}=controller();api.seek(api.state().sequenceEnd);api.swipe(30);api.tick(.25);
  const position=api.state().position;
  context.document.hidden=true;api.tick(30);assert.equal(api.state().position,position);
  context.document.hidden=false;context.experienceInView=false;api.tick(20);assert.equal(api.state().position,position);
  context.experienceInView=true;api.tick(.25);assert.ok(Math.abs(api.state().story-50/(70/30))<.00001);
});

test('main touch panorama retains bounded release momentum and drops it on a new touch or cancellation', () => {
  const {api,context,event}=controller();api.begin(event(100,200));api.elapse(20);api.move(event(150,205));
  assert.equal(context.isDragging,true);assert.ok(context.yaw<0);
  api.elapse(16);api.move(event(190,210));api.release({type:'touchend'});
  assert.equal(context.isDragging,false);assert.ok(context.inertialYawVelocity<0);assert.ok(Math.abs(context.inertialYawVelocity)<=1.25);
  api.begin(event(190,210));assert.equal(context.inertialYawVelocity,0);
  api.elapse(20);api.move(event(240,210));api.release({type:'touchcancel'});assert.equal(Math.abs(context.inertialYawVelocity),0);
  api.begin(event(100,200));api.elapse(20);api.move(event(150,200));api.elapse(200);api.release({type:'touchend'});
  assert.equal(Math.abs(context.inertialYawVelocity),0,'a held finger should not release old velocity');
});

test('a fast vertical return swipe invokes the desktop fast route from any story section or thumbnails', () => {
  for(const where of ['first','middle','colours']) {
    const {api,context,event}=controller();api.seek(where==='colours'?api.state().end:api.framePosition(where==='first'?40:190));
    api.begin(event(100,200));api.elapse(100);api.move(event(103,410));
    assert.equal(context.fastRequests.length,1);assert.deepEqual(context.fastRequests[0],{destination:'top',direction:-1});
  }
});

test('slow, short, sideways and forward swipes never trigger fast return', () => {
  for(const [x,y,ms] of [[103,410,700],[103,260,50],[340,410,100],[103,0,100]]) {
    const {api,context,event}=controller();api.seek(api.framePosition(190));api.begin(event(100,200));
    api.elapse(ms);api.move(event(x,y));assert.equal(context.fastRequests.length,0);
  }
  const {api,context,event}=controller();api.begin(event(100,200));api.elapse(100);api.move(event(103,410));
  assert.equal(context.fastRequests.length,0,'opening panorama cannot skip into a return route');
});

test('a rapid swipe can still skip after a short story clip ends during the same gesture', () => {
  const {api,context,event}=controller();api.seek(api.framePosition(109));api.begin(event(100,200));
  api.elapse(30);api.move(event(100,255));
  api.tick(.04);assert.equal(api.state().gesture.stopped,true);
  api.elapse(40);api.move(event(100,420));assert.equal(context.fastRequests.length,1);
});

test('desktop uses the export clock and rejects wheel momentum through the reading hold', () => {
  const {api,context}=controller();
  api.seek(api.state().sequenceEnd);
  context.MOBILE_RUNTIME=false;
  context.timelinePlaybackRate=4;
  context.storyFrameToPageY=frame=>frame*10;
  context.window.scrollTo=(_,y)=>{context.window.scrollY=y;};
  context.syncScrollTrackingAfterProgrammaticMove=()=>{};
  const clip=context.storyClips[3];
  clip.state='loading';
  vm.runInContext('startStorySequenceAutoplay(STORY_AUTOPLAY_RANGES[3], 1); updateStorySequenceAutoplay(0, 1)',context);
  assert.equal(context.storySequenceAutoplayFrame,324);
  clip.state='ready';
  vm.runInContext('updateStorySequenceAutoplay(0, 1)',context);
  assert.ok(context.storySequenceAutoplayFrame>324 && context.storySequenceAutoplayFrame<424);
  assert.equal(context.storySequenceAutoplayActive,true);
  assert.equal(clip.frame,30);
  assert.equal(vm.runInContext('blockDesktopStoryWheel(performance.now())',context),true);
  vm.runInContext('updateStorySequenceAutoplay(0, 3)',context);
  assert.equal(context.storySequenceAutoplayActive,false);
  assert.equal(clip.frame,76);
  assert.equal(context.storySequenceLottie.style.opacity,'1');
  assert.equal(context.moodClipActive,false);
  context.smoothStorySequenceProgress=.95;
  vm.runInContext('updateStoryTextMotion()',context);
  assert.equal(clip.frame,76,'a later scroll calculation cannot change the held frame');
  const blocked=()=>vm.runInContext('blockDesktopStoryWheel(performance.now())',context);
  api.elapse(2450);
  assert.equal(blocked(),true);
  api.elapse(100);
  assert.equal(blocked(),true,'wheel inertia cannot dismiss the held frame');
  api.elapse(200);
  assert.equal(blocked(),false,'a fresh wheel gesture can advance');
});

test('touch holds the exact endpoint through a later scroll recalculation', () => {
  const {api,context}=controller();
  api.seek(api.state().sequenceEnd);
  api.swipe(30);
  finish(api);
  context.smoothStorySequenceProgress=.22;
  vm.runInContext('updateStoryTextMotion()',context);
  assert.equal(context.storyClips[0].frame,70);
  assert.equal(api.state().visibleClip,0);
  api.tick(2.6);
  api.swipe(5000);
  finish(api);
  assert.equal(api.state().visibleClip,1);
  assert.equal(context.storyClips[1].frame,79);
});

test('loaded exports include the completed type-on frames and share each corrected handoff', async () => {
  const files = ['square_01.json', 'square_02.json', 'square_03.json', 'square_04.json'];
  const exports = files.map(file => JSON.parse(fs.readFileSync(require('node:path').join(__dirname, '..', file), 'utf8')));
  const clips = files.map(() => ({}));
  const loaded = [];
  const context = vm.createContext({
    STORY_CLIP_FILES: files, storyClips: clips, MOBILE_RUNTIME: false, scrollingReady: false,
    document: { createElement: () => ({}) },
    storySequenceLottie: { appendChild() {} },
    fetch: async file => ({ ok: true, json: async () => structuredClone(exports[files.indexOf(file)]) }),
    AbortController, setTimeout, clearTimeout, console,
    clamp: (v,a,b) => Math.max(a,Math.min(b,v)),
    lottie: { loadAnimation({ animationData: data }) {
      loaded.push(data);
      return {
        totalFrames: data.op - data.ip, frameRate: data.fr,
        addEventListener(name, callback) {
          if (name !== 'data_failed') queueMicrotask(callback);
        }
      };
    } }
  });
  const ranges = html.slice(html.indexOf('const STORY_CLIP_SPAN ='), html.indexOf('const HOLD_ENV_HOTSPOT_IMAGE_WIDTH'));
  const loader = html.slice(html.indexOf('async function loadStoryClip('), html.indexOf('async function loadScrollAssets('));
  await vm.runInContext(ranges + loader + 'loadStorySequenceAssets()', context);
  for (const [index, name] of ['non-repeating woodgrain', 'WITHOUT REPETITION'].entries()) {
    const layer = exports[index].assets.flatMap(asset => asset.layers || []).find(layer => layer.nm === name);
    const revealEnd = Math.ceil(layer.t.a.find(animator => animator.nm === 'Animator - Type On (Opacity)').s.e.k.at(-1).t);
    assert.equal(clips[index].state, 'ready');
    assert.equal(loaded[index].ip + clips[index].readFrame, revealEnd);
    assert.equal(loaded[index + 1].ip, revealEnd);
  }
});
