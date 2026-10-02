/* ================= CINEMATIC DETAIL · FX LAYERS ================= */
var scenePulse=0,mouseDX=0,mouseDY=0;
var CINEMA=true,REDUCED=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var DEEP_PARTICLES=[];
for(var dpi=0;dpi<36;dpi++)DEEP_PARTICLES.push({x:(dpi*137)%997/997,y:(dpi*281)%991/991,z:.25+(dpi%7)/9,p:dpi*.73});

/* per-node detail drawn on top of the archetype */
function drawNodeDetail(n,hl,tt){
  if(n.app<.2)return;
  var x=n.x,y=n.y,i,p;
  CX.save();
  if(n.kind==='src'){
    for(i=0;i<3;i++){
      var k=((tt*.22)+i/3)%1;
      CX.globalAlpha=(1-k)*(hl?0.4:0.14);
      CX.strokeStyle=hexa(C.info,0.9);CX.lineWidth=1;
      var a=iso(x-n.w*0.42,y-n.d*0.3+k*n.d*0.6,n.h*0.62+0.4),
          b=iso(x+n.w*0.42,y-n.d*0.3+k*n.d*0.6,n.h*0.62+0.4);
      CX.beginPath();CX.moveTo(a.x,a.y);CX.lineTo(b.x,b.y);CX.stroke();
    }
  }else if(n.kind==='store'){
    for(i=0;i<4;i++){
      p=iso(x-n.w*0.30+i*n.w*0.20,y+n.d*0.30,n.h*0.55);
      CX.globalAlpha=hl?0.55:0.2;
      CX.fillStyle=hexa(hl?C.info:n.col,0.8);
      CX.fillRect(p.x-1.2,p.y-3,2.4,6);
    }
  }else if(n.kind==='engine'){
    for(i=0;i<5;i++){
      var q=iso(x-n.w*0.32+i*n.w*0.16,y-n.d*0.5,n.h+1.4);
      CX.globalAlpha=hl?(0.35+0.5*Math.abs(Math.sin(tt*2.4+i))):0.14;
      CX.fillStyle=hexa(hl?C.info:C.analyze,0.9);
      CX.fillRect(q.x-0.9,q.y-2.4,1.8,4.8);
    }
  }else if(n.kind==='gate'){
    var gp=iso(x,y,n.h+2.2);
    CX.globalAlpha=hl?0.5:0.18;
    CX.strokeStyle=hexa(hl?C.info:C.gate,0.85);CX.lineWidth=1;
    CX.beginPath();CX.moveTo(gp.x-12,gp.y+4);CX.lineTo(gp.x+12,gp.y+4);CX.stroke();
  }else if(n.kind==='audit'){
    for(i=0;i<3;i++){
      CX.globalAlpha=0.16+0.06*i;
      CX.fillStyle=hexa(C.risk,0.7);
      CX.fillRect(iso(x,y,n.h+1.4).x-9+i*9,iso(x,y,n.h+1.4).y-1.2,5,1.6);
    }
  }
  CX.restore();
}
/* chevrons along a hot edge showing flow direction */
function drawEdgeChevrons(e,tt,col){
  var s=edgeScreen(e);if(s.length<2)return;
  var dashPos=REDUCED?0:(tt*22)%14;
  CX.save();
  for(var i=0;i<s.length-1;i++){
    var ax=s[i],bx=s[i+1];
    var vx=bx.x-ax.x,vy=bx.y-ax.y,L=Math.sqrt(vx*vx+vy*vy);
    if(L<10)continue;
    var ang=Math.atan2(vy,vx);
    for(var d=dashPos;d<L;d+=14){
      var u=d/L,mx=ax.x+vx*u,my=ax.y+vy*u;
      CX.globalAlpha=0.42*(0.4+0.6*Math.sin(Math.PI*u));
      CX.save();CX.translate(mx,my);CX.rotate(ang);
      CX.strokeStyle=hexa(col,.7);CX.lineWidth=1.1;
      CX.beginPath();CX.moveTo(-3,-3);CX.lineTo(1.8,0);CX.lineTo(-3,3);CX.stroke();
      CX.restore();
    }
  }
  CX.restore();
}


/* wake FX under a moving packet */
function drawMoverFX(k,x,y,tt,alarm){
  var col=alarm?C.risk:C.src,p=iso(x,y,0.12),i;
  CX.save();
  CX.globalAlpha=0.22;
  CX.strokeStyle=hexa(col,0.7);CX.lineWidth=1;
  CX.beginPath();CX.ellipse(p.x,p.y,6,2.6,0,0,6.2832);CX.stroke();
  if(k==='stream'){
    for(i=1;i<=3;i++){
      CX.globalAlpha=0.30/i;
      CX.fillStyle=hexa(col,0.9);
      CX.beginPath();CX.arc(p.x-i*4,p.y-i*1.2,1.8/i+0.5,0,6.2832);CX.fill();
    }
  }
  CX.restore();
}
/* detail overlay for the packet body */
function drawMoverDetail(k,x,y,tt,alarm){
  var p=iso(x,y,2.05),i,q;
  CX.save();
  if(k==='record'||k==='batch'){
    CX.strokeStyle='rgba(255,255,255,.42)';CX.lineWidth=.7;CX.globalAlpha=.65;
    var count=k==='batch'?4:3,span=k==='batch'?6:4.4;
    for(i=0;i<count;i++){
      q=iso(x-span*.38+i*(span*.76/(count-1)),y,2.1);
      CX.beginPath();CX.moveTo(q.x,q.y-4);CX.lineTo(q.x,q.y+4);CX.stroke();
    }
  }
  if(k==='table'){
    CX.strokeStyle='rgba(255,255,255,.38)';CX.lineWidth=.65;CX.globalAlpha=.6;
    for(i=-1;i<=1;i++){
      CX.beginPath();CX.moveTo(p.x-7,p.y+i*3.2);CX.lineTo(p.x+7,p.y+i*3.2);CX.stroke();
    }
  }
  CX.restore();
}
/* ultra detail: indicator lights per packet type */
function drawMoverUltraDetail(k,x,y,tt,alarm){
  if(!CINEMA)return;
  var p,i,q;
  CX.save();
  if(k==='record'||k==='batch'){
    for(i=-1;i<=1;i+=2){
      q=iso(x-1.6,y+i*.5,2.3);
      CX.fillStyle=hexa(i<0?C.risk:'#f6d365',.9);
      CX.shadowColor=CX.fillStyle;CX.shadowBlur=7;
      CX.beginPath();CX.arc(q.x,q.y,1.05,0,6.2832);CX.fill();
    }
  }else if(k==='stream'){
    p=iso(x,y,2.0);
    CX.fillStyle=hexa(C.info,.72);
    for(i=0;i<3;i++)CX.fillRect(p.x-4+i*3,p.y-1.6,2.0,3.2);
  }else if(k==='metric'){
    p=iso(x,y,3.2);
    CX.strokeStyle='rgba(255,255,255,.66)';CX.lineWidth=.7;
    CX.beginPath();CX.arc(p.x,p.y,2.2,0,6.2832);CX.stroke();
  }else if(k==='flag'){
    p=iso(x,y,5.0);
    CX.strokeStyle='rgba(255,255,255,.6)';CX.lineWidth=.7;
    CX.beginPath();CX.moveTo(p.x-5,p.y-5);CX.lineTo(p.x+5,p.y+5);CX.stroke();
  }else if(k==='doc'){
    p=iso(x,y,3.2);
    CX.strokeStyle='rgba(255,255,255,.7)';CX.lineWidth=.65;
    for(i=-1;i<=1;i++){
      CX.beginPath();CX.moveTo(p.x-2.6,p.y+i*2.4);CX.lineTo(p.x+2.6,p.y+i*2.4);CX.stroke();
    }
  }
  CX.restore();
}


/* orbit rings over the platform's control points */
function drawActiveOrbits(r,tt){
  var ids=['gateway','valid','kernel','publish','card','feedback'],n,p,rad,ang;
  CX.save();
  for(var i=0;i<ids.length;i++){
    if(!r.hot[ids[i]])continue;
    n=ND[ids[i]];if(!n)continue;
    p=iso(n.x,n.y,n.h+3);rad=12+i*2;ang=tt*(.45+i*.05);
    CX.strokeStyle='rgba(66,215,255,.14)';CX.lineWidth=1;
    CX.beginPath();CX.ellipse(p.x,p.y,rad,rad*.38,0,0,6.283);CX.stroke();
    CX.fillStyle='rgba(255,255,255,.72)';
    CX.beginPath();CX.arc(p.x+Math.cos(ang)*rad,p.y+Math.sin(ang)*rad*.38,1.6,0,6.283);CX.fill();
  }
  CX.restore();
}
/* vignette, evidence-state wash, grain */
function drawPostFX(r,tt){
  CX.save();
  var v=CX.createRadialGradient(W*.5,H*.5,Math.min(W,H)*.25,W*.5,H*.5,Math.max(W,H)*.72);
  v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.32)');
  CX.fillStyle=v;CX.fillRect(0,0,W,H);
  var tier=r.s.card.tr;
  if(tier==='CONFLICT'||tier==='PENDING'){
    CX.globalAlpha=.035+.025*Math.sin(tt*3);CX.fillStyle=C.risk;CX.fillRect(0,0,W,H);
  }
  if(scenePulse>0){
    CX.globalAlpha=scenePulse*.12;
    CX.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--sceneAccent')||C.info;
    CX.fillRect(0,0,W,H);scenePulse*=.90;
  }
  CX.globalAlpha=.035;CX.fillStyle='#fff';
  for(var i=0;i<18;i++){
    var x=((i*197+Math.floor(tt*6)*31)%W),y=((i*83+Math.floor(tt*4)*17)%H);
    CX.fillRect(x,y,.7,.7);
  }
  CX.restore();
}
/* scene-accent backdrop: silhouetted data racks + dashed horizon */
function drawWorldBackdrop(r,tt){
  if(!CINEMA)return;
  var ac=CHCOL[r.s.ch]||C.info;
  var g=CX.createLinearGradient(0,0,0,H*.72);
  g.addColorStop(0,hexa(ac,.055));
  g.addColorStop(.45,'rgba(7,13,24,.015)');
  g.addColorStop(1,'rgba(5,8,14,0)');
  CX.fillStyle=g;CX.fillRect(0,0,W,H*.76);
  var hy=H*.28;
  CX.save();CX.globalAlpha=.22;
  CX.strokeStyle=hexa(ac,.22);CX.lineWidth=.65;
  CX.setLineDash([2,10]);CX.lineDashOffset=REDUCED?0:-tt*2;
  CX.beginPath();CX.moveTo(W*.12,hy);CX.lineTo(W*.88,hy);CX.stroke();
  CX.setLineDash([]);
  for(var i=0;i<18;i++){
    var x=W*(.08+i*.049),h=8+(i*17)%42,w=8+(i%4)*5;
    CX.fillStyle='rgba(35,55,84,'+(.035+(i%3)*.012)+')';
    CX.fillRect(x,hy-h,w,h);
    if(i%3===0){CX.fillStyle=hexa(ac,.12);CX.fillRect(x+w*.5,hy-h+5,1,2);}
  }
  for(i=0;i<DEEP_PARTICLES.length;i++){
    var q=DEEP_PARTICLES[i];
    var px=q.x*W+mouseDX*10*q.z,py=q.y*H*.7+mouseDY*7*q.z;
    var a=.05+.12*(.5+.5*Math.sin((REDUCED?0:tt)*.24+q.p));
    CX.fillStyle=hexa(ac,a);
    CX.beginPath();CX.arc(px,py,.45+q.z,0,6.283);CX.fill();
  }
  CX.restore();
}
/* accent bloom on the ground under hot nodes */
function drawGroundBloom(r,tt){
  if(!CINEMA)return;
  var ac=CHCOL[r.s.ch]||C.info;
  CX.save();CX.globalCompositeOperation='screen';
  for(var i=0;i<NODES.length;i++){
    var n=NODES[i];if(!r.hot[n.id])continue;
    var p=iso(n.x,n.y,.05),rad=Math.max(18,n.w*cam.zoom*1.15);
    var g=CX.createRadialGradient(p.x,p.y,0,p.x,p.y,rad);
    g.addColorStop(0,hexa(ac,.12));g.addColorStop(.45,hexa(ac,.035));g.addColorStop(1,hexa(ac,0));
    CX.fillStyle=g;
    CX.beginPath();CX.ellipse(p.x,p.y,rad,rad*.28,0,0,6.283);CX.fill();
  }
  CX.restore();

/* travelling white-hot pulse along a hot edge */
function drawEdgeEnergy(e,tt,col){
  if(!CINEMA||e.kind==='audit')return;
  var s=edgeScreen(e);if(s.length<2)return;
  CX.save();CX.globalAlpha=.5;
  CX.strokeStyle=hexa('#ffffff',.5);CX.lineWidth=.55;
  CX.setLineDash([2,13]);CX.lineDashOffset=REDUCED?0:-tt*24;
  CX.beginPath();CX.moveTo(s[0].x,s[0].y);
  for(var i=1;i<s.length;i++)CX.lineTo(s[i].x,s[i].y);
  CX.stroke();CX.setLineDash([]);
  var u=REDUCED?.55:(tt*.16)%1,w=edgePosWorld(e,u);
  var p=iso(w.x,w.y,(e.kind==='decision'||e.kind==='serve')?2.7:.55);
  var g=CX.createRadialGradient(p.x,p.y,0,p.x,p.y,10);
  g.addColorStop(0,'rgba(255,255,255,.82)');
  g.addColorStop(.25,hexa(col,.48));
  g.addColorStop(1,hexa(col,0));
  CX.fillStyle=g;CX.beginPath();CX.arc(p.x,p.y,10,0,6.283);CX.fill();
  CX.restore();
}
/* light beam + hex badge over a hot node */
function drawNodeCinematic(n,hl,tt){
  if(!CINEMA||!hl)return;
  var ac=KCOL_ACCENT(n.kind);
  var ground=iso(n.x,n.y,.05),top=iso(n.x,n.y,n.h+5);
  var beam=CX.createLinearGradient(0,top.y,0,ground.y);
  beam.addColorStop(0,hexa(ac,0));
  beam.addColorStop(.55,hexa(ac,.075));
  beam.addColorStop(1,hexa(ac,.015));
  CX.save();CX.globalCompositeOperation='screen';
  CX.fillStyle=beam;
  CX.beginPath();
  CX.moveTo(top.x-5,top.y);CX.lineTo(top.x+5,top.y);
  CX.lineTo(ground.x+18,ground.y);CX.lineTo(ground.x-18,ground.y);
  CX.closePath();CX.fill();
  var p=iso(n.x,n.y,n.h+7.2),rr=6.5;
  CX.globalCompositeOperation='source-over';
  CX.fillStyle='rgba(5,11,20,.88)';
  CX.strokeStyle=hexa(ac,.72);CX.lineWidth=1;
  CX.beginPath();
  for(var k=0;k<6;k++){
    var a=-Math.PI/2+k*Math.PI/3,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr;
    if(k===0)CX.moveTo(x,y);else CX.lineTo(x,y);
  }
  CX.closePath();CX.fill();CX.stroke();
  CX.fillStyle=hexa(ac,.9);
  CX.beginPath();CX.arc(p.x,p.y,1.7,0,6.283);CX.fill();
  if(cam.zoom>7.4){
    setFont(6.5,700,false);CX.textAlign='center';
    CX.fillStyle='rgba(205,228,246,.62)';
    CX.fillText(KINDFA[n.kind]||'گره',p.x,p.y-10);
  }
  CX.restore();
}
function KCOL_ACCENT(kind){
  var map={src:'source',ingest:'ingest',store:'store',engine:'compute',
           decision:'decision',serve:'serve',audit:'audit',gate:'ingest',tower:'compute'};
  return KCOL[map[kind]||'compute']||C.info;
}
/* atmospheric fog + drifting data motes at the horizon */
function drawAtmosphericDepth(r,tt){
  if(!CINEMA)return;
  var ac=CHCOL[r.s.ch]||C.info;
  CX.save();
  var fog=CX.createLinearGradient(0,H*.58,0,H);
  fog.addColorStop(0,'rgba(5,8,14,0)');fog.addColorStop(1,hexa(ac,.035));
  CX.fillStyle=fog;CX.fillRect(0,H*.58,W,H*.42);
  CX.globalAlpha=.14;
  for(var i=0;i<10;i++){
    var x=((i*211+(REDUCED?0:tt*7))%(W+180))-90,y=H*.72+(i%4)*42;
    CX.strokeStyle=hexa(ac,.16);CX.lineWidth=.7;
    CX.beginPath();CX.moveTo(x,y);CX.lineTo(x+42,y-12);CX.stroke();
  }
  CX.restore();
}
/* cinematic corner frame */
function drawCinematicFrame(r,tt){
  if(!CINEMA||W<900)return;
  var ac=CHCOL[r.s.ch]||C.info,m=14,l=24;
  CX.save();CX.strokeStyle=hexa(ac,.2);CX.lineWidth=1;
  CX.beginPath();
  CX.moveTo(m,m+l);CX.lineTo(m,m);CX.lineTo(m+l,m);
  CX.moveTo(W-m-l,m);CX.lineTo(W-m,m);CX.lineTo(W-m,m+l);
  CX.moveTo(m,H-m-l);CX.lineTo(m,H-m);CX.lineTo(m+l,H-m);
  CX.moveTo(W-m-l,H-m);CX.lineTo(W-m,H-m);CX.lineTo(W-m,H-m-l);
  CX.stroke();CX.restore();
}
/* node hover tooltip */
function updateNodeHover(ev){
  if(!elNodeTip||window.innerWidth<820||(elExec&&elExec.classList.contains('on')))return;
  var best=null,bd=34*34;
  for(var i=0;i<NODES.length;i++){
    var n=NODES[i];
    if(n.app<.25)continue;
    var p=iso(n.x,n.y,n.h+2),dx=ev.clientX-p.x,dy=ev.clientY-p.y,d=dx*dx+dy*dy;
    if(d<bd){bd=d;best=n;}
  }
  if(best){
    elNodeTip.style.left=Math.min(ev.clientX,window.innerWidth-190)+'px';
    elNodeTip.style.top=Math.min(ev.clientY,window.innerHeight-100)+'px';
    elNodeTipType.textContent=KINDFA[best.kind]||'گره';
    elNodeTipName.textContent=best.fa;
    elNodeTipId.textContent=best.id.toUpperCase()+' · گرهٔ فعال جریان داده';
    elNodeTip.classList.add('on');

/* scene-context FX: scanning on gates, ripples on conflict, loops on feedback */
function drawContextFX(r,tt){
  CX.save();
  var n,p,rad,i;
  if(r.hot.gateway||r.hot.valid||r.hot.reject){
    n=r.hot.valid?ND.valid:(r.hot.gateway?ND.gateway:ND.reject);
    p=iso(n.x,n.y,n.h+8);
    var sweep=(Math.sin(tt*1.7)*.5+.5);
    var a1=p.x-80+160*sweep;
    var g=CX.createLinearGradient(a1-20,0,a1+20,0);
    g.addColorStop(0,'rgba(66,215,255,0)');
    g.addColorStop(.5,'rgba(66,215,255,.11)');
    g.addColorStop(1,'rgba(66,215,255,0)');
    CX.fillStyle=g;CX.fillRect(a1-20,p.y-90,40,140);
  }
  if(r.s.card.tr==='CONFLICT'||r.s.card.tr==='UNKNOWN'){
    n=ND.reject||ND.valid;
    p=iso(n.x,n.y,n.h+3);
    for(i=0;i<3;i++){
      rad=14+((tt*22+i*18)%54);
      CX.globalAlpha=(1-rad/70)*.32;
      CX.strokeStyle=C.risk;CX.lineWidth=1.2;
      CX.beginPath();CX.arc(p.x,p.y,rad,0,6.283);CX.stroke();
    }
  }
  if(r.hot.feedback||r.hot.api||r.hot.ui){
    n=ND.feedback||ND.api;
    p=iso(n.x,n.y,n.h+5);
    for(i=0;i<4;i++){
      var ang=tt*.8+i*1.57,rr=20;
      CX.globalAlpha=.75;CX.fillStyle=hexa(C.serve,.75);
      CX.beginPath();CX.arc(p.x+Math.cos(ang)*rr,p.y+Math.sin(ang)*rr*.38,2,0,6.283);CX.fill();
    }
  }
  CX.globalAlpha=1;
  CX.restore();
}

  }else elNodeTip.classList.remove('on');
}

}
