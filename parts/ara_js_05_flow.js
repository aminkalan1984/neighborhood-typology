/* ================= FLOWS · MOVERS · AMBIENT (ARA DATA-FLOW) ================= */
var KCOL={source:C.src,ingest:C.ingest,store:C.store,compute:C.kernel,
          decision:C.decision,serve:C.serve,audit:C.risk};
var KFA={source:'دادهٔ خام',ingest:'ورود و اعتبارسنجی',store:'رجیستری',
         compute:'محاسبه',decision:'تصمیم',serve:'سرو',audit:'رد و ردیابی'};
/* keys 1..6 on the legend map to the six visible flow families */
var FLOWKEY={source:'1',ingest:'2',store:'3',compute:'4',decision:'5',serve:'6'};
var FLOW_ON={source:true,ingest:true,store:true,compute:true,decision:true,serve:true,audit:true};
function edgeScreen(e){
  var s=[],i,z;
  for(i=0;i<e.pts.length;i++){
    z=(e.kind==='decision'||e.kind==='serve')?2.6:0.5;
    s.push(iso(e.pts[i][0],e.pts[i][1],z));
  }
  return s;
}
function edgePosWorld(e,t){
  var pts=e.pts,i,segs=[],tot=0,dx,dy,L;
  for(i=0;i<pts.length-1;i++){
    dx=pts[i+1][0]-pts[i][0];dy=pts[i+1][1]-pts[i][1];
    L=Math.sqrt(dx*dx+dy*dy);segs.push(L);tot+=L;
  }
  if(tot<=0)return {x:pts[0][0],y:pts[0][1],a:0};
  var want=clamp(t,0,1)*tot,acc=0,u;
  for(i=0;i<segs.length;i++){
    if(acc+segs[i]>=want||i===segs.length-1){
      u=segs[i]>0?(want-acc)/segs[i]:0;u=clamp(u,0,1);
      return {x:lerp(pts[i][0],pts[i+1][0],u),y:lerp(pts[i][1],pts[i+1][1],u),
              a:Math.atan2(pts[i+1][1]-pts[i][1],pts[i+1][0]-pts[i][0])};
    }
    acc+=segs[i];
  }
  return {x:pts[0][0],y:pts[0][1],a:0};
}
function drawEdge(e,hl,tt,alarm){
  if(FLOW_ON[e.kind]===false)return;
  var a=e.app;if(a<=0.01)return;
  var s=edgeScreen(e);if(s.length<2)return;
  var col=alarm?C.risk:KCOL[e.kind];
  var lw=e.kind==='compute'?(hl?3.2:1.7):(e.kind==='audit'?1.0:(hl?2.1:1.15));
  CX.save();
  CX.globalAlpha=a*(hl?1:(e.kind==='audit'?0.34:0.30));
  if(e.dash)CX.setLineDash([7,7]);
  if(hl){CX.shadowColor=hexa(col,0.8);CX.shadowBlur=12;}
  CX.strokeStyle=hexa(col,hl?0.95:0.52);CX.lineWidth=lw;CX.lineJoin='round';
  CX.beginPath();CX.moveTo(s[0].x,s[0].y);
  for(var i=1;i<s.length;i++)CX.lineTo(s[i].x,s[i].y);
  CX.stroke();CX.setLineDash([]);CX.shadowBlur=0;
  CX.restore();
  /* flow particles */
  if(hl&&e.kind!=='audit'){
    var n=5,k,ph,pw,pp;
    for(k=0;k<n;k++){
      ph=((tt*0.22)+k/n)%1;
      pw=edgePosWorld(e,ph);
      pp=iso(pw.x,pw.y,(e.kind==='decision'||e.kind==='serve')?2.6:0.5);
      CX.globalAlpha=a*(0.35+0.65*Math.sin(Math.PI*ph));
      CX.fillStyle=hexa(col,1);CX.shadowColor=hexa(col,1);CX.shadowBlur=10;
      CX.beginPath();CX.arc(pp.x,pp.y,2.4,0,6.2832);CX.fill();
      CX.shadowBlur=0;CX.globalAlpha=1;
    }
    drawEdgeChevrons(e,tt,col);drawEdgeEnergy(e,tt,col);
  }
}
/* ================= MOVERS · بستهٔ دادهٔ در حال حرکت ================= */
/* record=batch=stream=doc=metric=flag=query=alert */
function mover(k,x,y,tt,alarm){
  var col=alarm?C.risk:C.src,p;
  drawMoverFX(k,x,y,tt,alarm);
  if(k==='record'){
    prism(x,y,2.0,2.0,2.0,col,1,0.85);
  }else if(k==='batch'){
    prism(x,y,4.2,2.6,2.6,col,1,0.9);
    prism(x,y,2.6,1.6,3.4,shade(col,0.78),0.95,0.3);
  }else if(k==='stream'){
    prism(x,y,1.5,1.5,1.5,col,1,0.95);
    prism(x-2.2,y,1.0,1.0,1.0,shade(col,0.7),0.7,0.3);
  }else if(k==='table'){
    prism(x,y,5.2,3.4,1.2,col,1,0.6);
    prism(x,y,3.6,2.2,2.2,shade(col,0.82),0.9,0.25);
  }else if(k==='metric'){
    p=iso(x,y,3.2);
    CX.save();CX.shadowColor=hexa(C.analyze,0.9);CX.shadowBlur=14;
    CX.fillStyle=hexa(C.analyze,0.95);CX.beginPath();CX.arc(p.x,p.y,4.4,0,6.2832);CX.fill();
    CX.strokeStyle='rgba(7,15,25,.85)';CX.lineWidth=1.1;
    CX.beginPath();CX.moveTo(p.x-2,p.y);CX.lineTo(p.x-0.6,p.y+1.8);CX.lineTo(p.x+2.2,p.y-1.8);CX.stroke();
    CX.restore();
  }else if(k==='flag'){
    prism(x,y,1.5,1.5,4.4,C.decision,0.95,0.8);
    p=iso(x+1.6,y,5.0);
    CX.save();CX.shadowColor=hexa(C.decision,0.9);CX.shadowBlur=12;
    CX.fillStyle=hexa(C.decision,0.95);
    CX.beginPath();CX.moveTo(p.x,p.y-5.4);CX.lineTo(p.x+5.4,p.y);CX.lineTo(p.x,p.y+5.4);CX.closePath();CX.fill();
    CX.restore();
  }else if(k==='query'){
    p=iso(x,y,3.2);
    CX.save();CX.shadowColor=hexa(C.serve,0.9);CX.shadowBlur=14;
    CX.fillStyle=hexa(C.serve,0.95);
    CX.beginPath();CX.moveTo(p.x,p.y-6.5);CX.lineTo(p.x+5.6,p.y);CX.lineTo(p.x,p.y+6.5);CX.lineTo(p.x-5.6,p.y);CX.closePath();CX.fill();
    CX.restore();
  }else if(k==='doc'){
    p=iso(x,y,3.2);
    CX.save();CX.globalAlpha=0.95;
    CX.shadowColor=hexa(C.info,0.9);CX.shadowBlur=14;
    CX.fillStyle=hexa(C.info,0.95);
    CX.fillRect(p.x-4.2,p.y-6,8.4,12);
    CX.restore();
  }else if(k==='alert'){
    p=iso(x,y,3.4);
    CX.save();CX.shadowColor=hexa(C.risk,1);CX.shadowBlur=18;
    CX.fillStyle=hexa(C.risk,0.95);
    CX.beginPath();CX.moveTo(p.x,p.y-8);CX.lineTo(p.x+7,p.y+5);CX.lineTo(p.x-7,p.y+5);CX.closePath();CX.fill();
    CX.restore();
  }
}
/* kind of packet for each flow family */
function moverKind(kind){
  if(kind==='source')return 'record';
  if(kind==='ingest')return 'stream';
  if(kind==='store')return 'table';
  if(kind==='compute')return 'metric';
  if(kind==='decision')return 'flag';
  if(kind==='serve')return 'query';
  return 'doc';
}
/* movers are derived from the scene's hot edges — no static scene data needed */
function sceneMovers(r){
  var out=[],i,e,ids=r.s.hot;
  for(i=0;i<ids.length;i++){
    e=ED[ids[i]];
    if(!e||!r.hot[e.id])continue;
    if(FLOW_ON[e.kind]===false)continue;
    out.push(e);
    if(out.length>=9)break;
  }
  return out;
}


/* ================= AMBIENT · DATA PLANE · TELEMETRY ================= */
var AMB=[];for(var ai=0;ai<44;ai++)AMB.push({x:(ai*73)%997/997,y:(ai*193)%991/991,r:.4+(ai%4)*.22,p:ai*.61});
function drawAmbient(tt){
  var g=CX.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'rgba(20,40,72,.16)');
  g.addColorStop(.55,'rgba(5,8,14,0)');
  g.addColorStop(1,'rgba(0,135,170,.07)');
  CX.fillStyle=g;CX.fillRect(0,0,W,H);
  for(var i=0;i<AMB.length;i++){
    var q=AMB[i],a=.08+.11*(.5+.5*Math.sin(tt*.18+q.p));
    CX.fillStyle='rgba(112,177,225,'+a+')';
    CX.beginPath();CX.arc(q.x*W,(q.y*H+tt*(.8+q.r))%H,q.r,0,6.283);CX.fill();
  }
}
/* zone labels of the isometric data field */
function drawZoneLabels(){
  var z=[[-30,20,'منابع داده'],[10,20,'ورود و دروازه'],[-18,-28,'رجیستری و هستهٔ محاسبه'],
          [-6,-47,'تصمیم و انتشار'],[-14,-56,'سرو و بازخورد']];
  for(var i=0;i<z.length;i++){
    var p=iso(z[i][0],z[i][1],.1);
    setFont(8,700,false);CX.textAlign='center';
    CX.fillStyle='rgba(107,130,163,.32)';CX.fillText(z[i][2],p.x,p.y);
  }
}
/* telemetry halo over the kernel */
function drawTelemetry(r){
  var n=ND.kernel;if(!n||n.app<.3)return;
  var p=iso(n.x,n.y,n.h*1.0+6),rad=(24+4*Math.sin(t*1.4))*cam.zoom/9;
  CX.save();CX.globalAlpha=.35;
  CX.strokeStyle=hexa(r.s.card.tr==='CONFLICT'?C.risk:C.kernel,.55);
  CX.setLineDash([3,6]);
  CX.beginPath();CX.arc(p.x,p.y,rad,0,6.283);CX.stroke();
  CX.restore();
}
function drawScanSweep(tt){
  var x=((tt*.035)%1)*W,g=CX.createLinearGradient(x-80,0,x+20,0);
  g.addColorStop(0,'rgba(66,215,255,0)');
  g.addColorStop(.8,'rgba(66,215,255,.025)');
  g.addColorStop(1,'rgba(66,215,255,0)');
  CX.fillStyle=g;CX.fillRect(x-80,0,100,H);
}
function drawFocusBracket(n){
  if(cam.zoom<7.5||!n)return;
  var p=iso(n.x,n.y,n.h+2),r=Math.max(10,cam.zoom*n.w*.34),c=5;
  CX.save();CX.globalAlpha=.38;CX.strokeStyle=C.info;CX.lineWidth=1;
  CX.beginPath();
  CX.moveTo(p.x-r,p.y-r+c);CX.lineTo(p.x-r,p.y-r);CX.lineTo(p.x-r+c,p.y-r);
  CX.moveTo(p.x+r-c,p.y-r);CX.lineTo(p.x+r,p.y-r);CX.lineTo(p.x+r,p.y-r+c);
  CX.moveTo(p.x-r,p.y+r-c);CX.lineTo(p.x-r,p.y+r);CX.lineTo(p.x-r+c,p.y+r);
  CX.stroke();CX.restore();
}
/* the data plane under the source row: scans and carries packets */
function drawDataPlane(tt){
  var a=iso(-62,16,-.1),b=iso(34,16,-.1),c=iso(34,2,-.1),d=iso(-62,2,-.1);
  var g=CX.createLinearGradient(a.x,a.y,c.x,c.y);
  g.addColorStop(0,'rgba(18,72,105,.03)');
  g.addColorStop(.5,'rgba(22,116,148,.11)');
  g.addColorStop(1,'rgba(18,72,105,.03)');
  poly([a,b,c,d],g,'rgba(66,215,255,.09)',1);
  CX.save();CX.lineWidth=.75;
  for(var j=0;j<5;j++){
    var yy=4+j*2.6,off=Math.sin(tt*.35+j)*1.4;
    var p1=iso(-58+off,yy,0),p2=iso(30+off,yy,0);
    CX.strokeStyle='rgba(66,215,255,'+(.035+j*.006)+')';
    CX.setLineDash([10+j,8]);CX.lineDashOffset=-tt*(2+j*.18);
    CX.beginPath();CX.moveTo(p1.x,p1.y);CX.lineTo(p2.x,p2.y);CX.stroke();
  }
  CX.restore();
}
