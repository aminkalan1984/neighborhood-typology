/* ================= ARA PLATFORM · DATA-FLOW MOTION GRAPHIC · CORE ================= */
var CV=document.getElementById('cv');
var CX=CV.getContext('2d');
var W=1280,H=720,DPR=1;
var C={bg:'#05080e',g1:'#0b1322',g2:'#132038',ink:'#e9eff8',dim:'#7c8aa2',
src:'#42d7ff',ingest:'#3ddc84',store:'#b892ff',kernel:'#ff8a2b',analyze:'#ffd166',
decision:'#f4698a',serve:'#7fa4c4',risk:'#ff4d5e',rel:'#36466b',
bd:'#16233a',bdL:'#22375a',bdD:'#0d1626',tp:'#2c4672',tpL:'#3f6199',
hq:'#ffb347',port:'#2f6f8f',gate:'#6d4a90',pad:'#1b3150',twr:'#48d1c1',warn:'#ffd166'};
var MIR=1;
var cam={cx:0,cy:0,zoom:7.4,rot:0};
var S30=0.5,C30=0.8660254;
function iso(x,y,z){
  var c=Math.cos(cam.rot),s=Math.sin(cam.rot);
  var dx=(x-cam.cx)*MIR,dy=(y-cam.cy);
  var rx=dx*c-dy*s,ry=dx*s+dy*c;
  return {x:W/2+(rx-ry)*C30*cam.zoom,y:H*0.56+(rx+ry)*S30*cam.zoom-(z||0)*cam.zoom,d:rx+ry};
}
function isFa(t){return /[\u0600-\u06FF]/.test(String(t));}
function setFont(sz,wt,fa){
  CX.font=(wt||600)+' '+sz+'px '+(fa?'"Vazirmatn","Tahoma",sans-serif':'"Space Grotesk","Menlo",sans-serif');
  try{CX.letterSpacing=fa?'0px':'0.05em';}catch(e){}
}
function label(txt,sx,sy,sz,col,al,wt){
  var fa=isFa(txt);setFont(sz||12,wt||600,fa);
  CX.textAlign=al||'center';CX.textBaseline='middle';
  CX.fillStyle=col||C.ink;CX.fillText(txt,sx,sy);
  try{CX.letterSpacing='0px';}catch(e){}
}
function lerp(a,b,t){return a+(b-a)*t;}
function clamp(v,a,b){return v<a?a:(v>b?b:v);}
function bez(t,p1,p2){
  var lo=0,hi=1,u=t,i,x;
  for(i=0;i<18;i++){u=(lo+hi)/2;
    var mu=1-u;x=3*mu*mu*u*p1+3*mu*u*u*p2+u*u*u;
    if(x<t)lo=u;else hi=u;}
  u=(lo+hi)/2;var m=1-u;
  return 3*m*m*u*0.1+3*m*u*u*1+u*u*u;
}
function ease(t){return bez(clamp(t,0,1),0.25,0.25);}
function easeIO(t){t=clamp(t,0,1);return t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;}
function shade(hex,f){
  var n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=clamp(Math.round(r*f),0,255);g=clamp(Math.round(g*f),0,255);b=clamp(Math.round(b*f),0,255);
  return 'rgb('+r+','+g+','+b+')';
}
function hexa(hex,a){
  var n=parseInt(hex.slice(1),16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
}

var FA_D={'\u06F0':0,'\u06F1':1,'\u06F2':2,'\u06F3':3,'\u06F4':4,'\u06F5':5,'\u06F6':6,'\u06F7':7,'\u06F8':8,'\u06F9':9};
function toEnDigits(x){return String(x).replace(/[\u06F0-\u06F9]/g,function(c){return FA_D[c]})}
var FA_DIG=['\u06F0','\u06F1','\u06F2','\u06F3','\u06F4','\u06F5','\u06F6','\u06F7','\u06F8','\u06F9'];
function faNum(x){
  var f=arguments.length>1?arguments[1]:true;
  var s=String(x==null?'':x);
  if(!f)return s.replace(/\d/g,function(c){return FA_DIG[+c]});
  return s.replace(/\d/g,function(c){return FA_DIG[+c]});
}
function fmtClock(sec){
  sec=Math.max(0,Math.round(sec));
  var m=Math.floor(sec/60),s=sec%60;
  return (m<10?'0':'')+m+':'+(s<10?'0':'')+s;
}
function esc(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
function fmtNum(n,d){n=Number(n)||0;return faNum(n.toLocaleString('en-US',{maximumFractionDigits:d==null?1:d}))}
