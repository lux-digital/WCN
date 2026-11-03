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
    'BACKGROUND_AUTOPLAY_START_FRAME', 'HERO_TYPE_CONTINUE_END_FRAME'];
  // Dependencies precede their consumers.
  const ordered = names.filter(n => n !== 'HERO_TYPE_CONTINUE_END_FRAME').concat('HERO_TYPE_CONTINUE_END_FRAME');
  let declarations = '';
  for (const name of ordered) {
    const expression = html.match(new RegExp('\\b' + name + '\\s*=\\s*([^;\\n,]+)'));
    assert.ok(expression, name);
    declarations += `const ${name} = ${expression[1]};\n`;
  }
  declarations += html.slice(html.indexOf('const STORY_AUTOPLAY_RANGES ='), html.indexOf('];', html.indexOf('const STORY_AUTOPLAY_RANGES =')) + 2);
  const context = vm.createContext({
    performance: { now: () => 1000 }, MOBILE_RUNTIME: true, scrollingReady: true, storySquareLottieReady: true,
    wcnFast: { active: false, starting: false }, parentOverlayActive: false, parentScrollHandoffEnabled: true, parentHandoffRate: 1,
    viewportHeight: 1000, mobileSequenceDirection: 1, scrollFrames: Array(109).fill({}), currentScrollFrame: -1,
    moodClipComplete: false, moodClipActive: false, paints: [], handoffs: [],
    clamp: (v,a,b) => Math.max(a,Math.min(b,v)), lerp: (a,b,t) => a+(b-a)*t,
    rangeProgress: (v,a,b) => Math.max(0,Math.min(1,(v-a)/(b-a))), smootherstep01: x=>x*x*x*(x*(6*x-15)+10),
    clearMoodExitSettle(){}, clearMoodReturnHold(){}, beginMoodExitSettle(){},
    notifyParentMoodHandoffReady(){}, postElementorHandoffMessage(type){ context.handoffs.push(type); },
    loadMobileSequencePair: () => new Promise(()=>{}), prefetchMobileSequenceWindow(){},
    renderFrame: f=>context.paints.push(f), updatePanoramaOpacity(){}, updateHeroScrollTypography(){},
    updateOpeningTextLottie(){}, updateTextMode(){}, updateStoryTextMotion(){}, updateMoodSectionMotion(){}
  });
  vm.runInContext(declarations + '\n' +
    html.slice(html.indexOf('const TOUCH_FLOW ='), html.indexOf('function updateTouchHoldEnvironment')) + '\n' +
    `function storyFrameToRawProgress(frame) { return STORY_SEQUENCE_START + (STORY_SEQUENCE_END - STORY_SEQUENCE_START) * frame / STORY_LAST_FRAME; }
     globalThis.api = {
       state: () => ({ position: touchFlow.position, displayed: touchFlow.displayedPosition,
         frame: currentScrollFrame, story: touchStoryFrameAt(touchFlow.displayedPosition),
         clip: touchFlow.autoplay && {...touchFlow.autoplay}, complete: moodClipComplete,
         hold: TOUCH_HOLD_POSITION, end: TOUCH_END_POSITION, sequenceEnd: TOUCH_FLOW.sequenceEnd }),
       seek: p => { touchFlow.autoplay = null; setTouchPosition(p); updateTouchTimeline(true); },
       swipe: px => { advanceTouchTimeline(px, {stopped:false}); updateTouchTimeline(); },
       tick: dt => { updateTouchAutoplay(dt); updateTouchTimeline(); },
       raw: touchRawAt, position: touchPositionAtRaw, framePosition: touchPositionAtStoryFrame
     };`, context);
  context.api.seek(0);
  return { api:context.api, context };
}

function finish(api) { for(let i=0;i<1000 && api.state().clip;i++) api.tick(1/60); assert.equal(api.state().clip,null); }

test('all inline scripts parse', () => {
  for(const m of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(m[1]);
});

test('main images remain manual; first section needs 800px of travel at a 1000px viewport', () => {
  const {api}=controller(); api.swipe(400); const frame=api.state().frame;
  assert.ok(frame >= 29 && frame <= 31);
  for(let i=0;i<240;i++) api.tick(1/60);
  assert.equal(api.state().frame,frame); assert.equal(api.state().clip,null);
  api.swipe(410); assert.equal(api.state().clip.id,'first'); assert.equal(api.state().frame,60);
});

test('all five story clips autoplay in both directions without moving the image sequence', () => {
  const {api}=controller();
  for(const direction of [1,-1]) {
    if(direction===1) api.seek(0); else api.seek(api.state().hold);
    const ranges=direction===1?['first','mid','third','fourth','fifth']:['fifth','fourth','third','mid','first'];
    for(const id of ranges) {
      api.swipe(direction*5000);
      const s=api.state(); assert.equal(s.clip.id,id);
      finish(api); assert.equal(api.state().frame,s.frame,'background must wait for a swipe');
      assert.notEqual(api.state().story,s.story);
    }
  }
  assert.equal(api.state().story,0); api.swipe(-5000); assert.equal(api.state().frame,0);
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
  const {api}=controller(); api.swipe(5000); for(let i=0;i<35;i++)api.tick(1/60);
  const from=api.state(); api.swipe(-30); assert.equal(api.state().position,from.position);
  api.tick(1/60); assert.ok(api.state().position<from.position); finish(api);
  assert.equal(api.state().story,0); api.swipe(50); assert.equal(api.state().clip.id,'first'); finish(api);
  assert.equal(Math.round(api.state().story),72);
});

test('loading and parent overlay do not silently advance autoplay', () => {
  const {api,context}=controller(); context.scrollFrames[60]=null;
  api.swipe(5000); const start=api.state().position;
  for(let i=0;i<120;i++)api.tick(1/60); assert.equal(api.state().position,start);
  context.scrollFrames[60]={}; api.tick(1/60); api.tick(1/60); assert.ok(api.state().position>start);
  context.parentOverlayActive=true; const position=api.state().position; for(let i=0;i<120;i++)api.tick(1/60);
  assert.equal(api.state().position,position);
});

test('timeline coordinates remain reversible throughout the experience', () => {
  const {api}=controller(); for(let i=0;i<=1000;i++) {
    const p=i/1000*api.state().end; assert.ok(Math.abs(api.position(api.raw(p))-p)<1e-8);
  }
});
