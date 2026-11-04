const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

test('opening buttons and volume are positioned together before appearing, even while desktop assets load',()=>{
  let artworkBottom=550;const seen=[];
  const style=()=>({setProperty(key,value){this[key]=value;}});
  const links={style:{top:'calc(100% - 245px)'},querySelectorAll:()=>[{offsetHeight:40},{offsetHeight:40}]};
  const classes=new Set();
  const volume={style:{},classList:{contains:x=>classes.has(x),add(x){
    if(x==='is-ready')assertOrdered('volume appears');classes.add(x);
  }}};
  function assertOrdered(label){
    assert.ok(Number.isFinite(parseFloat(links.style.top)),label);
    assert.ok(parseFloat(volume.style.top)>parseFloat(links.style.top)+20,label);
    seen.push(label);
  }
  const context=vm.createContext({MOBILE_RUNTIME:false,scrollingReady:false,volumeDocked:false,
    stage:{getBoundingClientRect:()=>({top:0,bottom:1000,height:1000})},
    openingTextReady:false,heroTextInner:{getBoundingClientRect:()=>({bottom:artworkBottom})},
    heroText:{animate(){assertOrdered('hero starts');return {}; }},
    document:{getElementById:()=>links},volumeControl:volume,
    volumeButton:{offsetHeight:58,animate(){assertOrdered('volume animates');return {}; }},
    scrollIndicator:{style:style()},wcnFastAnimateButtonsEntrance(){assertOrdered('buttons appear');},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v))
  });
  vm.runInContext(html.slice(html.indexOf('function animateHeroText()'),html.indexOf('/* The new volume control never joins')),context);
  vm.runInContext('animateHeroText()',context);assert.equal(seen.length,4);
  artworkBottom=610;vm.runInContext('syncVolumeOpeningGap()',context);assertOrdered('loading frame');
  context.scrollingReady=true;vm.runInContext('syncVolumeOpeningGap()',context);assertOrdered('ready frame');
  const before=volume.style.top;context.volumeDocked=true;
  vm.runInContext('syncOpeningControlsLayout()',context);assert.equal(volume.style.top,before,'opening layout must not reposition a docked speaker');
});

test('opening buttons remain below the rendered text on a compact viewport',()=>{
  const style=()=>({setProperty(key,value){this[key]=value;}});
  const links={style:{},querySelectorAll:()=>[{offsetHeight:38},{offsetHeight:38}]};
  const group=(bottom)=>({tagName:'g',getBoundingClientRect:()=>({bottom,width:180,height:45})});
  const context=vm.createContext({
    MOBILE_RUNTIME:true,volumeDocked:false,openingTextReady:true,
    openingTextLottie:{querySelector:()=>({children:[group(275),group(360)]})},
    stage:{getBoundingClientRect:()=>({top:100,bottom:625,height:525})},
    document:{getElementById:()=>links},getComputedStyle:()=>({getPropertyValue:()=>'118px'}),
    volumeButton:{offsetHeight:54},volumeControl:{style:{}},scrollIndicator:{style:style()},
    clamp:(v,a,b)=>Math.max(a,Math.min(b,v))
  });
  vm.runInContext(html.slice(html.indexOf('function getOpeningArtworkBottom'),html.indexOf('/* The new volume control never joins')),context);
  vm.runInContext('syncOpeningControlsLayout()',context);
  const buttonTop=100+parseFloat(links.style.top)-19;
  assert.ok(buttonTop>=368,'allow text clearance even when the cue must shrink');
  assert.ok(parseFloat(context.volumeControl.style.top)>parseFloat(links.style.top)+19);
});
