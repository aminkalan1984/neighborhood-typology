/* ================= DRAW PRIMITIVES · ARA DATA-FLOW ================= */
function poly(pts,fill,stroke,lw){
  if(!pts.length)return;
  CX.beginPath();CX.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)CX.lineTo(pts[i].x,pts[i].y);
  CX.closePath();
  if(fill){CX.fillStyle=fill;CX.fill();}
  if(stroke){CX.strokeStyle=stroke;CX.lineWidth=lw||1;CX.stroke();}
}
/* ground grid of the data field */
function drawGrid(){
  var st=8,i,a,b;
  CX.lineWidth=1;
  for(i=-72;i<=72;i+=st){
    a=iso(i,-52,0);b=iso(i,20,0);
    CX.strokeStyle=(i%32===0)?C.g2:C.g1;
    CX.beginPath();CX.moveTo(a.x,a.y);CX.lineTo(b.x,b.y);CX.stroke();
  }
  for(i=-52;i<=20;i+=st){
    a=iso(-72,i,0);b=iso(72,i,0);
    CX.strokeStyle=(i%32===0)?C.g2:C.g1;
    CX.beginPath();CX.moveTo(a.x,a.y);CX.lineTo(b.x,b.y);CX.stroke();
  }
}
/* soft contact shadow */
function shadow(x,y,w,d){
  var p=iso(x,y,0);
  CX.save();CX.translate(p.x,p.y);CX.scale(1,S30);
  var rr=Math.max(w,d)*cam.zoom*0.95;
  var g=CX.createRadialGradient(0,0,1,0,0,rr);
  g.addColorStop(0,'rgba(0,0,0,0.55)');g.addColorStop(1,'rgba(0,0,0,0)');
  CX.fillStyle=g;CX.beginPath();CX.arc(0,0,rr,0,6.2832);CX.fill();
  CX.restore();
}
/* isometric prism — the base volume every node is built from */
function prism(x,y,w,d,h,col,alpha,glow){
  var hw=w/2,hd=d/2,a=alpha===undefined?1:alpha;
  var t=[iso(x-hw,y-hd,h),iso(x+hw,y-hd,h),iso(x+hw,y+hd,h),iso(x-hw,y+hd,h)];
  var l=[iso(x-hw,y+hd,h),iso(x+hw,y+hd,h),iso(x+hw,y+hd,0),iso(x-hw,y+hd,0)];
  var r=[iso(x+hw,y-hd,h),iso(x+hw,y+hd,h),iso(x+hw,y+hd,0),iso(x+hw,y-hd,0)];
  CX.globalAlpha=a;
  if(glow){CX.shadowColor=hexa(col,0.9);CX.shadowBlur=26*glow;}
  poly(l,shade(col,0.52),hexa(col,0.35),1);
  poly(r,shade(col,0.72),hexa(col,0.35),1);
  CX.shadowBlur=0;
  poly(t,shade(col,1.18),hexa(col,0.85),1.2);
  CX.globalAlpha=1;
}
/* flat diamond pad under a node */
function pad(x,y,w,d,col,alpha){
  var hw=w/2,hd=d/2;
  CX.globalAlpha=alpha===undefined?1:alpha;
  poly([iso(x-hw,y-hd,0),iso(x+hw,y-hd,0),iso(x+hw,y+hd,0),iso(x-hw,y+hd,0)],hexa(col,0.5),hexa(col,0.9),1.3);
  CX.globalAlpha=1;
}
/* ring emitter */
function ring(x,y,z,col,r,a,lw){
  var p=iso(x,y,z);
  CX.save();CX.translate(p.x,p.y);CX.scale(1,S30);
  CX.globalAlpha=a;CX.strokeStyle=col;CX.lineWidth=lw||1.4;
  CX.beginPath();CX.arc(0,0,r*cam.zoom,0,6.2832);CX.stroke();
  CX.restore();
}


/* ── kind: src · منبع داده (دیش رصد + دکل + سکوهای داده) ───────────────── */
function srcNode(n,hl,pulse){
  var x=n.x,y=n.y,w=n.w,d=n.d,h=n.h;
  shadow(x,y,w,d);
  pad(x,y,w+2.4,d+2.4,hl?C.info:C.src,hl?0.44:0.18);
  prism(x,y,w*0.88,d*0.70,h*0.62,n.col,1,hl?0.75:0.15);
  var base=iso(x,y,h*0.62),top=iso(x,y,h*0.62+6.4);
  CX.strokeStyle=hexa(hl?C.info:'#8aa3c0',hl?0.95:0.6);CX.lineWidth=1.8;
  CX.beginPath();CX.moveTo(base.x,base.y);CX.lineTo(top.x,top.y);CX.stroke();
  var tilt=Math.sin(pulse*0.7)*2.2,edge=iso(x+3.4,y-1.2,h*0.62+5.0+tilt);
  CX.save();
  CX.strokeStyle=hexa(hl?C.info:C.src,hl?1:0.72);CX.lineWidth=1.6;
  CX.beginPath();CX.moveTo(top.x,top.y);CX.lineTo(edge.x,edge.y);CX.stroke();
  CX.fillStyle=hexa(hl?C.info:C.src,hl?0.34:0.18);
  CX.beginPath();
  CX.ellipse(edge.x,edge.y,7.6,5.0,-0.42,0,6.2832);CX.fill();CX.stroke();
  CX.restore();
  if(hl){
    var k=(pulse*0.5)%1;
    CX.globalAlpha=(1-k)*0.55;
    CX.strokeStyle=hexa(C.info,0.9);CX.lineWidth=1.1;
    CX.beginPath();CX.arc(edge.x,edge.y,6+k*16,0,6.2832);CX.stroke();
    CX.globalAlpha=1;
  }
  for(var i=0;i<3;i++){
    prism(x-w*0.26+i*(w*0.26),y+d*0.22,2.1,1.6,0.85,hl?C.bdL:'#2b4364',0.9,hl?0.3:0.05);
  }
}
/* ── kind: ingest · موتور ورود داده (قِیف + نقاله) ─────────────────────── */
function ingestNode(n,hl){
  var x=n.x,y=n.y,w=n.w,d=n.d,h=n.h;
  shadow(x,y,w,d);
  pad(x,y,w+2.2,d+2.2,hl?C.ingest:C.bdL,hl?0.4:0.16);
  prism(x,y,w,d,h,n.col,1,hl?0.7:0.14);
  prism(x,y-d*0.34,w*0.52,d*0.26,h+2.6,shade(n.col,1.05),1,hl?0.55:0.12);
  prism(x,y+d*0.30,w*0.34,d*0.20,h+1.6,shade(n.col,0.9),1,hl?0.4:0.1);
  for(var i=-1;i<=1;i+=2){
    var a=iso(x-w*0.62,y+i*0.9,h*0.42),b=iso(x+w*0.62,y+i*0.9,h*0.42);
    CX.strokeStyle=hexa(hl?C.info:'#6a8299',hl?0.85:0.45);CX.lineWidth=1.7;
    CX.beginPath();CX.moveTo(a.x,a.y);CX.lineTo(b.x,b.y);CX.stroke();
  }
}
/* ── kind: store · رجیستر / انبار دادهٔ مرجع ───────────────────────────── */
function storeNode(n,hl){
  var x=n.x,y=n.y,hw=n.w/2,hd=n.d/2,h=n.h;
  shadow(n.x,n.y,n.w,n.d);
  prism(n.x,n.y,n.w,n.d,n.h,n.col,1,hl?0.62:0.12);
  var a=iso(x-hw,y,h+2.4),b=iso(x+hw,y,h+2.4),c=iso(x,y-hd*0.86,h+5.0),dd=iso(x,y+hd*0.86,h+5.0);
  poly([a,b,c],shade(n.col,1.22),hexa(n.col,0.9),1.2);
  poly([b,dd,c],shade(n.col,0.8),hexa(n.col,0.9),1.2);
  for(var i=-1;i<=1;i+=2){
    prism(x+i*hw*0.5,y,1.6,1.2,h+5.4,hl?C.info:'#31507a',0.95,hl?0.4:0.1);
  }
  for(var k=-1;k<=1;k++){
    prism(x+k*n.w*0.28,y+hd*0.94,2.2,0.8,h*0.5,shade(n.col,0.55),0.9,0);
  }

/* ── kind: engine · موتور محاسبه (حلقهٔ چرخان + پیستون) ─────────────────── */
function engineNode(n,hl,pulse){
  var x=n.x,y=n.y,w=n.w,d=n.d,h=n.h;
  shadow(x,y,w,d);
  prism(x,y,w,d,h,n.col,1,hl?0.85:0.2);
  prism(x,y,w*0.56,d*0.56,h+3.2,shade(n.col,1.12),1,hl?0.9:0.25);
  prism(x,y,w*0.26,d*0.26,h+5.6,hl?'#ffffff':'#eab27a',0.92,hl?1:0.3);
  var p=iso(x,y,h+2.4),ang=pulse*0.9;
  CX.save();
  CX.globalAlpha=hl?0.5:0.22;
  CX.strokeStyle=hexa(hl?C.info:C.analyze,0.9);CX.lineWidth=1.3;
  CX.beginPath();CX.ellipse(p.x,p.y,n.w*cam.zoom*0.44,n.d*cam.zoom*0.22,0,0,6.2832);CX.stroke();
  if(hl){
    CX.fillStyle=hexa(C.info,0.95);
    CX.beginPath();CX.arc(p.x+Math.cos(ang)*n.w*cam.zoom*0.44,p.y+Math.sin(ang)*n.d*cam.zoom*0.22,2.1,0,6.2832);CX.fill();
  }
  CX.restore();
  for(var i=-1;i<=1;i+=2){
    var lift=hl?(Math.sin(pulse*2.1+i)*1.6+1.6):0.6;
    prism(x+i*(w*0.62),y,w*0.14,d*0.32,h*0.7+lift,shade(n.col,0.72),0.95,hl?0.35:0.05);
  }
}
/* ── kind: gate · دروازهٔ منابع / اعتبارسنجی / انتشار ──────────────────── */
function gateNode(n,hl,alarm){
  var x=n.x,y=n.y,w=n.w,d=n.d,h=n.h,col=alarm?C.risk:C.gate;
  shadow(x,y,w,d);
  prism(x,y-d*0.42,w*0.26,d*0.18,h,col,1,alarm?1.2:(hl?0.7:0.15));
  prism(x,y+d*0.42,w*0.26,d*0.18,h,col,1,alarm?1.2:(hl?0.7:0.15));
  var a=iso(x,y-d*0.42,h),b=iso(x,y+d*0.42,h);
  CX.strokeStyle=alarm?hexa(C.risk,1):hexa(col,0.9);CX.lineWidth=3;
  if(alarm){CX.shadowColor=hexa(C.risk,1);CX.shadowBlur=20;}
  CX.beginPath();CX.moveTo(a.x,a.y);CX.lineTo(b.x,b.y);CX.stroke();CX.shadowBlur=0;
  CX.globalAlpha=hl?0.6:0.26;CX.strokeStyle=hexa(hl?C.info:col,0.9);CX.lineWidth=0.9;
  for(var i=1;i<4;i++){
    var u=i/4,p1=iso(x-w*0.3,y-d*0.42+u*d*0.84,h*0.85),p2=iso(x+w*0.3,y-d*0.42+u*d*0.84,h*0.85);
    CX.beginPath();CX.moveTo(p1.x,p1.y);CX.lineTo(p2.x,p2.y);CX.stroke();
  }
  CX.globalAlpha=1;
}
/* ── kind: tower · برج کنترل داده ──────────────────────────────────────── */
function towerNode(n,hl,pulse){
  var x=n.x,y=n.y,w=n.w,d=n.d,h=n.h;
  shadow(x,y,w,d);
  prism(x,y,w*0.32,d*0.32,h,n.col,0.95,hl?0.9:0.25);
  prism(x,y,w*0.95,d*0.95,2.2,n.col,0.9,hl?0.8:0.2);
  prism(x,y,w*0.72,d*0.72,h*0.62,shade(n.col,1.1),0.95,hl?0.7:0.15);
  var p=iso(x,y,h+2.8);
  var rr=(2.0+Math.abs(Math.sin(pulse*1.2))*1.6)*cam.zoom*0.5;
  CX.fillStyle=hexa(n.col,0.5);CX.beginPath();CX.arc(p.x,p.y,rr,0,6.2832);CX.fill();
  CX.fillStyle=hexa(n.col,1);CX.beginPath();CX.arc(p.x,p.y,2.6,0,6.2832);CX.fill();
  if(hl)ring(x,y,h+2.8,C.twr,3.6+Math.abs(Math.sin(pulse*0.9))*1.4,0.36,1.2);
}

}


/* ── kind: decision · کارت تصمیم محله (کارت برافراشته) ─────────────────── */
function decisionNode(n,hl,pulse){
  var x=n.x,y=n.y,w=n.w,d=n.d,h=n.h;
  shadow(x,y,w,d);
  pad(x,y,w+2.6,d+2.6,hl?C.decision:C.bdL,hl?0.42:0.14);
  prism(x,y,w*0.72,d*0.72,h,n.col,1,hl?0.85:0.18);
  var lift=hl?h+3.4:h+2.4,sway=hl?Math.sin(pulse*1.1)*1.1:0;
  prism(x+sway,y-w*0.06,w*0.66,d*0.10,lift,shade(n.col,1.24),0.95,hl?0.9:0.15);
  var p=iso(x+sway,y-w*0.06,lift+0.4),i;
  for(i=0;i<3;i++){
    var bw=2.4+i*1.5;
    CX.globalAlpha=hl?0.92:0.5;
    CX.fillStyle=hexa(hl?'#ffffff':C.ink,0.85);
    CX.fillRect(p.x-bw*1.2,p.y-2.4+i*2.6,bw*2.4,1.1);
  }
  CX.globalAlpha=1;
}
/* ── kind: serve · لایهٔ API / رابط کاربری ─────────────────────────────── */
function serveNode(n,hl,pulse){
  var x=n.x,y=n.y,w=n.w,d=n.d,h=n.h;
  shadow(x,y,w,d);
  prism(x,y,w,d,h,n.col,1,hl?0.7:0.16);
  prism(x,y,w*0.46,d*0.46,h+2.8,shade(n.col,1.16),0.95,hl?0.7:0.15);
  var p=iso(x,y,h+3.6),i;
  CX.save();
  for(i=0;i<3;i++){
    var k=((pulse*0.42)+i/3)%1;
    CX.globalAlpha=(1-k)*(hl?0.55:0.16);
    CX.strokeStyle=hexa(hl?C.info:C.serve,0.9);CX.lineWidth=1.2;
    CX.beginPath();CX.arc(p.x,p.y,4+k*20,Math.PI*1.08,Math.PI*1.92);CX.stroke();
  }
  CX.restore();
}
/* ── kind: audit · صف رد / آرشیو و ردیابی ──────────────────────────────── */
function auditNode(n,hl){
  var x=n.x,y=n.y,w=n.w,d=n.d,h=n.h;
  shadow(x,y,w,d);
  pad(x,y,w+2,d+2,hl?C.risk:C.bdL,hl?0.4:0.14);
  prism(x,y,w,d,h,n.col,1,hl?0.6:0.12);
  prism(x,y,w*0.5,d*0.5,h+2.2,shade(n.col,1.14),0.95,0);
  var p=iso(x,y,h+0.6);
  CX.save();CX.globalAlpha=hl?0.85:0.42;CX.lineWidth=1.6;
  for(var i=-1;i<=1;i++){
    CX.strokeStyle=hexa(i===0?C.risk:C.warn,0.9);
    CX.beginPath();CX.moveTo(p.x+i*5,p.y-3);CX.lineTo(p.x+i*5+2.4,p.y+3);CX.stroke();
  }
  CX.restore();
}
/* ── kind: block · بلوک انتشار ─────────────────────────────────────────── */
function blockNode(n,hl){
  var x=n.x,y=n.y,w=n.w,d=n.d,h=n.h;
  shadow(x,y,w,d);
  prism(x,y,w,d,h,C.risk,0.9,hl?0.6:0.2);
  prism(x,y,w*0.4,d*0.4,h+2.6,'#5c2230',0.95,0);
}
/* ── node dispatch + label ────────────────────────────────────────────── */
var KINDFA={src:'منبع داده',ingest:'ورود داده',store:'رجیستر و انبار',
 engine:'موتور محاسبه',gate:'دروازه',tower:'برج کنترل',decision:'کارت تصمیم',
 serve:'سرو و رابط',audit:'رد و آرشیو',block:'بلوک'};
function drawNode(n,hl,pulse,alarm){
  var a=n.app;
  if(a<=0.01)return;
  CX.globalAlpha=a;
  if(n.kind==='src')srcNode(n,hl,pulse);
  else if(n.kind==='ingest')ingestNode(n,hl);
  else if(n.kind==='store')storeNode(n,hl);
  else if(n.kind==='engine')engineNode(n,hl,pulse);
  else if(n.kind==='gate')gateNode(n,hl,alarm);
  else if(n.kind==='tower')towerNode(n,hl,pulse);
  else if(n.kind==='decision')decisionNode(n,hl,pulse);
  else if(n.kind==='serve')serveNode(n,hl,pulse);
  else if(n.kind==='audit')auditNode(n,hl);
  else blockNode(n,hl);
  CX.globalAlpha=1;
  /* label */
  var lz=(n.kind==='src')?n.h*0.62+9.4:(n.kind==='decision'?n.h+6.6:(n.kind==='tower'?n.h+5:n.h+4.2));
  if(n.kind==='gate')lz=n.h+3.4;
  var p=iso(n.x,n.y,lz);
  var sz=clamp(cam.zoom*1.16,9.5,15);
  CX.globalAlpha=a;
  label(n.fa,p.x,p.y,sz,hl?'#ffffff':hexa(C.ink,0.62),'center',hl?700:500);
  CX.globalAlpha=1;
}
