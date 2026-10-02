/* ===== MOTION DYNAMICS ENGINE 2.0 · ARA DATA-FLOW ===== */
var MD={trail:.62,camera:true,ops:true,shadow:true};
function mdSmoother(x){x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10)}
function mdProgress(raw,e,k){
  raw=clamp(raw,0,1);
  if(REDUCED)return raw;
  var base=mdSmoother(raw);
  if(!e||e.pts.length<3||k==='doc'||k==='metric'||k==='flag'||k==='query'||k==='alert')return base;
  var stops=[.27,.62],hold=.055;
  for(var i=0;i<stops.length;i++){
    var d=base-stops[i];
    if(Math.abs(d)<hold){
      var z=d/hold;
      base=stops[i]+Math.sign(z)*hold*mdSmoother(Math.abs(z))*.22;
    }
  }
  return clamp(base,0,1);
}
function mdCameraTarget(r,base){
  if(!MD.camera||REDUCED||!r||!r.s)return base;
  var ids=r.s.hot.filter(function(id){return ND[id]&&ED[id]==null}),nodes=[];
  for(var i=0;i<ids.length;i++){
    if(ND[ids[i]]&&nodes.indexOf(ND[ids[i]])<0)nodes.push(ND[ids[i]]);
  }
  if(nodes.length<2)return base;
  var a=nodes[0],b=nodes[nodes.length-1];
  var phase=mdSmoother(clamp((r.loc-.12)/.72,0,1));
  var focus={cx:lerp(a.x,b.x,phase),cy:lerp(a.y,b.y,phase),
             zoom:Math.max(base.zoom,Math.min(10.8,7.8+1.2*Math.sin(Math.PI*phase)))};
  var mix=.23*Math.sin(Math.PI*clamp((r.loc-.05)/.9,0,1));
  return {cx:lerp(base.cx,focus.cx,mix),cy:lerp(base.cy,focus.cy,mix),
          zoom:lerp(base.zoom,focus.zoom,mix*.65),
          rot:base.rot+Math.sin(phase*Math.PI)*.012};
}
function mdShadow(x,y,k,velocity){
  if(!MD.shadow)return;
  var p=iso(x,y,.05);
  var long=k==='batch'?26:k==='table'?24:k==='stream'?14:k==='flag'?12:9,
      wide=k==='batch'?6:k==='table'?6:4,
      off=4+velocity*9;
  CX.save();
  CX.globalAlpha=.16+.12*clamp(velocity,0,1);
  CX.filter='blur(3px)';CX.fillStyle='#000';
  CX.beginPath();
  CX.ellipse(p.x+off,p.y+off*.42,long*cam.zoom/9,wide*cam.zoom/9,0,0,6.283);
  CX.fill();CX.restore();
}
function mdTrail(e,u,k,alarm){
  if(MD.trail<=.01||REDUCED||!e)return;
  var col=alarm?C.risk:(k==='doc'||k==='query'?C.info:k==='metric'?C.analyze:C.src);
  var n=Math.max(3,Math.round(13*MD.trail)),step=.012+.045*MD.trail;
  CX.save();CX.lineCap='round';
  for(var j=n;j>0;j--){
    var q=edgePosWorld(e,Math.max(0,u-j*step/n));
    var p=iso(q.x,q.y,(k==='metric'||k==='flag')?2.8:.35);
    CX.globalAlpha=(1-j/(n+1))*.32*MD.trail;
    CX.fillStyle=col;
    var r=(k==='batch'?2.9:k==='table'?2.6:1.5)*(1-j/(n+2));
    CX.beginPath();CX.arc(p.x,p.y,Math.max(.4,r),0,6.283);CX.fill();
  }
  CX.restore();
}
/* typed in-flight packets, drawn along every hot edge */
function mdTypedFlow(e,tt,hot){
  if(!hot||e.kind==='audit'||REDUCED)return;
  if(FLOW_ON[e.kind]===false)return;
  var col=KCOL[e.kind];
  var speed=e.kind==='decision'?.075:e.kind==='serve'?.16:.11;
  var count=e.kind==='decision'?3:4,z=(e.kind==='decision'||e.kind==='serve')?2.8:0.65;
  CX.save();
  for(var i=0;i<count;i++){
    var u=(tt*speed+i/count)%1,w=edgePosWorld(e,u),p=iso(w.x,w.y,z),r=2.5;
    CX.globalAlpha=.52;
    CX.strokeStyle=col;CX.fillStyle=hexa(col,.58);CX.lineWidth=1;
    if(e.kind==='decision'){
      CX.beginPath();
      CX.moveTo(p.x,p.y-3.2-Math.sin(tt*3+i)*1.6);CX.lineTo(p.x+3.2,p.y);
      CX.lineTo(p.x,p.y+3.2);CX.lineTo(p.x-3.2,p.y);CX.closePath();CX.stroke();
    }else if(e.kind==='serve'){
      CX.save();CX.translate(p.x,p.y);CX.rotate(tt*1.6+i);
      CX.strokeRect(-r,-r,r*2,r*2);CX.restore();
    }else{
      CX.fillRect(p.x-3,p.y-1.2,6,2.4);
    }
  }

/* ---- operational machinery drawn over hot nodes ---- */
/* gate arm that lifts to admit the current packet */
function mdGateArm(n,tt,hot){
  if(!hot||!n)return;
  var p=iso(n.x,n.y,n.h+1.8),cycle=(Math.sin(tt*.85)+1)/2,ang=lerp(-.12,-1.05,mdSmoother(cycle));
  CX.save();CX.translate(p.x,p.y);
  CX.strokeStyle='#ffb347';CX.lineWidth=2.2;
  CX.beginPath();CX.moveTo(0,0);CX.lineTo(Math.cos(ang)*24,Math.sin(ang)*24);CX.stroke();
  CX.fillStyle='#ffb347';CX.beginPath();CX.arc(0,0,2.8,0,6.283);CX.fill();
  CX.restore();
}
/* queued records creeping toward a gate */
function mdRecordQueue(n,tt,hot){
  if(!hot||!n)return;
  for(var i=0;i<4;i++){
    var creep=((tt*.18+i*.21)%1)*1.4;
    var xx=n.x-n.w*0.9+i*3.15+creep,yy=n.y+n.d*0.85;
    var pulse=i===0?Math.max(0,Math.sin(tt*2)):0;
    mdShadow(xx,yy,'record',.12);
    prism(xx,yy,1.9,1.4,1.0,(i===0&&pulse>.5)?'#ffb347':'#36536f',.85,.35);
  }
}
/* kernel core: concentric analysis rings */
function mdKernelCore(n,tt,hot){
  if(!hot||!n)return;
  var p=iso(n.x,n.y,n.h+4.2),i;
  CX.save();
  for(i=0;i<3;i++){
    var k=((tt*.4)+i/3)%1;
    CX.globalAlpha=(1-k)*.5;
    CX.strokeStyle=hexa(C.kernel,.9);CX.lineWidth=1.4;
    CX.beginPath();CX.ellipse(p.x,p.y,(4+k*22)*cam.zoom/9,(4+k*22)*cam.zoom/9*.42,0,0,6.283);CX.stroke();
  }
  CX.globalAlpha=.75;CX.fillStyle=hexa(C.kernel,.9);
  CX.beginPath();CX.arc(p.x,p.y,2.4,0,6.283);CX.fill();
  CX.restore();
}
/* registry volumes filling + index card sliding in */
function mdRegistryLoad(n,tt,hot){
  if(!hot||!n)return;
  for(var i=0;i<5;i++){
    var x=n.x-n.w*0.34+(i%3)*2.7,y=n.y+n.d*0.34+Math.floor(i/3)*2.1;
    prism(x,y,1.3,1.1,.65,i%2?C.store:'#7c66b8',.74,.18);
  }
  var fx=n.x-n.w*0.42+((tt*.7)%1)*n.w*0.84;
  prism(fx,n.y+n.d*0.62,1.6,1.1,1.2,C.info,.82,.25);
}
/* validation gate: records scanned in a lattice */
function mdValidate(n,tt,hot){
  if(!hot||!n)return;
  var p=iso(n.x,n.y,n.h+2.6);
  CX.save();
  CX.globalAlpha=.5;
  var sweep=(Math.sin(tt*1.7)*.5+.5);
  var a1=p.x-22+44*sweep;
  var g=CX.createLinearGradient(a1-12,0,a1+12,0);
  g.addColorStop(0,'rgba(66,215,255,0)');
  g.addColorStop(.5,'rgba(66,215,255,.4)');
  g.addColorStop(1,'rgba(66,215,255,0)');
  CX.fillStyle=g;CX.fillRect(a1-12,p.y-16,24,32);
  CX.restore();
}
/* serve pulses out of the API / UI nodes */
function mdServePulse(n,tt,hot){
  if(!hot||!n)return;
  var p=iso(n.x,n.y,n.h+1.2),i;
  CX.save();
  for(i=0;i<3;i++){
    var k=((tt*.5)+i/3)%1;
    CX.globalAlpha=(1-k)*.42;
    CX.strokeStyle=hexa(C.serve,.9);CX.lineWidth=1.2;
    CX.beginPath();CX.arc(p.x,p.y,3+k*26,0,6.283);CX.stroke();
  }
  CX.restore();
}
function mdOperationalLayer(r,tt){
  if(!MD.ops)return;
  mdGateArm(ND.gateway,tt,!!r.hot.gateway);
  mdGateArm(ND.valid,tt+.8,!!r.hot.valid);
  mdGateArm(ND.publish,tt+1.4,!!r.hot.publish);
  mdRecordQueue(ND.gateway,tt,!!r.hot.gateway);
  mdRecordQueue(ND.ingest,tt+.5,!!r.hot.ingest);
  mdValidate(ND.valid,tt,!!r.hot.valid);
  mdKernelCore(ND.kernel,tt,!!r.hot.kernel);
  mdRegistryLoad(ND.reg419,tt,!!r.hot.reg419);
  mdRegistryLoad(ND.reg164,tt+.7,!!r.hot.reg164);
  mdRegistryLoad(ND.regcore,tt+1.3,!!r.hot.regcore);
  mdServePulse(ND.api,tt,!!r.hot.api);
  mdServePulse(ND.ui,tt+.6,!!r.hot.ui);
}
/* draw one moving packet with its trail, shadow and detail */
function mdDrawMover(k,e,wp,u,tt,alarm,velocity,r){
  mdTrail(e,u,k,alarm);
  mdShadow(wp.x,wp.y,k,velocity);
  mover(k,wp.x,wp.y,tt,alarm);
  drawMoverDetail(k,wp.x,wp.y,tt,alarm);
  drawMoverUltraDetail(k,wp.x,wp.y,tt,alarm);
}

  CX.restore();
}
