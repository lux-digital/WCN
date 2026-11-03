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

test('the touch Lottie preserves all animation data except shadow filters and the relative image path',()=>{
  const original=JSON.parse(fs.readFileSync(path.join(__dirname,'../square.json'),'utf8'));
  const mobile=JSON.parse(fs.readFileSync(path.join(__dirname,'../mobile/square.json'),'utf8'));
  let removed=0;
  for(const comp of [original,...original.assets])for(const layer of comp.layers||[]){
    if(!layer.ef)continue;
    const before=layer.ef.length;layer.ef=layer.ef.filter(effect=>effect.mn!=='ADBE Drop Shadow');
    removed+=before-layer.ef.length;if(!layer.ef.length)delete layer.ef;
  }
  for(const asset of original.assets){
    if(!asset.p||asset.e)continue;
    asset.u='../'+(asset.u||'');
    assert.ok(fs.existsSync(path.resolve(__dirname,'../mobile',asset.u,asset.p)));
  }
  assert.equal(removed,8);assert.deepEqual(mobile,original);
});
