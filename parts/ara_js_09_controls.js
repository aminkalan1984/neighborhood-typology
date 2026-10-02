/* ================= CONTROLS · LEGEND · KEYBOARD ================= */
function syncFlowLegend(){
  var rows=document.querySelectorAll('#leg .row');
  for(var i=0;i<rows.length;i++){
    var k=rows[i].getAttribute('data-flow');
    rows[i].classList.toggle('off',FLOW_ON[k]===false);
  }
}
function toggleFlow(k){FLOW_ON[k]=!FLOW_ON[k];syncFlowLegend();}
function bindFlowLegend(){
  var rows=document.querySelectorAll('#leg .row');
  for(var i=0;i<rows.length;i++){
    rows[i].addEventListener('click',function(){toggleFlow(this.getAttribute('data-flow'));});
  }
  syncFlowLegend();
}
function jump(i){i=clamp(i,0,SCENES.length-1);t=SCENES[i].t0+0.01;lastIdx=-1;}
function stepChapter(dir){
  var band=chapterBand(sceneAt(t));
  var target=dir>0?band.to+1:band.from-1;
  jump(clamp(target,0,SCENES.length-1));
}
function onKey(ev){
  var k=ev.key,ov,tag=(ev.target.tagName||'').toLowerCase();
  if(tag==='input'||tag==='textarea')return;
  /* number keys 1..6 toggle the six visible flow families */
  var map={'1':'source','2':'ingest','3':'store','4':'compute','5':'decision','6':'serve'};
  if(map[k])toggleFlow(map[k]);
  else if(k===' '){playing=!playing;if(ev.preventDefault)ev.preventDefault();}
  else if(k==='ArrowRight')t=Math.min(END,t+5);
  else if(k==='ArrowLeft')t=Math.max(0,t-5);
  else if(k==='ArrowUp')jump(sceneAt(t)+1);
  else if(k==='ArrowDown')jump(sceneAt(t)-1);
  else if(k==='PageUp')stepChapter(1);
  else if(k==='PageDown')stepChapter(-1);
  else if(k==='r'||k==='R'){t=0;lastIdx=-1;}
  else if(k==='+'||k==='=')speed=clamp(speed+0.25,0.25,3);
  else if(k==='-'||k==='_')speed=clamp(speed-0.25,0.25,3);
  else if(k==='e'||k==='E'){
    if(elExec){elExec.classList.toggle('on');elExec.setAttribute('aria-hidden',elExec.classList.contains('on')?'false':'true');}
  }
  else if(k==='c'||k==='C'){CINEMA=!CINEMA;document.body.classList.toggle('cinema-off',!CINEMA);}
  else if(k==='p'||k==='P'){
    if(elProcess){elProcess.classList.toggle('on');elProcess.setAttribute('aria-hidden',elProcess.classList.contains('on')?'false':'true');}
  }
  else if(k==='d'||k==='D'){
    if(elDrawer){elDrawer.classList.toggle('on');elDrawer.setAttribute('aria-hidden',elDrawer.classList.contains('on')?'false':'true');}
  }
  else if(k==='f'||k==='F'){
    if(document.fullscreenElement)document.exitFullscreen();
    else if(document.documentElement.requestFullscreen)document.documentElement.requestFullscreen();
  }
  else if(k==='h'||k==='H'){
    ov=document.getElementById('hud');
    if(ov)ov.style.display=(ov.style.display==='none')?'':'none';
  }
}
if(window.addEventListener){
  window.addEventListener('resize',resize);
  window.addEventListener('pointermove',function(ev){
    if(window.innerWidth<820)return;
    mouseDX=(ev.clientX/window.innerWidth-.5)*1.6;
    mouseDY=(ev.clientY/window.innerHeight-.5)*1.1;
    updateNodeHover(ev);
  },{passive:true});
  window.addEventListener('pointerleave',function(){
    mouseDX=mouseDY=0;
    if(elNodeTip)elNodeTip.classList.remove('on');
  });
  window.addEventListener('keydown',onKey);
}
buildChips();buildTicks();bindFlowLegend();
if(elProcClose)elProcClose.addEventListener('click',function(){
  elProcess.classList.remove('on');elProcess.setAttribute('aria-hidden','true');
});
var procBtns=document.querySelectorAll('#processOverlay [data-proc-scene]');
for(var pi=0;pi<procBtns.length;pi++){
  procBtns[pi].addEventListener('click',function(){
    jump(parseInt(this.getAttribute('data-proc-scene'),10));
    if(elProcess){elProcess.classList.remove('on');elProcess.setAttribute('aria-hidden','true');}
  });
}
resize();
if(elPlay&&elPlay.addEventListener)elPlay.addEventListener('click',function(){playing=!playing;});
if(elChip&&elChip.children){
  for(var ci=0;ci<elChip.children.length;ci++){
    (function(el){
      if(el&&el.addEventListener)el.addEventListener('click',function(){
        var target=el.getAttribute('data-ch'),i;
        for(i=0;i<SCENES.length;i++)if(SCENES[i].ch===target){jump(i);break;}
      });
    })(elChip.children[ci]);
  }
}
var tl=document.getElementById('track');
if(tl&&tl.addEventListener)tl.addEventListener('click',function(ev){
  var rc=tl.getBoundingClientRect?tl.getBoundingClientRect():{left:0,width:1};
  t=clamp((ev.clientX-rc.left)/rc.width,0,1)*END;lastIdx=-1;
});


/* ================= MOTION-DYNAMICS PANEL ================= */
(function(){
  var p=document.getElementById('mdPanel'),b=document.getElementById('motionTune'),
      range=document.getElementById('mdTrail'),camEl=document.getElementById('mdCamera'),
      ops=document.getElementById('mdOps'),sh=document.getElementById('mdShadow'),
      lab=document.getElementById('mdStateLabel');
  if(!p||!b)return;
  function sync(){
    if(camEl)camEl.classList.toggle('on',MD.camera);
    if(ops)ops.classList.toggle('on',MD.ops);
    if(sh)sh.classList.toggle('on',MD.shadow);
    if(lab)lab.textContent='رد '+faNum(Math.round(MD.trail*100))+'٪ · عملیات '+(MD.ops?'فعال':'خاموش');
  }
  b.onclick=function(){
    var on=!p.classList.contains('on');
    p.classList.toggle('on',on);
    p.setAttribute('aria-hidden',on?'false':'true');
    b.setAttribute('aria-expanded',on?'true':'false');
    var vt=document.getElementById('vtPanel');
    if(vt){vt.classList.remove('on');vt.setAttribute('aria-hidden','true');}
  };
  if(range)range.oninput=function(){MD.trail=clamp(parseInt(range.value,10)/100,0,1);sync();};
  if(camEl)camEl.onclick=function(){MD.camera=!MD.camera;sync();};
  if(ops)ops.onclick=function(){MD.ops=!MD.ops;sync();};
  if(sh)sh.onclick=function(){MD.shadow=!MD.shadow;sync();};
  if(range)MD.trail=clamp(parseInt(range.value,10)/100,0,1);
  sync();
  window.addEventListener('keydown',function(e){
    if(/input|textarea|select/i.test((e.target.tagName||'')))return;
    if((e.key==='g'||e.key==='G')&&!(document.getElementById('p4Hub')&&document.getElementById('p4Hub').classList.contains('on'))){
      e.preventDefault();b.click();
    }
  },true);
})();
/* ================= PRESENTATION THEMES ================= */
(function(){
  var body=document.body,p=document.getElementById('vtPanel'),
      launch=document.getElementById('themeTune'),label=document.getElementById('vtStateLabel');
  if(!p||!launch)return;
  var names={default:'سینمایی اصلی',mono:'Monochrome مدیریتی',light:'روشن',contrast:'کنتراست بالا'};
  var palette={bg:C.bg,g1:C.g1,g2:C.g2,ink:C.ink,dim:C.dim,
    src:C.src,ingest:C.ingest,store:C.store,kernel:C.kernel,analyze:C.analyze,
    decision:C.decision,serve:C.serve,risk:C.risk,rel:C.rel,
    bd:C.bd,bdL:C.bdL,bdD:C.bdD,tp:C.tp,tpL:C.tpL,
    hq:C.hq,port:C.port,gate:C.gate,pad:C.pad,twr:C.twr,warn:C.warn};
  function canvasTheme(mode){
    for(var k in palette)C[k]=palette[k];
    if(mode==='mono'){
      C.bg='#080a0d';C.g1='#15191f';C.g2='#252b33';C.ink='#f4f4f4';C.dim='#a4a8ad';
      C.src='#d7d7d7';C.ingest='#c9c9c9';C.store='#b4b4b4';C.kernel='#ededed';
      C.analyze='#f2f2f2';C.decision='#dadada';C.serve='#9aa0a6';C.risk='#ffffff';
      C.rel='#72777d';C.gate='#b7b7b7';
    }else if(mode==='light'){
      C.bg='#e9eff5';C.g1='#d6e0e9';C.g2='#bdcbd8';C.ink='#16273b';C.dim='#536b82';
      C.src='#007b9c';C.ingest='#127a55';C.store='#6a4fa3';C.kernel='#cc5f00';
      C.analyze='#a97700';C.decision='#c02a55';C.serve='#4d6f92';C.risk='#c62e46';
      C.rel='#75869a';C.bd='#b8c7d5';C.bdL='#93a9bc';C.bdD='#d6e0e9';
      C.tp='#7193ad';C.tpL='#456e8c';C.hq='#c77700';C.port='#4b8ca8';
      C.gate='#8059a0';C.pad='#a7b9c9';C.twr='#168c80';C.warn='#a86600';
    }else if(mode==='contrast'){
      C.bg='#000000';C.g1='#101010';C.g2='#484848';C.ink='#ffffff';C.dim='#ffffff';
      C.src='#00e5ff';C.ingest='#00ff8a';C.store='#d9a0ff';C.kernel='#ff9d00';
      C.analyze='#ffd000';C.decision='#ff5c8a';C.serve='#8fd6ff';C.risk='#ff3157';
      C.rel='#b7c8ff';C.bd='#111';C.bdL='#3b4b62';C.bdD='#000';
      C.tp='#39bfff';C.tpL='#fff';C.hq='#ffd000';C.port='#00c8ff';
      C.gate='#d9a0ff';C.pad='#203655';C.twr='#00ffd0';C.warn='#ffea00';
    }
    window.KCOL={source:C.src,ingest:C.ingest,store:C.store,compute:C.kernel,
                 decision:C.decision,serve:C.serve,audit:C.risk};
  }
  function apply(mode,save){
    if(!names[mode])mode='default';
    body.classList.remove('theme-mono','theme-light','theme-contrast');
    if(mode!=='default')body.classList.add('theme-'+mode);
    body.dataset.theme=mode;
    canvasTheme(mode);
    var modes=document.querySelectorAll('.vtMode');
    for(var i=0;i<modes.length;i++){
      var on=modes[i].dataset.theme===mode;
      modes[i].classList.toggle('on',on);
      modes[i].setAttribute('aria-checked',on?'true':'false');
    }
    if(label)label.textContent=names[mode];
    if(save){try{localStorage.setItem('ara-presentation-theme',mode)}catch(e){}}
    if(elLive)elLive.textContent='تم '+names[mode]+' فعال شد';
  }
  launch.onclick=function(){
    var on=!p.classList.contains('on');
    var mp=document.getElementById('mdPanel');
    if(mp){mp.classList.remove('on');mp.setAttribute('aria-hidden','true');
      var mb=document.getElementById('motionTune');if(mb)mb.setAttribute('aria-expanded','false');}
    p.classList.toggle('on',on);
    p.setAttribute('aria-hidden',on?'false':'true');
    launch.setAttribute('aria-expanded',on?'true':'false');
  };
  var modes=document.querySelectorAll('.vtMode');
  for(var i=0;i<modes.length;i++){
    modes[i].onclick=(function(btn){return function(){apply(btn.dataset.theme,true);};})(modes[i]);
  }
  window.addEventListener('keydown',function(e){
    if(/input|textarea|select/i.test((e.target.tagName||'')))return;
    if((e.key==='t'||e.key==='T')&&!(document.getElementById('p4Hub')&&document.getElementById('p4Hub').classList.contains('on'))){
      e.preventDefault();launch.click();
    }
  },true);
  var start='default';
  try{start=localStorage.getItem('ara-presentation-theme')||'default'}catch(e){}
  apply(start,false);
  window.setPresentationTheme=apply;
})();
/* ================= BOOT ================= */
requestAnimationFrame(frame);
