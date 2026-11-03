const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { test } = require('node:test');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

test('mobile textures pan on an inner transform and preserve the authored crossfade layer', async () => {
  const element = () => ({ style:{transform:'translate3d(0,0,0)'}, dataset:{}, setAttribute(){}, prepend(child){this.child=child;} });
  const base=element(), incoming=element(), overlay=element();
  const context=vm.createContext({MOBILE_RUNTIME:true, woodLoopOffset:120,
    woodViewerStrip:base, woodViewerStripIncoming:incoming, woodViewerOverlay:overlay,
    document:{createElement:element}, console,
    ResizeObserver:class {constructor(callback){this.callback=callback;} observe(){this.callback([{contentRect:{width:500,height:100}}]);}},
    preloadMoodImage:async()=>({naturalWidth:2250,naturalHeight:435})
  });
  vm.runInContext(html.slice(html.indexOf('const touchWoodSurfaces ='),html.indexOf('function initWoodViewerInteraction()')),context);
  vm.runInContext('setWoodTexture(woodViewerStrip,"mobile/COASTAL SAND.webp");',context);
  await flush();
  const previous=base.child.style.transform;
  context.woodLoopOffset+=10;vm.runInContext('applyWoodViewerPanPosition()',context);
  assert.notEqual(base.child.style.transform,previous);
  assert.equal(base.style.backgroundImage,'none');
  assert.equal(base.style.backgroundPosition,undefined);
  assert.equal(base.style.transform,'translate3d(0,0,0)');
  assert.match(base.child.style.backgroundImage,/COASTAL%20SAND/);
  assert.ok(parseFloat(base.child.style.width)>500);
  vm.runInContext('setWoodTexture(woodViewerStrip,"")',context);
  assert.equal(base.child.style.backgroundImage,'none');
});

test('touch image loading has at most four workers, prioritizes demand, and bounds the cache', async () => {
  const pending=[];let active=0,maxActive=0;
  const context=vm.createContext({MOBILE_RUNTIME:true,MOBILE_SEQUENCE_CACHE_MAX:28,SCROLL_FRAME_COUNT:109,
    mobileSequenceDemandFrame:0,currentScrollFrame:0,mobileSequenceUse:new Map(),mobileSequenceUseTick:0,
    mobileSequenceLoads:new Map(),scrollFrames:Array(109).fill(null),maskFrames:Array(109).fill(null),
    clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),scrollImagePath:f=>f,
    loadImage:frame=>new Promise(resolve=>{active++;maxActive=Math.max(maxActive,active);pending.push({frame,done:()=>{active--;resolve({decode:async()=>{}});}});})
  });
  vm.runInContext(html.slice(html.indexOf('function markMobileSequenceFrameUsed('),html.indexOf('function prefetchMobileSequenceWindow(')),context);
  const requests=vm.runInContext('Array.from({length:109},(_,frame)=>loadMobileSequencePair(frame))',context);
  assert.equal(active,4);context.mobileSequenceDemandFrame=80;
  pending.shift().done();await flush();assert.equal(pending.at(-1).frame,80);
  while(pending.length){pending.shift().done();await flush();}
  await Promise.all(requests);
  assert.equal(maxActive,4);assert.equal(context.mobileSequenceLoads.size,0);
  assert.ok(context.scrollFrames.filter(Boolean).length<=28);
  assert.ok(context.scrollFrames[80]);assert.ok(context.scrollFrames[0]);
});

test('desktop texture paths remain unchanged', () => {
  const code=html.slice(html.indexOf('const touchImagePath ='),html.indexOf('if (MOBILE_RUNTIME) {',html.indexOf('const touchImagePath =')));
  const context=vm.createContext({MOBILE_RUNTIME:false});vm.runInContext(code,context);
  assert.equal(vm.runInContext('touchImagePath("NEO LUMBER/HEMLOCK.png")',context),'NEO LUMBER/HEMLOCK.png');
});

test('a paused visible touch background resumes without requiring another swipe or sound activation', () => {
  let visible=true,progress=1,plays=0;const video={tagName:'VIDEO',paused:true};
  const context=vm.createContext({MOBILE_RUNTIME:true,moodTransitioning:false,MOOD_VIDEO_START:.971,activeMoodIndex:0,
    mediaIsVisible:()=>visible,getMoodVisualProgress:()=>progress,getMoodMediaElement:()=>video,playMoodVideo:()=>plays++});
  vm.runInContext(html.slice(html.indexOf('function resumeVisibleMoodVideo()'),html.indexOf('function syncMoodMediaVisibility(')),context);
  vm.runInContext('resumeVisibleMoodVideo()',context);assert.equal(plays,1);
  visible=false;vm.runInContext('resumeVisibleMoodVideo()',context);assert.equal(plays,1);
  visible=true;progress=0;vm.runInContext('resumeVisibleMoodVideo()',context);assert.equal(plays,1);
  progress=1;video.paused=false;vm.runInContext('resumeVisibleMoodVideo()',context);assert.equal(plays,1);
});
