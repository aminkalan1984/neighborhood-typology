/* ================= STATE / SCENE RESOLUTION ================= */
var t=0,playing=true,last=0,speed=1;
function sceneAt(tt){
  for(var i=SCENES.length-1;i>=0;i--)if(tt>=SCENES[i].t0)return i;
  return 0;
}
function camTarget(tt){
  var i=sceneAt(tt),s=SCENES[i],nx=SCENES[Math.min(i+1,SCENES.length-1)];
  var loc=clamp((tt-s.t0)/s.d,0,1);
  var q=clamp((loc-0.62)/0.38,0,1);
  var k=ease(q);
  return {cx:lerp(s.cam.cx,nx.cam.cx,k),cy:lerp(s.cam.cy,nx.cam.cy,k),
          zoom:lerp(s.cam.zoom,nx.cam.zoom,easeIO(q)),
          rot:lerp(s.cam.rot,nx.cam.rot,k)};
}
function resolve(tt){
  var idx=sceneAt(tt),s=SCENES[idx],i,j,n,e,h,want;
  var hotSet={};
  for(i=0;i<s.hot.length;i++)hotSet[s.hot[i]]=1;
  /* progressive appearance: once introduced, a node or edge stays visible */
  var seen={};
  for(i=0;i<=idx;i++){
    h=SCENES[i].hot;
    for(j=0;j<h.length;j++)seen[h[j]]=1;
  }
  for(i=0;i<NODES.length;i++){
    n=NODES[i];
    want=hotSet[n.id]?1:(seen[n.id]?0.62:0.10);
    n.app+=(want-n.app)*0.10;
  }
  for(i=0;i<EDGES.length;i++){
    e=EDGES[i];
    want=hotSet[e.id]?1:(seen[e.id]?0.5:0.0);
    e.app+=(want-e.app)*0.10;
  }
  return {idx:idx,s:s,hot:hotSet,loc:clamp((tt-s.t0)/s.d,0,1),tier:s.card.tr};
}
/* ================= HUD (DOM) ================= */
var elTitle=document.getElementById('sTitle'),elSub=document.getElementById('sSub'),
    elChip=document.getElementById('chips'),elCard=document.getElementById('cardTx'),
    elTier=document.getElementById('cardTier'),elSrc=document.getElementById('cardSrc'),
    elBar=document.getElementById('bar'),elClock=document.getElementById('clock'),
    elIdx=document.getElementById('sIdx'),elOpen=document.getElementById('openLay'),
    elEnd=document.getElementById('endLay'),elMetricValue=document.getElementById('metricValue'),
    elMetricLabel=document.getElementById('metricLabel'),elMetricMeta=document.getElementById('metricMeta'),
    elMetricFill=document.getElementById('metricFill'),elLensRole=document.getElementById('lensRole'),
    elLensOutput=document.getElementById('lensOutput'),elLensControl=document.getElementById('lensControl'),
    elLensFail=document.getElementById('lensFail'),elMissionEta=document.getElementById('missionEta'),
    elMissionRoute=document.getElementById('missionRoute'),elPlay=document.getElementById('playBtn'),
    elFlash=document.getElementById('sceneFlash'),elFlashNo=document.getElementById('flashNo'),
    elFlashTitle=document.getElementById('flashTitle'),elFlashChapter=document.getElementById('flashChapter'),
    elDrawer=document.getElementById('dataDrawer'),elDrawerTitle=document.getElementById('drawerTitle'),
    elDrawerRows=document.getElementById('drawerRows'),elTr0=document.getElementById('tr0'),
    elTr1=document.getElementById('tr1'),elTr2=document.getElementById('tr2'),
    elViz=document.getElementById('miniViz'),elVizTitle=document.getElementById('vizTitle'),
    elVizRows=document.getElementById('vizRows'),elChapterName=document.getElementById('chapterName'),
    elChapterCount=document.getElementById('chapterCount'),elExec=document.getElementById('execOverlay'),
    elGauge=document.getElementById('gArc'),elGaugeText=document.getElementById('gText'),
    elLetter=document.getElementById('letterbox'),elNodeTip=document.getElementById('nodeTip'),
    elNodeTipType=document.getElementById('nodeTipType'),elNodeTipName=document.getElementById('nodeTipName'),
    elNodeTipId=document.getElementById('nodeTipId'),elProcess=document.getElementById('processOverlay'),
    elProcClose=document.getElementById('procClose'),elLive=document.getElementById('live');
var chipsBuilt=false,lastIdx=-1;
function buildChips(){
  if(chipsBuilt||!elChip)return;chipsBuilt=true;
  var seenCh=[],i,html='';
  for(i=0;i<SCENES.length;i++)if(seenCh.indexOf(SCENES[i].ch)<0)seenCh.push(SCENES[i].ch);
  for(i=0;i<seenCh.length;i++)html+='<span class="chip" data-ch="'+seenCh[i]+'">'+seenCh[i]+'</span>';
  elChip.innerHTML=html;
}
function fmt(x){
  var m=Math.floor(x/60),s=Math.floor(x%60);
  return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}
function triggerSceneTransition(r){
  scenePulse=1;
  if(elLetter){elLetter.classList.remove('kick');void elLetter.offsetWidth;elLetter.classList.add('kick');}
  if(elFlash){
    elFlashNo.textContent=(r.idx+1<10?'0':'')+(r.idx+1);
    elFlashTitle.textContent=r.s.ti;
    elFlashChapter.textContent=r.s.ch;
    elFlash.classList.remove('go');void elFlash.offsetWidth;elFlash.classList.add('go');
  }
  ['head','card','metric'].forEach(function(id){
    var x=document.getElementById(id);
    if(x){x.classList.remove('scene-kick');void x.offsetWidth;x.classList.add('scene-kick');}
  });
}
function updateDeepData(r,ln,mx,tr){
  if(elDrawerTitle)elDrawerTitle.textContent=faNum(r.idx+1)+' — '+r.s.ti.replace(/^.*?—\s*/,'');
  if(elDrawerRows)elDrawerRows.innerHTML=
    '<div><span>CHAPTER</span><b>'+r.s.ch+'</b></div>'+
    '<div><span>OWNER / WHO</span><b>'+ln.r+'</b></div>'+
    '<div><span>خروجی</span><b>'+ln.o+'</b></div>'+
    '<div><span>کنترل</span><b>'+ln.c+'</b></div>'+
    '<div><span>FAILURE MODE</span><b>'+ln.f+'</b></div>'+
    '<div><span>METRIC</span><b>'+mx[0]+' · '+mx[1]+'</b></div>'+
    '<div><span>EVIDENCE</span><b>'+r.s.card.sr+'</b></div>'+
    '<div><span>TRACE IDs</span><b>'+tr.join(' · ')+'</b></div>';
}
function buildTicks(){
  var box=document.getElementById('ticks');if(!box)return;
  var h='',prev='';
  for(var i=0;i<SCENES.length;i++){
    var major=SCENES[i].ch!==prev;prev=SCENES[i].ch;
    h+='<i class="tick'+(major?' major':'')+'" data-i="'+i+'" style="left:'+(SCENES[i].t0/END*100).toFixed(3)+'%"></i>';
  }
  box.innerHTML=h;
}


/* ---- chapter band helper ---- */
function chapterBand(idx){
  var a=idx,b=idx,ch=SCENES[idx].ch;
  while(a>0&&SCENES[a-1].ch===ch)a--;
  while(b<SCENES.length-1&&SCENES[b+1].ch===ch)b++;
  return {from:a,to:b,pos:idx-a+1,total:b-a+1};
}
/* ---- HUD ---- */
function updHUD(r){
  if(r.idx!==lastIdx){
    lastIdx=r.idx;triggerSceneTransition(r);
    if(elTitle)elTitle.textContent=r.s.ti;
    if(elSub)elSub.textContent=r.s.sb;
    if(elIdx)elIdx.textContent=(r.idx+1)+' / '+SCENES.length;
    if(elCard)elCard.textContent=r.s.card.tx;
    if(elTier){
      elTier.textContent=TIERFA[r.s.card.tr]||r.s.card.tr;
      elTier.style.color=TIERCOL[r.s.card.tr];
      elTier.style.borderColor=TIERCOL[r.s.card.tr];
      elTier.style.background=hexa(TIERCOL[r.s.card.tr],0.10);
    }
    if(elSrc)elSrc.textContent='منبع: '+r.s.card.sr;
    var mx=SCENE_METRICS[r.idx],ln=SCENE_LENS[r.idx];
    if(mx){
      if(elMetricValue)elMetricValue.textContent=mx[0];
      if(elMetricLabel)elMetricLabel.textContent=mx[1];
      if(elMetricMeta)elMetricMeta.textContent=mx[2];
      if(elMetricFill)elMetricFill.style.width=mx[3]+'%';
      if(elGauge){
        elGauge.style.strokeDashoffset=(106.82*(1-mx[3]/100)).toFixed(2);
        if(elGaugeText)elGaugeText.textContent=mx[3];
      }
    }
    if(ln){
      if(elLensRole)elLensRole.textContent=ln.r;
      if(elLensOutput)elLensOutput.textContent=ln.o;
      if(elLensControl)elLensControl.textContent=ln.c;
      if(elLensFail)elLensFail.textContent=ln.f;
    }
    var tr=SCENE_TRACE[r.idx]||[];
    if(elTr0)elTr0.textContent=tr[0]||'—';
    if(elTr1)elTr1.textContent=tr[1]||'—';
    if(elTr2)elTr2.textContent=tr[2]||'—';
    updateDeepData(r,ln,mx,tr);
    var vz=SCENE_VIZ[r.idx];
    if(elViz){
      elViz.classList.toggle('on',!!vz);
      if(vz){
        elVizTitle.textContent=vz.title;
        var vh='';
        for(var vi=0;vi<vz.items.length;vi++){
          var it=vz.items[vi];
          vh+='<div class="vizRow"><label>'+it[0]+'</label>'+
              '<div class="vizTrack"><i class="vizFill" style="width:'+it[1]+'%"></i></div>'+
              '<em>'+it[2]+'</em></div>';
        }
        elVizRows.innerHTML=vh;
      }
    }
    var ac=CHCOL[r.s.ch]||'#42d7ff';
    document.documentElement.style.setProperty('--sceneAccent',ac);
    var band=chapterBand(r.idx);
    document.documentElement.style.setProperty('--chapterPct',(band.pos/band.total*100)+'%');
    if(elChapterName)elChapterName.textContent=r.s.ch;
    if(elChapterCount)elChapterCount.textContent=band.pos+' / '+band.total;
    if(elMissionEta)elMissionEta.textContent=(r.s.card.tr==='CONFLICT')?'تعارض داده':(r.s.card.tr==='UNKNOWN'?'کمبود پوشش':(r.idx>63?'ممیزی‌شده':(r.idx>55?'دروازهٔ انتشار':(r.idx>34?'محاسبه‌شده':'خام‌ورودی'))));
    if(elMissionRoute)elMissionRoute.textContent=chapterRoute(r.s.ch);
    if(elChip){
      var cs=elChip.children;
      for(var ci=0;ci<cs.length;ci++)cs[ci].className='chip'+(cs[ci].getAttribute('data-ch')===r.s.ch?' on':'');
    }
  }
  if(elBar)elBar.style.width=(t/END*100).toFixed(2)+'%';
  var tk=document.querySelectorAll('#ticks .tick');
  for(var ti=0;ti<tk.length;ti++)tk[ti].classList.toggle('active',ti===r.idx);
  if(elClock)elClock.textContent=fmt(t)+' / '+fmt(END);
  if(elPlay)elPlay.textContent=playing?'Ⅱ':'▶';
  if(elOpen)elOpen.style.opacity=String(clamp(1-Math.max(0,t-3.0)/1.6,0,1));
  if(elEnd)elEnd.style.opacity=String(clamp((t-(END-6.5))/2.2,0,1));
}

/* ================= FRAME ================= */
function resize(){
  DPR=Math.min(window.devicePixelRatio||1,2);
  W=CV.clientWidth||window.innerWidth||1280;
  H=CV.clientHeight||window.innerHeight||720;
  CV.width=Math.round(W*DPR);CV.height=Math.round(H*DPR);
  CX.setTransform(DPR,0,0,DPR,0,0);
}
function frame(ts){
  if(!last)last=ts;
  var dt=Math.min((ts-last)/1000,0.1);last=ts;
  if(playing)t+=dt*speed;
  if(t>END)t=END;
  var r=resolve(t);
  var ct=camTarget(t);
  ct=mdCameraTarget(r,ct);
  cam.cx+=(ct.cx+mouseDX*.75-cam.cx)*0.055;
  cam.cy+=(ct.cy+mouseDY*.42-cam.cy)*0.055;
  cam.zoom+=(ct.zoom-cam.zoom)*0.05;
  cam.rot+=(ct.rot+Math.sin(t*0.09)*0.018-cam.rot)*0.04;
  /* paint */
  CX.fillStyle=C.bg;CX.fillRect(0,0,W,H);
  drawAmbient(t);drawWorldBackdrop(r,t);drawScanSweep(t);
  var gg=CX.createRadialGradient(W*0.5,H*0.52,10,W*0.5,H*0.52,Math.max(W,H)*0.75);
  gg.addColorStop(0,'rgba(24,42,78,0.34)');gg.addColorStop(1,'rgba(5,8,14,0)');
  CX.fillStyle=gg;CX.fillRect(0,0,W,H);
  drawGrid();drawDataPlane(t);drawZoneLabels();drawGroundBloom(r,t);
  var alarm=(r.s.card.tr==='CONFLICT'||r.s.card.tr==='UNKNOWN')&&(r.loc>0.28);
  var i,n,e,u,wp;
  for(i=0;i<EDGES.length;i++){
    drawEdge(EDGES[i],!!r.hot[EDGES[i].id],t,alarm&&EDGES[i].kind==='ingest'&&!!r.hot[EDGES[i].id]);
    mdTypedFlow(EDGES[i],t,!!r.hot[EDGES[i].id]);
  }
  var order=NODES.slice().sort(function(a,b){return iso(a.x,a.y,0).d-iso(b.x,b.y,0).d;});
  for(i=0;i<order.length;i++){
    n=order[i];
    drawNode(n,!!r.hot[n.id],t,alarm&&(n.id==='valid'||n.id==='reject'));
    drawNodeDetail(n,!!r.hot[n.id],t);
    drawNodeCinematic(n,!!r.hot[n.id],t);
    if(r.hot[n.id])drawFocusBracket(n);
  }
  mdOperationalLayer(r,t);
  /* flowing packets, derived from the scene's hot edges */
  var flow=sceneMovers(r);
  for(i=0;i<flow.length;i++){
    e=flow[i];
    if(!e)continue;
    var kind=moverKind(e.kind);
    var raw=clamp((r.loc-0.06-i*0.03)/0.82,0,1);
    var shaped=mdProgress(raw,e,kind),prev=mdProgress(Math.max(0,raw-.012),e,kind);
    u=lerp(0.04,0.96,shaped);wp=edgePosWorld(e,u);
    mdDrawMover(kind,e,wp,u,t,alarm&&(kind==='alert'),Math.abs(shaped-prev)/.012,r);
  }
  drawActiveOrbits(r,t);drawContextFX(r,t);drawTelemetry(r);
  drawAtmosphericDepth(r,t);drawPostFX(r,t);drawCinematicFrame(r,t);
  updHUD(r);
  requestAnimationFrame(frame);
}

function chapterRoute(ch){
  var m={'بنیان':'SRC › GATE › KERNEL › CARD','منابع داده':'۷ خانوادهٔ منبع',
         'ورود داده':'MANIFEST › FETCH › VALIDATE','رجیستری':'REG-419 › REG-164 › REG-CORE',
         'هستهٔ محاسبات':'NORMALIZE › WEIGHT › CHAIN','کیفیت داده':'Q · T · R جدا',
         'موتور تحلیل':'RULE › BOTTLE › EQUITY','تصمیم و انتشار':'CARD › GATE › PUBLISH',
         'سرو و رابط':'API › UI › FEEDBACK','حاکمیت و ردیابی':'VERSION › TRACE › RULE',
         'بلوغ':'ROADMAP › GAP › NEXT'};
  return m[ch]||'SRC › GATE › KERNEL › CARD';
}
