
/* ================= FCL MOTION GRAPHIC — CORE ENGINE ================= */
var CV=document.getElementById('cv');
var CX=CV.getContext('2d');
var W=1280,H=720,DPR=1;
var C={bg:'#05080e',g1:'#0b1322',g2:'#132038',ink:'#e9eff8',dim:'#7c8aa2',
cargo:'#ff8a2b',info:'#32d3ff',money:'#3ddc84',risk:'#ff4d5e',rel:'#36466b',
bd:'#16233a',bdL:'#22375a',bdD:'#0d1626',tp:'#2c4672',tpL:'#3f6199',
hq:'#ffb347',port:'#2f6f8f',gate:'#6d4a90',pad:'#1b3150',twr:'#48d1c1',warn:'#ffd166'};
var MIR=1;
var cam={cx:-40,cy:2,zoom:9,rot:0};
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
/* cubic-bezier easing (CSS "ease" = .25,.1,.25,1) */
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

/* ================= WORLD: NODES ================= */
/* kinds: box | hq | pad | port | gate | depot | whs | tower | rail */
var NODES=[
{id:'shipper',x:-60,y:8,kind:'box',fa:'صاحب کالا / کارخانه',w:7,d:7,h:6,col:C.bdL},
{id:'whs',x:-48,y:8,kind:'whs',fa:'انبار مبدأ (بارگیری)',w:9,d:8,h:5,col:C.bd},
{id:'depot',x:-52,y:-6,kind:'depot',fa:'دپوی کانتینر خالی',w:8,d:6,h:4,col:C.bd},
{id:'expcus',x:-36,y:8,kind:'gate',fa:'گمرک صادرات',w:6,d:8,h:8,col:C.gate},
{id:'oport',x:-23,y:8,kind:'port',fa:'بندر مبدأ',w:12,d:10,h:3,col:C.port},
{id:'hub',x:2,y:8,kind:'port',fa:'هاب ترانشیپمنت',w:11,d:10,h:3,col:C.port},
{id:'dport',x:27,y:8,kind:'port',fa:'بندر مقصد',w:12,d:10,h:3,col:C.port},
{id:'impcus',x:40,y:8,kind:'gate',fa:'گمرک واردات',w:7,d:9,h:9,col:C.gate,big:1},
{id:'consignee',x:54,y:8,kind:'box',fa:'گیرندهٔ کالا',w:7,d:7,h:6,col:C.bdL},
{id:'fwd',x:-14,y:-10,kind:'hq',fa:'فورواردر',w:12,d:12,h:12,col:C.hq},
{id:'line',x:-2,y:-24,kind:'pad',fa:'خط دریایی',w:8,d:7,h:4,col:C.pad},
{id:'agent',x:24,y:-24,kind:'pad',fa:'نمایندهٔ خارجی',w:8,d:7,h:4,col:C.pad},
{id:'road',x:-36,y:-18,kind:'pad',fa:'حمل‌کنندهٔ زمینی',w:8,d:7,h:4,col:C.pad},
{id:'rail',x:-28,y:24,kind:'rail',fa:'اپراتور ریلی',w:9,d:6,h:4,col:C.bd},
{id:'broker',x:38,y:-16,kind:'pad',fa:'کارگزار گمرک',w:8,d:7,h:4,col:C.pad},
{id:'ins',x:4,y:-14,kind:'pad',fa:'بیمه‌گر',w:7,d:6,h:4,col:C.pad},
{id:'insp',x:14,y:-16,kind:'pad',fa:'بازرس',w:7,d:6,h:4,col:C.pad},
{id:'bank',x:-12,y:-32,kind:'pad',fa:'بانک / تسویه',w:8,d:7,h:5,col:C.pad},
{id:'tower',x:10,y:-34,kind:'tower',fa:'برج کنترل عملیاتی',w:6,d:6,h:18,col:C.twr}

,{id:'sales',x:-46,y:-28,kind:'pad',fa:'فروش و توسعه کسب‌وکار',w:8,d:7,h:5,col:C.pad}
,{id:'pricing',x:-31,y:-30,kind:'pad',fa:'قیمت‌گذاری و خرید',w:8,d:7,h:5,col:C.pad}
,{id:'docs',x:-29,y:-8,kind:'pad',fa:'مرکز اسناد',w:8,d:7,h:5,col:C.pad}
,{id:'compliance',x:32,y:-31,kind:'pad',fa:'انطباق و تحریم',w:8,d:7,h:6,col:C.gate}
,{id:'cfs',x:-45,y:25,kind:'whs',fa:'CFS / کنسولیدیشن',w:9,d:7,h:5,col:C.bd}
,{id:'airO',x:-18,y:29,kind:'port',fa:'فرودگاه مبدأ',w:9,d:7,h:2.5,col:C.port}
,{id:'airD',x:28,y:29,kind:'port',fa:'فرودگاه مقصد',w:9,d:7,h:2.5,col:C.port}
,{id:'qhse',x:18,y:-31,kind:'pad',fa:'DG / QHSE',w:7,d:6,h:5,col:C.pad}
];
var ND={};for(var i=0;i<NODES.length;i++){ND[NODES[i].id]=NODES[i];NODES[i].app=0;}
function P(id){var n=ND[id];return [n.x,n.y];}

/* ================= WORLD: EDGES ================= */
function E(id,kind,ids,opt){
  var pts=[],k;
  for(k=0;k<ids.length;k++){
    if(typeof ids[k]==='string')pts.push(P(ids[k]));else pts.push(ids[k]);
  }
  var e={id:id,kind:kind,pts:pts,app:0};
  if(opt)for(k in opt)e[k]=opt[k];
  return e;
}
var EDGES=[
/* --- cargo: the single full container, factory door to consignee door --- */
E('c_empty','cargo',['depot','whs'],{dash:1}),
E('c_fac','cargo',['shipper','whs']),
E('c_exp','cargo',['whs','expcus']),
E('c_prt','cargo',['expcus','oport']),
E('c_rail','cargo',['whs',[-40,24],'rail',[-16,24],'oport'],{dash:1,alt:1}),
E('c_sea1','cargo',['oport',[-12,14],'hub']),
E('c_sea2','cargo',['hub',[15,14],'dport']),
E('c_alt','cargo',['oport',[-10,26],[14,26],'dport'],{dash:1,alt:1}),
E('c_imp','cargo',['dport','impcus']),
E('c_last','cargo',['impcus','consignee']),
/* --- info: direct forwarder-to-party communication + documents --- */
E('i_ship','info',['fwd','shipper']),
E('i_whs','info',['fwd','whs']),
E('i_depot','info',['fwd','depot']),
E('i_line','info',['fwd','line']),
E('i_road','info',['fwd','road']),
E('i_rail','info',['fwd','rail']),
E('i_agent','info',['fwd','agent']),
E('i_broker','info',['fwd','broker']),
E('i_ins','info',['fwd','ins']),
E('i_insp','info',['fwd','insp']),
E('i_exp','info',['fwd','expcus']),
E('i_imp','info',['fwd','impcus']),
E('i_oport','info',['fwd','oport']),
E('i_dport','info',['fwd','dport']),
E('i_cons','info',['fwd','consignee']),
E('i_docexp','info',['fwd',[-26,-2],'expcus']),
E('i_docimp','info',['broker','impcus']),
E('i_eta','info',['dport',[8,-4],'shipper'],{dash:1}),
/* --- money --- */
E('m_cust','money',['shipper','fwd']),
E('m_line','money',['fwd','line']),
E('m_road','money',['fwd','road']),
E('m_agent','money',['fwd','agent']),
E('m_ins','money',['fwd','ins']),
E('m_bank','money',['fwd','bank']),
E('m_cons','money',['consignee','fwd'],{dash:1}),
/* --- standing relationships --- */
E('r_line','rel',['fwd','line']),
E('r_agent','rel',['fwd','agent']),
E('r_road','rel',['fwd','road']),
E('r_broker','rel',['fwd','broker']),
E('r_rail','rel',['fwd','rail']),
/* --- control tower monitoring --- */
E('t_fwd','info',['fwd','tower'],{dash:1}),
E('t_op','info',['oport','tower'],{dash:1}),
E('t_hub','info',['hub','tower'],{dash:1}),
E('t_dp','info',['dport','tower'],{dash:1})

,E('i_sales','info',['sales','fwd'])
,E('i_price','info',['pricing','fwd'])
,E('i_docs','info',['docs','fwd'])
,E('i_comp','info',['compliance','fwd'])
,E('i_qhse','info',['qhse','fwd'])
,E('c_lcl','cargo',['shipper','cfs','oport'],{dash:1})
,E('c_air','cargo',['airO',[5,33],'airD'],{dash:1})
,E('c_railmain','cargo',['rail',[-8,27],[16,27],'dport'],{dash:1})
];
var ED={};for(i=0;i<EDGES.length;i++)ED[EDGES[i].id]=EDGES[i];

/* ================= SCENES (24) + EVIDENCE CARDS ================= */
/* tier: VERIFIED | FACT | CLAIM | INFERENCE | CONFLICT | UNKNOWN */
var SCENES=[
{d:10,ch:'اکوسیستم',ti:'۰۱ — پیدایش شبکه',sb:'فورواردر در قلب شبکه، بدون مالکیت دارایی حمل',
 cam:{cx:-6,cy:-2,zoom:6.2,rot:-0.06},
 hot:['fwd','shipper','consignee','line','agent','road','broker','ins','r_line','r_agent','r_road','r_broker'],
 card:{tx:'فورواردر = هماهنگ‌کنندهٔ اطلاعات، اسناد و ظرفیت؛ در اکثر آرکتایپ‌ها asset-light است و مالک دارایی حمل نیست.',tr:'VERIFIED',sr:'R-A §A.1 / §۱.۱'}},

{d:10,ch:'تجاری',ti:'۰۲ — ورود تقاضا: تماس مستقیم با فورواردر',sb:'صاحب کالا با تلفن ، ایمیل ، فکس استعلام می‌دهد',
 cam:{cx:-36,cy:0,zoom:9.5,rot:-0.04},
 hot:['shipper','fwd','i_ship'],
 mov:[{e:'i_ship',k:'doc',a:1,b:0}],
 card:{tx:'دادهٔ حداقل استعلام: جفت مبدأ–مقصد، Incoterm، شرح کالا، وزن/حجم/ابعاد، نوع تجهیز، تاریخ آمادگی بار؛ هدف پاسخ اغلب همان روز کاری.',tr:'CLAIM',sr:'R-B §۹'}},

{d:12,ch:'تجاری',ti:'۰۳ — امکان‌سنجی بار FCL',sb:'نوع کانتینر، وزن/حجم و طبقه‌بندی HS',
 cam:{cx:-34,cy:-4,zoom:9,rot:0.05},
 hot:['fwd','shipper','insp','i_insp','i_ship'],
 card:{tx:'HS: نامنکلاتور بین‌المللی ۶‌رقمی با بیش از ۵٬۰۰۰ گروه کالایی، به‌روزرسانی هر ۵–۶ سال (WCO). نسخهٔ جاری HS: نامشخص (Unknown). انواع تجهیز: 20′ / 40′ / 40′HC / 45′ — dry, reefer, OT, FR (CLAIM صنعتی).',tr:'VERIFIED',sr:'R-B §۱۱ — WCO, 2026-09-21'}},

{d:12,ch:'تجاری',ti:'۰۴ — اینکوترمز و دامنهٔ خدمت',sb:'تقسیم هزینه و ریسک میان فروشنده و خریدار',
 cam:{cx:-22,cy:-2,zoom:7.6,rot:0},
 hot:['shipper','consignee','fwd','i_ship','i_cons'],
 card:{tx:'Incoterms® 2020 = ۱۱ قاعدهٔ ICC که هزینه، ریسک و تعهدات را میان فروشنده و خریدار تخصیص می‌دهد؛ در اجرا از 2020-01-01. این قواعد قرارداد/عرف تجاری‌اند، نه قانون.',tr:'VERIFIED',sr:'R-B §۱۲ — ICC, 2026-09-21'}},

{d:11,ch:'تأمین',ti:'۰۵ — تأمین ظرفیت: مذاکرهٔ مستقیم با خط دریایی',sb:'نرخ قراردادی (MQC) در برابر نرخ اسپات',
 cam:{cx:-12,cy:-16,zoom:10,rot:-0.08},
 hot:['fwd','line','r_line','i_line'],
 mov:[{e:'i_line',k:'cube',a:0,b:1}],
 card:{tx:'ظرفیت قراردادی (allocation / MQC): ظرفیت تضمین‌شده با تعهد حداقل حجم و ثبات نرخ؛ اسپات: انعطاف ولی ریسک rollover. نسبت بهینهٔ قراردادی/اسپات هر بنگاه: نامشخص (Unknown). ناوگان فعال جهانی: ۷٬۶۵۰ کشتی / 34,754,863 TEU — MSC ۲۱٫۶٪ (VERIFIED).',tr:'INFERENCE',sr:'R-C §۴۲ / R-B §۱۳'}},

{d:12,ch:'تأمین',ti:'۰۶ — قیمت‌گذاری: خرید → فروش → حاشیه',sb:'ساختار بهای تمام‌شدهٔ خدمت برای یک کانتینر کامل',
 cam:{cx:-14,cy:-10,zoom:11,rot:0.04},
 hot:['fwd','line','road','m_line','m_road'],
 card:{tx:'Sea FCL — build-up: ocean freight به‌ازای کانتینر + BAF/CAF + THC مبدأ/مقصد + drayage + مستندسازی + بافر ریسک D&D. Margin = Sell − Buy − Cost-to-serve. هیچ عدد پولی در منابع درج نشده است — ارقام: نامشخص (Unknown).',tr:'INFERENCE',sr:'R-C §۴۰ / R-B §۱۵'}},

{d:10,ch:'تجاری',ti:'۰۷ — پیشنهاد و مذاکره',sb:'کانال سنتی: ایمیل، فکس، تلفن',
 cam:{cx:-26,cy:-6,zoom:10,rot:-0.05},
 hot:['fwd','shipper','i_ship'],
 mov:[{e:'i_ship',k:'doc',a:0,b:1}],
 card:{tx:'معیارهای رایج award: buy-rate، free time (detention/demurrage)، schedule reliability، پوشش lane، تضمین allocation. SOP تأیید quotation در دامنهٔ A چارچوب SOP قرار دارد.',tr:'CLAIM',sr:'R-B §۱۳ / R-C §۳۷'}},

{d:11,ch:'عملیات',ti:'۰۸ — رزرو با خط کشتیرانی',sb:'تأییدیهٔ رزرو و تخصیص کشتی و سفر',
 cam:{cx:-10,cy:-14,zoom:10.5,rot:0.06},
 hot:['fwd','line','i_line','r_line'],
 mov:[{e:'i_line',k:'doc',a:1,b:0}],
 card:{tx:'cutoff‌های کلیدی: VGM cutoff ، Documentation/SI cutoff ، Gate-in (CY) cutoff ، Port cutoff. عبور از هرکدام → rollover.',tr:'CLAIM',sr:'R-B §۱۸'}},

{d:11,ch:'عملیات',ti:'۰۹ — تخصیص کانتینر و تجهیز',sb:'دریافت کانتینر خالی از دپو',
 cam:{cx:-48,cy:2,zoom:11,rot:-0.06},
 hot:['depot','whs','road','c_empty','i_depot','i_road'],
 mov:[{e:'c_empty',k:'container',a:0,b:1}],
 card:{tx:'اسناد مرحله: booking confirmation ، EIR (Equipment Interchange Receipt) ، pickup order. انتخاب تجهیز بر پایهٔ پروفایل بار: dry / reefer / OT / FR.',tr:'CLAIM',sr:'R-B §۲۱ / §۱۱'}},

{d:13,ch:'عملیات',ti:'۱۰ — عملیات مبدأ: بارگیری، VGM، پلمب',sb:'یک کانتینر کامل، متعلق به یک صاحب کالا',
 cam:{cx:-50,cy:4,zoom:12,rot:0.05},
 hot:['shipper','whs','c_fac','i_whs'],
 mov:[{e:'c_fac',k:'cube',a:0,b:1}],
 card:{tx:'الزام VGM (Verified Gross Mass): بدون ثبت VGM بارگیری ممنوع است — عرف صنعتی؛ استناد رسمی SOLAS (اصلاحیهٔ 2016): نامشخص (Unknown). اسناد: VGM certificate ، EIR ، container packing list.',tr:'CLAIM',sr:'R-B §۲۱'}},

{d:12,ch:'اسناد',ti:'۱۱ — اسناد صادرات',sb:'B/L ، فاکتور ، بسته‌بندی ، CO',
 cam:{cx:-30,cy:-4,zoom:10,rot:0},
 hot:['fwd','whs','expcus','i_docexp','i_whs'],
 mov:[{e:'i_docexp',k:'doc',a:0,b:1}],
 card:{tx:'فهرست مرجع ۳۴ سند؛ برای FCL اسناد اصلی: Commercial Invoice ، Packing List ، Shipping Instructions (SI) ، Bill of Lading ، Certificate of Origin ، VGM Certificate ، Export Declaration ، EIR. انواع release: Original / Telex–Express / Sea Waybill.',tr:'CLAIM',sr:'R-B §۲۲'}},

{d:12,ch:'گمرک',ti:'۱۲ — ترخیص گمرک صادرات',sb:'اظهار صادرات و غربالگری انطباق',
 cam:{cx:-34,cy:4,zoom:11,rot:0.07},
 hot:['expcus','whs','fwd','c_exp','i_exp','i_docexp'],
 mov:[{e:'c_exp',k:'truck',a:0,b:1}],
 card:{tx:'US CBP ISF (10+2): ۱۰ عنصر importer + ۲ عنصر carrier پیش از lading — در اجرا از 2009-01-26. EU UCC: Regulation (EU) 952/2013 — در اجرا از 2016-05-01. WCO Revised Kyoto — در اجرا از 2006-02-03. تاریخ effective واحد NCTS: نامشخص (Unknown).',tr:'VERIFIED',sr:'R-B §۲۳ — 2026-09-21'}},

{d:10,ch:'عملیات',ti:'۱۳ — تحویل به بندر و Gate-in',sb:'ورود به محوطهٔ کانتینری (CY) پیش از مهلت مقرر',
 cam:{cx:-28,cy:4,zoom:11,rot:-0.05},
 hot:['expcus','oport','road','rail','c_prt','c_rail','i_oport','i_road','i_rail'],
 mov:[{e:'c_prt',k:'truck',a:0,b:1}],
 card:{tx:'gate-in پس از cutoff → rollover به voyage بعد. اسناد: gate-in slip ، EIR ، dock receipt. کنترل: پایش پیوستهٔ cutoff‌ها.',tr:'CLAIM',sr:'R-B §۱۹ / §۲۱'}},

{d:14,ch:'حمل اصلی',ti:'۱۴ — حمل اصلی دریایی',sb:'بندر مبدأ → هاب ترانشیپمنت',
 cam:{cx:-12,cy:6,zoom:8,rot:0.03},
 hot:['oport','hub','line','c_sea1','c_alt','i_line','i_oport'],
 mov:[{e:'c_sea1',k:'ship',a:0,b:1}],
 card:{tx:'بندرهای کلیدی مبدأ (۲۰۲۴، هزار TEU): Shanghai ۵۱٬۵۰۶ — نخستین بندر بالای ۵۰ میلیون. Ningbo-Zhoushan: ۳۹٬۳۰۰ (WSC) در برابر ۳۸٬۹۰۰ — متناقض؛ هر دو مقدار نگه داشته شد. Shenzhen ۳۳٬۴۰۰ ، Busan ۲۴٬۴۰۲.',tr:'CONFLICT',sr:'R-B §۱۶'}},

{d:12,ch:'حمل اصلی',ti:'۱۵ — ترانشیپمنت',sb:'تخلیه و بارگیری مجدد همان کانتینر',
 cam:{cx:2,cy:6,zoom:11,rot:-0.04},
 hot:['hub','line','c_sea2','i_line','t_hub'],
 mov:[{e:'c_sea2',k:'ship',a:0,b:0.5}],
 card:{tx:'Singapore بزرگ‌ترین هاب ترانشیپمنت جهان: ۴۱٬۱۲۴ هزار TEU (۲۰۲۴). Jebel Ali: throughput ۱۵٫۵M TEU با ظرفیت ترمینال ۱۹٫۴M — متناقض: یک منبع کم‌اعتبار ۱۳٫۷M گفته است؛ هر دو نگه داشته شد. ریسک: miss-connection.',tr:'CONFLICT',sr:'R-B §۱۶ / §۲۴ / §۲۵'}},

{d:12,ch:'مقصد',ti:'۱۶ — ورود به بندر مقصد و تخلیه',sb:'تخلیه در ترمینال و اطلاعیهٔ ورود',
 cam:{cx:22,cy:4,zoom:10,rot:0.05},
 hot:['dport','agent','c_sea2','i_dport','i_agent'],
 mov:[{e:'c_sea2',k:'ship',a:0.5,b:1}],
 card:{tx:'Rotterdam بزرگ‌ترین gateway اتحادیهٔ اروپا: ۱۳٬۸۲۰ هزار TEU. San Pedro Bay: Los Angeles ۱۰٬۲۹۷ و Long Beach ۹٬۶۵۰. هزینه‌های مقصد: THC ، storage ، demurrage/detention احتمالی.',tr:'VERIFIED',sr:'R-B §۱۶ / §۲۵'}},

{d:13,ch:'گمرک',ti:'۱۷ — ترخیص گمرک واردات',sb:'اظهار واردات، عوارض، غربالگری تحریمی',
 cam:{cx:36,cy:0,zoom:11,rot:-0.06},
 hot:['impcus','broker','fwd','c_imp','i_docimp','i_imp','i_broker'],
 mov:[{e:'i_docimp',k:'doc',a:0,b:1},{e:'c_imp',k:'container',a:0,b:1}],
 card:{tx:'اظهار واردات / Entry Summary توسط کارگزار گمرک؛ غربالگری اجباری در برابر فهرست‌های تحریمی OFAC (منبع رسمی، Tier A)؛ کنترل four-eyes بر HS و screening. تاریخ effective صفحهٔ Entry Summary: نامشخص (Unknown).',tr:'VERIFIED',sr:'R-B §۲۳ / R-C §۳۱'}},

{d:11,ch:'مقصد',ti:'۱۸ — آزادسازی کانتینر و تحویل',sb:'اطلاعیهٔ ورود → صدور DO → آزادسازی',
 cam:{cx:40,cy:2,zoom:11.5,rot:0.04},
 hot:['impcus','agent','consignee','i_cons','i_agent'],
 mov:[{e:'i_cons',k:'doc',a:0,b:1}],
 card:{tx:'زنجیرهٔ آزادسازی: Arrival Notice → صدور Delivery Order (DO) → release کانتینر. انواع release: Original release (تحویل نسخهٔ اصل) ، Telex/Express release ، Sea Waybill release.',tr:'CLAIM',sr:'R-B §۲۲ / §۲۶'}},

{d:12,ch:'مقصد',ti:'۱۹ — آخرین مایل تا درِ گیرنده',sb:'حمل نهایی، تخلیه، بازگشت خالی',
 cam:{cx:48,cy:4,zoom:11.5,rot:-0.04},
 hot:['impcus','consignee','road','c_last','i_cons'],
 mov:[{e:'c_last',k:'truck',a:0,b:1}],
 card:{tx:'هزینه: last-mile haulage + detention احتمالی برای تأخیر در بازگشت خالی. ریسک: عدم حضور گیرنده، آسیب هنگام تحویل. کنترل: هماهنگی appointment.',tr:'CLAIM',sr:'R-B §۲۶'}},

{d:10,ch:'مقصد',ti:'۲۰ — رسید تحویل (POD)',sb:'بسته‌شدن مسیر فیزیکی',
 cam:{cx:50,cy:2,zoom:12,rot:0.03},
 hot:['consignee','fwd','i_cons','i_eta'],
 mov:[{e:'i_cons',k:'doc',a:1,b:0}],
 card:{tx:'Proof of Delivery (POD) امضاشده همراه با empty return / EIR چرخهٔ عملیاتی را می‌بندد؛ POD در فهرست ۳۴‌گانهٔ اسناد مرجع قرار دارد (سند شمارهٔ ۳۴).',tr:'CLAIM',sr:'R-B §۲۲ / §۲۶'}},

{d:12,ch:'مالی',ti:'۲۱ — جریان مالی',sb:'صورتحساب ، وصول ، پرداخت تأمین‌کننده ، تسویه',
 cam:{cx:-8,cy:-18,zoom:8.6,rot:-0.05},
 hot:['fwd','shipper','consignee','line','road','agent','ins','bank','m_cust','m_cons','m_line','m_road','m_agent','m_ins','m_bank'],
 mov:[{e:'m_cust',k:'coin',a:0,b:1},{e:'m_line',k:'coin',a:0,b:1},{e:'m_bank',k:'coin',a:0,b:1}],
 card:{tx:'چرخه: Invoicing → Disbursement → Collections → DSO. Cash Conversion = DSO − DPO؛ هرچه DPO ≥ DSO باشد فشار نقدی کمتر است. اعداد DSO/DPO هر بنگاه: نامشخص (Unknown) — فقط ساختار.',tr:'INFERENCE',sr:'R-C §۴۱ / R-B §۲۷'}},

{d:13,ch:'استثنا',ti:'۲۲ — ادعا و استثناها',sb:'استثنای قرمز: توقف گمرکی',
 cam:{cx:30,cy:-2,zoom:9.4,rot:0.06},risk:1,
 hot:['impcus','broker','ins','insp','fwd','c_imp','i_imp','i_ins','i_insp'],
 mov:[{e:'i_imp',k:'alert',a:1,b:0}],
 card:{tx:'۲۳ نوع exception فهرست شده است: rollover ، nil allocation ، missed cutoff (VGM/SI/gate-in) ، port congestion ، demurrage ، detention ، customs hold/inspection ، sanctions hold … مطالعهٔ موردی Red Sea: انحراف از Cape ≈ +۱۰–۱۴ روز (FACT)؛ premium نقل‌شده ~۲۵–۳۵٪ (FACT — سطح C / advisory). سقف مسئولیت Hague-Visby و مهلت notice: نامشخص (Unknown).',tr:'CLAIM',sr:'R-B §۲۸ / §۲۹ / R-D §۶۰'}},

{d:12,ch:'حاکمیت',ti:'۲۳ — برج کنترل و بازبینی عملکرد',sb:'یک مدل عملیاتی انسانی، نه سامانهٔ نرم‌افزاری',
 cam:{cx:4,cy:-18,zoom:8.2,rot:0},
 hot:['tower','fwd','oport','hub','dport','t_fwd','t_op','t_hub','t_dp'],
 card:{tx:'برج کنترل = مدل عملیاتی سازمانی/انسانی؛ آیین‌ها: هم‌ایستایی روزانه ، جلسهٔ استثناها ، بازبینی هفتگی کریر ، بازبینی ماهانهٔ KPI. حلقهٔ تصمیم: پایش → تشخیص → طبقه‌بندی → ارجاع → حل → ثبت → بازبینی. Benchmark: schedule reliability ۹۲٪ — Hapag-Lloyd (VERIFIED).',tr:'INFERENCE',sr:'R-B §۳۰'}},

{d:11,ch:'حاکمیت',ti:'۲۴ — ارزیابی تأمین‌کننده و بستن چرخه',sb:'از تقاضا تا تسویه، کنترل و یادگیری',
 cam:{cx:0,cy:-4,zoom:5.8,rot:-0.05},fin:1,
 hot:['fwd','line','agent','road','broker','rail','r_line','r_agent','r_road','r_broker','r_rail','tower'],
 card:{tx:'اسکورکارد تأمین‌کننده: Strategic / Preferred / Approved / Conditional / Do-Not-Use. اهداف نمونهٔ مرجع (Illustrative): OTP ≥ ۹۵٪ ، rollover ≤ ۳٪ ، دقت اسناد ≥ ۹۹٪ ، claims ≤ ۰٫۵٪. آستانه‌های واقعی هر بنگاه و وزن‌دهی اسکورکارد: نامشخص (Unknown).',tr:'INFERENCE',sr:'R-C §۳۱ / §۳۲'}}

,
{d:12,ch:'معماری',ti:'۲۵ — معماری مدل عملیاتی سرتاسری',sb:'۳۸ نقش، ۲۵ فرایند، ۱۰۰ گام و سه جریان ارزش',cam:{cx:-8,cy:-12,zoom:6,rot:.02},hot:['fwd','sales','pricing','docs','compliance','tower','i_sales','i_price','i_docs','i_comp','t_fwd'],card:{tx:'پایگاه مرجع: ۳۸ نقش داخلی و بیرونی، ۲۵ فرایند سرتاسری، ۱۰۰ گام، ۱۸ تراکنش، ۱۸ جریان ارزش، ۱۸ جریان فیزیکی و ۲۰ جریان اطلاعاتی. ستون فقرات: تقاضا → طراحی خدمت → خرید ظرفیت → اجرا → تسویه → یادگیری.',tr:'FACT',sr:'Database 02/04/05/06/27–30'}},
{d:12,ch:'تجاری',ti:'۲۶ — قرارداد، KYC، تحریم و اعتبار',sb:'Award فقط پس از عبور از دروازهٔ پذیرش مشتری عملیاتی می‌شود',cam:{cx:-30,cy:-22,zoom:8.2,rot:-.05},hot:['sales','fwd','bank','compliance','i_sales','i_comp','m_bank'],mov:[{e:'i_comp',k:'doc',a:1,b:0}],card:{tx:'PRC-008: پس از برد تجاری، Trading Terms، KYC/AML، screening طرفین، Credit Limit و شرایط پرداخت تثبیت می‌شود. Credit Control حق hold/release دارد؛ Sanctions Officer حق توقف تراکنش و ارجاع برای مجوز را دارد.',tr:'INFERENCE',sr:'PRC-008 · ACT-016/022 · SOP-036'}},
{d:13,ch:'چندوجهی',ti:'۲۷ — LCL و کنسولیدیشن در CFS',sb:'چند محموله، یک کانتینر؛ HBL برای هر shipper و MBL برای co-loader',cam:{cx:-35,cy:18,zoom:8.6,rot:.04},hot:['shipper','cfs','oport','road','c_lcl','i_whs'],mov:[{e:'c_lcl',k:'truck',a:0,b:1}],card:{tx:'PRC-012: دریافت، tally، کنترل packing، گروه‌بندی سازگار، stuffing و صدور House B/L. تصمیم‌های Supervisor: stow plan، grouping و hold/release. شکست محتمل: short-shipment، damage، mis-consolidation و missed cutoff.',tr:'INFERENCE',sr:'PRC-012 · ACT-012/029 · SOP-025'}},
{d:13,ch:'چندوجهی',ti:'۲۸ — Air Freight فوری و دماحساس',sb:'Chargeable Weight، ULD، AWB و کنترل زنجیرهٔ سرد',cam:{cx:6,cy:27,zoom:7.6,rot:-.04},hot:['airO','airD','qhse','c_air','i_qhse'],mov:[{e:'c_air',k:'cube',a:0,b:1}],card:{tx:'Air General/Express: booking و uplift، MAWB/HAWB، security screening، DG acceptance و temperature handling. کریر دربارهٔ allocation، embargo و prioritization تصمیم می‌گیرد. KPIها: flown-as-booked، transit time و zero temperature excursion.',tr:'INFERENCE',sr:'SVC-003/004 · ACT-026 · RFQ-003'}},
{d:13,ch:'چندوجهی',ti:'۲۹ — Rail، Middle Corridor و ترانزیت',sb:'ریل + کشتی خزر + ریل + جاده؛ چند مرز و چند رژیم گمرکی',cam:{cx:-2,cy:23,zoom:7.2,rot:.03},hot:['rail','dport','road','c_railmain','i_rail','i_broker'],mov:[{e:'c_railmain',k:'train',a:0,b:1}],card:{tx:'China–Europe Rail شامل slot، border handover و تغییر gauge است. Middle Corridor از Kazakhstan، Caspian، Azerbaijan، Georgia و Turkey می‌گذرد. برآوردهای منبع برای TITR: ۱۰–۱۵ روز در برابر ۱۴–۱۸ روز؛ هر دو مقدار حفظ می‌شوند.',tr:'CONFLICT',sr:'RTE-003/004 · PRC-017 · ACT-027'}},
{d:12,ch:'حاکمیت',ti:'۳۰ — واجدشرایط‌سازی و اسکورکارد تأمین‌کننده',sb:'Carrier، agent، haulier، CFS و broker با منطق واحد ارزیابی می‌شوند',cam:{cx:-6,cy:-18,zoom:7,rot:-.02},hot:['fwd','line','agent','road','rail','broker','r_line','r_agent','r_road','r_rail'],card:{tx:'دروازهٔ ورود: مجوز، بیمه، پوشش lane، توان DG، ظرفیت و سلامت مالی. اسکورکارد: OTP، rollover، پاسخ‌گویی، claims، SLA و دقت اسناد. طبقات: Strategic / Preferred / Approved / Conditional / Do-Not-Use.',tr:'INFERENCE',sr:'SUP-001…018 · KPI-025…027 · SOP-049/050'}},
{d:12,ch:'حاکمیت',ti:'۳۱ — معماری قرارداد و رژیم مسئولیت',sb:'هر رابطهٔ تجاری به قرارداد، سند حمل و رژیم مسئولیت متصل است',cam:{cx:-8,cy:-13,zoom:8,rot:.05},hot:['fwd','line','agent','shipper','consignee','i_line','i_agent','i_ship','i_cons'],card:{tx:'لایه‌ها: Master Trading Conditions، quotation، carrier service contract، agency agreement و B/L/AWB/CMR/CIM. رژیم‌ها: Hague-Visby، Montreal، CMR، CIM و TIR؛ حدود و مهلت‌ها باید در حوزهٔ قضایی هدف اعتبارسنجی شوند.',tr:'VERIFIED',sr:'Contracts 16 · Part C §32 · REG-004…008'}},
{d:11,ch:'ریسک',ti:'۳۲ — بیمه و انتقال ریسک',sb:'بار، liability، open cover و supplementary limits',cam:{cx:3,cy:-18,zoom:9,rot:-.04},hot:['fwd','ins','shipper','consignee','i_ins','m_ins'],mov:[{e:'i_ins',k:'doc',a:0,b:1}],card:{tx:'Cargo insurance خسارت کالا را پوشش می‌دهد؛ Forwarder Liability مسئولیت حرفه‌ای را؛ Open Cover پوشش تکرارشونده را ساده می‌کند. کنترل: declaration درست ارزش/کالا، exclusions، deductible، geographic scope و اتصال certificate به shipment.',tr:'INFERENCE',sr:'Part C §33 · ACT-033 · CON-010…014'}},
{d:13,ch:'ریسک',ti:'۳۳ — معماری ریسک: ۱۹ دسته',sb:'از ظرفیت و نرخ تا DG، تحریم، تقلب و نقدینگی',cam:{cx:7,cy:-20,zoom:6.9,rot:.04},risk:1,hot:['tower','fwd','compliance','qhse','bank','ins','t_fwd','i_comp','i_qhse','m_bank'],card:{tx:'ریسک‌های High-impact: کمبود ظرفیت؛ credit/non-payment؛ cargo loss؛ customs breach؛ sanctions؛ DG mis-declaration؛ geopolitical disruption؛ liquidity. هر ریسک به owner، control، exception و escalation متصل است.',tr:'INFERENCE',sr:'RSK-001…019 · Part C §34'}},
{d:12,ch:'ریسک',ti:'۳۴ — تقلب و کنترل‌های غیرنرم‌افزاری',sb:'Four-eyes، callback مستقل، اصل سند و تفکیک وظایف',cam:{cx:-10,cy:-20,zoom:7.8,rot:-.05},risk:1,hot:['fwd','docs','bank','agent','broker','i_docs','m_bank','i_agent'],mov:[{e:'i_docs',k:'alert',a:0,b:1}],card:{tx:'سناریوها: B/L جعلی یا گمشده، pickup ساختگی، تغییر اطلاعات بانکی، invoice manipulation و collusion. کنترل‌ها: چهارچشم، callback به شمارهٔ مستقل، تأیید تغییر حساب، segregation of duties، تطبیق سه‌طرفه و chain-of-custody.',tr:'INFERENCE',sr:'Part C §35 · RSK-014 · EXC-021'}},
{d:13,ch:'حاکمیت',ti:'۳۵ — ۵۲ SOP، RACI و حقوق تصمیم',sb:'هر فعالیت یک Responsible و یک Accountable روشن دارد',cam:{cx:-12,cy:-13,zoom:7.2,rot:.03},hot:['fwd','tower','sales','pricing','docs','compliance','i_sales','i_price','i_docs','i_comp','t_fwd'],card:{tx:'کتابخانه شامل ۵۲ SOP، ۲۵ ردیف RACI و ۲۰ حق تصمیم است. نمونه: margin در guardrail توسط Pricing؛ DG stop-work با QHSE؛ sanctions hold با Compliance؛ exception severity با Control Tower.',tr:'FACT',sr:'21_SOPs · 22_RACI · 35_Decision_Rights'}},
{d:12,ch:'حاکمیت',ti:'۳۶ — معماری KPI در ۱۰ دامنه',sb:'۳۰ شاخص از conversion تا HSE و supplier SLA',cam:{cx:4,cy:-20,zoom:7.5,rot:-.03},hot:['tower','fwd','line','agent','road','broker','t_fwd','t_op','t_hub','t_dp'],card:{tx:'اهداف مرجع: Quote TAT <۲۴h؛ booking <۱۲h؛ rollover <۳٪؛ OTD ≥۹۵٪؛ document accuracy ≥۹۸٪؛ screening=۱۰۰٪؛ DSO <۴۵ روز؛ claims <۵/۱۰۰۰؛ supplier SLA ≥۹۵٪؛ NPS ≥۴۰.',tr:'FACT',sr:'KPI-001…030 · Part C §39'}},
{d:12,ch:'مالی',ti:'۳۷ — اقتصاد واحد و سرمایه در گردش',sb:'Cost-to-Serve، accrual، FX، DSO/DPO و leakage',cam:{cx:-8,cy:-23,zoom:8.2,rot:.04},hot:['fwd','bank','shipper','consignee','line','road','m_cust','m_cons','m_line','m_road','m_bank'],mov:[{e:'m_cust',k:'coin',a:0,b:1},{e:'m_line',k:'coin',a:0,b:1}],card:{tx:'Gross Margin = Sell − Buy؛ Contribution پس از cost-to-serve. سود واقعی به accrual کامل، FX، unbilled cost و D&D وابسته است. Cash Conversion ≈ DSO − DPO؛ هدف مرجع DSO <۴۵ روز و bad debt <۰٫۵٪.',tr:'INFERENCE',sr:'Part C §40–41 · FIN-001…014'}},
{d:13,ch:'معماری',ti:'۳۸ — ۸ آرکی‌تایپ و ۲۲ مطالعهٔ موردی',sb:'Traditional، Digital، Broker، NVOCC، 3PL، 4PL/5PL، Integrator و Carrier-owned',cam:{cx:-2,cy:-5,zoom:5.9,rot:-.04},hot:['fwd','line','agent','road','rail','tower','shipper','consignee','r_line','r_agent','r_road','r_rail'],card:{tx:'Benchmark هشت مدل، حدود قانونی و منطق درآمد را تفکیک می‌کند. ۲۲ case از Hanjin bankruptcy و M&Aهای DSV تا Suez/Red Sea، الگوهای resilience، scale، visibility و supplier diversification را استخراج می‌کنند.',tr:'FACT',sr:'24_Benchmarks · 25_Case_Studies · Part D §50–52'}},
{d:14,ch:'سناریو',ti:'۳۹ — موتور ۱۰ سناریوی End-to-End',sb:'FCL، LCL، Air، Rail، Multimodal، Transit، Charter، Project و Exception',cam:{cx:0,cy:1,zoom:5.4,rot:.04},risk:1,hot:['shipper','consignee','fwd','oport','hub','dport','rail','airO','airD','tower','c_sea1','c_sea2','c_air','c_railmain','t_fwd'],mov:[{e:'c_sea1',k:'ship',a:0,b:1}],card:{tx:'سناریو ۹: بازمسیریابی Asia–Europe از Cape حدود ۱۰–۱۴ روز می‌افزاید. سناریو ۱۰: آتش‌سوزی کشتی + DG misdeclared → rescue، survey، notification، احتمال General Average، security، claim و recovery. هر سناریو Request→Settlement اجرا می‌شود.',tr:'FACT',sr:'Part D §60 · CASE-007 · RTE-002'}},
{d:13,ch:'ممیزی',ti:'۴۰ — ممیزی کامل بودن و تصمیم‌های باز',sb:'Unknown ≠ Assumption ≠ Contradiction؛ چرخه با validation plan بسته می‌شود',cam:{cx:0,cy:-7,zoom:5.6,rot:-.02},fin:1,hot:['fwd','tower','docs','compliance','qhse','bank','t_fwd','i_docs','i_comp','i_qhse','m_bank'],card:{tx:'ممیزی ۱۳ بُعد، ۳۰ Unknown، ۲۲ Assumption و ۱۱ فهرست نهایی را جدا نگه می‌دارد: دادهٔ غایب، شکاف پژوهش، اعتبارسنجی مقرراتی/عملیاتی/تأمین‌کننده، وابستگی حیاتی، single point of failure و open decision.',tr:'FACT',sr:'31_Coverage_Audit · 33/34 · Part D §54/63'}}

,
{d:13,ch:'داده‌مرجع',ti:'۴۱ — سبد ۱۶ خدمت و ۱۲ RFQ مرجع',sb:'از FCL/LCL و Air Express تا Rail، Project بار، Customs و Contract Logistics',cam:{cx:-25,cy:-14,zoom:6.8,rot:.03},hot:['sales','pricing','fwd','shipper','consignee','i_sales','i_price','i_ship','i_cons'],mov:[{e:'i_sales',k:'doc',a:0,b:1}],card:{tx:'Taxonomy خدمات، scope included/excluded و segment هدف را تفکیک می‌کند. ۱۲ RFQ نمونه شامل FCL Shanghai→Rotterdam، LCL Ningbo→Hamburg، Pharma Air PVG→FRA، Rail Xi’an→Duisburg و پروژه‌های چندوجهی است؛ هر RFQ به route، mode، commodity، volume و Incoterm متصل می‌شود.',tr:'FACT',sr:'03_Services SVC-001…016 · 12_RFQ RFQ-001…012'}},
{d:12,ch:'داده‌مرجع',ti:'۴۲ — ۲۲ جزء قیمت و Rate Build-Up',sb:'Ocean/Air freight، BAF، CAF، THC، drayage، documentation، duty و risk buffer',cam:{cx:-20,cy:-22,zoom:7.8,rot:-.04},hot:['pricing','fwd','line','road','bank','i_price','m_line','m_road','m_bank'],mov:[{e:'m_line',k:'coin',a:0,b:1}],card:{tx:'هر charge با Cost-or-Sell، mode، route، basis-of-charge و buy-rate source ثبت می‌شود. FCL per-container؛ Air per chargeable kg؛ CAF درصد freight؛ THC و drayage به node/leg متصل‌اند. کنترل حرفه‌ای: validity، currency، pass-through، markup، accrual و quote-to-invoice variance <۵٪.',tr:'INFERENCE',sr:'13_Pricing PRI-001…022 · KPI-004 · Part C §40'}},
{d:13,ch:'داده‌مرجع',ti:'۴۳ — زنجیرهٔ ۳۲ سند و Release Logic',sb:'Commercial، operational، transport، customs، finance، insurance و delivery evidence',cam:{cx:-27,cy:-8,zoom:9.2,rot:.04},hot:['docs','fwd','shipper','consignee','broker','i_docs','i_ship','i_cons','i_broker'],mov:[{e:'i_docs',k:'doc',a:0,b:1},{e:'i_cons',k:'doc',a:0,b:1}],card:{tx:'Commercial Invoice، Packing List، SLI، SI، B/L، AWB، CMR/CIM، CoO، VGM، EIR، declarations، insurance certificate، survey report، invoice و POD با issuer/receiver، mode و mandatory/optional ثبت شده‌اند. کنترل release باید Original، Telex/Express و Sea Waybill را از هم جدا کند.',tr:'FACT',sr:'14_Documents DOC-001…032 · Part B §22'}},
{d:13,ch:'داده‌مرجع',ti:'۴۴ — ۱۲ رویهٔ گمرکی و ۲۳ مقرره',sb:'WCO، UCC/NCTS، CBP، TIR، Incoterms و الزامات مودال',cam:{cx:32,cy:-18,zoom:7.8,rot:-.03},risk:1,hot:['compliance','qhse','broker','expcus','impcus','fwd','i_comp','i_exp','i_imp','i_broker'],mov:[{e:'i_comp',k:'alert',a:0,b:1}],card:{tx:'هر رویهٔ گمرکی به authority، regulation، trigger و اسناد متصل است. نمونه‌ها: EU UCC و Common/Union Transit در NCTS؛ US ISF 10+2 و Entry Summary؛ WCO SAFE/RKC؛ TIR. edition/effective-dateهای نامطمئن باید در backlog اعتبارسنجی باقی بمانند، نه در facts.',tr:'VERIFIED',sr:'15_Customs CUS-001…012 · 26_Regulations REG-001…023'}},
{d:12,ch:'داده‌مرجع',ti:'۴۵ — ۱۴ نوع Claim و مسیر Recovery',sb:'Notice → mitigation → survey → liability → reserve → settlement → subrogation',cam:{cx:4,cy:-18,zoom:8.8,rot:.04},risk:1,hot:['ins','insp','fwd','line','road','docs','i_ins','i_insp','i_docs'],mov:[{e:'i_ins',k:'doc',a:0,b:1}],card:{tx:'Claims مرجع شامل sea damage/loss، air damage/delay، road، rail، theft، temperature excursion، shortage، demurrage dispute و General Average است. هر claim به trigger، claimant، liable party، رژیم مسئولیت و بستهٔ سند متصل می‌شود؛ هدف مرجع settlement <۶۰ روز و recovery ≥۶۰٪ است.',tr:'INFERENCE',sr:'18_Claims CLM-001…014 · KPI-022…024 · SOP-033/035'}},
{d:13,ch:'داده‌مرجع',ti:'۴۶ — معماری سه‌جریانی: فیزیکی، اطلاعاتی و ارزش',sb:'۱۸ جریان فیزیکی + ۲۰ اطلاعاتی + ۱۸ جریان ارزش؛ همگی با trigger و owner',cam:{cx:0,cy:-2,zoom:5.7,rot:-.04},hot:['shipper','consignee','fwd','oport','hub','dport','line','road','bank','c_fac','c_sea1','c_sea2','c_last','i_ship','i_line','i_cons','m_cust','m_line'],card:{tx:'Physical Flow از premises/CFS/CY تا main carriage و delivery؛ Information Flow از enquiry و quote تا booking، milestone، customs و POD؛ Value Flow از customer revenue تا carrier، trucker، CFS، agent، duty و insurance disbursement. تطبیق سه جریان برای job close و margin واقعی ضروری است.',tr:'FACT',sr:'28_Value_Flows VF-001…018 · 29 PF-001…018 · 30 IF-001…020'}},
{d:12,ch:'شواهد',ti:'۴۷ — ۱۲۹ منبع و انضباط شواهد',sb:'Primary/official، secondary و reference-model از هم جدا نگه داشته می‌شوند',cam:{cx:0,cy:-18,zoom:6.8,rot:.03},hot:['tower','docs','compliance','fwd','i_docs','i_comp','t_fwd'],card:{tx:'هر گزاره باید source ID، نوع منبع، ناشر، URL، تاریخ دسترسی و وضعیت verification داشته باشد. Official/Primary برای مقررات و اعداد کلیدی اولویت دارد؛ secondary برای triangulation؛ reference-model برای طراحی عملیاتی با برچسب Inferred. تعارض‌ها حذف نمی‌شوند و Unknown به Fact تبدیل نمی‌شود.',tr:'FACT',sr:'32_Research_Sources SRC-001…129 · README §4'}},
{d:13,ch:'شواهد',ti:'۴۸ — بستهٔ کامل، قابل‌ردیابی و آمادهٔ اعتبارسنجی',sb:'۳۶ شیت، ۱۳ بُعد ممیزی، ۳۰ Unknown، ۲۲ Assumption و ۱۱ فهرست اقدام',cam:{cx:0,cy:-7,zoom:5.3,rot:-.02},fin:1,hot:['fwd','tower','sales','pricing','docs','compliance','qhse','bank','line','agent','road','rail','t_fwd','i_sales','i_price','i_docs','i_comp','m_bank'],card:{tx:'خروجی نهایی یک مدل بسته اما نه قطعی است: تمام role/process/document/control/KPI/risk/sourceها با ID قابل ردیابی‌اند؛ completeness audit شکاف‌ها را آشکار می‌کند؛ validation backlog مالک، روش و اثر خطا را مشخص می‌سازد. تصمیم نهایی فقط پس از fit-to-company و country/corridor validation گرفته می‌شود.',tr:'FACT',sr:'00_README · 31_Coverage_Audit · Part D §54/61–64'}}

,
{d:13,ch:'شبکه جهانی',ti:'۴۹ — نقشهٔ ۵۲ نهاد، ۱۰ کریر و ۲۰ گره',sb:'Forwarderها، parent groupها، خطوط، اپراتورها و gatewayها در یک مدل رابطه‌ای',cam:{cx:-2,cy:-7,zoom:5.2,rot:.03},hot:['fwd','line','agent','road','rail','oport','hub','dport','airO','airD','cfs','tower','r_line','r_agent','r_road','r_rail'],card:{tx:'Entity master شامل ۵۲ شرکت/گروه و نسبت‌های ownership است؛ Carrier master ده تأمین‌کنندهٔ مودال را تفکیک می‌کند؛ Node master پانزده بندر واقعی و پنج نوع گره عمومی را پوشش می‌دهد. اتصال Entity↔Carrier↔Node برای جلوگیری از نام‌های تکراری و تحلیل شبکه ضروری است.',tr:'FACT',sr:'01_Entities ENT-0001…052 · 08_Nodes · 10_Carriers'}},
{d:13,ch:'شبکه جهانی',ti:'۵۰ — ساختار ظرفیت و سهم خطوط کانتینری',sb:'ناوگان جهانی 34.75M TEU؛ Top carriers و alliance capacity',cam:{cx:-2,cy:-22,zoom:7.2,rot:-.04},hot:['line','fwd','oport','hub','dport','r_line','i_line'],mov:[{e:'i_line',k:'cube',a:0,b:1}],card:{tx:'دادهٔ مرجع: MSC 7,437,394 TEU / 21.6٪؛ Maersk 4,753,254 / 13.8٪؛ CMA CGM 4,411,667 / 12.8٪؛ COSCO 3,648,800 / 10.6٪؛ Hapag-Lloyd 2,392,174 / 6.9٪. ظرفیت alliance ثبت‌شده: 3.4M و 3.8M TEU. اعداد snapshot هستند و باید با تاریخ دسترسی خوانده شوند.',tr:'VERIFIED',sr:'09_Capacity CAP-003…012 · 10_Carriers CAR-001…005'}},
{d:13,ch:'شبکه جهانی',ti:'۵۱ — سلسله‌مراتب ۱۵ بندر و Throughput',sb:'Shanghai، Singapore، Ningbo، Shenzhen، Busan، Jebel Ali و gatewayهای اروپا/آمریکا',cam:{cx:5,cy:10,zoom:5.7,rot:.04},hot:['oport','hub','dport','line','tower','c_sea1','c_sea2','t_op','t_hub','t_dp'],mov:[{e:'c_sea1',k:'ship',a:0,b:1}],card:{tx:'Throughput 2024 (هزار TEU): Shanghai 51,506؛ Singapore 41,124؛ Ningbo 39,300 در برابر ≈38,900؛ Shenzhen 33,400؛ Busan 24,402؛ Jebel Ali 15,536 با ظرفیت 19.4M؛ Rotterdam 13,820؛ Los Angeles 10,297؛ Long Beach 9,650. Throughput با design capacity یکسان نیست.',tr:'CONFLICT',sr:'08_Nodes NODE-001…015 · CAP-001/002'}},
{d:12,ch:'روابط',ti:'۵۲ — ۲۸ رابطهٔ بازیگری و Contract Linkage',sb:'Customer–Forwarder، Buyer–Supplier، Agent Network، Authority و Financial Settlement',cam:{cx:-7,cy:-13,zoom:6.6,rot:-.03},hot:['shipper','consignee','fwd','line','agent','road','broker','bank','ins','i_ship','i_cons','i_line','i_agent','m_cust','m_line','m_bank'],card:{tx:'هر رابطه from/to، نوع، جهت، شرح، قرارداد و ارزش مبادله‌شده دارد. مثال: Operations↔Shipper تحت Master Terms؛ Procurement↔Ocean Carrier تحت Service Contract؛ Forwarder↔Agent تحت Agency Agreement؛ Finance↔Bank برای settlement. این لایه پایهٔ RACI و contract accountability است.',tr:'FACT',sr:'27_Actors_Relationships REL-001…028 · 16_Contracts'}},
{d:13,ch:'کنترل',ti:'۵۳ — کتابخانهٔ ۵۲ SOP، ۲۵ RACI و ۲۰ Decision Right',sb:'کنترل اجرایی از Quote Approval تا DG Stop-Work و Credit Hold',cam:{cx:-9,cy:-16,zoom:6.8,rot:.04},hot:['tower','fwd','sales','pricing','docs','compliance','qhse','bank','i_sales','i_price','i_docs','i_comp','i_qhse','t_fwd'],card:{tx:'SOPها trigger، owner، steps، input/output، control point و escalation دارند. RACI یک Accountable روشن برای هر فعالیت نگه می‌دارد. Decision Rights آستانه‌ها را مشخص می‌کند: sell-price زیر margin، buy-rate خارج budget، credit hold، DG acceptance، sanctions clear/hold و exception escalation.',tr:'FACT',sr:'21_SOPs SOP-001…052 · 22_RACI 25 rows · 35_Decision_Rights 20 rows'}},
{d:13,ch:'کنترل',ti:'۵۴ — Heatmap ریسک، Exception و نقاط شکست',sb:'۱۹ ریسک، ۲۴ Exception و مالک/کنترل/Recovery برای هر مورد',cam:{cx:8,cy:-18,zoom:6.9,rot:-.04},risk:1,hot:['tower','fwd','compliance','qhse','bank','ins','impcus','i_comp','i_qhse','m_bank','t_fwd'],mov:[{e:'i_comp',k:'alert',a:0,b:1}],card:{tx:'Exception taxonomy از rollover، blank sailing، congestion و missed cutoff تا DG rejection، sanctions hit، temperature excursion، cargo theft و payment default را پوشش می‌دهد. Risk Heatmap احتمال×اثر را با owner و control پیوند می‌دهد؛ High-impactها باید contingency، communication و recovery option از پیش تعریف‌شده داشته باشند.',tr:'INFERENCE',sr:'19_Exceptions EXC-001…024 · 20_Risks RSK-001…019'}},
{d:12,ch:'اعتبارسنجی',ti:'۵۵ — ۳۰ Unknown، ۲۲ Assumption و ۳۳ Audit Row',sb:'Backlog اعتبارسنجی با اثر خطا، روش بررسی و مالک تصمیم',cam:{cx:0,cy:-18,zoom:6.8,rot:.03},hot:['tower','docs','compliance','fwd','i_docs','i_comp','t_fwd'],card:{tx:'Unknownها شامل edition/effective-date مقررات، دادهٔ live rate، SLA واقعی و thresholdهای بنگاه‌اند. Assumptionها fit مرجع به شرکت، ترکیب نقش‌ها و RACI نمونه را پوشش می‌دهند. Coverage Audit برای هر بُعد count، verified/unknown و missing gap ثبت می‌کند؛ هیچ backlog item نباید بی‌مالک بماند.',tr:'FACT',sr:'31_Coverage_Audit 33 rows · 33_Unknowns 30 · 34_Assumptions 22'}},
{d:14,ch:'جمع‌بندی',ti:'۵۶ — Executive Control Surface و بستن مدل',sb:'از ۳۶ شیت و ۱۲۹ منبع تا ۷۵ صحنهٔ قابل‌ردیابی و قابل‌اجرا',cam:{cx:0,cy:-6,zoom:5.1,rot:-.02},fin:1,hot:['fwd','tower','sales','pricing','docs','compliance','qhse','bank','line','agent','road','rail','shipper','consignee','t_fwd','i_sales','i_price','i_docs','i_comp','m_bank'],card:{tx:'مدل نهایی، تصمیم را جایگزین نمی‌کند؛ تصمیم را قابل‌ردیابی می‌کند. هر صحنه به role، process، output، control، failure mode، KPI، evidence و validation need متصل است. اجرای واقعی نیازمند calibration با ساختار شرکت، live rates، قراردادها، country/corridor rules و delegated authorities است.',tr:'FACT',sr:'Database 36 sheets · 129 sources · 75 scenes · validation-ready'}}

,
{d:13,ch:'بنچمارک',ti:'۵۷ — هشت آرکی‌تایپ مدل عملیاتی',sb:'Traditional، Digital، Broker، NVOCC، 4PL، 5PL، Marketplace و Integrated Provider',cam:{cx:-2,cy:-8,zoom:5.4,rot:.03},hot:['fwd','line','agent','road','rail','tower','sales','pricing','docs','shipper','consignee','r_line','r_agent','r_road','r_rail'],card:{tx:'Traditional Forwarder روی orchestration و margin ظرفیت؛ Digital روی channel فناوری؛ Broker روی matching؛ NVOCC به‌عنوان carrier قراردادی با own B/L؛ 4PL روی neutral orchestration؛ 5PL روی network aggregation؛ Marketplace روی many-to-many transaction؛ ILP روی ترکیب forwarding، warehousing و distribution متمایز می‌شوند.',tr:'INFERENCE',sr:'24_Benchmarks BMK-001…008 · Part A §7.4'}},
{d:13,ch:'مطالعه موردی',ti:'۵۸ — شکست، ورشکستگی و Consolidation',sb:'Hanjin، Panalpina، Agility GIL، Schenker، Ziegler و Convoy',cam:{cx:-5,cy:-15,zoom:6.7,rot:-.04},risk:1,hot:['tower','fwd','line','agent','bank','ins','t_fwd','i_line','i_agent','m_bank'],mov:[{e:'i_line',k:'alert',a:1,b:0}],card:{tx:'Hanjin: حدود US$14bn کالا و ≈540,000 کانتینر در معرض اختلال؛ نیاز به carrier-independent visibility. DSV roll-up: Panalpina 2019، Agility GIL 2021 و Schenker تکمیل 30-Apr-2025. Ziegler Belgium در 2026 به شبکه‌های دیگر جذب شد. Convoy در 2023 پس از freight recession تعطیل شد.',tr:'CONFLICT',sr:'CASE-001…006 · 25_Case_Studies'}},
{d:13,ch:'مطالعه موردی',ti:'۵۹ — اختلال Chokepoint و پاسخ شبکه',sb:'Ever Given، Red Sea/Cape و Self-Chartering دوران COVID',cam:{cx:0,cy:7,zoom:6.3,rot:.04},risk:1,hot:['oport','hub','dport','line','tower','c_sea1','c_sea2','c_alt','t_op','t_hub','t_dp'],mov:[{e:'c_alt',k:'ship',a:0,b:1}],card:{tx:'Ever Given کانال سوئز را 23–29 Mar 2021 مسدود کرد و backlog حدود 150 کشتی ایجاد شد. Red Sea rerouting مسیر Cape را با +10–14 روز فعال کرد. در 2021 برخی BCOها برای تضمین ظرفیت self-charter کردند: Coca-Cola سه bulk vessel، Costco هفت vessel و نمونه‌های Home Depot/Walmart.',tr:'FACT',sr:'CASE-009…011 · RTE-002 · Part C §44'}},
{d:13,ch:'مطالعه موردی',ti:'۶۰ — الگوهای مثبت عملیاتی و Project Logistics',sb:'Sea-Air Pharma، Solar+BESS Control Tower و B747F Charter',cam:{cx:4,cy:10,zoom:6.2,rot:-.03},hot:['airO','airD','oport','dport','tower','qhse','c_air','c_sea1','t_fwd','i_qhse'],mov:[{e:'c_air',k:'cube',a:0,b:1}],card:{tx:'K+N برای داروی 15–25°C مسیر Istanbul→Singapore→Sydney را با Sea-Air و cold-chain certified storage اجرا کرد. CEVA برای پروژه Solar+BESS عربستان، 2,000 کانتینر 40’HC را با control tower، hazmat/QA و review cadence هماهنگ کرد. Case B747F توربین، نمونهٔ outsize charter است اما جزئیات آن light-verified باقی می‌ماند.',tr:'CONFLICT',sr:'CASE-012/013/015 · Part D §51C/D'}},
{d:12,ch:'اجراپذیری',ti:'۶۱ — الگوی Problem → Pattern → Mechanism',sb:'هر راهکار فقط وقتی معتبر است که trigger، owner، control و failure path داشته باشد',cam:{cx:-6,cy:-13,zoom:6.6,rot:.03},hot:['fwd','tower','sales','pricing','docs','compliance','qhse','bank','i_sales','i_price','i_docs','i_comp','t_fwd'],card:{tx:'Pattern library مسئله را به سازوکار عملیاتی تبدیل می‌کند: کمبود ظرفیت→dual sourcing/allocation mix؛ عدم قطعیت مسیر→candidate routes + decision gate؛ خطای سند→four-eyes + cutoff؛ اختلال→control tower + escalation؛ liquidity→credit hold + accrual discipline. Example و Applicability مانع کپی‌برداری کور می‌شوند.',tr:'INFERENCE',sr:'Part D §52 · SOP/Risk/Control cross-links'}},
{d:13,ch:'اجراپذیری',ti:'۶۲ — تست WHO → DOES WHAT → IF IT FAILS',sb:'۳۰ عنصر Operating Model با ۱۴ عدسی تحلیل و Cross-Link کامل',cam:{cx:-3,cy:-16,zoom:6.4,rot:-.04},hot:['fwd','tower','sales','pricing','docs','compliance','qhse','line','agent','road','bank','t_fwd'],card:{tx:'برای هر عنصر باید مسئول، عمل، ذی‌نفع، مکان، trigger، counterparty، capacity، contract/rule، document، KPI، risk، control، cost/revenue و failure mode مشخص باشد. ۳۰ ردیف Integrated Operating Model از acquisition تا sanctions management این ردپای ردیابی را نگه می‌دارند.',tr:'FACT',sr:'36_Operating_Model OM-001…030 · Part D §61–62'}},
{d:12,ch:'اعتبارسنجی',ti:'۶۳ — Heatmap پوشش ۳۳ بُعد',sb:'Complete، Partial و Gap-Flagged با verified/unknown count و missing gap',cam:{cx:1,cy:-18,zoom:6.5,rot:.03},hot:['tower','docs','compliance','fwd','i_docs','i_comp','t_fwd'],card:{tx:'نمونه ممیزی: Entities 52 با 36 verified؛ Routes 8 با 2 verified؛ Nodes 20 با 5 verified؛ Capacity 12 secondary-sourced؛ Carriers 10 با 3 placeholder؛ Customs و Regulations gap-flagged؛ Benchmarks 12 با 4 verified؛ Cases 22 با 6 verified؛ Sources 129 کامل. Completion بدون evidence quality گمراه‌کننده است.',tr:'FACT',sr:'31_Coverage_Audit AUD-001…033'}},
{d:13,ch:'مدل فرایندی',ti:'۶۴ — دروازهٔ صلاحیت تأمین‌کننده',sb:'KYB/KYC، مجوز، بیمه، AEO، توان مالی و قرارداد چارچوب',cam:{cx:-7,cy:-17,zoom:6.6,rot:.03},hot:['fwd','line','agent','road','rail','broker','compliance','ins','r_line','r_agent','r_road','r_rail','i_comp','i_ins'],card:{tx:'زنجیرهٔ پذیرش تأمین‌کننده از ثبت‌نام آغاز می‌شود: احراز هویت حقوقی KYB/KYC، اعتبار مجوز و بیمهٔ مسئولیت CMR، بررسی FIATA/BIFA، وضعیت AEO، توان مالی و پوشش بیمه‌ای. دروازهٔ تصمیم سه خروجی دارد: رد، دورهٔ آزمایشی محدود یا فعال‌سازی؛ سپس SLA، سطح عضویت و کارت نرخ منتشر می‌شود.',tr:'INFERENCE',sr:'فایل مرجع جدید · Supplier Qualification · 11 node'}},
{d:13,ch:'مدل فرایندی',ti:'۶۵ — دریافت هوشمند RFQ و حلقهٔ تکمیل داده',sb:'OCR/LLM → استانداردسازی → کنترل کامل‌بودن → پرسش هدفمند',cam:{cx:-28,cy:-9,zoom:7.2,rot:-.04},hot:['shipper','sales','docs','fwd','i_ship','i_sales','i_docs'],mov:[{e:'i_ship',k:'doc',a:0,b:1},{e:'i_sales',k:'doc',a:0,b:1}],card:{tx:'درخواست حمل و اسناد تجاری با OCR/LLM استخراج می‌شوند؛ سپس mode، route، commodity، HS، Incoterm، وزن و ابعاد استاندارد می‌گردند. اگر داده ناقص باشد، سامانه به‌جای حدس‌زدن پرسش هدفمند تولید می‌کند و پس از تکمیل دوباره اعتبارسنجی می‌شود. مرجع واحد حقیقت پیش از قیمت‌گذاری شکل می‌گیرد.',tr:'INFERENCE',sr:'فایل مرجع جدید · Marketplace & Pricing · Data-completeness gateway'}},
{d:13,ch:'مدل فرایندی',ti:'۶۶ — انطباق چندلایه و Stop/Review/Clear',sb:'OFAC، dual-use، export license، IMDG و IATA DGR',cam:{cx:-19,cy:-18,zoom:7.5,rot:.04},risk:1,hot:['compliance','qhse','broker','expcus','fwd','i_comp','i_qhse','i_broker','i_exp'],mov:[{e:'i_comp',k:'alert',a:0,b:1}],card:{tx:'پس از کامل‌شدن داده، طرفین و کشورها در برابر تحریم غربال می‌شوند؛ کالای دومنظوره و مجوز صادرات، سپس DG تحت IMDG/IATA DGR کنترل می‌شود. نتیجهٔ دروازهٔ انطباق: Clear برای ادامه، Review برای تصمیم مسئول انطباق، یا Block برای توقف درخواست و آزادسازی ظرفیت.',tr:'INFERENCE',sr:'فایل مرجع جدید · Compliance decision tree · OFAC/IMDG/IATA DGR'}},
{d:13,ch:'مدل فرایندی',ti:'۶۷ — Quote پویا، اعتبار نرخ و Hold ظرفیت',sb:'Landed Cost + BAF/CAF/PSS + Credit Limit + DSO',cam:{cx:-14,cy:-16,zoom:7.3,rot:-.03},hot:['pricing','fwd','line','bank','sales','i_price','i_line','m_bank','r_line'],mov:[{e:'i_line',k:'doc',a:1,b:0},{e:'m_bank',k:'coin',a:0,b:1}],card:{tx:'پیشنهاد چندوجهی با ریسک مسیر رتبه‌بندی و Landed Cost محاسبه می‌شود. اگر اعتبار Quote منقضی شود، BAF/CAF و PSS بازاعمال می‌شوند. سفارش قطعی فقط پس از Hold موقت ظرفیت، کنترل Credit Limit و DSO به رزرو تأمین‌کننده تبدیل می‌شود؛ رد رزرو با کد دلیل، ظرفیت را آزاد و گزینهٔ جایگزین را فعال می‌کند.',tr:'INFERENCE',sr:'فایل مرجع جدید · Dynamic pricing & booking loop'}},
{d:13,ch:'مدل فرایندی',ti:'۶۸ — ماتریس اسناد، eBL و کنترل UCP 600',sb:'نسخه‌بندی، امضای دیجیتال، HBL/MBL، مانیفست و Release Logic',cam:{cx:-24,cy:-7,zoom:7.8,rot:.04},hot:['docs','bank','line','shipper','expcus','i_docs','i_line','i_ship','i_exp','m_bank'],mov:[{e:'i_docs',k:'doc',a:0,b:1},{e:'i_line',k:'doc',a:0,b:1}],card:{tx:'ماتریس اسناد لازم بر اساس کالا، مسیر، شیوه و LC تعیین می‌شود. کنترل متقابل تحت UCP 600، رفع نقص، امضای دیجیتال و نسخه‌بندی پیش از CoO/SPS و VGM انجام می‌شود. HBL، MBL و مانیفست باید سازگار باشند؛ Release میان eBL/Telex و نسخهٔ اصل/LOI یک تصمیم کنترل‌شده است.',tr:'INFERENCE',sr:'فایل مرجع جدید · Execution & Documents · UCP 600/eBL/LOI'}},
{d:13,ch:'مدل فرایندی',ti:'۶۹ — گمرک سه‌مسیره و ترانزیت تضمین‌شده',sb:'Green/Yellow/Red، ارزش‌گذاری WTO، SPS، TIR/NCTS و ATA',cam:{cx:32,cy:-4,zoom:7.2,rot:-.04},risk:1,hot:['expcus','impcus','broker','rail','road','compliance','i_exp','i_imp','i_broker','i_rail'],mov:[{e:'i_imp',k:'alert',a:0,b:1},{e:'c_railmain',k:'train',a:0,b:1}],card:{tx:'اظهار واردات پس از ثبت سفارش و پیش‌اظهار ISF/ENS به مسیر قرمز، زرد یا سبز هدایت می‌شود. کنترل‌ها شامل بازرسی فیزیکی، ارزش‌گذاری WTO، قواعد مبدأ و SPS است. در ترانزیت، TIR/NCTS، تضمین و ATA کنترل و در پایان ابطال می‌شوند؛ عدم تسویه، مطالبه از زنجیرهٔ ضمانت و CAPA را فعال می‌کند.',tr:'INFERENCE',sr:'فایل مرجع جدید · Customs/Transit subprocesses · 23 customs nodes'}},
{d:13,ch:'مدل فرایندی',ti:'۷۰ — دفتر رویداد، ETA پیش‌بین و Free Time',sb:'Normalization → Deduplication → Immutable Event Ledger → Predictive ETA',cam:{cx:4,cy:-8,zoom:6.2,rot:.03},hot:['tower','line','oport','hub','dport','road','t_fwd','t_op','t_hub','t_dp','i_line','i_eta'],mov:[{e:'c_sea2',k:'ship',a:0,b:1}],card:{tx:'رویدادهای کریر، AIS، ترمینال و آخرین مایل نرمال، تکرارها حذف و تعارض منابع حل می‌شود؛ سپس در دفتر رویداد تغییرناپذیر ثبت می‌گردد. ETA پیش‌بین و شمارش Free Time از همان خط رویداد تغذیه می‌شوند تا ریسک دمورج پیش از وقوع و با مالک مشخص هشدار داده شود.',tr:'INFERENCE',sr:'فایل مرجع جدید · Control Tower & Event Management'}},
{d:14,ch:'مدل فرایندی',ti:'۷۱ — موتور استثنا و Human-in-the-Loop',sb:'۷ شاخهٔ رخداد، شدت، مالک، تأیید انسانی، اقدام اصلاحی و CAPA',cam:{cx:5,cy:-18,zoom:6.7,rot:-.03},risk:1,hot:['tower','fwd','qhse','compliance','ins','impcus','line','road','i_qhse','i_comp','i_ins','i_imp','t_fwd'],mov:[{e:'i_comp',k:'alert',a:0,b:1}],card:{tx:'Exception Engine هفت شاخهٔ صریح دارد: rollover/capacity، کمبود تجهیز/شاسی، انحراف دمای ریفر، توقف گمرکی، اختلال مسیر، اعتصاب/فورس‌ماژور و سرقت/امنیت. پس از تعیین شدت و مالک، اقدام پرریسک نیازمند تأیید اپراتور است؛ اثر هزینه، ریشه‌یابی و CAPA به دفتر رویداد بازمی‌گردد.',tr:'INFERENCE',sr:'فایل مرجع جدید · 7 exception branches · Human approval gate'}},
{d:13,ch:'مدل فرایندی',ti:'۷۲ — تسویه امانی، FX و Profit Share',sb:'تطبیق سه‌جانبه، Credit Note، Escrow، آزادسازی مشروط و تسویه',cam:{cx:-7,cy:-21,zoom:7.2,rot:.04},hot:['bank','fwd','agent','line','road','shipper','consignee','m_bank','m_agent','m_line','m_road','m_cust','m_cons'],mov:[{e:'m_cust',k:'coin',a:0,b:1},{e:'m_bank',k:'coin',a:0,b:1},{e:'m_agent',k:'coin',a:0,b:1}],card:{tx:'صورتحساب با تطبیق سه‌جانبه صادر می‌شود؛ مغایرت به Credit Note و بازتطبیق می‌رود. وجه در Escrow نگهداری، FX پوشش و پس از تحقق شرط آزاد می‌شود. سپس کارمزد پلتفرم، تسویهٔ تأمین‌کننده و Profit Share ایجنت خارجی محاسبه می‌شود؛ DSO، سرمایه در گردش و ذخیرهٔ مطالبات مشکوک‌الوصول بسته می‌شوند.',tr:'INFERENCE',sr:'فایل مرجع جدید · Finance & Settlement · 16 nodes'}},
{d:13,ch:'مدل فرایندی',ti:'۷۳ — Claims، General Average و Subrogation',sb:'Notice deadline → Survey → Liability Regime → Reserve → Settlement/Reject',cam:{cx:4,cy:-18,zoom:7.4,rot:-.04},risk:1,hot:['ins','insp','fwd','line','road','docs','i_ins','i_insp','i_docs'],mov:[{e:'i_ins',k:'doc',a:0,b:1}],card:{tx:'رزرو حق ادعا روی POD و اعلام خسارت باید در مهلت قانونی ثبت شود. بازرس مستقل علت و میزان را مستند می‌کند؛ رژیم مسئولیت و General Average بررسی می‌شود. پذیرش پوشش به پرداخت و جانشینی می‌رسد؛ رد باید مستدل باشد. حق Subrogation می‌تواند خسارت را از تسویهٔ مقصر کسر کند.',tr:'INFERENCE',sr:'فایل مرجع جدید · Insurer/Surveyor · Claims & recovery flow'}},
{d:13,ch:'مدل فرایندی',ti:'۷۴ — حلقهٔ یادگیری و امتیازدهی شبکه',sb:'Event score → Supplier card → Lane analytics → Model retraining → Archive',cam:{cx:-2,cy:-10,zoom:5.8,rot:.03},fin:1,hot:['tower','fwd','line','agent','road','rail','pricing','sales','t_fwd','r_line','r_agent','r_road','r_rail','i_price'],card:{tx:'POD، نتیجهٔ Claim، استثنا، هزینه و بازخورد مشتری به امتیاز عملکرد تبدیل می‌شوند. امتیاز به کارت نرخ و سطح عضویت تأمین‌کننده بازمی‌گردد؛ تحلیل lane و بازآموزی مدل پیشنهاددهی را اصلاح می‌کند. پس از نتیجهٔ PCA و تطبیق مالی، پرونده بایگانی می‌شود. مدل جدید در مجموع ۷ Pool، ۱۸۸ Node و ۲۴۸ Flow دارد.',tr:'FACT',sr:'فایل مرجع جدید · 150 activity + 20 gateway + 18 event · 192 sequence + 56 message flow'}},
{d:14,ch:'بلوغ',ti:'۷۵ — نقشهٔ بلوغ Current → Controlled → Integrated → Resilient',sb:'اول استانداردسازی، سپس کنترل، یکپارچگی و تاب‌آوری؛ نه صرفاً افزودن فناوری',cam:{cx:0,cy:-6,zoom:5,rot:-.02},fin:1,hot:['fwd','tower','sales','pricing','docs','compliance','qhse','bank','line','agent','road','rail','shipper','consignee','t_fwd','i_sales','i_price','i_docs','i_comp','i_qhse','m_bank'],card:{tx:'Roadmap پیشنهادی: 1) Baseline داده/نقش/SOP؛ 2) Controlled با RACI، thresholds و evidence؛ 3) Integrated با سه‌جریان و job economics؛ 4) Resilient با scenario playbook، dual sourcing، recovery و learning loop. فناوری فقط channel/enabler است؛ operating model، accountability و decision rights هستهٔ تغییرند.',tr:'INFERENCE',sr:'Part D §53–54/64 · 36_Operating_Model'}}

];
var SCENE_METRICS=[["19", "بازیگر در شبکه هماهنگی", "ASSET-LIGHT MODEL", 72], ["<4h", "هدف پاسخ به استعلام", "SAME-DAY RESPONSE", 42], ["6-DIGIT", "ساختار پایه کد HS", "WCO NOMENCLATURE", 58], ["11", "قاعده Incoterms® 2020", "ICC STANDARD", 78], ["34.8M", "ظرفیت ناوگان فعال؛ TEU", "GLOBAL FLEET", 91], ["SELL−BUY", "منطق حاشیه خدمت", "MARGIN CONTROL", 62], ["5", "معیار کلیدی انتخاب", "AWARD CRITERIA", 52], ["4", "مهلت بحرانی رزرو", "CUTOFF CONTROL", 66], ["1×FCL", "کانتینر اختصاصی", "EQUIPMENT", 48], ["VGM", "پیش‌شرط بارگیری", "SOLAS CONTROL", 74], ["8", "سند اصلی این مرحله", "DOCUMENT SET", 63], ["4-EYES", "کنترل HS و انطباق", "COMPLIANCE", 82], ["CY", "ورود پیش از cutoff", "GATE-IN", 57], ["51.5M", "TEU شانگهای در ۲۰۲۴", "PORT THROUGHPUT", 96], ["41.1M", "TEU سنگاپور در ۲۰۲۴", "TRANSSHIPMENT", 88], ["13.8M", "TEU روتردام", "EU GATEWAY", 79], ["100%", "پوشش screening", "SANCTIONS", 84], ["3 STEP", "زنجیره آزادسازی", "RELEASE", 68], ["LAST MILE", "تحویل در مقصد", "DELIVERY", 54], ["POD", "بستن مسیر فیزیکی", "DELIVERED", 92], ["DSO−DPO", "چرخه تبدیل نقد", "WORKING CAPITAL", 64], ["24", "گروه exception", "EXCEPTION LIBRARY", 93], ["92%", "نمونه پایایی برنامه", "RELIABILITY", 86], ["≥95%", "هدف OTP", "SCORECARD", 95], ["38", "نقش داخلی و بیرونی", "ACTOR UNIVERSE", 88], ["4 GATES", "KYC · Credit · Sanctions", "ONBOARDING", 82], ["HBL/MBL", "ساختار سند LCL", "CONSOLIDATION", 74], ["0", "هدف excursion دمایی", "AIR / COLD CHAIN", 92], ["10–18d", "بازه گزارش‌شده TITR", "MIDDLE CORRIDOR", 67], ["≥95%", "هدف Supplier SLA", "SUPPLIER GOVERNANCE", 90], ["5 REGIMES", "رژیم مسئولیت مودال", "LIABILITY MAP", 80], ["4 LAYERS", "پوشش و انتقال ریسک", "INSURANCE", 76], ["19", "دسته ریسک مرجع", "ENTERPRISE RISK", 94], ["4-EYES", "کنترل کلیدی ضدتقلب", "FRAUD PREVENTION", 91], ["52", "SOP عملیاتی", "GOVERNANCE", 96], ["30", "KPI در ۱۰ دامنه", "PERFORMANCE", 93], ["<45d", "هدف مرجع DSO", "WORKING CAPITAL", 84], ["8+22", "آرکی‌تایپ + case", "BENCHMARKS", 86], ["10", "سناریوی End-to-End", "SCENARIOS", 97], ["13", "بُعد ممیزی پوشش", "VALIDATION", 89], ["16+12", "خدمت + RFQ نمونه", "SERVICE / DEMAND TAXONOMY", 90], ["22", "جزء قیمت مرجع", "RATE BUILD-UP", 92], ["32", "سند در زنجیره", "DOCUMENT ARCHITECTURE", 96], ["12+23", "رویه گمرکی + مقرره", "REGULATORY MAP", 95], ["14", "نوع claim مرجع", "CLAIMS & RECOVERY", 88], ["18·20·18", "Physical · Info · Value", "FLOW ARCHITECTURE", 97], ["129", "منبع پژوهشی", "EVIDENCE GRAPH", 94], ["36", "شیت پایگاه مدل", "TRACEABLE MODEL", 100], ["52·10·20", "Entity · Carrier · Node", "GLOBAL NETWORK MASTER", 92], ["34.75M", "TEU ناوگان جهانی", "CAPACITY STRUCTURE", 97], ["51.506M", "Throughput شانگهای", "PORT HIERARCHY", 96], ["28", "رابطهٔ بازیگری", "RELATIONSHIP GRAPH", 90], ["52·25·20", "SOP · RACI · Decision", "CONTROL LIBRARY", 98], ["19+24", "Risk + Exception", "RISK HEATMAP", 95], ["30·22·33", "Unknown · Assumption · Audit", "VALIDATION BACKLOG", 93], ["36+129", "Sheets + Sources", "EXECUTIVE CONTROL", 100], ["8", "آرکی‌تایپ عملیاتی", "OPERATING ARCHETYPES", 91], ["6", "Case شکست و M&A", "FAILURE / CONSOLIDATION", 94], ["3", "الگوی اختلال شبکه", "DISRUPTION RESPONSE", 96], ["2,000", "کانتینر Project Case", "CONTROL-TOWER DELIVERY", 93], ["5", "Operational Pattern کلیدی", "PATTERN LIBRARY", 88], ["30×14", "Element × Lens", "EXECUTABILITY TEST", 99], ["33", "بُعد Coverage Audit", "EVIDENCE COVERAGE", 97], ["7", "نقش‌گاه بازیگری در فرایند مرجع", "SUPPLIER GATE", 88],
["OCR+LLM", "دریافت و استانداردسازی RFQ", "INTELLIGENT INTAKE", 86],
["3-WAY", "Clear · Review · Block", "COMPLIANCE GATE", 94],
["BAF/CAF", "بازمحاسبهٔ Quote منقضی", "DYNAMIC QUOTE", 89],
["UCP 600", "تطبیق اسناد و Release", "DOCUMENT CONTROL", 93],
["3 ROUTES", "Green · Yellow · Red", "CUSTOMS TRIAGE", 91],
["1 LEDGER", "خط رویداد تغییرناپذیر", "PREDICTIVE ETA", 92],
["7", "شاخهٔ صریح استثنا", "HUMAN-IN-THE-LOOP", 96],
["5 STEP", "Escrow تا Settlement", "FINANCE ORCHESTRATION", 90],
["GA", "General Average + Subrogation", "CLAIMS RECOVERY", 88],
["188·248", "Process Node · Flow", "REFERENCE PROCESS GRAPH", 100],
["4 LEVEL", "نقشه بلوغ", "MATURITY ROADMAP", 100]];
var SCENE_LENS=[{"r": "Branch Manager / Forwarder", "o": "نقشه شبکه و روابط", "c": "Relationship governance", "f": "شکاف مالکیت"}, {"r": "Inside Sales · ACT-003", "o": "Enquiry کامل", "c": "SOP-001", "f": "quote ناقص"}, {"r": "QHSE/Docs", "o": "Cargo profile", "c": "SOP-021", "f": "DG/HS error"}, {"r": "KAM + Ops", "o": "تقسیم مسئولیت", "c": "Incoterms check", "f": "هزینه مبهم"}, {"r": "Procurement · ACT-005", "o": "Buy-rate + allocation", "c": "SOP-048", "f": "rollover"}, {"r": "Pricing · ACT-004", "o": "Sell-price + margin", "c": "SOP-003", "f": "margin leakage"}, {"r": "KAM · ACT-002", "o": "Award + terms", "c": "Approval guardrail", "f": "تعهد نامعتبر"}, {"r": "Booking · ACT-011", "o": "Carrier confirmation", "c": "SOP-005", "f": "cancellation"}, {"r": "Drayage · ACT-013", "o": "Empty pickup", "c": "EIR control", "f": "equipment mismatch"}, {"r": "Export Ops · ACT-007", "o": "Stuffed + VGM", "c": "SOP-013", "f": "missed cutoff"}, {"r": "Docs · ACT-009", "o": "Document set", "c": "Four-eyes QC", "f": "discrepancy"}, {"r": "Customs · ACT-010", "o": "Export release", "c": "SOP-015", "f": "customs hold"}, {"r": "Origin Ops", "o": "CY gate-in", "c": "Cutoff dashboard", "f": "rollover"}, {"r": "Ocean Carrier", "o": "Main carriage", "c": "Departure check", "f": "blank sailing"}, {"r": "Control Tower", "o": "Onward connection", "c": "SOP-042", "f": "miss-connection"}, {"r": "Import Ops", "o": "Available cargo", "c": "Arrival checklist", "f": "dwell/storage"}, {"r": "Broker/Compliance", "o": "Import release", "c": "Screening", "f": "hold/penalty"}, {"r": "Destination Agent", "o": "Delivery Order", "c": "Release authentication", "f": "misdelivery"}, {"r": "Drayage", "o": "Delivered unit", "c": "Appointment control", "f": "detention"}, {"r": "Customer Service", "o": "Signed POD", "c": "POD validation", "f": "open job"}, {"r": "Finance", "o": "Invoice + settlement", "c": "3-way match", "f": "bad debt"}, {"r": "Claims/Control Tower", "o": "Recovery plan", "c": "Escalation matrix", "f": "uncontrolled loss"}, {"r": "Control Tower", "o": "Resolved exception", "c": "Daily exception rhythm", "f": "SLA breach"}, {"r": "Branch Manager", "o": "Closed cycle", "c": "SOP-050", "f": "repeat failure"}, {"r": "Operating Model Owner", "o": "Traceable architecture", "c": "ID cross-links", "f": "orphan process"}, {"r": "Credit + Compliance", "o": "Operational account", "c": "KYC/AML gate", "f": "sanctions/default"}, {"r": "CFS Supervisor", "o": "Stuffed groupage", "c": "Tally + stow plan", "f": "short shipment"}, {"r": "Air Ops + QHSE", "o": "Uplift-ready cargo", "c": "DG/temp/security", "f": "excursion"}, {"r": "Rail Ops + Customs", "o": "Border-cleared leg", "c": "Transit docs", "f": "border delay"}, {"r": "Network Manager", "o": "Approved supplier", "c": "Qualification + SLA", "f": "supplier failure"}, {"r": "Legal/Management", "o": "Contract stack", "c": "Jurisdiction review", "f": "wrong regime"}, {"r": "Claims + Insurer", "o": "Valid cover", "c": "Declaration check", "f": "coverage gap"}, {"r": "Risk Owners", "o": "Treatment plan", "c": "Risk-control link", "f": "unmitigated risk"}, {"r": "Finance/Docs/Network", "o": "Authenticated transaction", "c": "Callback + SoD", "f": "fraud"}, {"r": "Process Owners", "o": "RACI + rights", "c": "SOP cadence", "f": "unclear accountability"}, {"r": "Control Tower + Mgmt", "o": "KPI review pack", "c": "Data-owner check", "f": "bad KPI data"}, {"r": "Finance + Pricing", "o": "Contribution + cash", "c": "Accrual + FX", "f": "liquidity leak"}, {"r": "Strategy / Network", "o": "Case lessons", "c": "Evidence tiers", "f": "false comparison"}, {"r": "Scenario Commander", "o": "Recovery run", "c": "Contingency playbook", "f": "cascade failure"}, {"r": "Research / Governance", "o": "Validation backlog", "c": "Unknown separation", "f": "false certainty"}, {"r": "Solution Design + Sales", "o": "Service/RFQ fit", "c": "Scope included/excluded", "f": "mis-scoped offer"}, {"r": "Pricing · ACT-004", "o": "Traceable rate build", "c": "Validity + variance <5%", "f": "margin leakage"}, {"r": "Documentation · ACT-009", "o": "Complete document chain", "c": "Issuer/receiver + release QC", "f": "hold or misdelivery"}, {"r": "Customs/Compliance", "o": "Filed/validated procedure", "c": "Authority + effective date", "f": "penalty or seizure"}, {"r": "Claims · ACT-017", "o": "Settlement/recovery file", "c": "Notice + survey + reserve", "f": "time-bar / coverage loss"}, {"r": "Control Tower + Finance", "o": "Reconciled three flows", "c": "Milestone + three-way match", "f": "open job / false margin"}, {"r": "Research Governance", "o": "Cited verified statement", "c": "Evidence tier + access date", "f": "false certainty"}, {"r": "Model Owner / Board", "o": "Validation-ready backlog", "c": "Fit-to-company review", "f": "misapplied reference model"}, {"r": "Network / Data Steward", "o": "Deduplicated entity graph", "c": "Ownership + ID integrity", "f": "wrong counterparty mapping"}, {"r": "Procurement · ACT-005", "o": "Capacity strategy", "c": "Dated fleet snapshot", "f": "false allocation assumption"}, {"r": "Trade-Lane Manager", "o": "Node hierarchy", "c": "Throughput vs capacity", "f": "wrong gateway design"}, {"r": "Network + Legal", "o": "Contract-linked relation", "c": "Direction + value exchange", "f": "accountability gap"}, {"r": "Process Owners", "o": "Executable control library", "c": "One accountable owner", "f": "approval ambiguity"}, {"r": "Risk + Control Tower", "o": "Prioritized recovery plan", "c": "Likelihood × impact", "f": "cascading disruption"}, {"r": "Validation Owner", "o": "Owned evidence backlog", "c": "Impact + method + due date", "f": "unknown treated as fact"}, {"r": "Executive / Board", "o": "Decision-ready model", "c": "Calibration + authority", "f": "reference model misapplied"}, {"r": "Strategy / Legal", "o": "Selected archetype", "c": "Legal role + revenue logic", "f": "category confusion"}, {"r": "Executive + Network", "o": "Continuity / integration plan", "c": "Counterparty resilience", "f": "stranded cargo"}, {"r": "Trade-Lane + Control Tower", "o": "Reroute/wait decision", "c": "Scenario trigger + ETA", "f": "inventory disruption"}, {"r": "Project Control Tower", "o": "Synchronized delivery", "c": "Cold-chain / hazmat / QA", "f": "site or patient impact"}, {"r": "Operating Model Owner", "o": "Reusable mechanism", "c": "Applicability boundary", "f": "cargo-cult solution"}, {"r": "Process Assurance", "o": "Executable OM row", "c": "14-lens completeness", "f": "ownerless failure"}, {"r": "Research Governance", "o": "Prioritized evidence gaps", "c": "Verified/unknown counts", "f": "false completeness"}, {r:'Network Governance',o:'Qualified supplier tier',c:'KYB/KYC + insurance + SLA',f:'unqualified capacity'},
{r:'Digital Intake + Sales',o:'Validated RFQ record',c:'Completeness gateway',f:'silent data assumption'},
{r:'Compliance + QHSE',o:'Clear/Review/Block decision',c:'OFAC + dual-use + DG',f:'regulatory breach'},
{r:'Pricing + Credit + Procurement',o:'Valid bookable quote',c:'Validity + credit + capacity hold',f:'expired rate / no space'},
{r:'Documentation + Bank',o:'Release-ready document set',c:'UCP 600 + version control',f:'discrepancy / misrelease'},
{r:'Customs + Transit Owner',o:'Released or guaranteed movement',c:'Route + guarantee + PCA',f:'hold / guarantee call'},
{r:'Control Tower',o:'Trusted ETA and free-time clock',c:'Dedup + immutable ledger',f:'late demurrage alert'},
{r:'Exception Owner + Operator',o:'Approved corrective action',c:'Severity + human approval + CAPA',f:'cascading exception'},
{r:'Finance + Treasury',o:'Controlled settlement',c:'3-way match + escrow + FX',f:'leakage / liquidity shock'},
{r:'Claims + Insurer + Surveyor',o:'Settled/recovered claim',c:'Time bar + survey + liability',f:'coverage or recovery loss'},
{r:'Model Owner + Network',o:'Updated score and playbook',c:'Event feedback + archive',f:'repeat failure'},
{"r": "Executive / Transformation", "o": "Sequenced roadmap", "c": "Stage-gate evidence", "f": "technology-first failure"}];

var SCENE_TRACE=[["ACT", "PRC", "COMMERCIAL"], ["ACT", "PRC", "COMMERCIAL"], ["ACT", "PRC", "COMMERCIAL"], ["ACT", "PRC", "COMMERCIAL"], ["ACT", "PRC", "COMMERCIAL"], ["ACT", "PRC", "COMMERCIAL"], ["ACT", "PRC", "COMMERCIAL"], ["ACT", "PRC", "COMMERCIAL"], ["DOC", "MILESTONE", "EXECUTION"], ["DOC", "MILESTONE", "EXECUTION"], ["DOC", "MILESTONE", "EXECUTION"], ["DOC", "MILESTONE", "EXECUTION"], ["DOC", "MILESTONE", "EXECUTION"], ["DOC", "MILESTONE", "EXECUTION"], ["DOC", "MILESTONE", "EXECUTION"], ["DOC", "MILESTONE", "EXECUTION"], ["DOC", "MILESTONE", "EXECUTION"], ["DOC", "MILESTONE", "EXECUTION"], ["DOC", "MILESTONE", "EXECUTION"], ["DOC", "MILESTONE", "EXECUTION"], ["KPI", "EXC", "CONTROL"], ["KPI", "EXC", "CONTROL"], ["KPI", "EXC", "CONTROL"], ["KPI", "EXC", "CONTROL"], ["OM", "SOP", "NETWORK"], ["OM", "SOP", "NETWORK"], ["OM", "SOP", "NETWORK"], ["OM", "SOP", "NETWORK"], ["OM", "SOP", "NETWORK"], ["OM", "SOP", "NETWORK"], ["RSK", "RACI", "GOVERNANCE"], ["RSK", "RACI", "GOVERNANCE"], ["RSK", "RACI", "GOVERNANCE"], ["RSK", "RACI", "GOVERNANCE"], ["RSK", "RACI", "GOVERNANCE"], ["RSK", "RACI", "GOVERNANCE"], ["RSK", "RACI", "GOVERNANCE"], ["RSK", "RACI", "GOVERNANCE"], ["SCENARIO", "AUDIT", "VALIDATE"], ["SCENARIO", "AUDIT", "VALIDATE"], ["SVC-001…016", "RFQ-001…012", "03 / 12"], ["PRI-001…022", "KPI-004", "13_Pricing"], ["DOC-001…032", "SOP-009/013", "14_Documents"], ["CUS-001…012", "REG-001…023", "15 / 26"], ["CLM-001…014", "KPI-022…024", "18_Claims"], ["PF-001…018", "IF-001…020", "VF-001…018"], ["SRC-001…129", "TIER A/B/C", "32_Sources"], ["36 SHEETS", "13-DIM AUDIT", "VALIDATE"], ["ENT-0001…052", "CAR-001…010", "NODE-001…020"], ["CAP-003…012", "TOP-5", "2026-09-21"], ["NODE-001…015", "TEU 2024", "CAP≠THROUGHPUT"], ["REL-001…028", "CONTRACT LINK", "VALUE EXCHANGE"], ["SOP-001…052", "RACI×25", "DEC×20"], ["RSK-001…019", "EXC-001…024", "OWNER+RECOVERY"], ["UNK×30", "ASM×22", "AUD×33"], ["36 SHEETS", "129 SOURCES", "۷۵ صحنه"], ["BMK-001…008", "LEGAL ROLE", "REVENUE LOGIC"], ["CASE-001…006", "FAILURE/M&A", "CONTINUITY"], ["CASE-009…011", "SUEZ/CAPE", "CAPACITY HEDGE"], ["CASE-012/013/015", "PHARMA/PROJECT", "LIGHT-VERIFY"], ["PROBLEM", "PATTERN", "MECHANISM"], ["OM-001…030", "14-LENS", "EXECUTABLE"], ["AUD-001…033", "VERIFIED", "GAP-FLAGGED"], ["KYB/KYC", "AEO", "SLA"],
["RFQ", "OCR/LLM", "DATA GATE"],
["OFAC", "DUAL-USE", "IMDG/IATA"],
["BAF/CAF/PSS", "CREDIT", "CAPACITY HOLD"],
["UCP 600", "eBL/LOI", "HBL/MBL"],
["WTO/SPS", "TIR/NCTS", "ATA/PCA"],
["AIS/EVENT", "ETA", "FREE TIME"],
["7 BRANCH", "HUMAN GATE", "CAPA"],
["3-WAY MATCH", "ESCROW/FX", "PROFIT SHARE"],
["NOTICE/SURVEY", "GENERAL AVERAGE", "SUBROGATION"],
["۷ نقش‌گاه", "188 NODES", "248 FLOWS"],
["BASELINE", "CONTROLLED", "RESILIENT"]];

var SCENE_VIZ=[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, {"title": "MASTER DATA", "items": [["ENTITIES", 100, "52"], ["NODES", 38, "20"], ["CARRIERS", 19, "10"]]}, {"title": "GLOBAL FLEET SHARE", "items": [["MSC", 100, "21.6%"], ["MAERSK", 64, "13.8%"], ["CMA CGM", 59, "12.8%"], ["COSCO", 49, "10.6%"], ["H-L", 32, "6.9%"]]}, {"title": "PORT THROUGHPUT · 2024", "items": [["SHA", 100, "51.5M"], ["SIN", 80, "41.1M"], ["NGB", 76, "39.3M"], ["SZX", 65, "33.4M"], ["PUS", 47, "24.4M"]]}, {"title": "RELATIONSHIP LAYERS", "items": [["REL", 100, "28"], ["INFO", 71, "20"], ["VALUE", 64, "18"], ["PHYSICAL", 64, "18"]]}, {"title": "GOVERNANCE DEPTH", "items": [["SOP", 100, "52"], ["RACI", 48, "25"], ["DECISION", 38, "20"]]}, {"title": "CONTROL BACKLOG", "items": [["EXCEPTION", 100, "24"], ["RISK", 79, "19"], ["HIGH IMPACT", 42, "10+"]]}, {"title": "VALIDATION QUEUES", "items": [["AUDIT", 100, "33"], ["UNKNOWN", 91, "30"], ["ASSUMPTION", 67, "22"]]}, {"title": "MODEL COVERAGE", "items": [["SHEETS", 100, "36"], ["SOURCES", 100, "129"], ["SCENES", 100, "56"]]}, {"title": "ARCHETYPE SPECTRUM", "items": [["FORWARDER", 88, "core"], ["NVOCC", 78, "carrier"], ["4PL", 65, "orchestrate"], ["ILP", 100, "integrated"]]}, {"title": "CASE GROUP · 22 TOTAL", "items": [["FAIL/M&A", 100, "6+"], ["DISRUPT", 67, "3"], ["POSITIVE", 83, "5+"], ["LIGHT-VER", 100, "8"]]}, {"title": "TRANSIT IMPACT", "items": [["SUEZ", 62, "base"], ["CAPE", 100, "+10–14d"], ["BACKLOG", 78, "150 ships"]]}, {"title": "PROJECT SCALE", "items": [["CONTAINERS", 100, "2,000"], ["TEMP", 75, "15–25°C"], ["CONTROL", 95, "daily/weekly"]]}, {"title": "PATTERN CONTROL", "items": [["TRIGGER", 100, "defined"], ["OWNER", 100, "named"], ["FAILURE", 100, "mapped"]]}, {"title": "EXECUTABILITY", "items": [["OM ROWS", 100, "30"], ["LENSES", 47, "14"], ["TRACE", 100, "E2E"]]}, {"title": "AUDIT QUALITY", "items": [["DIMENSIONS", 100, "33"], ["SOURCES", 100, "129"], ["GAPS", 58, "flagged"]]}, {title:'SUPPLIER QUALIFICATION',items:[["IDENTITY",100,"KYB/KYC"],["LICENSE",92,"valid"],["INSURANCE",88,"CMR"],["SLA",82,"signed"]]},
{title:'INTAKE QUALITY LOOP',items:[["EXTRACT",86,"OCR/LLM"],["NORMALIZE",94,"schema"],["COMPLETE",100,"gate"]]},
{title:'COMPLIANCE ROUTING',items:[["CLEAR",100,"continue"],["REVIEW",62,"human"],["BLOCK",28,"stop"]]},
{title:'QUOTE CONTROL',items:[["LANDED COST",100,"base"],["BAF/CAF",76,"refresh"],["CREDIT",88,"gate"],["CAPACITY",94,"hold"]]},
{title:'DOCUMENT CHAIN',items:[["MATRIX",100,"required"],["UCP QC",92,"match"],["eBL/LOI",82,"release"]]},
{title:'CUSTOMS ROUTES',items:[["GREEN",42,"release"],["YELLOW",68,"document"],["RED",100,"inspect"]]},
{title:'EVENT PIPELINE',items:[["NORMALIZE",78,"multi-source"],["DEDUP",86,"trusted"],["LEDGER",100,"immutable"],["ETA",92,"predict"]]},
{title:'EXCEPTION ENGINE',items:[["BRANCHES",100,"7"],["OWNER",100,"named"],["HUMAN",82,"gate"],["CAPA",94,"loop"]]},
{title:'SETTLEMENT STACK',items:[["MATCH",100,"3-way"],["ESCROW",88,"hold"],["FX",72,"hedge"],["PAYOUT",95,"conditional"]]},
{title:'CLAIMS PATH',items:[["NOTICE",100,"time-bar"],["SURVEY",92,"evidence"],["LIABILITY",86,"regime"],["RECOVERY",78,"subrogate"]]},
{title:'PROCESS GRAPH',items:[["ACTIVITY",100,"150"],["GATEWAY",13,"20"],["EVENT",12,"18"],["FLOWS",100,"248"]]},
{"title": "MATURITY PATH", "items": [["BASELINE", 25, "1"], ["CONTROLLED", 50, "2"], ["INTEGRATED", 75, "3"], ["RESILIENT", 100, "4"]]}];


/* ================= حرفه‌ای‌سازی و فارسی‌سازی متن‌ها ================= */
var FA_EXACT={
'ASSET-LIGHT MODEL':'مدل سبک‌دارایی','SAME-DAY RESPONSE':'پاسخ در همان روز','WCO NOMENCLATURE':'نام‌گذاری سازمان جهانی گمرک','ICC STANDARD':'استاندارد اتاق بازرگانی بین‌المللی','GLOBAL FLEET':'ناوگان جهانی','MARGIN CONTROL':'کنترل حاشیه سود','AWARD CRITERIA':'معیارهای انتخاب','CUTOFF CONTROL':'کنترل مهلت نهایی','EQUIPMENT':'تجهیز','SOLAS CONTROL':'کنترل SOLAS','DOCUMENT SET':'بستهٔ اسناد','COMPLIANCE':'انطباق','GATE-IN':'ورود به پایانه','PORT THROUGHPUT':'عملکرد بندر','TRANSSHIPMENT':'ترانشیپمنت','EU GATEWAY':'دروازهٔ اروپا','SANCTIONS':'تحریم‌ها','RELEASE':'آزادسازی','LAST MILE':'آخرین مایل','DELIVERY':'تحویل','DELIVERED':'تحویل‌شده','WORKING CAPITAL':'سرمایه در گردش','EXCEPTION LIBRARY':'کتابخانهٔ استثناها','RELIABILITY':'قابلیت اتکا','SCORECARD':'کارت امتیازی','ACTOR UNIVERSE':'مجموعهٔ بازیگران','ONBOARDING':'پذیرش و فعال‌سازی','CONSOLIDATION':'تجمیع بار','AIR / COLD CHAIN':'هوایی / زنجیرهٔ سرد','MIDDLE CORRIDOR':'کریدور میانی','SUPPLIER GOVERNANCE':'حاکمیت تأمین‌کننده','LIABILITY MAP':'نقشهٔ مسئولیت','INSURANCE':'بیمه','ENTERPRISE RISK':'ریسک بنگاه','FRAUD PREVENTION':'پیشگیری از تقلب','GOVERNANCE':'حاکمیت','PERFORMANCE':'عملکرد','BENCHMARKS':'مقایسه‌های مرجع','SCENARIOS':'سناریوها','VALIDATION':'اعتبارسنجی','SERVICE / DEMAND TAXONOMY':'طبقه‌بندی خدمت / تقاضا','RATE BUILD-UP':'ساختار نرخ','DOCUMENT ARCHITECTURE':'معماری اسناد','REGULATORY MAP':'نقشهٔ مقررات','CLAIMS & RECOVERY':'خسارت و بازیافت','FLOW ARCHITECTURE':'معماری جریان','EVIDENCE GRAPH':'گراف شواهد','TRACEABLE MODEL':'مدل ردیابی‌پذیر','GLOBAL NETWORK MASTER':'مرجع شبکهٔ جهانی','CAPACITY STRUCTURE':'ساختار ظرفیت','PORT HIERARCHY':'سلسله‌مراتب بنادر','RELATIONSHIP GRAPH':'گراف روابط','CONTROL LIBRARY':'کتابخانهٔ کنترل','RISK HEATMAP':'نقشهٔ حرارتی ریسک','VALIDATION BACKLOG':'صف اعتبارسنجی','EXECUTIVE CONTROL':'کنترل مدیریتی','OPERATING ARCHETYPES':'الگوهای مدل عملیاتی','FAILURE / CONSOLIDATION':'شکست / یکپارچه‌سازی','DISRUPTION RESPONSE':'پاسخ به اختلال','CONTROL-TOWER DELIVERY':'تحویل با برج کنترل','PATTERN LIBRARY':'کتابخانهٔ الگو','EXECUTABILITY TEST':'آزمون اجراپذیری','EVIDENCE COVERAGE':'پوشش شواهد','SUPPLIER GATE':'دروازهٔ تأمین‌کننده','INTELLIGENT INTAKE':'دریافت هوشمند','COMPLIANCE GATE':'دروازهٔ انطباق','DYNAMIC QUOTE':'پیشنهاد نرخ پویا','DOCUMENT CONTROL':'کنترل اسناد','CUSTOMS TRIAGE':'مسیر‌بندی گمرکی','PREDICTIVE ETA':'زمان ورود پیش‌بینی‌شده','HUMAN-IN-THE-LOOP':'تأیید انسانی','FINANCE ORCHESTRATION':'هماهنگ‌سازی مالی','CLAIMS RECOVERY':'بازیافت خسارت','REFERENCE PROCESS GRAPH':'گراف فرایند مرجع','MATURITY ROADMAP':'نقشهٔ راه بلوغ','6-DIGIT':'شش‌رقمی','SELL−BUY':'فروش منهای خرید','1×FCL':'یک کانتینر FCL','4-EYES':'چهارچشمی','3 STEP':'سه مرحله','4 GATES':'چهار دروازه','5 REGIMES':'پنج رژیم','4 LAYERS':'چهار لایه','3-WAY':'تطبیق سه‌جانبه','3 ROUTES':'سه مسیر','1 LEDGER':'یک دفتر رویداد','5 STEP':'پنج مرحله','4 LEVEL':'چهار سطح','Physical · Info · Value':'فیزیکی · اطلاعات · ارزش','Entity · Carrier · Node':'نهاد · حمل‌کننده · گره','Risk + Exception':'ریسک + استثنا','Unknown · Assumption · Audit':'نامشخص · فرض · ممیزی','Sheets + Sources':'برگه‌ها + منابع','Case شکست و M&A':'مطالعهٔ شکست و ادغام و تملک','Operational Pattern کلیدی':'الگوی عملیاتی کلیدی','Element × Lens':'عنصر × عدسی تحلیل','Process Node · Flow':'گره فرایندی · جریان','Clear · Review · Block':'مجاز · بازبینی · مسدود','Green · Yellow · Red':'سبز · زرد · قرمز','Escrow تا Settlement':'حساب امانی تا تسویه','General Average + Subrogation':'خسارت همگانی + جانشینی','ACT':'بازیگر','PRC':'فرایند','COMMERCIAL':'تجاری','DOC':'سند','MILESTONE':'نقطهٔ عطف','EXECUTION':'اجرا','EXC':'استثنا','CONTROL':'کنترل','OM':'مدل عملیاتی','NETWORK':'شبکه','RSK':'ریسک','GOVERNANCE':'حاکمیت','SCENARIO':'سناریو','AUDIT':'ممیزی','VALIDATE':'اعتبارسنجی','TIER A/B/C':'سطح شواهد الف/ب/ج','36 SHEETS':'۳۶ برگه','13-DIM AUDIT':'ممیزی ۱۳بُعدی','TOP-5':'پنج مورد برتر','CONTRACT LINK':'پیوند قراردادی','VALUE EXCHANGE':'تبادل ارزش','OWNER+RECOVERY':'مالک + بازیافت','LEGAL ROLE':'نقش حقوقی','REVENUE LOGIC':'منطق درآمد','FAILURE/M&A':'شکست / ادغام و تملک','CONTINUITY':'تداوم','CAPACITY HEDGE':'پوشش ریسک ظرفیت','PHARMA/PROJECT':'دارویی / پروژه','LIGHT-VERIFY':'اعتبارسنجی محدود','PROBLEM':'مسئله','PATTERN':'الگو','MECHANISM':'سازوکار','14-LENS':'۱۴ عدسی تحلیل','EXECUTABLE':'اجراپذیر','GAP-FLAGGED':'شکاف‌دار','DATA GATE':'دروازهٔ داده','DUAL-USE':'دومنظوره','CAPACITY HOLD':'توقف ظرفیت','AIS/EVENT':'AIS / رویداد','FREE TIME':'مهلت آزاد','7 BRANCH':'هفت شاخه','HUMAN GATE':'دروازهٔ تأیید انسانی','3-WAY MATCH':'تطبیق سه‌جانبه','PROFIT SHARE':'سهم سود','NOTICE/SURVEY':'اعلام / بازرسی','GENERAL AVERAGE':'خسارت همگانی','SUBROGATION':'جانشینی','7 POOLS':'هفت نقش‌گاه','188 NODES':'۱۸۸ گره','248 FLOWS':'۲۴۸ جریان','BASELINE':'پایه','CONTROLLED':'کنترل‌شده','INTEGRATED':'یکپارچه','RESILIENT':'تاب‌آور','ENTITIES':'نهادها','NODES':'گره‌ها','CARRIERS':'حمل‌کنندگان','REL':'رابطه','INFO':'اطلاعات','VALUE':'ارزش','PHYSICAL':'فیزیکی','DECISION':'تصمیم','EXCEPTION':'استثنا','RISK':'ریسک','HIGH IMPACT':'اثر بالا','ASSUMPTION':'فرض','SHEETS':'برگه‌ها','SOURCES':'منابع','SCENES':'صحنه‌ها','FORWARDER':'فورواردر','DISRUPT':'اختلال','POSITIVE':'موفق','CONTAINERS':'کانتینرها','TEMP':'دما','TRIGGER':'محرک','OWNER':'مالک','FAILURE':'شکست','OM ROWS':'ردیف‌های مدل','LENSES':'عدسی‌های تحلیل','TRACE':'ردیابی','DIMENSIONS':'ابعاد','GAPS':'شکاف‌ها','IDENTITY':'هویت','LICENSE':'مجوز','EXTRACT':'استخراج','NORMALIZE':'استانداردسازی','COMPLETE':'کامل','CLEAR':'مجاز','REVIEW':'بازبینی','BLOCK':'مسدود','LANDED COST':'هزینهٔ نهایی تحویل‌شده','CREDIT':'اعتبار','MATRIX':'ماتریس','GREEN':'سبز','YELLOW':'زرد','RED':'قرمز','DEDUP':'حذف تکرار','LEDGER':'دفتر رویداد','BRANCHES':'شاخه‌ها','HUMAN':'انسانی','MATCH':'تطبیق','ESCROW':'حساب امانی','PAYOUT':'پرداخت','NOTICE':'اعلام','SURVEY':'بازرسی','LIABILITY':'مسئولیت','RECOVERY':'بازیافت','ACTIVITY':'فعالیت','GATEWAY':'دروازه','EVENT':'رویداد','FLOWS':'جریان‌ها',
'Branch Manager / Forwarder':'مدیر شعبه / فورواردر','Inside Sales':'فروش داخلی','QHSE/Docs':'ایمنی، کیفیت و اسناد','KAM + Ops':'مدیر حساب کلیدی و عملیات','Procurement':'تأمین ظرفیت','Pricing':'قیمت‌گذاری','Booking':'رزرو','Drayage':'حمل پیشین/پسین','Export Ops':'عملیات صادرات','Docs':'اسناد','Customs':'گمرک','Origin Ops':'عملیات مبدأ','Ocean Carrier':'حمل‌کنندهٔ دریایی','Control Tower':'برج کنترل','Import Ops':'عملیات واردات','Broker/Compliance':'کارگزار / انطباق','Destination Agent':'نمایندهٔ مقصد','Customer Service':'خدمات مشتری','Finance':'مالی','Claims/Control Tower':'خسارت / برج کنترل','Branch Manager':'مدیر شعبه','Operating Model Owner':'مالک مدل عملیاتی','Credit + Compliance':'اعتبار و انطباق','CFS Supervisor':'سرپرست CFS','Air Ops + QHSE':'عملیات هوایی و ایمنی/کیفیت','Rail Ops + Customs':'عملیات ریلی و گمرک','Network Manager':'مدیر شبکه','Legal/Management':'حقوقی / مدیریت','Claims + Insurer':'خسارت و بیمه‌گر','Risk Owners':'مالکان ریسک','Finance/Docs/Network':'مالی / اسناد / شبکه','Process Owners':'مالکان فرایند','Control Tower + Mgmt':'برج کنترل و مدیریت','Finance + Pricing':'مالی و قیمت‌گذاری','Strategy / Network':'راهبرد / شبکه','Scenario Commander':'فرمانده سناریو','Research / Governance':'پژوهش / حاکمیت','Solution Design + Sales':'طراحی راهکار و فروش','Documentation':'مستندسازی','Customs/Compliance':'گمرک / انطباق','Claims':'خسارت','Control Tower + Finance':'برج کنترل و مالی','Research Governance':'حاکمیت پژوهش','Model Owner / Board':'مالک مدل / هیئت‌مدیره','Network / Data Steward':'شبکه / متولی داده','Trade-Lane Manager':'مدیر مسیر تجاری','Network + Legal':'شبکه و حقوقی','Risk + Control Tower':'ریسک و برج کنترل','Validation Owner':'مالک اعتبارسنجی','Executive / Board':'مدیریت ارشد / هیئت‌مدیره','Strategy / Legal':'راهبرد / حقوقی','Executive + Network':'مدیریت ارشد و شبکه','Trade-Lane + Control Tower':'مسیر تجاری و برج کنترل','Project Control Tower':'برج کنترل پروژه','Process Assurance':'تضمین فرایند','Network Governance':'حاکمیت شبکه','Digital Intake + Sales':'دریافت دیجیتال و فروش','Compliance + QHSE':'انطباق و ایمنی/کیفیت','Pricing + Credit + Procurement':'قیمت‌گذاری، اعتبار و تأمین','Documentation + Bank':'اسناد و بانک','Customs + Transit Owner':'گمرک و مالک ترانزیت','Exception Owner + Operator':'مالک استثنا و اپراتور','Finance + Treasury':'مالی و خزانه‌داری','Claims + Insurer + Surveyor':'خسارت، بیمه‌گر و بازرس','Model Owner + Network':'مالک مدل و شبکه',
'MASTER DATA':'داده‌های مرجع','GLOBAL FLEET SHARE':'سهم ناوگان جهانی','PORT THROUGHPUT · 2024':'عملکرد بنادر · ۲۰۲۴','RELATIONSHIP LAYERS':'لایه‌های رابطه','GOVERNANCE DEPTH':'عمق حاکمیت','CONTROL BACKLOG':'صف کنترل‌ها','VALIDATION QUEUES':'صف‌های اعتبارسنجی','MODEL COVERAGE':'پوشش مدل','ARCHETYPE SPECTRUM':'طیف الگوهای عملیاتی','CASE GROUP · 22 TOTAL':'گروه مطالعات موردی · ۲۲ مورد','TRANSIT IMPACT':'اثر ترانزیت','PROJECT SCALE':'مقیاس پروژه','PATTERN CONTROL':'کنترل الگو','EXECUTABILITY':'اجراپذیری','AUDIT QUALITY':'کیفیت ممیزی','SUPPLIER QUALIFICATION':'صلاحیت‌سنجی تأمین‌کننده','INTAKE QUALITY LOOP':'حلقهٔ کیفیت دریافت','COMPLIANCE ROUTING':'مسیر‌بندی انطباق','QUOTE CONTROL':'کنترل پیشنهاد نرخ','DOCUMENT CHAIN':'زنجیرهٔ اسناد','CUSTOMS ROUTES':'مسیرهای گمرکی','EVENT PIPELINE':'خط پردازش رویداد','EXCEPTION ENGINE':'موتور استثنا','SETTLEMENT STACK':'زنجیرهٔ تسویه','CLAIMS PATH':'مسیر خسارت','PROCESS GRAPH':'گراف فرایند','MATURITY PATH':'مسیر بلوغ',
'FACT':'واقعیت منبع‌دار','VERIFIED':'راستی‌آزمایی‌شده','CLAIM':'ادعای عملیاتی','INFERENCE':'استنتاج مدل مرجع','CONFLICT':'تعارض منابع','UNKNOWN':'نامشخص'
};
var FA_PHRASES=[
['Sea FCL','حمل دریایی FCL'],['ocean freight','کرایهٔ حمل دریایی'],['build-up','ساختار نرخ'],['Margin = Sell − Buy','حاشیه سود = فروش − خرید'],['Sell − Buy','فروش − خرید'],['Documentation/SI','اسناد / SI'],['Port cutoff','مهلت نهایی بندر'],['Gate-in','ورود به پایانه'],['dry / reefer / OT / FR','خشک / یخچالی / روباز / کفی'],['dry, reefer, OT, FR','خشک، یخچالی، روباز، کفی'],['Verified Gross Mass','وزن ناخالص تأییدشده'],['Original / Telex–Express','نسخهٔ اصل / آزادسازی تلکسی'],['US CBP','گمرک و حفاظت مرزی آمریکا'],['EU UCC','قانون گمرکی اتحادیهٔ اروپا'],['Regulation (EU)','مقررهٔ اتحادیهٔ اروپا'],['WCO Revised Kyoto','کنوانسیون تجدیدنظرشدهٔ کیوتو'],['Red Sea','دریای سرخ'],['San Pedro Bay','خلیج سن‌پدرو'],['Los Angeles','لس‌آنجلس'],['Long Beach','لانگ‌بیچ'],['Ningbo-Zhoushan','نینگبو–ژوشان'],['Shanghai','شانگهای'],['Shenzhen','شنژن'],['Busan','بوسان'],['Singapore','سنگاپور'],['Jebel Ali','جبل‌علی'],['Rotterdam','روتردام'],['throughput','عملکرد کانتینری'],['miss-connection','از دست رفتن اتصال'],['Tier A','سطح شواهد الف'],['Trading Terms','شرایط بازرگانی'],['Credit Limit','سقف اعتبار'],['Sanctions Officer','مسئول تحریم‌ها'],['House B/L','بارنامهٔ داخلی'],['Chargeable Weight','وزن قابل‌محاسبه'],['Air General/Express','حمل هوایی عمومی/سریع'],['Middle Corridor','کریدور میانی'],['China–Europe Rail','ریل چین–اروپا'],['border handover','تحویل مرزی'],['Master Trading Conditions','شرایط اصلی بازرگانی'],['agency agreement','قرارداد نمایندگی'],['Open Cover','پوشش باز'],['Forwarder Liability','مسئولیت فورواردر'],['Cargo insurance','بیمه باربری'],['High-impact','پُراثر'],['credit/non-payment','اعتبار/عدم پرداخت'],['cargo loss','فقدان کالا'],['customs breach','نقض گمرکی'],['DG mis-declaration','اظهار نادرست کالای خطرناک'],['geopolitical disruption','اختلال ژئوپلیتیکی'],['callback','تماس بازگشتی'],['invoice manipulation','دستکاری صورتحساب'],['segregation of duties','تفکیک وظایف'],['chain-of-custody','زنجیرهٔ نگهداشت'],['Responsible','مسئول اجرا'],['Accountable','پاسخ‌گو'],['quote TAT','زمان پاسخ پیشنهاد نرخ'],['document accuracy','دقت اسناد'],['bad debt','مطالبات سوخت‌شده'],['Gross Margin','حاشیه سود ناخالص'],['Contribution','سود مشارکت'],['unbilled cost','هزینهٔ صورتحساب‌نشده'],['Traditional Forwarder','فورواردر سنتی'],['Digital Forwarder','فورواردر دیجیتال'],['Marketplace','بازارگاه'],['Integrated Provider','ارائه‌دهندهٔ یکپارچه'],['Scenario trigger','محرک سناریو'],['Validation backlog','صف اعتبارسنجی'],['Rate Build-Up','ساختار نرخ'],['Primary/official','اولیه/رسمی'],['secondary','ثانویه'],['reference-model','مدل مرجع'],['Official/Primary','رسمی/اولیه'],['access date','تاریخ دسترسی'],['Master Terms','شرایط اصلی'],['Service Contract','قرارداد خدمت'],['Agency Agreement','قرارداد نمایندگی'],['Decision Right','حق تصمیم'],['Decision Rights','حقوق تصمیم'],['Credit Hold','توقف اعتباری'],['Executive Control Surface','سطح کنترل مدیریتی'],['Self-Chartering','اجارهٔ مستقیم کشتی'],['Problem → Pattern → Mechanism','مسئله ← الگو ← سازوکار'],['WHO → DOES WHAT → IF IT FAILS','چه کسی ← چه کاری ← پیامد شکست'],['Coverage Audit','ممیزی پوشش'],['Current → Controlled → Integrated → Resilient','وضع موجود ← کنترل‌شده ← یکپارچه ← تاب‌آور'],['Predictive ETA','زمان ورود پیش‌بینی‌شده'],['Immutable Event Ledger','دفتر رویداد تغییرناپذیر'],['Normalization','استانداردسازی'],['Deduplication','حذف تکرار'],['Credit Note','یادداشت بستانکاری'],['Insurer/Surveyor','بیمه‌گر / بازرس'],['Event score','امتیاز رویداد'],['Lane analytics','تحلیل مسیر تجاری'],['Model retraining','بازآموزی مدل'],['Archive','بایگانی'],['Roadmap','نقشهٔ راه'],['General Average','خسارت همگانی'],['Proof of Delivery','رسید تحویل'],['Bill of Lading','بارنامه'],['Commercial Invoice','فاکتور تجاری'],['Packing List','فهرست بسته‌بندی'],['Shipping Instructions','دستور حمل'],['Certificate of Origin','گواهی مبدأ'],['Export Declaration','اظهارنامهٔ صادراتی'],['Equipment Interchange Receipt','رسید تبادل تجهیز'],['Delivery Order','دستور تحویل'],['Arrival Notice','اعلامیهٔ ورود'],['Entry Summary','خلاصه اظهار ورود'],['Sea Waybill','راه‌نامهٔ دریایی'],['Original release','آزادسازی با نسخهٔ اصل'],['Telex/Express release','آزادسازی تلکسی/سریع'],['booking confirmation','تأیید رزرو'],['pickup order','دستور تحویل تجهیز'],['gate-in slip','رسید ورود به پایانه'],['dock receipt','رسید اسکله'],['VGM certificate','گواهی VGM'],['container packing list','فهرست بارگیری کانتینر'],['four-eyes','کنترل چهارچشمی'],['last-mile haulage','حمل آخرین مایل'],['empty return','بازگشت تجهیز خالی'],['Cash Conversion','چرخهٔ تبدیل نقد'],['schedule reliability','قابلیت اتکای برنامه حرکت'],['free time','مهلت آزاد'],['buy-rate','نرخ خرید'],['sell-price','نرخ فروش'],['Cost-to-serve','هزینهٔ ارائه خدمت'],['Landed Cost','هزینهٔ نهایی تحویل‌شده'],['working capital','سرمایه در گردش'],['rate build','ساختار نرخ'],['data owner','مالک داده'],['control tower','برج کنترل'],['trade lane','مسیر تجاری'],['cold chain','زنجیرهٔ سرد'],['supplier qualification','صلاحیت‌سنجی تأمین‌کننده'],['human approval','تأیید انسانی'],['event ledger','دفتر رویداد'],['three-way match','تطبیق سه‌جانبه'],['3-way match','تطبیق سه‌جانبه'],['time-bar','مهلت قانونی'],['source IDs','شناسه‌های منبع'],['message flow','جریان پیام'],['sequence flow','جریان توالی'],['End-to-End','سرتاسری'],['asset-light','سبک‌دارایی'],['same-day','همان‌روز'],['fit-to-company','انطباق با شرکت'],['exception escalation','تشدید استثنا'],['single point of failure','نقطهٔ شکست یکتا'],['Do-Not-Use','غیرمجاز برای استفاده'],['Preferred','ترجیحی'],['Approved','تأییدشده'],['Conditional','مشروط'],['Strategic','راهبردی']
];
var FA_WORDS={
'Unknown':'نامشخص','Verified':'راستی‌آزمایی‌شده','Inference':'استنتاج','Conflict':'تعارض','Fact':'واقعیت','Claim':'خسارت','Claims':'خسارت‌ها','Benchmark':'مقایسهٔ مرجع','Case':'مطالعهٔ موردی','cases':'مطالعات موردی','award':'انتخاب','allocation':'سهمیهٔ ظرفیت','rollover':'انتقال به سفر بعد','cutoff':'مهلت نهایی','booking':'رزرو','release':'آزادسازی','screening':'غربالگری','gateway':'دروازه','storage':'انبارداری','appointment':'نوبت تحویل','Invoicing':'صورتحساب‌زنی','Disbursement':'پرداخت','Collections':'وصول مطالبات','exception':'استثنا','premium':'حق‌بیمه/مازاد نرخ','advisory':'مشورتی','notice':'اعلام','trigger':'محرک','owner':'مالک','failure':'شکست','control':'کنترل','document':'سند','documents':'اسناد','output':'خروجی','risk':'ریسک','service':'خدمت','scope':'دامنه','validity':'اعتبار زمانی','variance':'انحراف','issuer':'صادرکننده','receiver':'دریافت‌کننده','authority':'مرجع','evidence':'شواهد','milestone':'نقطهٔ عطف','recovery':'بازیافت','reserve':'ذخیره','settlement':'تسویه','flow':'جریان','physical':'فیزیکی','value':'ارزش','information':'اطلاعات','source':'منبع','sources':'منابع','sheet':'برگه','sheets':'برگه‌ها','role':'نقش','roles':'نقش‌ها','process':'فرایند','node':'گره','nodes':'گره‌ها','carrier':'حمل‌کننده','carriers':'حمل‌کنندگان','entity':'نهاد','entities':'نهادها','relationship':'رابطه','decision':'تصمیم','unknown':'نامشخص','assumption':'فرض','audit':'ممیزی','executive':'مدیریتی','archetype':'الگوی عملیاتی','disruption':'اختلال','pattern':'الگو','mechanism':'سازوکار','lens':'عدسی تحلیل','coverage':'پوشش','baseline':'پایه','controlled':'کنترل‌شده','integrated':'یکپارچه','resilient':'تاب‌آور','activity':'فعالیت','activities':'فعالیت‌ها','event':'رویداد','events':'رویدادها','gateway':'دروازه','gateways':'دروازه‌ها','flows':'جریان‌ها','pool':'نقش‌گاه','pools':'نقش‌گاه‌ها','clear':'مجاز','review':'بازبینی','block':'مسدود','green':'سبز','yellow':'زرد','red':'قرمز','ledger':'دفتر ثبت','branch':'شاخه','branches':'شاخه‌ها','human':'انسانی','escrow':'حساب امانی','profit share':'سهم سود','subrogation':'جانشینی','survey':'بازرسی','liability':'مسئولیت','regime':'رژیم','quote':'پیشنهاد نرخ','pricing':'قیمت‌گذاری','intake':'دریافت','qualification':'صلاحیت‌سنجی','supplier':'تأمین‌کننده','finance':'مالی','insurance':'بیمه','compliance':'انطباق','customs':'گمرک','origin':'مبدأ','destination':'مقصد','ocean':'دریا','orchestration':'هماهنگ‌سازی','active':'فعال','network':'شبکه','model':'مدل','operating':'عملیاتی','main carriage':'حمل اصلی','departure check':'کنترل خروج','blank sailing':'لغو سفر','hold':'توقف','penalty':'جریمه','misdelivery':'تحویل اشتباه','detention':'توقف تجهیز','demurrage':'رسوب بندری','fraud':'تقلب','liquidity':'نقدینگی','continuity':'تداوم','reroute':'تغییر مسیر','wait':'انتظار','capacity':'ظرفیت','performance':'عملکرد','data':'داده','quality':'کیفیت','daily':'روزانه','weekly':'هفتگی','monthly':'ماهانه','defined':'تعریف‌شده','named':'نام‌گذاری‌شده','mapped':'نگاشت‌شده','required':'الزامی','valid':'معتبر','signed':'امضاشده','continue':'ادامه','stop':'توقف','refresh':'بازمحاسبه','match':'تطبیق','inspect':'بازرسی','trusted':'قابل‌اعتماد','immutable':'تغییرناپذیر','predict':'پیش‌بینی','loop':'حلقه','hedge':'پوشش ریسک','conditional':'مشروط','core':'هسته','integrated':'یکپارچه','base':'پایه','backlog':'صف','containers':'کانتینرها','temperature':'دما','Incoterm':'اینکوترمز','dry':'خشک','reefer':'یخچالی','freight':'کرایه حمل','drayage':'حمل زمینی کوتاه‌برد','Margin':'حاشیه سود','Sell':'فروش','Buy':'خرید','lane':'مسیر تجاری','quotation':'پیشنهاد نرخ','Documentation':'مستندسازی','Port':'بندر','voyage':'سفر دریایی','importer':'واردکننده','lading':'بارگیری','effective':'لازم‌الاجرا','Regulation':'مقرره','Revised':'تجدیدنظرشده','Kyoto':'کیوتو','throughput':'عملکرد کانتینری','screening':'غربالگری','Illustrative':'نمونه','shipper':'فرستنده','loader':'بارگذار','tally':'شمارش','packing':'بسته‌بندی','stuffing':'بارچینی کانتینر','Supervisor':'سرپرست','grouping':'گروه‌بندی','damage':'آسیب','Air':'هوایی','Rail':'ریلی','Multimodal':'چندوجهی','Transit':'ترانزیت','Charter':'اجاره دربست','Project':'پروژه','slot':'ظرفیت زمانی','gauge':'عرض خط','agent':'نماینده','haulier':'حمل‌کننده زمینی','contract':'قرارداد','declaration':'اظهار','exclusions':'استثناهای پوشش','deductible':'فرانشیز','geographic':'جغرافیایی','shipment':'محموله','collusion':'تبانی','conversion':'تبدیل','accuracy':'دقت','accrual':'ذخیره تعهدی','leakage':'نشت درآمد','Traditional':'سنتی','Digital':'دیجیتال','Broker':'کارگزار','Integrator':'یکپارچه‌ساز','Carrier-owned':'وابسته به حمل‌کننده','bankruptcy':'ورشکستگی','resilience':'تاب‌آوری','scale':'مقیاس','visibility':'دیدپذیری','diversification':'تنوع‌بخشی','misdeclared':'اظهار نادرست','rescue':'نجات','notification':'اطلاع‌رسانی','security':'امنیت','Request':'درخواست','Contradiction':'تناقض','validation':'اعتبارسنجی','included':'مشمول','excluded':'غیرمشمول','segment':'بخش بازار','route':'مسیر','mode':'شیوه حمل','commodity':'کالا','volume':'حجم','charge':'جزء هزینه','currency':'ارز','markup':'حاشیه‌گذاری','invoice':'صورتحساب','operational':'عملیاتی','transport':'حمل','delivery':'تحویل','declarations':'اظهارنامه‌ها','certificate':'گواهی','report':'گزارش','mandatory':'الزامی','optional':'اختیاری','regulation':'مقرره','edition':'ویرایش','mitigation':'کاهش اثر','claimant':'مدعی','liable':'مسئول','party':'طرف','shortage':'کسری','dispute':'اختلاف','premises':'محل فرستنده','customer':'مشتری','revenue':'درآمد','trucker':'حمل‌کننده زمینی','duty':'حقوق ورودی','official':'رسمی','triangulation':'اعتبارسنجی متقاطع','Inferred':'استنتاجی','completeness':'کامل‌بودن','country':'کشور','corridor':'کریدور','Forwarder':'فورواردر','parent':'شرکت مادر','ownership':'مالکیت','master':'مرجع','Top':'برتر','alliance':'ائتلاف','snapshot':'تصویر مقطعی','Customer':'مشتری','Buyer':'خریدار','Operations':'عملیات','Procurement':'تأمین','Financial':'مالی','from':'از','to':'به','steps':'گام‌ها','input':'ورودی','point':'نقطه','budget':'بودجه','acceptance':'پذیرش','rows':'ردیف','taxonomy':'طبقه‌بندی','congestion':'ازدحام','rejection':'رد','hit':'اصابت','theft':'سرقت','payment':'پرداخت','default':'نکول','contingency':'برنامه جایگزین','communication':'ارتباطات','option':'گزینه','Row':'ردیف','threshold':'آستانه','count':'تعداد','missing':'مفقود','item':'مورد','Surface':'سطح','calibration':'تنظیم','rates':'نرخ‌ها','rules':'قواعد','delegated':'تفویض‌شده','authorities':'اختیارات','Provider':'ارائه‌دهنده','channel':'کانال','matching':'تطبیق','neutral':'بی‌طرف','aggregation':'تجمیع','transaction':'تراکنش','forwarding':'فورواردینگ','warehousing':'انبارداری','distribution':'توزیع','independent':'مستقل','roll-up':'تجمیع تملک','recession':'رکود','Chokepoint':'گلوگاه','rerouting':'بازمسیر‌دهی','bulk':'فله‌بر','vessel':'کشتی','vessels':'کشتی‌ها','Pharma':'دارویی','certified':'تأییدشده','review':'بازبینی','cadence':'تناوب','outsize':'فوق‌ابعاد','light':'محدود','path':'مسیر','dual':'دوگانه','sourcing':'تأمین','mix':'ترکیب','candidate':'نامزد','discipline':'انضباط','Example':'نمونه','Applicability':'دامنه کاربرد','counterparty':'طرف مقابل','cost':'هزینه','acquisition':'جذب مشتری','management':'مدیریت','Complete':'کامل','Partial':'ناقص','placeholder':'جای‌نگهدار','Regulations':'مقررات','Completion':'کامل‌بودن','marketplace':'بازارگاه','tree':'درخت تصمیم','Dynamic':'پویا','Execution':'اجرا','subprocesses':'زیرفرایندها','Management':'مدیریت','deadline':'مهلت','Reject':'رد','score':'امتیاز','card':'کارت','analytics':'تحلیل','retraining':'بازآموزی','sequence':'توالی','Current':'وضع موجود','thresholds':'آستانه‌ها','economics':'اقتصاد','playbook':'راهنمای اقدام','learning':'یادگیری','enabler':'توانمندساز','accountability':'پاسخ‌گویی','rights':'حقوق','Relationship':'رابطه','Enquiry':'استعلام','Cargo profile':'پروفایل بار','error':'خطا','terms':'شرایط','Approval guardrail':'حدود تأیید','confirmation':'تأیید','cancellation':'لغو','Empty pickup':'دریافت تجهیز خالی','equipment mismatch':'عدم تطابق تجهیز','Stuffed':'بارچینی‌شده','missed':'ازدست‌رفته','set':'بسته','discrepancy':'مغایرت','Export':'صادرات','dashboard':'داشبورد','Onward connection':'اتصال بعدی','Available cargo':'بار قابل تحویل','Arrival checklist':'چک‌لیست ورود','dwell':'توقف','Import':'واردات','authentication':'اصالت‌سنجی','Delivered unit':'واحد تحویل‌شده','Signed':'امضاشده','open job':'پرونده باز','Invoice':'صورتحساب','plan':'برنامه','Escalation matrix':'ماتریس تشدید','uncontrolled loss':'زیان کنترل‌نشده','Resolved':'حل‌شده','rhythm':'چرخه','breach':'نقض','Closed cycle':'چرخه بسته','repeat':'تکرار','Traceable architecture':'معماری ردیابی‌پذیر','cross-links':'پیوندهای متقاطع','orphan':'بی‌مالک','Operational account':'حساب عملیاتی','groupage':'بار گروپاژ','stow plan':'برنامه چیدمان','short shipment':'کسری حمل','Uplift-ready cargo':'بار آماده پرواز','excursion':'انحراف','Border-cleared leg':'قطعه ترخیص‌شده مرزی','Transit docs':'اسناد ترانزیت','delay':'تأخیر'
};
/* FINAL_PRO_TRANSLATION_AUDIT */
Object.assign(FA_EXACT,{"رابطه governance": "حاکمیت رابطه", "Inside Sales · ACT-003": "فروش داخلی · ACT-003", "Incoterms check": "کنترل اینکوترمز", "KAM · ACT-002": "مدیر حساب کلیدی · ACT-002", "صادرات Ops · ACT-007": "عملیات صادرات · ACT-007", "Docs · ACT-009": "اسناد · ACT-009", "DG/HS خطا": "خطای کالای خطرناک / کد HS", "EIR کنترل": "کنترل رسید تبادل تجهیز", "KYC/AML gate": "دروازهٔ احراز هویت و مبارزه با پول‌شویی", "sanctions/نکول": "تحریم / نکول", "DG/temp/امنیت": "کالای خطرناک / دما / امنیت", "border تأخیر": "تأخیر مرزی", "قرارداد stack": "پشتهٔ قراردادها", "Jurisdiction بازبینی": "بازبینی حوزهٔ قضایی", "wrong رژیم": "رژیم حقوقی نادرست", "معتبر cover": "پوشش معتبر", "اظهار check": "کنترل اظهار", "پوشش gap": "شکاف پوشش", "Treatment برنامه": "برنامهٔ اقدام", "ریسک-کنترل link": "پیوند ریسک و کنترل", "unmitigated ریسک": "ریسک مهارنشده", "Authenticated تراکنش": "تراکنش احراز‌شده", "مطالعهٔ موردی lessons": "درس‌های مطالعهٔ موردی", "شواهد tiers": "سطوح شواهد", "false comparison": "مقایسهٔ نادرست", "بازیافت run": "اجرای بازیافت", "cascade شکست": "شکست آبشاری", "نامشخص separation": "تفکیک موارد نامشخص", "false certainty": "قطعیت کاذب", "خدمت/RFQ fit": "تناسب خدمت و درخواست نرخ", "mis-scoped offer": "پیشنهاد با دامنهٔ نادرست", "Traceable ساختار نرخ": "ساختار نرخ ردیابی‌پذیر", "کامل سند chain": "زنجیرهٔ کامل اسناد", "توقف or تحویل اشتباه": "توقف یا تحویل اشتباه", "Filed/validated procedure": "رویهٔ ثبت‌شده و اعتبارسنجی‌شده", "مرجع + لازم‌الاجرا date": "مرجع و تاریخ لازم‌الاجرا", "جریمه or seizure": "جریمه یا توقیف", "تسویه/بازیافت file": "پروندهٔ تسویه و بازیافت", "مهلت قانونی / پوشش loss": "مهلت قانونی / فقدان پوشش", "Reconciled three جریان‌ها": "سه جریان تطبیق‌یافته", "پرونده باز / false حاشیه سود": "پروندهٔ باز / حاشیه سود کاذب", "Cited راستی‌آزمایی‌شده statement": "گزارهٔ مستند و راستی‌آزمایی‌شده", "شواهد tier + تاریخ دسترسی": "سطح شواهد و تاریخ دسترسی", "اعتبارسنجی-ready صف": "صف آمادهٔ اعتبارسنجی", "misapplied reference مدل": "کاربرد نادرست مدل مرجع", "Deduplicated نهاد graph": "گراف نهادهای بدون تکرار", "مالکیت + ID integrity": "مالکیت و یکپارچگی شناسه", "wrong طرف مقابل mapping": "نگاشت نادرست طرف مقابل", "ظرفیت strategy": "راهبرد ظرفیت", "Dated fleet تصویر مقطعی": "تصویر مقطعی تاریخ‌دار ناوگان", "false سهمیهٔ ظرفیت فرض": "فرض نادرست سهمیهٔ ظرفیت", "گره hierarchy": "سلسله‌مراتب گره‌ها", "عملکرد کانتینری vs ظرفیت": "عملکرد کانتینری در برابر ظرفیت", "wrong دروازه design": "طراحی نادرست دروازه", "قرارداد-linked relation": "رابطهٔ متصل به قرارداد", "Direction + ارزش exchange": "جهت و ارزش مبادله", "پاسخ‌گویی gap": "شکاف پاسخ‌گویی", "Executable کنترل library": "کتابخانهٔ کنترل اجراپذیر", "One پاسخ‌گو مالک": "یک مالک پاسخ‌گو", "approval ambiguity": "ابهام در تأیید", "Prioritized بازیافت برنامه": "برنامهٔ اولویت‌بندی‌شدهٔ بازیافت", "Likelihood × impact": "احتمال × اثر", "cascading اختلال": "اختلال آبشاری", "Owned شواهد صف": "صف شواهد دارای مالک", "Impact + method + due date": "اثر، روش و موعد", "نامشخص treated as واقعیت": "تلقی مورد نامشخص به‌عنوان واقعیت", "تصمیم-ready مدل": "مدل آمادهٔ تصمیم", "reference مدل misapplied": "کاربرد نادرست مدل مرجع", "Selected الگوی عملیاتی": "الگوی عملیاتی منتخب", "Legal نقش + درآمد logic": "نقش حقوقی و منطق درآمد", "category confusion": "آشفتگی طبقه‌بندی", "تداوم / integration برنامه": "برنامهٔ تداوم و یکپارچه‌سازی", "stranded cargo": "بار بلاتکلیف", "inventory اختلال": "اختلال موجودی", "Synchronized تحویل": "تحویل همگام‌شده", "Cold-chain / hazmat / QA": "زنجیرهٔ سرد / مواد خطرناک / تضمین کیفیت", "site or patient impact": "اثر بر سایت یا بیمار", "Reusable سازوکار": "سازوکار قابل‌استفادهٔ مجدد", "دامنه کاربرد boundary": "مرز دامنهٔ کاربرد", "cargo-cult solution": "راه‌حل تقلیدی و بی‌تحلیل", "Executable OM ردیف": "ردیف مدل عملیاتی اجراپذیر", "ownerless شکست": "شکست بدون مالک", "Prioritized شواهد gaps": "شکاف‌های اولویت‌بندی‌شدهٔ شواهد", "راستی‌آزمایی‌شده/نامشخص counts": "شمار موارد راستی‌آزمایی‌شده / نامشخص", "false کامل‌بودن": "کامل‌بودن کاذب", "Qualified تأمین‌کننده tier": "سطح تأمین‌کنندهٔ صلاحیت‌سنجی‌شده", "unqualified ظرفیت": "ظرفیت تأییدنشده", "Validated RFQ record": "رکورد درخواست نرخ اعتبارسنجی‌شده", "silent داده فرض": "فرض پنهان داده", "regulatory نقض": "نقض مقررات", "معتبر bookable پیشنهاد نرخ": "پیشنهاد نرخ معتبر و قابل رزرو", "اعتبار زمانی + credit + ظرفیت توقف": "اعتبار زمانی، اعتبار مالی و توقف موقت ظرفیت", "expired rate / no space": "نرخ منقضی / نبود ظرفیت", "آزادسازی-ready سند بسته": "بستهٔ اسناد آمادهٔ آزادسازی", "UCP 600 + version کنترل": "UCP 600 و کنترل نسخه", "مغایرت / misrelease": "مغایرت / آزادسازی نادرست", "Released or guaranteed movement": "حرکت آزادشده یا تضمین‌شده", "مسیر + guarantee + PCA": "مسیر، تضمین و تحلیل علت ریشه‌ای", "توقف / guarantee call": "توقف / مطالبهٔ تضمین", "قابل‌اعتماد ETA and free-time clock": "زمان ورود قابل‌اتکا و شمارش مهلت آزاد", "Dedup + تغییرناپذیر دفتر ثبت": "حذف تکرار و دفتر ثبت تغییرناپذیر", "late رسوب بندری alert": "هشدار دیرهنگام رسوب بندری", "تأییدشده corrective action": "اقدام اصلاحی تأییدشده", "Severity + تأیید انسانی + CAPA": "شدت، تأیید انسانی و اقدام اصلاحی", "نشت درآمد / نقدینگی shock": "نشت درآمد / شوک نقدینگی", "Settled/recovered خسارت": "خسارت تسویه یا بازیافت‌شده", "Time bar + بازرسی + مسئولیت": "مهلت قانونی، بازرسی و مسئولیت", "پوشش or بازیافت loss": "فقدان پوشش یا بازیافت", "Updated امتیاز and راهنمای اقدام": "امتیاز و راهنمای اقدام به‌روزشده", "رویداد feedback + بایگانی": "بازخورد رویداد و بایگانی", "مدیریتی / Transformation": "مدیریت / تحول", "Sequenced نقشهٔ راه": "نقشهٔ راه مرحله‌بندی‌شده", "Stage-gate شواهد": "دروازه‌های مرحله‌ای شواهد", "technology-first شکست": "شکست ناشی از فناوری‌محوری"});
FA_PHRASES=FA_PHRASES.concat(Object.entries({"container فهرست بسته‌بندی": "فهرست بسته‌بندی کانتینر", "ورود به پایانه slip": "رسید ورود به پایانه", "انتقال به سفر بعد به سفر دریایی بعد": "انتقال به سفر دریایی بعد", "nil سهمیهٔ ظرفیت": "نبود سهمیهٔ ظرفیت", "ازدست‌رفته مهلت نهایی": "از دست رفتن مهلت نهایی", "گمرک توقف/inspection": "توقف یا بازرسی گمرکی", "sanctions توقف": "توقف تحریمی", "Credit کنترل": "کنترل اعتبار", "co-بارگذار": "هم‌بارگذار", "short-محموله": "کسری محموله", "mis-consolidation": "تجمیع نادرست", "DG پذیرش": "پذیرش کالای خطرناک", "دما handling": "کنترل دما", "flown-as-booked": "حمل مطابق رزرو", "ترانزیت time": "زمان ترانزیت", "zero دما انحراف": "بدون انحراف دما", "sanctions؛": "تحریم‌ها؛", "escalation متصل": "تشدید متصل", "B/L جعلی": "بارنامهٔ جعلی", "pickup ساختگی": "تحویل‌گیری ساختگی", "guardrail": "چارچوب کنترل", "DG توقف-work": "توقف کار کالای خطرناک", "severity": "شدت", "Gross حاشیه سود": "حاشیه سود ناخالص", "live rate": "نرخ زنده", "open تصمیم": "تصمیم باز", "هوایی Express": "هوایی سریع", "پروژه Cargo": "بار پروژه‌ای", "قرارداد Logistics": "قرارداد لجستیک", "Rate ساختار نرخ": "ساختار نرخ", "ریسک buffer": "ذخیرهٔ ریسک", "هزینه-or-فروش": "هزینه یا فروش", "basis-of-جزء هزینه": "مبنای جزء هزینه", "per-container": "به‌ازای کانتینر", "per chargeable kg": "به‌ازای کیلوگرم قابل‌محاسبه", "pass-through": "انتقال مستقیم هزینه", "آزادسازی Logic": "منطق آزادسازی", "Commercial،": "تجاری،", "تحویل شواهد": "مدرک تحویل", "گمرک و مقررات gap-flagged": "گمرک و مقررات دارای شکاف", "sea آسیب/loss": "آسیب یا فقدان دریایی", "هوایی آسیب/تأخیر": "آسیب یا تأخیر هوایی", "دما انحراف": "انحراف دما", "مسئول طرف": "طرف مسئول", "job close": "بستن پرونده", "منبع ID": "شناسهٔ منبع", "وضعیت verification": "وضعیت راستی‌آزمایی", "منبعها": "منابع", "دروازهها": "دروازه‌ها", "گروهها": "گروه‌ها", "Linkage": "پیوند", "Bank برای تسویه": "بانک برای تسویه", "Approval": "تأیید", "توقف-Work": "توقف کار", "حق تصمیمs": "حقوق تصمیم", "Heatmap": "نقشهٔ حرارتی", "sanctions اصابت": "تطابق با فهرست تحریم", "cargo سرقت": "سرقت بار", "نامشخصها": "موارد نامشخص", "لازم‌الاجرا-date": "تاریخ لازم‌الاجرا", "فرضها": "فرض‌ها", "مفقود gap": "شکاف مفقود", "شکست شیوه حمل": "شیوهٔ شکست", "اعتبارسنجی need": "نیاز اعتبارسنجی", "live نرخ‌ها": "نرخ‌های زنده", "کشور/کریدور قواعد": "قواعد کشور / کریدور", "تفویض‌شده اختیارات": "اختیارات تفویض‌شده", "own B/L": "بارنامهٔ اختصاصی", "بی‌طرف هماهنگ‌سازی": "هماهنگ‌سازی بی‌طرفانه", "شبکه تجمیع": "تجمیع شبکه", "many-به-many": "چندبه‌چند", "تجمیع تملک": "تجمیع از راه تملک", "کرایه حمل رکود": "رکود کرایهٔ حمل", "انحراف از Cape": "انحراف از مسیر دماغه امیدنیک", "مسیر Cape": "مسیر دماغه امیدنیک", "self-اجاره دربست": "اجارهٔ مستقیم کشتی", "سه فله‌بر کشتی": "سه کشتی فله‌بر", "Sea-هوایی": "دریا–هوایی", "cold-chain تأییدشده انبارداری": "انبارداری تأییدشدهٔ زنجیرهٔ سرد", "بازبینی تناوب": "بازبینی دوره‌ای", "الگو library": "کتابخانهٔ الگو", "نامزد routes": "مسیرهای نامزد", "تصمیم gate": "دروازهٔ تصمیم", "escalation": "تشدید", "ذخیره تعهدی انضباط": "انضباط ذخیرهٔ تعهدی", "Cross-Link کامل": "پیوند متقاطع کامل", "قرارداد/rule": "قرارداد / قاعده", "sanctions مدیریت": "مدیریت تحریم‌ها", "ثانویه-sourced": "دارای منبع ثانویه", "Gap-Flagged": "دارای شکاف", "Routes": "مسیرها", "Benchmarks": "مقایسه‌های مرجع", "FIATA/BIFA": "FIATA / BIFA", "دوگانه-use": "دومنظوره", "صادرات license": "مجوز صادرات", "استثنا Engine": "موتور استثنا", "موتور استثنا": "موتور استثنا", "کد دلیل": "کد علت", "نسخه‌بندی": "مدیریت نسخه", "آزادسازی-ready": "آمادهٔ آزادسازی", "عملیاتی مدل": "مدل عملیاتی", "scenario راهنمای اقدام": "راهنمای اقدام سناریویی", "دوگانه تأمین": "تأمین دوگانه", "یادگیری حلقه": "حلقهٔ یادگیری"}));
Object.assign(FA_WORDS,{"governance": "حاکمیت", "check": "کنترل", "Credit": "اعتبار", "inspection": "بازرسی", "Cape": "دماغه امیدنیک", "claim": "خسارت", "handling": "نگهداشت", "embargo": "ممنوعیت", "prioritization": "اولویت‌بندی", "Kazakhstan": "قزاقستان", "Caspian": "دریای خزر", "Azerbaijan": "جمهوری آذربایجان", "Georgia": "گرجستان", "Turkey": "ترکیه", "supplementary": "تکمیلی", "limits": "حدود", "sanctions": "تحریم‌ها", "open": "باز", "Ningbo": "نینگبو", "Hamburg": "هامبورگ", "Duisburg": "دویسبورگ", "Xi’an": "شی‌آن", "Common": "مشترک", "Union": "اتحادیه", "facts": "واقعیت‌ها", "Original": "نسخهٔ اصل", "Telex": "آزادسازی تلکسی", "Express": "سریع", "loss": "فقدان", "road": "جاده‌ای", "file": "پرونده", "statement": "گزاره", "fleet": "ناوگان", "mapping": "نگاشت", "strategy": "راهبرد", "library": "کتابخانه", "impact": "اثر", "method": "روش", "counts": "شمار", "regulatory": "مقرراتی", "bookable": "قابل رزرو", "version": "نسخه", "guarantee": "تضمین", "multi-منبع": "چندمنبعی", "schema": "طرح‌واره", "gate": "دروازه", "subrogate": "جانشینی", "orchestrate": "هماهنگ‌سازی", "flagged": "علامت‌گذاری‌شده", "ships": "کشتی", "Transformation": "تحول"});
/* FINAL_DELIVERY_POLISH */
Object.assign(FA_EXACT,{'wrong counterparty mapping':'نگاشت نادرست طرف مقابل','Executable control library':'کتابخانهٔ کنترل اجراپذیر','cascading exception':'استثنای آبشاری','coverage or recovery loss':'فقدان پوشش یا بازیافت'});
FA_PHRASES=FA_PHRASES.concat([['Tier C','سطح C'],['Cargo, liability','بار، مسئولیت'],['design capacity','ظرفیت طراحی'],['model fit','تناسب مدل مرجع'],['this trace','این ردپای ردیابی'],['job economics','اقتصاد پرونده'],['sanctions hold','توقف ناشی از تحریم']]);
Object.assign(FA_WORDS,{'leg':'مرحلهٔ حمل','cascading':'آبشاری'});
function faText(v){
 if(v===null||v===undefined)return v;var x=String(v);if(FA_EXACT[x])x=FA_EXACT[x];
 for(var i=0;i<FA_PHRASES.length;i++){var a=FA_PHRASES[i][0],b=FA_PHRASES[i][1];x=x.replace(new RegExp(a.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),b);}
 var keys=Object.keys(FA_WORDS).sort(function(a,b){return b.length-a.length;});
 for(i=0;i<keys.length;i++){var k=keys[i];x=x.replace(new RegExp('\\b'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','gi'),FA_WORDS[k]);}
 return x===String(v)?x:faText(x);
}
for(var fi=0;fi<SCENES.length;fi++){var fs=SCENES[fi];fs.ti=faText(fs.ti);fs.sb=faText(fs.sb);fs.card.tx=faText(fs.card.tx);fs.card.sr=faText(fs.card.sr);}
for(fi=0;fi<SCENE_METRICS.length;fi++)for(var fj=0;fj<3;fj++)SCENE_METRICS[fi][fj]=faText(SCENE_METRICS[fi][fj]);
for(fi=0;fi<SCENE_LENS.length;fi++){SCENE_LENS[fi].r=faText(SCENE_LENS[fi].r);SCENE_LENS[fi].o=faText(SCENE_LENS[fi].o);SCENE_LENS[fi].c=faText(SCENE_LENS[fi].c);SCENE_LENS[fi].f=faText(SCENE_LENS[fi].f);}
for(fi=0;fi<SCENE_TRACE.length;fi++)for(fj=0;fj<SCENE_TRACE[fi].length;fj++)SCENE_TRACE[fi][fj]=faText(SCENE_TRACE[fi][fj]);
for(fi=0;fi<SCENE_VIZ.length;fi++)if(SCENE_VIZ[fi]){SCENE_VIZ[fi].title=faText(SCENE_VIZ[fi].title);for(fj=0;fj<SCENE_VIZ[fi].items.length;fj++){SCENE_VIZ[fi].items[fj][0]=faText(SCENE_VIZ[fi].items[fj][0]);SCENE_VIZ[fi].items[fj][2]=faText(SCENE_VIZ[fi].items[fj][2]);}}

/* timeline */
var T0=[],ACC=0;
for(var si=0;si<SCENES.length;si++){T0.push(ACC);SCENES[si].t0=ACC;ACC+=SCENES[si].d;}
var END=ACC;
var TIERCOL={VERIFIED:'#3ddc84',FACT:'#32d3ff',CLAIM:'#ffd166',INFERENCE:'#b892ff',CONFLICT:'#ff8a2b',UNKNOWN:'#7c8aa2'};
var TIERFA={VERIFIED:'راستی‌آزمایی‌شده',FACT:'واقعیت منبع‌دار',CLAIM:'ادعای عملیاتی',INFERENCE:'استنتاج مدل مرجع',CONFLICT:'متناقض — هر دو مقدار',UNKNOWN:'نامشخص'};

/* ================= DRAW PRIMITIVES ================= */
function shade(hex,f){
  var n=parseInt(hex.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;
  r=clamp(Math.round(r*f),0,255);g=clamp(Math.round(g*f),0,255);b=clamp(Math.round(b*f),0,255);
  return 'rgb('+r+','+g+','+b+')';
}
function hexa(hex,a){
  var n=parseInt(hex.slice(1),16);
  return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
}
function poly(pts,fill,stroke,lw){
  if(!pts.length)return;
  CX.beginPath();CX.moveTo(pts[0].x,pts[0].y);
  for(var i=1;i<pts.length;i++)CX.lineTo(pts[i].x,pts[i].y);
  CX.closePath();
  if(fill){CX.fillStyle=fill;CX.fill();}
  if(stroke){CX.strokeStyle=stroke;CX.lineWidth=lw||1;CX.stroke();}
}
/* ground grid */
function drawGrid(){
  var st=8,i,a,b;
  CX.lineWidth=1;
  for(i=-72;i<=72;i+=st){
    a=iso(i,-44,0);b=iso(i,36,0);
    CX.strokeStyle=(i%32===0)?C.g2:C.g1;
    CX.beginPath();CX.moveTo(a.x,a.y);CX.lineTo(b.x,b.y);CX.stroke();
  }
  for(i=-44;i<=36;i+=st){
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
/* isometric prism */
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
/* flat diamond pad */
function pad(x,y,w,d,col,alpha){
  var hw=w/2,hd=d/2;
  CX.globalAlpha=alpha===undefined?1:alpha;
  poly([iso(x-hw,y-hd,0),iso(x+hw,y-hd,0),iso(x+hw,y+hd,0),iso(x-hw,y+hd,0)],hexa(col,0.5),hexa(col,0.9),1.3);
  CX.globalAlpha=1;
}
/* port with gantry cranes */
function port(n,hl){
  var x=n.x,y=n.y,w=n.w,d=n.d;
  shadow(x,y,w,d);
  pad(x,y,w+2,d+2,hl?C.info:C.port,hl?0.5:0.3);
  prism(x,y+d*0.30,w*0.92,d*0.36,1.6,C.port,1,hl?0.7:0.2);
  var k,cx2,base,top,arm,arm2;
  for(k=-1;k<=1;k++){
    cx2=x+k*(w*0.30);
    base=iso(cx2,y-d*0.18,0);top=iso(cx2,y-d*0.18,9);
    CX.strokeStyle=hl?hexa(C.info,0.95):hexa('#8fb6c9',0.6);CX.lineWidth=2;
    CX.beginPath();CX.moveTo(base.x,base.y);CX.lineTo(top.x,top.y);CX.stroke();
    arm=iso(cx2,y+d*0.42,8.2);
    CX.beginPath();CX.moveTo(top.x,top.y);CX.lineTo(arm.x,arm.y);CX.stroke();
    arm2=iso(cx2,y-d*0.58,8.2);
    CX.beginPath();CX.moveTo(top.x,top.y);CX.lineTo(arm2.x,arm2.y);CX.stroke();
  }
}
/* customs gate */
function gate(n,hl,alarm){
  var x=n.x,y=n.y,w=n.w,d=n.d,h=n.h,col=alarm?C.risk:C.gate;
  shadow(x,y,w,d);
  prism(x,y-d*0.42,w*0.28,d*0.16,h,col,1,alarm?1.2:(hl?0.7:0.15));
  prism(x,y+d*0.42,w*0.28,d*0.16,h,col,1,alarm?1.2:(hl?0.7:0.15));
  var a=iso(x,y-d*0.42,h),b=iso(x,y+d*0.42,h);
  CX.strokeStyle=alarm?hexa(C.risk,1):hexa(col,0.9);CX.lineWidth=3;
  if(alarm){CX.shadowColor=hexa(C.risk,1);CX.shadowBlur=20;}
  CX.beginPath();CX.moveTo(a.x,a.y);CX.lineTo(b.x,b.y);CX.stroke();CX.shadowBlur=0;
}
/* warehouse with pitched roof */
function warehouse(n,hl){
  shadow(n.x,n.y,n.w,n.d);
  prism(n.x,n.y,n.w,n.d,n.h,n.col,1,hl?0.6:0.12);
  var hw=n.w/2,hd=n.d/2;
  var a=iso(n.x-hw,n.y,n.h+2.4),b=iso(n.x+hw,n.y,n.h+2.4);
  var c=iso(n.x+hw,n.y-hd,n.h),e=iso(n.x-hw,n.y-hd,n.h);
  poly([a,b,c,e],shade(n.col,1.5),hexa(C.info,0.45),1);
  var f=iso(n.x+hw,n.y+hd,n.h),g=iso(n.x-hw,n.y+hd,n.h);
  poly([a,b,f,g],shade(n.col,1.1),hexa(C.info,0.3),1);
}
/* empty container depot: stacked boxes */
function depot(n,hl){
  shadow(n.x,n.y,n.w,n.d);
  pad(n.x,n.y,n.w+2,n.d+2,C.info,hl?0.38:0.16);
  var r,c2;
  for(r=0;r<3;r++)for(c2=0;c2<2;c2++){
    prism(n.x-2.2+r*2.2,n.y-1.4+c2*2.8,1.9,2.2,1.5+(r%2)*1.5,C.bdL,0.95,hl?0.45:0.08);
  }
}
/* rail yard */
function rail(n,hl){
  shadow(n.x,n.y,n.w,n.d);
  prism(n.x,n.y,n.w,n.d*0.5,n.h*0.6,n.col,1,hl?0.55:0.1);
  var i,a,b;
  for(i=-1;i<=1;i+=2){
    a=iso(n.x-n.w*0.8,n.y+i*0.8,0.2);b=iso(n.x+n.w*0.8,n.y+i*0.8,0.2);
    CX.strokeStyle=hexa(hl?C.info:'#6a7e96',0.7);CX.lineWidth=1.6;
    CX.beginPath();CX.moveTo(a.x,a.y);CX.lineTo(b.x,b.y);CX.stroke();
  }
}
/* forwarder HQ with glow ring */
function hq(n,hl,pulse){
  shadow(n.x,n.y,n.w*1.5,n.d*1.5);
  var rr=n.w*0.95+Math.sin(pulse*1.6)*0.5;
  var p=iso(n.x,n.y,0);
  CX.save();
  CX.translate(p.x,p.y);CX.scale(1,S30);
  CX.strokeStyle=hexa(C.hq,0.30+0.18*Math.sin(pulse*1.6));CX.lineWidth=2.4;
  CX.beginPath();CX.arc(0,0,rr*cam.zoom,0,6.2832);CX.stroke();
  CX.strokeStyle=hexa(C.hq,0.14);CX.lineWidth=1.4;
  CX.beginPath();CX.arc(0,0,(rr+3.5)*cam.zoom,0,6.2832);CX.stroke();
  CX.restore();
  prism(n.x,n.y,n.w*0.86,n.d*0.86,n.h*0.55,'#2a3b5e',1,0.3);
  prism(n.x,n.y,n.w*0.60,n.d*0.60,n.h,C.hq,1,hl?1.25:0.85);
  prism(n.x,n.y,n.w*0.26,n.d*0.26,n.h*1.32,C.hq,1,1.1);
}
/* control tower */
function tower(n,hl,pulse){
  shadow(n.x,n.y,n.w,n.d);
  prism(n.x,n.y,n.w*0.34,n.d*0.34,n.h,C.twr,0.95,hl?0.9:0.25);
  prism(n.x,n.y,n.w*0.95,n.d*0.95,2.2,C.twr,0.9,hl?0.8:0.2);
  var p=iso(n.x,n.y,n.h+2.6);
  var rr=(2.0+Math.abs(Math.sin(pulse*1.2))*1.6)*cam.zoom*0.5;
  CX.fillStyle=hexa(C.twr,0.5);CX.beginPath();CX.arc(p.x,p.y,rr,0,6.2832);CX.fill();
  CX.fillStyle=hexa(C.twr,1);CX.beginPath();CX.arc(p.x,p.y,2.6,0,6.2832);CX.fill();
}
/* generic actor: pad + prism + node dot */
function actor(n,hl){
  shadow(n.x,n.y,n.w,n.d);
  pad(n.x,n.y,n.w+2.2,n.d+2.2,hl?C.info:C.pad,hl?0.42:0.16);
  prism(n.x,n.y,n.w*0.66,n.d*0.66,n.h,hl?C.bdL:C.bd,1,hl?0.6:0.08);
  var p=iso(n.x,n.y,n.h+1.1);
  CX.fillStyle=hexa(hl?C.info:C.dim,hl?0.95:0.4);
  CX.beginPath();CX.arc(p.x,p.y,hl?3.4:2.2,0,6.2832);CX.fill();
}
/* box actor (shipper / consignee) */
function boxActor(n,hl){
  shadow(n.x,n.y,n.w,n.d);
  prism(n.x,n.y,n.w,n.d,n.h,hl?C.bdL:C.bd,1,hl?0.75:0.12);
  prism(n.x,n.y,n.w*0.42,n.d*0.42,n.h+3.4,hl?C.info:'#24374f',1,hl?0.8:0.1);
}
/* ====== node dispatch ====== */
function drawNode(n,hl,pulse,alarm){
  var a=n.app;
  if(a<=0.01)return;
  CX.globalAlpha=a;
  if(n.kind==='port')port(n,hl);
  else if(n.kind==='gate')gate(n,hl,alarm);
  else if(n.kind==='whs')warehouse(n,hl);
  else if(n.kind==='depot')depot(n,hl);
  else if(n.kind==='rail')rail(n,hl);
  else if(n.kind==='hq')hq(n,hl,pulse);
  else if(n.kind==='tower')tower(n,hl,pulse);
  else if(n.kind==='box')boxActor(n,hl);
  else actor(n,hl);
  CX.globalAlpha=1;
  /* label */
  var lz=(n.kind==='hq')?n.h*1.45:(n.kind==='tower'?n.h+5:n.h+4.2);
  var p=iso(n.x,n.y,lz);
  var sz=clamp(cam.zoom*1.30,10,17);
  CX.globalAlpha=a;
  if(n.kind==='hq'){
    label(n.fa,p.x,p.y-4,sz*1.46,hl?'#ffffff':C.hq,'center',700);
    label('\u0647\u0645\u0627\u0647\u0646\u06af\u200c\u06a9\u0646\u0646\u062f\u0647\u0654 \u0645\u0631\u06a9\u0632\u06cc',p.x,p.y+sz*1.05,sz*0.80,hexa(C.hq,0.80),'center',600);
  }else{
    label(n.fa,p.x,p.y,sz,hl?'#ffffff':hexa(C.ink,0.62),'center',hl?700:500);
  }
  CX.globalAlpha=1;
}

/* ================= EDGES, MOVERS, CAMERA, LOOP ================= */
var KCOL={cargo:C.cargo,info:C.info,money:C.money,rel:C.rel};var FLOW_ON={cargo:true,info:true,money:true,rel:true};var CHCOL={'تجاری':'#42d7ff','تأمین':'#ffb347','عملیات':'#ff8a2b','اسناد':'#9fb0c8','گمرک':'#b892ff','حمل اصلی':'#42d7ff','مقصد':'#46d69a','مالی':'#3ddc84','استثنا':'#ff4d5e','حاکمیت':'#b892ff','ریسک':'#ff6b7a','چندوجهی':'#42d7ff','معماری':'#ffb347','سناریو':'#ff4d5e','ممیزی':'#9fb0c8','داده‌مرجع':'#42d7ff','شواهد':'#8fa0b7','شبکه جهانی':'#42d7ff','روابط':'#b892ff','کنترل':'#ff8a2b','اعتبارسنجی':'#ffb347','جمع‌بندی':'#46d69a','بنچمارک':'#42d7ff','مطالعه موردی':'#ff8a2b','اجراپذیری':'#b892ff','بلوغ':'#46d69a','مدل فرایندی':'#35e0c1'};
function edgeScreen(e){
  var s=[],i,z;
  for(i=0;i<e.pts.length;i++){
    z=(e.kind==='info'||e.kind==='money')?2.6:0.5;
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
  var lw=e.kind==='cargo'?(hl?3.4:1.8):(e.kind==='rel'?1.1:(hl?2.2:1.2));
  CX.save();
  CX.globalAlpha=a*(hl?1:(e.kind==='rel'?0.42:0.34));
  if(e.dash)CX.setLineDash([7,7]);
  if(hl){CX.shadowColor=hexa(col,0.8);CX.shadowBlur=12;}
  CX.strokeStyle=hexa(col,hl?0.95:0.55);CX.lineWidth=lw;CX.lineJoin='round';
  CX.beginPath();CX.moveTo(s[0].x,s[0].y);
  for(var i=1;i<s.length;i++)CX.lineTo(s[i].x,s[i].y);
  CX.stroke();CX.setLineDash([]);CX.shadowBlur=0;
  CX.restore();
  /* flow particles */
  if(hl&&e.kind!=='rel'){
    var n=5,k,ph,pw,pp;
    for(k=0;k<n;k++){
      ph=((tt*0.22)+k/n)%1;
      pw=edgePosWorld(e,ph);
      pp=iso(pw.x,pw.y,(e.kind==='info'||e.kind==='money')?2.6:0.5);
      CX.globalAlpha=a*(0.35+0.65*Math.sin(Math.PI*ph));
      CX.fillStyle=hexa(col,1);CX.shadowColor=hexa(col,1);CX.shadowBlur=10;
      CX.beginPath();CX.arc(pp.x,pp.y,2.6,0,6.2832);CX.fill();
      CX.shadowBlur=0;CX.globalAlpha=1;
    }
    drawEdgeChevrons(e,tt,col);drawEdgeEnergy(e,tt,col);
  }
}
/* ================= MOVERS ================= */
function mover(k,x,y,tt,alarm){
  var col=alarm?C.risk:C.cargo,p;drawMoverFX(k,x,y,tt,alarm);
  if(k==='container'){
    prism(x,y,4.4,2.1,2.0,col,1,0.95);
  }else if(k==='truck'){
    prism(x,y,4.6,2.2,2.1,col,1,0.9);
    prism(x-3.0,y,1.7,2.0,2.4,'#3a4d72',1,0.3);
  }else if(k==='van'){
    prism(x,y,3.0,1.8,1.9,col,1,0.8);
  }else if(k==='train'){
    prism(x-2.6,y,2.0,1.9,2.2,'#3a4d72',1,0.3);
    prism(x+0.8,y,4.2,2.0,2.0,col,1,0.85);
  }else if(k==='ship'){
    prism(x,y,9.0,3.4,1.5,'#24405f',1,0.4);
    prism(x-1.4,y,5.2,2.2,1.7,col,0.95,0.9);
    prism(x+3.2,y,1.6,2.0,3.0,'#3f6199',1,0.3);
  }else if(k==='cube'){
    prism(x,y,2.0,2.0,2.0,col,1,0.8);
  }else if(k==='doc'){
    p=iso(x,y,3.2);
    CX.save();CX.globalAlpha=0.95;
    CX.shadowColor=hexa(C.info,0.9);CX.shadowBlur=14;
    CX.fillStyle=hexa(C.info,0.95);
    CX.beginPath();CX.moveTo(p.x,p.y-7);CX.lineTo(p.x+5.4,p.y);CX.lineTo(p.x,p.y+7);CX.lineTo(p.x-5.4,p.y);CX.closePath();CX.fill();
    CX.restore();
  }else if(k==='coin'){
    p=iso(x,y,3.2);
    CX.save();CX.shadowColor=hexa(C.money,0.9);CX.shadowBlur=14;
    CX.fillStyle=hexa(C.money,0.95);CX.beginPath();CX.arc(p.x,p.y,4.4,0,6.2832);CX.fill();
    CX.restore();
  }else if(k==='alert'){
    p=iso(x,y,3.4);
    CX.save();CX.shadowColor=hexa(C.risk,1);CX.shadowBlur=18;
    CX.fillStyle=hexa(C.risk,0.95);
    CX.beginPath();CX.moveTo(p.x,p.y-8);CX.lineTo(p.x+7,p.y+5);CX.lineTo(p.x-7,p.y+5);CX.closePath();CX.fill();
    CX.restore();
  }
}

/* premium ambient layers */
var AMB=[];for(var ai=0;ai<44;ai++)AMB.push({x:(ai*73)%997/997,y:(ai*193)%991/991,r:.4+(ai%4)*.22,p:ai*.61});
function drawAmbient(tt){var g=CX.createLinearGradient(0,0,W,H);g.addColorStop(0,'rgba(20,40,72,.16)');g.addColorStop(.55,'rgba(5,8,14,0)');g.addColorStop(1,'rgba(0,135,170,.07)');CX.fillStyle=g;CX.fillRect(0,0,W,H);for(var i=0;i<AMB.length;i++){var q=AMB[i],a=.08+.11*(.5+.5*Math.sin(tt*.18+q.p));CX.fillStyle='rgba(112,177,225,'+a+')';CX.beginPath();CX.arc(q.x*W,(q.y*H+tt*(.8+q.r))%H,q.r,0,6.283);CX.fill();}}
function drawZoneLabels(){var z=[[-49,18,'مبدأ'],[2,18,'دریا'],[41,18,'مقصد'],[-4,-29,'هماهنگ‌سازی']];for(var i=0;i<z.length;i++){var p=iso(z[i][0],z[i][1],.1);setFont(8,700,false);CX.textAlign='center';CX.fillStyle='rgba(107,130,163,.32)';CX.fillText(z[i][2],p.x,p.y);}}
function drawTelemetry(r){var n=ND.fwd,p=iso(n.x,n.y,n.h*1.58),rad=23+4*Math.sin(t*1.4);CX.save();CX.globalAlpha=.35;CX.strokeStyle=hexa(r.s.risk?C.risk:C.hq,.55);CX.setLineDash([3,6]);CX.beginPath();CX.arc(p.x,p.y,rad,0,6.283);CX.stroke();CX.restore();}


function drawScanSweep(tt){var x=((tt*.035)%1)*W,g=CX.createLinearGradient(x-80,0,x+20,0);g.addColorStop(0,'rgba(66,215,255,0)');g.addColorStop(.8,'rgba(66,215,255,.025)');g.addColorStop(1,'rgba(66,215,255,0)');CX.fillStyle=g;CX.fillRect(x-80,0,100,H);}
function drawFocusBracket(n){if(cam.zoom<7.5)return;var p=iso(n.x,n.y,n.h+2),r=Math.max(10,cam.zoom*n.w*.34),c=5;CX.save();CX.globalAlpha=.38;CX.strokeStyle=C.info;CX.lineWidth=1;CX.beginPath();CX.moveTo(p.x-r,p.y-r+c);CX.lineTo(p.x-r,p.y-r);CX.lineTo(p.x-r+c,p.y-r);CX.moveTo(p.x+r-c,p.y-r);CX.lineTo(p.x+r,p.y-r);CX.lineTo(p.x+r,p.y-r+c);CX.moveTo(p.x-r,p.y+r-c);CX.lineTo(p.x-r,p.y+r);CX.lineTo(p.x-r+c,p.y+r);CX.stroke();CX.restore();}


/* ================= CINEMATIC WORLD DETAIL ================= */
var scenePulse=0,mouseDX=0,mouseDY=0;
function drawOceanField(tt){
  var a=iso(-34,10,-.1),b=iso(38,10,-.1),c=iso(38,23,-.1),d=iso(-34,23,-.1),g=CX.createLinearGradient(a.x,a.y,c.x,c.y);
  g.addColorStop(0,'rgba(18,72,105,.025)');g.addColorStop(.5,'rgba(22,116,148,.10)');g.addColorStop(1,'rgba(18,72,105,.025)');poly([a,b,c,d],g,'rgba(66,215,255,.08)',1);
  CX.save();CX.lineWidth=.75;
  for(var j=0;j<8;j++){var yy=11+j*1.55,off=Math.sin(tt*.35+j)*1.2,p1=iso(-31+off,yy,0),p2=iso(35+off,yy,0);CX.strokeStyle='rgba(66,215,255,'+(.035+j*.006)+')';CX.setLineDash([10+j,8]);CX.lineDashOffset=-tt*(2+j*.18);CX.beginPath();CX.moveTo(p1.x,p1.y);CX.lineTo(p2.x,p2.y);CX.stroke();}
  CX.restore();
}
function drawNodeDetail(n,hl,tt){
  if(n.app<.12)return;var p=iso(n.x,n.y,n.h+1.2),col=hl?C.info:C.dim;
  CX.save();CX.globalAlpha=n.app*(hl?.72:.16);CX.strokeStyle=hexa(col,1);CX.lineWidth=1;
  if(hl){var rr=6+2*Math.sin(tt*2+n.x);CX.beginPath();CX.arc(p.x,p.y,rr,0,6.283);CX.stroke();var ang=tt*.7+n.x*.1;CX.fillStyle=hexa(col,.9);CX.beginPath();CX.arc(p.x+Math.cos(ang)*rr,p.y+Math.sin(ang)*rr,1.6,0,6.283);CX.fill();}
  if(n.kind==='box'||n.kind==='pad'){for(var k=-1;k<=1;k++){var w=iso(n.x+k*.9,n.y+n.d*.34,n.h*.52);CX.fillStyle=hexa(hl?C.info:'#8aa0be',hl?.72:.22);CX.fillRect(w.x-1.5,w.y-1,3,2);}}
  if(n.kind==='port'){for(var q=-2;q<=2;q++){var bx=n.x+q*1.65,co=(q%2)?C.cargo:C.info;prism(bx,n.y+n.d*.18,1.25,1.8,.7,co,.55,hl?.2:0);}}
  CX.restore();
}
function drawEdgeChevrons(e,tt,col){
  if(e.kind==='rel')return;CX.save();CX.strokeStyle=hexa(col,.78);CX.lineWidth=1.2;CX.globalAlpha=.65;
  for(var j=0;j<3;j++){var u=(tt*.11+j*.31)%1,w=edgePosWorld(e,u),q=iso(w.x,w.y,(e.kind==='info'||e.kind==='money')?2.6:.5),q2=iso(w.x+Math.cos(w.a)*.7,w.y+Math.sin(w.a)*.7,(e.kind==='info'||e.kind==='money')?2.6:.5),ang=Math.atan2(q2.y-q.y,q2.x-q.x);CX.save();CX.translate(q.x,q.y);CX.rotate(ang);CX.beginPath();CX.moveTo(-4,-3);CX.lineTo(0,0);CX.lineTo(-4,3);CX.stroke();CX.restore();}
  CX.restore();
}
function drawMoverFX(k,x,y,tt,alarm){
  var p=iso(x,y,.2),col=alarm?C.risk:(k==='doc'?C.info:(k==='coin'?C.money:C.cargo));CX.save();CX.globalAlpha=.32;CX.strokeStyle=hexa(col,1);CX.lineWidth=1;
  if(k==='ship'){for(var j=0;j<3;j++){CX.beginPath();CX.ellipse(p.x-15-j*8,p.y+4+j*2,12+j*4,3+j,0,0,6.283);CX.stroke();}}
  else{var rr=8+((tt*16)%13);CX.beginPath();CX.ellipse(p.x,p.y,rr,rr*S30,0,0,6.283);CX.stroke();}
  CX.restore();
}
function drawActiveOrbits(r,tt){
  var ids=['fwd','tower','oport','hub','dport'],n,p,rad,ang;CX.save();
  for(var i=0;i<ids.length;i++){if(!r.hot[ids[i]])continue;n=ND[ids[i]];p=iso(n.x,n.y,n.h+3);rad=12+i*2;ang=tt*(.45+i*.05);CX.strokeStyle='rgba(66,215,255,.14)';CX.lineWidth=1;CX.beginPath();CX.ellipse(p.x,p.y,rad,rad*.38,0,0,6.283);CX.stroke();CX.fillStyle='rgba(255,255,255,.72)';CX.beginPath();CX.arc(p.x+Math.cos(ang)*rad,p.y+Math.sin(ang)*rad*.38,1.6,0,6.283);CX.fill();}
  CX.restore();
}
function drawPostFX(r,tt){
  CX.save();var v=CX.createRadialGradient(W*.5,H*.5,Math.min(W,H)*.25,W*.5,H*.5,Math.max(W,H)*.72);v.addColorStop(0,'rgba(0,0,0,0)');v.addColorStop(1,'rgba(0,0,0,.32)');CX.fillStyle=v;CX.fillRect(0,0,W,H);
  if(r.s.risk){CX.globalAlpha=.035+.025*Math.sin(tt*3);CX.fillStyle=C.risk;CX.fillRect(0,0,W,H);}
  if(scenePulse>0){CX.globalAlpha=scenePulse*.12;CX.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--sceneAccent')||C.info;CX.fillRect(0,0,W,H);scenePulse*=.90;}
  CX.globalAlpha=.035;CX.fillStyle='#fff';for(var i=0;i<18;i++){var x=((i*197+Math.floor(tt*6)*31)%W),y=((i*83+Math.floor(tt*4)*17)%H);CX.fillRect(x,y,.7,.7);}CX.restore();
}


function drawMoverDetail(k,x,y,tt,alarm){
  var col=alarm?C.risk:C.cargo,p=iso(x,y,2.05),i,q;CX.save();
  if(k==='container'||k==='truck'||k==='train'||k==='ship'){
    CX.strokeStyle='rgba(255,255,255,.42)';CX.lineWidth=.7;CX.globalAlpha=.65;
    var count=k==='ship'?5:4,span=k==='ship'?16:7;
    for(i=0;i<count;i++){q=iso(x-span*.38+i*(span*.76/(count-1)),y,2.1);CX.beginPath();CX.moveTo(q.x,q.y-4);CX.lineTo(q.x,q.y+4);CX.stroke();}
  }
  if(k==='truck'||k==='train'){CX.fillStyle='#07101a';for(i=-1;i<=1;i+=2){q=iso(x+i*2.0,y+1.0,.35);CX.beginPath();CX.arc(q.x,q.y,2.1,0,6.283);CX.fill();CX.strokeStyle=hexa(col,.8);CX.stroke();}}
  if(k==='ship'){CX.fillStyle='rgba(66,215,255,.38)';for(i=0;i<4;i++){q=iso(x-2.5+i*1.7,y-1.2,3.1);CX.fillRect(q.x-2,q.y-1.2,4,2.4);}}
  CX.restore();
}
function drawContextFX(r,tt){
  CX.save();var n,p,rad,i;
  if(r.hot.expcus||r.hot.impcus||r.hot.compliance){n=r.hot.impcus?ND.impcus:(r.hot.expcus?ND.expcus:ND.compliance);p=iso(n.x,n.y,n.h+8);var sweep=(Math.sin(tt*1.7)*.5+.5);var a1=p.x-80+160*sweep;var g=CX.createLinearGradient(a1-20,0,a1+20,0);g.addColorStop(0,'rgba(66,215,255,0)');g.addColorStop(.5,'rgba(66,215,255,.11)');g.addColorStop(1,'rgba(66,215,255,0)');CX.fillStyle=g;CX.fillRect(a1-20,p.y-90,40,140);}
  if(r.s.risk){n=ND.impcus;p=iso(n.x,n.y,n.h+3);for(i=0;i<3;i++){rad=14+((tt*22+i*18)%54);CX.globalAlpha=(1-rad/70)*.32;CX.strokeStyle=C.risk;CX.lineWidth=1.2;CX.beginPath();CX.arc(p.x,p.y,rad,0,6.283);CX.stroke();}}
  if(r.hot.m_bank||r.hot.m_line||r.hot.m_cust){p=iso(ND.fwd.x,ND.fwd.y,ND.fwd.h+7);for(i=0;i<4;i++){var ang=tt*.8+i*1.57,rr=22;CX.fillStyle=hexa(C.money,.75);CX.beginPath();CX.arc(p.x+Math.cos(ang)*rr,p.y+Math.sin(ang)*rr*.38,2,0,6.283);CX.fill();}}
  CX.restore();
}
function updateNodeHover(ev){
  if(!elNodeTip||window.innerWidth<820||elExec&&elExec.classList.contains('on'))return;var best=null,bd=34*34;
  for(var i=0;i<NODES.length;i++){var n=NODES[i];if(n.app<.25)continue;var p=iso(n.x,n.y,n.h+2),dx=ev.clientX-p.x,dy=ev.clientY-p.y,d=dx*dx+dy*dy;if(d<bd){bd=d;best=n;}}
  if(best){elNodeTip.style.left=Math.min(ev.clientX,window.innerWidth-180)+'px';elNodeTip.style.top=Math.min(ev.clientY,window.innerHeight-100)+'px';var kfa={port:'بندر',gate:'دروازه',whs:'انبار',depot:'دپو',rail:'ریل',hq:'مرکز',tower:'برج کنترل',box:'بازیگر',pad:'نقش'};elNodeTipType.textContent=kfa[best.kind]||'گره';elNodeTipName.textContent=best.fa;elNodeTipId.textContent=best.id.toUpperCase()+' · گرهٔ فعال شبکه';elNodeTip.classList.add('on');}else elNodeTip.classList.remove('on');
}


/* ================= PROFESSIONAL CINEMATIC FX ================= */
var CINEMA=true,REDUCED=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var DEEP_PARTICLES=[];for(var dpi=0;dpi<36;dpi++)DEEP_PARTICLES.push({x:(dpi*137)%997/997,y:(dpi*281)%991/991,z:.25+(dpi%7)/9,p:dpi*.73});
function drawWorldBackdrop(r,tt){
  if(!CINEMA)return;var ac=CHCOL[r.s.ch]||C.info,g=CX.createLinearGradient(0,0,0,H*.72);g.addColorStop(0,hexa(ac,.055));g.addColorStop(.45,'rgba(7,13,24,.015)');g.addColorStop(1,'rgba(5,8,14,0)');CX.fillStyle=g;CX.fillRect(0,0,W,H*.76);
  var hy=H*.28;CX.save();CX.globalAlpha=.22;CX.strokeStyle=hexa(ac,.22);CX.lineWidth=.65;CX.setLineDash([2,10]);CX.lineDashOffset=REDUCED?0:-tt*2;CX.beginPath();CX.moveTo(W*.12,hy);CX.lineTo(W*.88,hy);CX.stroke();CX.setLineDash([]);
  for(var i=0;i<18;i++){var x=W*(.08+i*.049),h=8+(i*17)%42,w=8+(i%4)*5;CX.fillStyle='rgba(35,55,84,'+(.035+(i%3)*.012)+')';CX.fillRect(x,hy-h,w,h);if(i%3===0){CX.fillStyle=hexa(ac,.12);CX.fillRect(x+w*.5,hy-h+5,1,2);}}
  for(i=0;i<DEEP_PARTICLES.length;i++){var q=DEEP_PARTICLES[i],px=q.x*W+mouseDX*10*q.z,py=q.y*H*.7+mouseDY*7*q.z,a=.05+.12*(.5+.5*Math.sin((REDUCED?0:tt)*.24+q.p));CX.fillStyle=hexa(ac,a);CX.beginPath();CX.arc(px,py,.45+q.z,0,6.283);CX.fill();}
  CX.restore();
}
function drawGroundBloom(r,tt){
  if(!CINEMA)return;var ac=CHCOL[r.s.ch]||C.info;CX.save();CX.globalCompositeOperation='screen';
  for(var i=0;i<NODES.length;i++){var n=NODES[i];if(!r.hot[n.id])continue;var p=iso(n.x,n.y,.05),rad=Math.max(18,n.w*cam.zoom*1.15),g=CX.createRadialGradient(p.x,p.y,0,p.x,p.y,rad);g.addColorStop(0,hexa(ac,.12));g.addColorStop(.45,hexa(ac,.035));g.addColorStop(1,hexa(ac,0));CX.fillStyle=g;CX.beginPath();CX.ellipse(p.x,p.y,rad,rad*.28,0,0,6.283);CX.fill();}
  CX.restore();
}
function drawEdgeEnergy(e,tt,col){
  if(!CINEMA||e.kind==='rel')return;var s=edgeScreen(e);if(s.length<2)return;CX.save();CX.globalAlpha=.55;CX.strokeStyle=hexa('#ffffff',.55);CX.lineWidth=.55;CX.setLineDash([2,13]);CX.lineDashOffset=REDUCED?0:-tt*24;CX.beginPath();CX.moveTo(s[0].x,s[0].y);for(var i=1;i<s.length;i++)CX.lineTo(s[i].x,s[i].y);CX.stroke();CX.setLineDash([]);
  var u=REDUCED?.55:(tt*.16)%1,w=edgePosWorld(e,u),p=iso(w.x,w.y,(e.kind==='info'||e.kind==='money')?2.7:.55),g=CX.createRadialGradient(p.x,p.y,0,p.x,p.y,10);g.addColorStop(0,'rgba(255,255,255,.82)');g.addColorStop(.25,hexa(col,.48));g.addColorStop(1,hexa(col,0));CX.fillStyle=g;CX.beginPath();CX.arc(p.x,p.y,10,0,6.283);CX.fill();CX.restore();
}
function drawNodeCinematic(n,hl,tt){
  if(!CINEMA||!hl)return;var ac=C.info,ground=iso(n.x,n.y,.05),top=iso(n.x,n.y,n.h+5),beam=CX.createLinearGradient(0,top.y,0,ground.y);beam.addColorStop(0,hexa(ac,0));beam.addColorStop(.55,hexa(ac,.075));beam.addColorStop(1,hexa(ac,.015));CX.save();CX.globalCompositeOperation='screen';CX.fillStyle=beam;CX.beginPath();CX.moveTo(top.x-5,top.y);CX.lineTo(top.x+5,top.y);CX.lineTo(ground.x+18,ground.y);CX.lineTo(ground.x-18,ground.y);CX.closePath();CX.fill();
  var p=iso(n.x,n.y,n.h+7.2),rr=6.5;CX.globalCompositeOperation='source-over';CX.fillStyle='rgba(5,11,20,.88)';CX.strokeStyle=hexa(ac,.72);CX.lineWidth=1;CX.beginPath();for(var k=0;k<6;k++){var a=-Math.PI/2+k*Math.PI/3,x=p.x+Math.cos(a)*rr,y=p.y+Math.sin(a)*rr;if(k===0)CX.moveTo(x,y);else CX.lineTo(x,y);}CX.closePath();CX.fill();CX.stroke();CX.fillStyle=hexa(ac,.9);CX.beginPath();CX.arc(p.x,p.y,1.7,0,6.283);CX.fill();
  if(cam.zoom>7.4){setFont(6.5,700,false);CX.textAlign='center';CX.fillStyle='rgba(205,228,246,.62)';var kfa={port:'بندر',gate:'گمرک',whs:'انبار',depot:'دپو',rail:'ریل',hq:'مرکز',tower:'برج',box:'بازیگر',pad:'نقش'};CX.fillText(kfa[n.kind]||'گره',p.x,p.y-10);}
  CX.restore();
}
function drawAtmosphericDepth(r,tt){
  if(!CINEMA)return;var ac=CHCOL[r.s.ch]||C.info;CX.save();var fog=CX.createLinearGradient(0,H*.58,0,H);fog.addColorStop(0,'rgba(5,8,14,0)');fog.addColorStop(1,hexa(ac,.035));CX.fillStyle=fog;CX.fillRect(0,H*.58,W,H*.42);
  CX.globalAlpha=.14;for(var i=0;i<10;i++){var x=((i*211+(REDUCED?0:tt*7))%(W+180))-90,y=H*.72+(i%4)*42;CX.strokeStyle=hexa(ac,.16);CX.lineWidth=.7;CX.beginPath();CX.moveTo(x,y);CX.lineTo(x+42,y-12);CX.stroke();}
  CX.restore();
}
function drawMoverUltraDetail(k,x,y,tt,alarm){
  if(!CINEMA)return;var col=alarm?C.risk:C.cargo,p,i,q;CX.save();
  if(k==='truck'){for(i=-1;i<=1;i+=2){q=iso(x-3.3,y+i*.58,1.7);CX.fillStyle=hexa(i<0?C.risk:'#f6d365',.9);CX.shadowColor=CX.fillStyle;CX.shadowBlur=7;CX.beginPath();CX.arc(q.x,q.y,1.15,0,6.283);CX.fill();}}
  else if(k==='train'){p=iso(x-2.7,y,2.3);CX.fillStyle=hexa(C.info,.72);for(i=0;i<3;i++)CX.fillRect(p.x-5+i*4,p.y-2,2.4,1.2);}
  else if(k==='ship'){p=iso(x-5.2,y,1.6);CX.fillStyle=hexa('#f6d365',.85);CX.shadowColor=CX.fillStyle;CX.shadowBlur=8;CX.beginPath();CX.arc(p.x,p.y,1.25,0,6.283);CX.fill();q=iso(x+4.6,y,1.6);CX.fillStyle=hexa(C.risk,.85);CX.beginPath();CX.arc(q.x,q.y,1.25,0,6.283);CX.fill();}
  else if(k==='doc'){p=iso(x,y,3.2);CX.strokeStyle='rgba(255,255,255,.7)';CX.lineWidth=.65;for(i=-1;i<=1;i++) {CX.beginPath();CX.moveTo(p.x-2.5,p.y+i*2);CX.lineTo(p.x+2.5,p.y+i*2);CX.stroke();}}
  else if(k==='coin'){p=iso(x,y,3.2);CX.strokeStyle='rgba(255,255,255,.66)';CX.lineWidth=.7;CX.beginPath();CX.arc(p.x,p.y,2.2,0,6.283);CX.stroke();}
  CX.restore();
}
function drawCinematicFrame(r,tt){
  if(!CINEMA||W<900)return;var ac=CHCOL[r.s.ch]||C.info,m=14,l=24;CX.save();CX.strokeStyle=hexa(ac,.2);CX.lineWidth=1;CX.beginPath();CX.moveTo(m,m+l);CX.lineTo(m,m);CX.lineTo(m+l,m);CX.moveTo(W-m-l,m);CX.lineTo(W-m,m);CX.lineTo(W-m,m+l);CX.moveTo(m,H-m-l);CX.lineTo(m,H-m);CX.lineTo(m+l,H-m);CX.moveTo(W-m-l,H-m);CX.lineTo(W-m,H-m);CX.lineTo(W-m,H-m-l);CX.stroke();CX.restore();
}


/* ===== MOTION DYNAMICS ENGINE 2.0 ===== */
var MD={trail:.62,camera:true,ops:true,shadow:true};
function mdSmoother(x){x=clamp(x,0,1);return x*x*x*(x*(x*6-15)+10)}
function mdProgress(raw,e,k){raw=clamp(raw,0,1);if(REDUCED)return raw;var base=mdSmoother(raw);if(!e||e.pts.length<3||k==='ship'||k==='aircraft'||k==='doc'||k==='coin'||k==='alert')return base;var stops=[.27,.62],hold=.055;for(var i=0;i<stops.length;i++){var d=base-stops[i];if(Math.abs(d)<hold){var z=d/hold;base=stops[i]+Math.sign(z)*hold*mdSmoother(Math.abs(z))*.22;}}return clamp(base,0,1)}
function mdCameraTarget(r,base){if(!MD.camera||REDUCED||!r||!r.s)return base;var ids=r.s.hot.filter(function(id){return ND[id]&&ED[id]==null}),nodes=[];for(var i=0;i<ids.length;i++){if(ND[ids[i]]&&nodes.indexOf(ND[ids[i]])<0)nodes.push(ND[ids[i]])}if(nodes.length<2)return base;var a=nodes[0],b=nodes[nodes.length-1],phase=mdSmoother(clamp((r.loc-.12)/.72,0,1)),focus={cx:lerp(a.x,b.x,phase),cy:lerp(a.y,b.y,phase),zoom:Math.max(base.zoom,Math.min(10.8,7.8+1.2*Math.sin(Math.PI*phase)))};var mix=.23*Math.sin(Math.PI*clamp((r.loc-.05)/.9,0,1));return {cx:lerp(base.cx,focus.cx,mix),cy:lerp(base.cy,focus.cy,mix),zoom:lerp(base.zoom,focus.zoom,mix*.65),rot:base.rot+Math.sin(phase*Math.PI)*.012}}
function mdShadow(x,y,k,velocity){if(!MD.shadow)return;var p=iso(x,y,.05),long=k==='ship'?28:k==='aircraft'?20:k==='train'?18:k==='truck'?14:9,wide=k==='ship'?6:k==='aircraft'?7:4,off=4+velocity*9;CX.save();CX.globalAlpha=.16+.12*clamp(velocity,0,1);CX.filter='blur(3px)';CX.fillStyle='#000';CX.beginPath();CX.ellipse(p.x+off,p.y+off*.42,long*cam.zoom/9,wide*cam.zoom/9,0,0,6.283);CX.fill();CX.restore()}
function mdTrail(e,u,k,alarm){if(MD.trail<=.01||REDUCED||!e)return;var col=alarm?C.risk:(k==='doc'?C.info:k==='coin'?C.money:C.cargo),n=Math.max(3,Math.round(13*MD.trail)),step=.012+.045*MD.trail;CX.save();CX.lineCap='round';for(var j=n;j>0;j--){var q=edgePosWorld(e,Math.max(0,u-j*step/n)),p=iso(q.x,q.y,k==='aircraft'?6:(k==='doc'||k==='coin'?2.8:.35)),alpha=(1-j/(n+1))*.32*MD.trail;CX.globalAlpha=alpha;CX.fillStyle=col;var r=(k==='ship'?2.7:k==='aircraft'?2:1.5)*(1-j/(n+2));CX.beginPath();CX.arc(p.x,p.y,Math.max(.4,r),0,6.283);CX.fill()}CX.restore()}
function mdAircraft(x,y,a,tt){var p=iso(x,y,7.2),q=iso(x+Math.cos(a),y+Math.sin(a),7.2),ang=Math.atan2(q.y-p.y,q.x-p.x);CX.save();CX.translate(p.x,p.y);CX.rotate(ang);CX.shadowColor='rgba(66,215,255,.65)';CX.shadowBlur=12;CX.fillStyle='#dbeafa';CX.strokeStyle='#42d7ff';CX.lineWidth=.8;CX.beginPath();CX.moveTo(15,0);CX.lineTo(2,-2.2);CX.lineTo(-5,-11);CX.lineTo(-8,-10);CX.lineTo(-4,-1.5);CX.lineTo(-14,-1);CX.lineTo(-17,-5);CX.lineTo(-19,-4);CX.lineTo(-17,0);CX.lineTo(-19,4);CX.lineTo(-17,5);CX.lineTo(-14,1);CX.lineTo(-4,1.5);CX.lineTo(-8,10);CX.lineTo(-5,11);CX.lineTo(2,2.2);CX.closePath();CX.fill();CX.stroke();CX.restore()}
function mdTypedFlow(e,tt,hot){if(!hot||e.kind==='rel'||REDUCED)return;var col=KCOL[e.kind],speed=e.kind==='money'?.075:e.kind==='info'?.16:.11,count=e.kind==='money'?3:4;CX.save();for(var i=0;i<count;i++){var u=(tt*speed+i/count)%1,w=edgePosWorld(e,u),p=iso(w.x,w.y,e.kind==='cargo'?.65:2.8),r=e.kind==='money'?4:2.5;CX.globalAlpha=.52;CX.strokeStyle=col;CX.fillStyle=hexa(col,.58);CX.lineWidth=1;if(e.kind==='money'){CX.beginPath();CX.arc(p.x,p.y+Math.sin(tt*3+i)*2,r,0,6.283);CX.stroke();CX.beginPath();CX.arc(p.x,p.y+Math.sin(tt*3+i)*2,1,0,6.283);CX.fill()}else if(e.kind==='info'){CX.save();CX.translate(p.x,p.y);CX.rotate(tt*1.6+i);CX.strokeRect(-r,-r,r*2,r*2);CX.restore()}else{CX.fillRect(p.x-3,p.y-1.2,6,2.4)}}CX.restore()}
function mdGate(n,tt,hot){if(!hot)return;var p=iso(n.x,n.y,n.h+1.8),cycle=(Math.sin(tt*.85)+1)/2,ang=lerp(-.12,-1.05,mdSmoother(cycle));CX.save();CX.translate(p.x,p.y);CX.strokeStyle='#ffb347';CX.lineWidth=2.2;CX.beginPath();CX.moveTo(0,0);CX.lineTo(Math.cos(ang)*24,Math.sin(ang)*24);CX.stroke();CX.fillStyle='#ffb347';CX.beginPath();CX.arc(0,0,2.8,0,6.283);CX.fill();CX.restore()}
function mdQueue(n,tt,hot){if(!hot)return;for(var i=0;i<4;i++){var creep=((tt*.18+i*.21)%1)*1.4,xx=n.x-10+i*3.15+creep,yy=n.y+5.2;var pulse=i===0?Math.max(0,Math.sin(tt*2)):0;mdShadow(xx,yy,'truck',.12);prism(xx,yy,2.2,1.15,1.0,i===0&&pulse>.5?'#ffb347':'#364d69',.85,.35)}}
function mdCrane(n,tt,hot){if(!hot)return;var p=iso(n.x,n.y,n.h+9),phase=(Math.sin(tt*.72)+1)/2,lift=9+phase*18,sway=Math.sin(tt*.46)*12;CX.save();CX.strokeStyle='rgba(66,215,255,.48)';CX.lineWidth=1.25;CX.beginPath();CX.moveTo(p.x-28,p.y+18);CX.lineTo(p.x-28,p.y-18);CX.lineTo(p.x+28,p.y-18);CX.lineTo(p.x+28,p.y+18);CX.moveTo(p.x+sway,p.y-18);CX.lineTo(p.x+sway,p.y+lift);CX.stroke();CX.fillStyle='rgba(255,138,43,.9)';CX.shadowColor='rgba(255,138,43,.65)';CX.shadowBlur=8;CX.fillRect(p.x+sway-8,p.y+lift-3,16,6);CX.restore()}
function mdWarehouse(n,tt,hot){if(!hot)return;for(var i=0;i<5;i++){var x=n.x-5+(i%3)*2.7,y=n.y+5+Math.floor(i/3)*2.1;prism(x,y,1.3,1.1,.65,i%2?C.cargo:'#b68b54',.74,.18)}var fx=n.x-6+((tt*.7)%1)*12;prism(fx,n.y+9,1.6,1.1,1.2,'#ffb347',.82,.25)}
function mdRailCouple(tt,active){if(!active)return;var n=ND.rail,gap=1.1+Math.abs(Math.sin(tt*.7))*2.8;prism(n.x-3-gap,n.y+4,4.8,1.8,1.6,'#ff8a2b',.9,.55);prism(n.x+3+gap,n.y+4,4.8,1.8,1.6,'#375574',.9,.32);var a=iso(n.x-gap*.25,n.y+4,.8),b=iso(n.x+gap*.25,n.y+4,.8);CX.save();CX.strokeStyle='#ffb347';CX.lineWidth=2;CX.beginPath();CX.moveTo(a.x,a.y);CX.lineTo(b.x,b.y);CX.stroke();CX.restore()}
function mdContainerState(r,wp){if(!wp)return;var idx=r.idx,label=idx<8?'EMPTY':idx<9?'STUFFED':idx<13?'GATED-IN':'LOADED',fa={EMPTY:'خالی',STUFFED:'بارگیری‌شده','GATED-IN':'ورود به گیت',LOADED:'بارشده'}[label],p=iso(wp.x,wp.y,5.2);CX.save();setFont(8,800,false);var w=64;CX.fillStyle='rgba(7,15,25,.86)';CX.strokeStyle='rgba(255,179,71,.55)';CX.lineWidth=1;CX.beginPath();CX.roundRect(p.x-w/2,p.y-22,w,18,8);CX.fill();CX.stroke();label&&(CX.fillStyle='#ffca82');CX.textAlign='center';CX.fillText(label,p.x,p.y-10);CX.restore()}
function mdMultimodal(r,tt){if(r.idx<26||r.idx>28)return;var items=[['CFS',ND.cfs,C.cargo],['AIR',ND.airO,C.info],['RAIL',ND.rail,'#b892ff']],active=r.idx-26;CX.save();for(var i=0;i<items.length;i++){var p=iso(items[i][1].x,items[i][1].y,items[i][1].h+7),on=i===active;CX.globalAlpha=on?1:.28;CX.strokeStyle=items[i][2];CX.fillStyle='rgba(7,15,25,.82)';CX.lineWidth=on?2:1;CX.beginPath();CX.arc(p.x,p.y,15+(on?Math.sin(tt*3)*2:0),0,6.283);CX.fill();CX.stroke();setFont(7,800,false);CX.fillStyle=items[i][2];CX.textAlign='center';CX.fillText(items[i][0],p.x,p.y+2)}CX.restore()}
function mdOperationalLayer(r,tt){if(!MD.ops)return;mdGate(ND.expcus,tt,!!r.hot.expcus);mdGate(ND.impcus,tt+.8,!!r.hot.impcus);mdQueue(ND.oport,tt,!!r.hot.oport);mdQueue(ND.expcus,tt+.5,!!r.hot.expcus);mdQueue(ND.impcus,tt+1,!!r.hot.impcus);mdCrane(ND.oport,tt,!!r.hot.oport);mdCrane(ND.hub,tt+.8,!!r.hot.hub);mdCrane(ND.dport,tt+1.4,!!r.hot.dport);mdWarehouse(ND.whs,tt,!!r.hot.whs);mdWarehouse(ND.cfs,tt+.7,!!r.hot.cfs);mdRailCouple(tt,!!r.hot.rail&&r.idx===28);mdMultimodal(r,tt)}
function mdDrawMover(k,e,wp,u,tt,alarm,velocity,r){var kind=e&&e.id==='c_air'?'aircraft':k;mdTrail(e,u,kind,alarm);mdShadow(wp.x,wp.y,kind,velocity);if(kind==='aircraft')mdAircraft(wp.x,wp.y,wp.a,tt);else{mover(kind,wp.x,wp.y,tt,alarm);drawMoverDetail(kind,wp.x,wp.y,tt,alarm);drawMoverUltraDetail(kind,wp.x,wp.y,tt,alarm)}if(kind==='container'||kind==='truck'||kind==='ship')mdContainerState(r,wp)}

/* ================= STATE / SCENE RESOLUTION ================= */
var t=0,playing=true,last=0,speed=1;
function sceneAt(tt){
  var i;
  for(i=SCENES.length-1;i>=0;i--)if(tt>=SCENES[i].t0)return i;
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
  var hotSet={};for(i=0;i<s.hot.length;i++)hotSet[s.hot[i]]=1;
  /* progressive appearance: once a scene introduces a node/edge it stays visible */
  var seen={};
  for(i=0;i<=idx;i++){h=SCENES[i].hot;for(j=0;j<h.length;j++)seen[h[j]]=1;}
  for(i=0;i<NODES.length;i++){
    n=NODES[i];
    want=hotSet[n.id]?1:(seen[n.id]?0.62:0.14);
    n.app+=(want-n.app)*0.10;
  }
  for(i=0;i<EDGES.length;i++){
    e=EDGES[i];
    want=hotSet[e.id]?1:(seen[e.id]?0.5:0.0);
    e.app+=(want-e.app)*0.10;
  }
  return {idx:idx,s:s,hot:hotSet,loc:clamp((tt-s.t0)/s.d,0,1)};
}
/* ================= HUD (DOM) ================= */
var elTitle=document.getElementById('sTitle'),elSub=document.getElementById('sSub'),
    elChip=document.getElementById('chips'),elCard=document.getElementById('cardTx'),
    elTier=document.getElementById('cardTier'),elSrc=document.getElementById('cardSrc'),
    elBar=document.getElementById('bar'),elClock=document.getElementById('clock'),
    elIdx=document.getElementById('sIdx'),elOpen=document.getElementById('openLay'),
    elEnd=document.getElementById('endLay'),elMetricValue=document.getElementById('metricValue'),elMetricLabel=document.getElementById('metricLabel'),elMetricMeta=document.getElementById('metricMeta'),elMetricFill=document.getElementById('metricFill'),elLensRole=document.getElementById('lensRole'),elLensOutput=document.getElementById('lensOutput'),elLensControl=document.getElementById('lensControl'),elLensFail=document.getElementById('lensFail'),elMissionEta=document.getElementById('missionEta'),elMissionRoute=document.getElementById('missionRoute'),elPlay=document.getElementById('playBtn'),elFlash=document.getElementById('sceneFlash'),elFlashNo=document.getElementById('flashNo'),elFlashTitle=document.getElementById('flashTitle'),elFlashChapter=document.getElementById('flashChapter'),elDrawer=document.getElementById('dataDrawer'),elDrawerTitle=document.getElementById('drawerTitle'),elDrawerRows=document.getElementById('drawerRows'),elTr0=document.getElementById('tr0'),elTr1=document.getElementById('tr1'),elTr2=document.getElementById('tr2'),elViz=document.getElementById('miniViz'),elVizTitle=document.getElementById('vizTitle'),elVizRows=document.getElementById('vizRows'),elChapterName=document.getElementById('chapterName'),elChapterCount=document.getElementById('chapterCount'),elExec=document.getElementById('execOverlay'),elGauge=document.getElementById('gArc'),elGaugeText=document.getElementById('gText'),elLetter=document.getElementById('letterbox'),elNodeTip=document.getElementById('nodeTip'),elNodeTipType=document.getElementById('nodeTipType'),elNodeTipName=document.getElementById('nodeTipName'),elNodeTipId=document.getElementById('nodeTipId'),elProcess=document.getElementById('processOverlay'),elProcClose=document.getElementById('procClose');
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

function faNum(n){return String(n).replace(/\d/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'[+d];});}
function triggerSceneTransition(r){
  scenePulse=1;if(elLetter){elLetter.classList.remove('kick');void elLetter.offsetWidth;elLetter.classList.add('kick');}
  if(elFlash){elFlashNo.textContent=(r.idx+1<10?'0':'')+(r.idx+1);elFlashTitle.textContent=r.s.ti;elFlashChapter.textContent=r.s.ch;elFlash.classList.remove('go');void elFlash.offsetWidth;elFlash.classList.add('go');}
  ['head','card','metric'].forEach(function(id){var x=document.getElementById(id);if(x){x.classList.remove('scene-kick');void x.offsetWidth;x.classList.add('scene-kick');}});
}
function updateDeepData(r,ln,mx,tr){
 if(elDrawerTitle)elDrawerTitle.textContent=faNum(r.idx+1)+' — '+r.s.ti.replace(/^.*?—\s*/, '');
 if(elDrawerRows)elDrawerRows.innerHTML='<div><span>CHAPTER</span><b>'+r.s.ch+'</b></div><div><span>OWNER / WHO</span><b>'+ln.r+'</b></div><div><span>خروجی</span><b>'+ln.o+'</b></div><div><span>کنترل</span><b>'+ln.c+'</b></div><div><span>FAILURE MODE</span><b>'+ln.f+'</b></div><div><span>METRIC</span><b>'+mx[0]+' · '+mx[1]+'</b></div><div><span>EVIDENCE</span><b>'+r.s.card.sr+'</b></div><div><span>TRACE IDs</span><b>'+tr.join(' · ')+'</b></div>';
}
function buildTicks(){var box=document.getElementById('ticks');if(!box)return;var h='',last='';for(var i=0;i<SCENES.length;i++){var major=SCENES[i].ch!==last;last=SCENES[i].ch;h+='<i class="tick'+(major?' major':'')+'" data-i="'+i+'" style="left:'+(SCENES[i].t0/END*100).toFixed(3)+'%"></i>';}box.innerHTML=h;}

function updHUD(r){
  if(r.idx!==lastIdx){
    lastIdx=r.idx;triggerSceneTransition(r);
    if(elTitle)elTitle.textContent=r.s.ti;
    if(elSub)elSub.textContent=r.s.sb;
    if(elIdx)elIdx.textContent=(r.idx+1)+' / '+SCENES.length;
    if(elCard)elCard.textContent=r.s.card.tx;
    if(elTier){
      elTier.textContent=TIERFA[r.s.card.tr];
      elTier.style.color=TIERCOL[r.s.card.tr];
      elTier.style.borderColor=TIERCOL[r.s.card.tr];
      elTier.style.background=hexa(TIERCOL[r.s.card.tr],0.10);
    }
    if(elSrc)elSrc.textContent='\u0645\u0646\u0628\u0639: '+r.s.card.sr;
    var mx=SCENE_METRICS[r.idx],ln=SCENE_LENS[r.idx];if(mx){if(elMetricValue)elMetricValue.textContent=mx[0];if(elMetricLabel)elMetricLabel.textContent=mx[1];if(elMetricMeta)elMetricMeta.textContent=mx[2];if(elMetricFill)elMetricFill.style.width=mx[3]+'%';if(elGauge){elGauge.style.strokeDashoffset=(106.82*(1-mx[3]/100)).toFixed(2);if(elGaugeText)elGaugeText.textContent=mx[3];}}if(ln){if(elLensRole)elLensRole.textContent=ln.r;if(elLensOutput)elLensOutput.textContent=ln.o;if(elLensControl)elLensControl.textContent=ln.c;if(elLensFail)elLensFail.textContent=ln.f;}var tr=SCENE_TRACE[r.idx]||[];if(elTr0)elTr0.textContent=tr[0]||'—';if(elTr1)elTr1.textContent=tr[1]||'—';if(elTr2)elTr2.textContent=tr[2]||'—';updateDeepData(r,ln,mx,tr);var vz=SCENE_VIZ[r.idx];if(elViz){elViz.classList.toggle('on',!!vz);if(vz){elVizTitle.textContent=vz.title;var vh='';for(var vi=0;vi<vz.items.length;vi++){var it=vz.items[vi];vh+='<div class="vizRow"><label>'+it[0]+'</label><div class="vizTrack"><i class="vizFill" style="width:'+it[1]+'%"></i></div><em>'+it[2]+'</em></div>';}elVizRows.innerHTML=vh;}}var ac=CHCOL[r.s.ch]||'#42d7ff';document.documentElement.style.setProperty('--sceneAccent',ac);var cStart=r.idx,cEnd=r.idx;while(cStart>0&&SCENES[cStart-1].ch===r.s.ch)cStart--;while(cEnd<SCENES.length-1&&SCENES[cEnd+1].ch===r.s.ch)cEnd++;var cp=(r.idx-cStart+1)/(cEnd-cStart+1)*100;document.documentElement.style.setProperty('--chapterPct',cp+'%');if(elChapterName)elChapterName.textContent=r.s.ch;if(elChapterCount)elChapterCount.textContent=(r.idx-cStart+1)+' / '+(cEnd-cStart+1);if(elMissionEta)elMissionEta.textContent=r.s.risk?'استثنا':(r.idx>38?'اعتبارسنجی':(r.idx>23?'کنترل‌شده':'طبق برنامه'));if(elMissionRoute)elMissionRoute.textContent=r.idx===27?'هوایی · دما':(r.idx===28?'ریلی · TITR':(r.idx>23?'مدل عملیاتی':'شانگهای › سنگاپور › روتردام'));
    if(elChip){
      var cs=elChip.children,i;
      for(i=0;i<cs.length;i++)cs[i].className='chip'+(cs[i].getAttribute('data-ch')===r.s.ch?' on':'');
    }
  }
  if(elBar)elBar.style.width=(t/END*100).toFixed(2)+'%';var tk=document.querySelectorAll('#ticks .tick');for(var ti=0;ti<tk.length;ti++)tk[ti].classList.toggle('active',ti===r.idx);
  if(elClock)elClock.textContent=fmt(t)+' / '+fmt(END);if(elPlay)elPlay.textContent=playing?'Ⅱ':'▶';
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
  CX.fillStyle=C.bg;CX.fillRect(0,0,W,H);drawAmbient(t);drawWorldBackdrop(r,t);drawScanSweep(t);
  var gg=CX.createRadialGradient(W*0.5,H*0.52,10,W*0.5,H*0.52,Math.max(W,H)*0.75);
  gg.addColorStop(0,'rgba(24,42,78,0.34)');gg.addColorStop(1,'rgba(5,8,14,0)');
  CX.fillStyle=gg;CX.fillRect(0,0,W,H);
  drawGrid();drawOceanField(t);drawZoneLabels();drawGroundBloom(r,t);
  var alarm=!!r.s.risk&&(r.loc>0.28);
  var i,n,m,e,u,wp;
  for(i=0;i<EDGES.length;i++){
    drawEdge(EDGES[i],!!r.hot[EDGES[i].id],t,alarm&&EDGES[i].kind==='info'&&!!r.hot[EDGES[i].id]);
    mdTypedFlow(EDGES[i],t,!!r.hot[EDGES[i].id]);
  }
  var order=NODES.slice().sort(function(a,b){return iso(a.x,a.y,0).d-iso(b.x,b.y,0).d;});
  for(i=0;i<order.length;i++){
    n=order[i];
    drawNode(n,!!r.hot[n.id],t,alarm&&(n.id==='impcus'));drawNodeDetail(n,!!r.hot[n.id],t);drawNodeCinematic(n,!!r.hot[n.id],t);if(r.hot[n.id])drawFocusBracket(n);
  }
  mdOperationalLayer(r,t);
  if(r.s.mov){
    for(i=0;i<r.s.mov.length;i++){
      m=r.s.mov[i];e=ED[m.e];
      if(!e)continue;
      var raw=clamp((r.loc-0.08)/0.84,0,1),kind=(e.id==='c_air'?'aircraft':m.k);
      var shaped=mdProgress(raw,e,kind),prev=mdProgress(Math.max(0,raw-.012),e,kind);
      u=lerp(m.a,m.b,shaped);wp=edgePosWorld(e,u);
      mdDrawMover(m.k,e,wp,u,t,alarm&&m.k==='alert',Math.abs(shaped-prev)/.012,r);
    }
  }
  drawActiveOrbits(r,t);drawContextFX(r,t);drawTelemetry(r);drawAtmosphericDepth(r,t);drawPostFX(r,t);drawCinematicFrame(r,t);updHUD(r);
  requestAnimationFrame(frame);
}
/* ================= CONTROLS ================= */

function syncFlowLegend(){var rows=document.querySelectorAll('#leg .row');for(var i=0;i<rows.length;i++){var k=rows[i].getAttribute('data-flow');rows[i].classList.toggle('off',FLOW_ON[k]===false);}}
function toggleFlow(k){FLOW_ON[k]=!FLOW_ON[k];syncFlowLegend();}
function bindFlowLegend(){var rows=document.querySelectorAll('#leg .row');for(var i=0;i<rows.length;i++)rows[i].addEventListener('click',function(){toggleFlow(this.getAttribute('data-flow'));});syncFlowLegend();}

function jump(i){i=clamp(i,0,SCENES.length-1);t=SCENES[i].t0+0.01;lastIdx=-1;}
function onKey(ev){
  var k=ev.key,ov;
  if(k==='1')toggleFlow('cargo');else if(k==='2')toggleFlow('info');else if(k==='3')toggleFlow('money');else if(k==='4')toggleFlow('rel');
  else if(k===' '){playing=!playing;if(ev.preventDefault)ev.preventDefault();}
  else if(k==='ArrowRight')t=Math.min(END,t+5);
  else if(k==='ArrowLeft')t=Math.max(0,t-5);
  else if(k==='ArrowUp')jump(sceneAt(t)+1);
  else if(k==='ArrowDown')jump(sceneAt(t)-1);
  else if(k==='r'||k==='R'){t=0;lastIdx=-1;}
  else if(k==='+'||k==='=')speed=clamp(speed+0.25,0.25,3);
  else if(k==='-'||k==='_')speed=clamp(speed-0.25,0.25,3);
  else if(k==='e'||k==='E'){if(elExec){elExec.classList.toggle('on');elExec.setAttribute('aria-hidden',elExec.classList.contains('on')?'false':'true');}}
  else if(k==='c'||k==='C'){CINEMA=!CINEMA;document.body.classList.toggle('cinema-off',!CINEMA);}
  else if(k==='p'||k==='P'){if(elProcess){elProcess.classList.toggle('on');elProcess.setAttribute('aria-hidden',elProcess.classList.contains('on')?'false':'true');}}
  else if(k==='d'||k==='D'){if(elDrawer){elDrawer.classList.toggle('on');elDrawer.setAttribute('aria-hidden',elDrawer.classList.contains('on')?'false':'true');}}
  else if(k==='h'||k==='H'){
    ov=document.getElementById('hud');
    if(ov)ov.style.display=(ov.style.display==='none')?'':'none';
  }
}
if(window.addEventListener){
  window.addEventListener('resize',resize);window.addEventListener('pointermove',function(ev){if(window.innerWidth<820)return;mouseDX=(ev.clientX/window.innerWidth-.5)*1.6;mouseDY=(ev.clientY/window.innerHeight-.5)*1.1;updateNodeHover(ev);},{passive:true});window.addEventListener('pointerleave',function(){mouseDX=mouseDY=0;if(elNodeTip)elNodeTip.classList.remove('on');});
  window.addEventListener('keydown',onKey);
}
buildChips();buildTicks();bindFlowLegend();if(elProcClose)elProcClose.addEventListener('click',function(){elProcess.classList.remove('on');elProcess.setAttribute('aria-hidden','true');});var procBtns=document.querySelectorAll('#processOverlay [data-jump]');for(var pi=0;pi<procBtns.length;pi++)procBtns[pi].addEventListener('click',function(){jump(parseInt(this.getAttribute('data-jump'),10)-1);if(elProcess){elProcess.classList.remove('on');elProcess.setAttribute('aria-hidden','true');}});resize();if(elPlay&&elPlay.addEventListener)elPlay.addEventListener('click',function(){playing=!playing;});
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

/* ===== PHASE 1 · INTERACTIVE PRESENTATION CONTROLLER ===== */
(function(){
 var state={panel:null,mode:'cinematic',layer:'summary',narr:'short',ribbon:false,last:-1,termBound:false};
 var $=function(id){return document.getElementById(id)}, panels=[...document.querySelectorAll('.p1Panel')], dock=$('p1Dock'), live=$('p1Live');
 var glossary={
  'FCL':'بار یک صاحب کالا که یک کانتینر کامل را در اختیار می‌گیرد.','LCL':'چند محمولهٔ کوچک که در یک کانتینر تجمیع می‌شوند.','VGM':'وزن ناخالص تأییدشدهٔ کانتینر که پیش از بارگیری باید ثبت شود.','HS':'سامانهٔ هماهنگ‌شدهٔ طبقه‌بندی بین‌المللی کالا.','Incoterms':'قواعد اتاق بازرگانی بین‌المللی برای تقسیم هزینه، ریسک و تعهدات فروشنده و خریدار.','POD':'رسید تحویل؛ مدرک تأیید تحویل محموله به گیرنده.','ETA':'زمان تخمینی ورود محموله یا وسیلهٔ حمل.','DSO':'میانگین روزهای وصول مطالبات از مشتری.','DPO':'میانگین روزهای پرداخت بدهی به تأمین‌کنندگان.','NVOCC':'متصدی حمل بدون مالکیت کشتی که در برابر مشتری نقش حمل‌کنندهٔ قراردادی دارد.','UCP 600':'مجموعه قواعد بین‌المللی اعتبارات اسنادی.','TIR':'سامانهٔ ترانزیت گمرکی بین‌المللی تحت تضمین.','NCTS':'سامانهٔ رایانه‌ای ترانزیت مشترک در اروپا.','EIR':'رسید تبادل تجهیز که تحویل یا بازگشت کانتینر را ثبت می‌کند.','SLA':'توافق سطح خدمت و شاخص‌های تعهدشده میان طرفین.','RACI':'ماتریس مسئول، پاسخ‌گو، مشاور و مطلع برای فعالیت‌ها.','KPI':'شاخص کلیدی عملکرد برای سنجش نتیجه یا کیفیت اجرا.','BAF':'ضریب تعدیل هزینهٔ سوخت در نرخ حمل دریایی.','CAF':'ضریب تعدیل نوسان ارز در نرخ حمل.','PSS':'هزینهٔ اضافی فصل اوج تقاضا.','CAPA':'اقدام اصلاحی و پیشگیرانه برای حذف علت ریشه‌ای مشکل.'
 };
 function esc(x){return String(x==null?'':x).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
 function sceneColor(ch){return (window.CHCOL&&CHCOL[ch])||'#42d7ff'}
 function announce(x){if(live)live.textContent=x}
 function closePanels(returnFocus){panels.forEach(function(p){p.classList.remove('on');p.setAttribute('aria-hidden','true')});document.body.classList.remove('p1-panel-open');document.querySelectorAll('.p1Tool[data-panel]').forEach(function(b){b.setAttribute('aria-expanded','false')});var old=state.panel;state.panel=null;if(returnFocus&&old){var b=document.querySelector('.p1Tool[data-panel="'+old.id+'"]');if(b)b.focus()}}
 function openPanel(id){var p=$(id);if(!p)return;if(state.panel===p){closePanels(true);return}closePanels(false);state.panel=p;p.classList.add('on');p.setAttribute('aria-hidden','false');document.body.classList.add('p1-panel-open');var b=document.querySelector('.p1Tool[data-panel="'+id+'"]');if(b)b.setAttribute('aria-expanded','true');setTimeout(function(){var f=id==='p1SearchPanel'?$('p1SearchInput'):p.querySelector('input,button');if(f)f.focus()},60);if(id==='p1LayerPanel')renderLayers();if(id==='p1NarrPanel')renderNarr();announce(p.querySelector('h2').textContent)}
 document.querySelectorAll('.p1Tool[data-panel]').forEach(function(b){b.addEventListener('click',function(){openPanel(b.dataset.panel)})});document.querySelectorAll('.p1Close').forEach(function(b){b.addEventListener('click',function(){closePanels(true)})});
 function buildNavigation(){var mm=$('p1MiniMap'),cc=$('p1Chapters'),chs=[],map={};SCENES.forEach(function(s,i){if(!map[s.ch]){map[s.ch]={first:i,count:0};chs.push(s.ch)}map[s.ch].count++;var d=document.createElement('button');d.className='p1MiniDot';d.type='button';d.setAttribute('role','listitem');d.setAttribute('aria-label','صحنه '+faNum(i+1)+'، '+s.ti);d.title=s.ti;d.dataset.i=i;d.style.setProperty('--dot',sceneColor(s.ch));d.addEventListener('click',function(){jump(i);closePanels(false)});mm.appendChild(d)});chs.forEach(function(ch){var b=document.createElement('button');b.className='p1Chapter';b.type='button';b.dataset.ch=ch;b.innerHTML='<span>'+esc(ch)+'</span><b>'+faNum(map[ch].count)+' صحنه</b>';b.addEventListener('click',function(){jump(map[ch].first);closePanels(false)});cc.appendChild(b)})}
 function updateNavigation(i){document.querySelectorAll('.p1MiniDot').forEach(function(d,n){d.classList.toggle('on',n===i);d.classList.toggle('seen',n<=i)});document.querySelectorAll('.p1Chapter').forEach(function(b){b.classList.toggle('on',b.dataset.ch===SCENES[i].ch)})}
 function searchable(i){var s=SCENES[i],l=SCENE_LENS[i]||{},m=SCENE_METRICS[i]||[],tr=SCENE_TRACE[i]||[];return [s.ch,s.ti,s.sb,s.card.tx,s.card.sr,l.r,l.o,l.c,l.f,m.join(' '),tr.join(' ')].join(' ').toLowerCase()}
 function runSearch(q){var box=$('p1SearchResults'),meta=$('p1SearchMeta');q=(q||'').trim().toLowerCase();box.innerHTML='';if(!q){meta.textContent='همهٔ ۷۵ صحنه جست‌وجو می‌شوند.';return}var found=[];SCENES.forEach(function(s,i){if(searchable(i).indexOf(q)>-1)found.push(i)});meta.textContent=faNum(found.length)+' نتیجه برای «'+q+'»';if(!found.length){box.innerHTML='<div class="p1Empty">نتیجه‌ای یافت نشد؛ اصطلاح یا کد دیگری را امتحان کنید.</div>';return}found.slice(0,30).forEach(function(i){var s=SCENES[i],b=document.createElement('button');b.type='button';b.className='p1Result';b.innerHTML='<small>'+esc(s.ch)+' · صحنه '+faNum(i+1)+'</small><b>'+esc(s.ti)+'</b><span>'+esc(s.sb)+'</span>';b.addEventListener('click',function(){jump(i);closePanels(false)});box.appendChild(b)})}
 $('p1SearchInput').addEventListener('input',function(){runSearch(this.value)});
 function setMode(mode){state.mode=mode;document.body.classList.toggle('mode-explore',mode==='explore');document.querySelectorAll('.p1ModeBtn').forEach(function(b){b.classList.toggle('on',b.dataset.mode===mode);b.setAttribute('aria-pressed',b.dataset.mode===mode?'true':'false')});if(mode==='explore')playing=false;announce(mode==='explore'?'حالت کاوش تعاملی فعال شد':'حالت سینمایی فعال شد')}
 document.querySelectorAll('.p1ModeBtn').forEach(function(b){b.addEventListener('click',function(){setMode(b.dataset.mode)})});
 function layerHTML(i,layer){var s=SCENES[i],l=SCENE_LENS[i]||{},m=SCENE_METRICS[i]||[],tr=SCENE_TRACE[i]||[];if(layer==='summary')return '<div class="p1DataCard"><span>پیام صحنه</span><b>'+esc(s.sb)+'</b></div><div class="p1DataCard"><span>شرح</span><p>'+esc(s.card.tx)+'</p></div><div class="p1DataCard"><span>شاخص برجسته</span><b>'+esc(m[0]||'—')+' · '+esc(m[1]||'—')+'</b></div>';if(layer==='operation')return '<div class="p1DataCard"><span>مسئول</span><b>'+esc(l.r||'—')+'</b></div><div class="p1DataCard"><span>خروجی</span><b>'+esc(l.o||'—')+'</b></div><div class="p1DataCard"><span>زمینهٔ عملیاتی</span><p>'+esc(m[2]||s.ch)+'</p></div>';if(layer==='control')return '<div class="p1DataCard"><span>کنترل کلیدی</span><b>'+esc(l.c||'—')+'</b></div><div class="p1DataCard"><span>شاخص و آستانه</span><p>'+esc(m[0]||'—')+' · '+esc(m[1]||'—')+'</p></div><div class="p1DataCard"><span>شناسه‌های ردیابی</span><div class="p1Trace">'+tr.map(function(x){return '<i>'+esc(x)+'</i>'}).join('')+'</div></div>';if(layer==='risk')return '<div class="p1DataCard p1Risk"><span>اگر فرایند شکست بخورد</span><b>'+esc(l.f||'—')+'</b></div><div class="p1DataCard"><span>وضعیت شواهد</span><p>'+esc(TIERFA[s.card.tr]||s.card.tr)+'</p></div><div class="p1DataCard"><span>اقدام ارائه‌ای</span><p>مالک، کنترل و مسیر تشدید این صحنه را پیش از حرکت به مرحلهٔ بعد تأیید کنید.</p></div>';return '<div class="p1DataCard p1Source"><span>منبع و ردیابی</span><b>'+esc(s.card.sr)+'</b></div><div class="p1DataCard"><span>سطح شواهد</span><p>'+esc(TIERFA[s.card.tr]||s.card.tr)+'</p></div><div class="p1DataCard"><span>شناسه‌ها</span><div class="p1Trace">'+tr.map(function(x){return '<i>'+esc(x)+'</i>'}).join('')+'</div></div>'}
 function renderLayers(){var i=sceneAt(t);$('p1LayerTitle').textContent=faNum(i+1)+' — '+SCENES[i].ti.replace(/^.*?—\s*/,'');$('p1LayerContent').innerHTML=layerHTML(i,state.layer)}
 document.querySelectorAll('#p1LayerTabs .p1Tab').forEach(function(b){b.addEventListener('click',function(){state.layer=b.dataset.layer;document.querySelectorAll('#p1LayerTabs .p1Tab').forEach(function(x){x.classList.toggle('on',x===b)});renderLayers()})});
 function narrText(i,kind){var s=SCENES[i],l=SCENE_LENS[i]||{},m=SCENE_METRICS[i]||[];if(kind==='short')return s.ti+'. '+s.sb+'. شاخص برجسته: '+(m[0]||'—')+'، '+(m[1]||'—')+'.';return s.ti+'. '+s.sb+'. '+s.card.tx+' مسئول اصلی: '+(l.r||'—')+'. خروجی مورد انتظار: '+(l.o||'—')+'. کنترل کلیدی: '+(l.c||'—')+'. در صورت شکست: '+(l.f||'—')+'. منبع: '+s.card.sr+'.'}
 function renderNarr(){var tx=narrText(sceneAt(t),state.narr);$('p1NarrText').textContent=tx;if(state.ribbon)$('p1NarrRibbon').textContent=tx}
 document.querySelectorAll('#p1NarrTabs .p1Tab').forEach(function(b){b.addEventListener('click',function(){state.narr=b.dataset.narr;document.querySelectorAll('#p1NarrTabs .p1Tab').forEach(function(x){x.classList.toggle('on',x===b)});renderNarr()})});
 $('p1NarrShow').addEventListener('click',function(){state.ribbon=!state.ribbon;document.body.classList.toggle('narration-on',state.ribbon);this.textContent=state.ribbon?'پنهان‌کردن از صحنه':'نمایش روی صحنه';renderNarr()});
 $('p1Speak').addEventListener('click',function(){if(!('speechSynthesis'in window)){announce('خواندن صوتی در این مرورگر پشتیبانی نمی‌شود');return}speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(narrText(sceneAt(t),state.narr));u.lang='fa-IR';u.rate=.92;speechSynthesis.speak(u)});$('p1NarrStop').addEventListener('click',function(){if('speechSynthesis'in window)speechSynthesis.cancel();state.ribbon=false;document.body.classList.remove('narration-on')});
 function markTerms(el){if(!el)return;var txt=el.textContent||'',keys=Object.keys(glossary).sort(function(a,b){return b.length-a.length}),hit=false,html=esc(txt);keys.forEach(function(k){var re=new RegExp('(^|[^A-Za-z0-9])('+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?=$|[^A-Za-z0-9])','g');html=html.replace(re,function(_,p,w){hit=true;return p+'<span class="term" tabindex="0" data-term="'+esc(k)+'">'+w+'</span>'})});if(hit)el.innerHTML=html}
 function bindTermEvents(){document.addEventListener('pointerover',function(e){var x=e.target.closest&&e.target.closest('.term');if(x)showTerm(x)});document.addEventListener('pointerout',function(e){if(e.target.closest&&e.target.closest('.term'))hideTerm()});document.addEventListener('focusin',function(e){if(e.target.classList&&e.target.classList.contains('term'))showTerm(e.target)});document.addEventListener('focusout',function(e){if(e.target.classList&&e.target.classList.contains('term'))hideTerm()})}
 function showTerm(x){var tip=$('p1TermTip'),r=x.getBoundingClientRect();$('p1TermName').textContent=x.dataset.term;$('p1TermDef').textContent=glossary[x.dataset.term]||'';tip.style.left=Math.max(12,Math.min(innerWidth-292,r.left))+'px';tip.style.top=Math.min(innerHeight-120,r.bottom+8)+'px';tip.classList.add('on')}
 function hideTerm(){$('p1TermTip').classList.remove('on')}
 function refreshTerms(){markTerms(elSub);markTerms(elCard);markTerms(elMetricLabel)}
 CV.setAttribute('tabindex','0');CV.setAttribute('role','img');CV.setAttribute('aria-label','نقشهٔ ایزومتریک تعاملی اکوسیستم فورواردینگ؛ در حالت کاوش برای رفتن به صحنهٔ مرتبط روی یک گره کلیک کنید.');CV.addEventListener('click',function(ev){if(state.mode!=='explore')return;var best=null,bd=34;NODES.forEach(function(n){var p=iso(n.x,n.y,n.h*.55),d=Math.hypot(ev.clientX-p.x,ev.clientY-p.y);if(d<bd){bd=d;best=n}});if(best){for(var i=0;i<SCENES.length;i++)if(SCENES[i].hot.indexOf(best.id)>-1){jump(i);announce('پرش به '+best.fa);break}}});
 var oldTrigger=triggerSceneTransition;triggerSceneTransition=function(r){oldTrigger(r);var tr=$('p1Transition');if(!REDUCED&&state.mode==='cinematic'){tr.classList.remove('go');void tr.offsetWidth;tr.classList.add('go')}};
 var oldHUD=updHUD;updHUD=function(r){oldHUD(r);if(r.idx!==state.last){state.last=r.idx;updateNavigation(r.idx);if(state.panel&&state.panel.id==='p1LayerPanel')renderLayers();if(state.panel&&state.panel.id==='p1NarrPanel'||state.ribbon)renderNarr();setTimeout(refreshTerms,0);announce('صحنه '+faNum(r.idx+1)+' از '+faNum(SCENES.length)+'، '+r.s.ti)}};
 window.addEventListener('keydown',function(e){var tag=(e.target.tagName||'').toLowerCase(),typing=tag==='input'||tag==='textarea';if(e.key==='Escape'){closePanels(true);hideTerm();return}if(typing)return;if(e.key==='/'){e.preventDefault();openPanel('p1SearchPanel');setTimeout(function(){$('p1SearchInput').focus()},80)}else if(e.key==='v'||e.key==='V')setMode(state.mode==='cinematic'?'explore':'cinematic');else if(e.key==='n'||e.key==='N')openPanel('p1NarrPanel');else if(e.key==='l'||e.key==='L')openPanel('p1LayerPanel');else if(e.key==='m'||e.key==='M')openPanel('p1NavPanel')});
 $('p1SearchPanel').addEventListener('transitionend',function(){if(this.classList.contains('on'))$('p1SearchInput').focus({preventScroll:true})});$('p1SearchBtn').addEventListener('click',function(){setTimeout(function(){if($('p1SearchPanel').classList.contains('on'))$('p1SearchInput').focus({preventScroll:true})},450)});buildNavigation();bindTermEvents();setMode('cinematic');updateNavigation(sceneAt(t));renderNarr();
})();


/* ===== PHASE 2 · OPERATIONAL DEPTH CONTROLLER ===== */
(function(){
 var $2=function(id){return document.getElementById(id)},ws=$2('p2Workspace'),stage=$2('p2Stage'),view='actors',actorSel='fwd',docCat='همه',kpiChapter='همه',p2LastScene=-1;
 var DOCS=[
 ['DOC-001','درخواست نرخ و پروفایل محموله','تجاری','مشتری','فروش / قیمت‌گذاری',1],['DOC-002','پیشنهاد نرخ','تجاری','فورواردر','مشتری',6],['DOC-003','تأیید رزرو','عملیاتی','حمل‌کننده','فورواردر',7],['DOC-004','دستور تحویل تجهیز','عملیاتی','حمل‌کننده / دپو','راننده',8],['DOC-005','رسید تبادل تجهیز EIR','عملیاتی','دپو / ترمینال','فورواردر',8],['DOC-006','گواهی VGM','عملیاتی','صاحب کالا','حمل‌کننده',9],['DOC-007','فاکتور تجاری','تجاری','فروشنده','خریدار / گمرک',10],['DOC-008','فهرست بسته‌بندی','تجاری','صاحب کالا','گمرک / فورواردر',10],['DOC-009','دستور حمل SI','حمل','صاحب کالا','فورواردر / کریر',10],['DOC-010','بارنامهٔ اصلی MBL','حمل','حمل‌کننده','فورواردر / گیرنده',10],['DOC-011','بارنامهٔ داخلی HBL','حمل','فورواردر','فرستنده / گیرنده',26],['DOC-012','راه‌نامهٔ هوایی AWB','حمل','کریر هوایی','فرستنده / گیرنده',27],['DOC-013','گواهی مبدأ CoO','گمرکی','مرجع مجاز','گمرک مقصد',10],['DOC-014','اظهارنامهٔ صادراتی','گمرکی','صادرکننده / کارگزار','گمرک مبدأ',11],['DOC-015','اظهارنامهٔ وارداتی','گمرکی','واردکننده / کارگزار','گمرک مقصد',16],['DOC-016','اعلامیهٔ ورود','عملیاتی','نماینده / کریر','گیرنده',17],['DOC-017','دستور تحویل DO','حمل','کریر / نماینده','گیرنده / ترمینال',17],['DOC-018','گواهی بیمه','بیمه','بیمه‌گر','بیمه‌گذار / بانک',31],['DOC-019','گزارش بازرسی','بیمه','بازرس مستقل','بیمه‌گر / مدعی',44],['DOC-020','صورتحساب فروش','مالی','فورواردر','مشتری',20],['DOC-021','صورتحساب تأمین‌کننده','مالی','تأمین‌کننده','فورواردر',45],['DOC-022','رسید تحویل POD','تحویل','حمل‌کننده','فورواردر / مشتری',19],['DOC-023','اعلام خسارت','بیمه','مدعی','بیمه‌گر / کریر',72],['DOC-024','گزارش CAPA','کنترل','مالک فرایند','حاکمیت / ممیزی',70]
 ];
 var RISKS=[
 {id:'R1',n:'کمبود ظرفیت',p:4,i:5,o:'تأمین',c:'سهمیهٔ قراردادی و تأمین دوگانه',s:4},{id:'R2',n:'انتقال به سفر بعد',p:4,i:4,o:'رزرو',c:'کنترل مهلت‌ها و ظرفیت جایگزین',s:7},{id:'R3',n:'خطای HS',p:3,i:5,o:'گمرک',c:'کنترل چهارچشمی طبقه‌بندی',s:2},{id:'R4',n:'تطابق تحریمی',p:2,i:5,o:'انطباق',c:'غربالگری و حق توقف',s:65},{id:'R5',n:'رسوب بندری و توقف تجهیز',p:4,i:4,o:'عملیات مقصد',c:'مهلت آزاد و هشدار پیش‌بین',s:69},{id:'R6',n:'مغایرت اسناد',p:4,i:3,o:'اسناد',c:'ماتریس سند و کنترل نسخه',s:67},{id:'R7',n:'نکول اعتباری',p:3,i:5,o:'مالی',c:'سقف اعتبار و توقف آزادسازی',s:25},{id:'R8',n:'خسارت یا مفقودی بار',p:2,i:5,o:'خسارت‌ها',c:'بیمه، بازرسی و رزرو حق ادعا',s:72},{id:'R9',n:'از دست رفتن اتصال',p:3,i:4,o:'برج کنترل',c:'ETA و مسیر جایگزین',s:14},{id:'R10',n:'انحراف دمای ریفر',p:2,i:5,o:'QHSE',c:'حسگر، هشدار و اقدام اصلاحی',s:70},{id:'R11',n:'ازدحام بندر',p:4,i:4,o:'مدیر مسیر',c:'بازمسیریابی و ظرفیت جایگزین',s:58},{id:'R12',n:'نشت درآمد',p:3,i:4,o:'مالی / قیمت‌گذاری',c:'تطبیق نرخ تا صورتحساب',s:36},{id:'R13',n:'تقلب اسنادی یا بانکی',p:2,i:5,o:'مالی / اسناد',c:'تماس بازگشتی و تفکیک وظایف',s:33},{id:'R14',n:'توقف گمرکی',p:3,i:4,o:'کارگزار',c:'پیش‌اظهار و تکمیل داده',s:68},{id:'R15',n:'اختلال ژئوپلیتیکی',p:3,i:5,o:'مدیریت بحران',c:'راهنمای اقدام و برج کنترل',s:58}
 ];
 var RACI=[
 ['تکمیل RFQ',['R','A','C','I','I','I']],['تأیید نرخ فروش',['C','A','R','I','C','I']],['رزرو ظرفیت',['I','A','C','R','I','I']],['کنترل اسناد',['C','A','I','I','R','C']],['غربالگری تحریم',['I','A','I','I','C','R']],['اظهار گمرکی',['I','A','I','C','R','C']],['مدیریت استثنا',['I','A','C','R','C','C']],['توقف اعتباری',['I','C','I','I','I','A']],['اعلام خسارت',['R','A','I','C','R','C']],['بستن پرونده',['I','A','C','R','R','C']]
 ];
 var ROLES=['مشتری','مدیر عملیات','قیمت‌گذاری','برج کنترل','اسناد/گمرک','مالی/انطباق'];
 var DECISIONS=[['نرخ زیر کف حاشیه','مدیر قیمت‌گذاری','توقف و ارجاع برای تأیید'],['ظرفیت خارج از قرارداد','مدیر تأمین','خرید اسپات یا مسیر جایگزین'],['رد کالای خطرناک','QHSE','توقف کار و بررسی تخصصی'],['تطابق تحریمی','مسئول انطباق','توقف تراکنش یا اخذ مجوز'],['عبور از سقف اعتبار','مدیر مالی','توقف رزرو یا آزادسازی'],['تغییر حساب بانکی','کنترل‌کننده مالی','تماس بازگشتی مستقل'],['استثنای شدت بالا','برج کنترل','فعال‌سازی مدیریت بحران'],['آزادسازی اصل بارنامه','مسئول اسناد','کنترل نسخه و مجوز آزادسازی']];
 var CRIT=[['دریافت RFQ','۴ ساعت',1],['اعتبارسنجی داده','۲ ساعت',1],['انطباق','۱ ساعت',0],['طراحی مسیر','۳ ساعت',0],['قیمت‌گذاری','۴ ساعت',1],['تأیید اعتبار','۲ ساعت',0],['رزرو ظرفیت','۱۲ ساعت',1],['اسناد/VGM','تا مهلت نهایی',1],['ورود به پایانه','تا مهلت نهایی',1],['حمل اصلی','وابسته به مسیر',0],['ترخیص مقصد','۱–۳ روز',1],['آخرین مایل','۱ روز',0],['POD','۲۴ ساعت',0],['صورتحساب و بستن','۲ روز',0]];
 function e2(x){return String(x==null?'':x).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
 function sceneNo(i){return faNum(i+1)}
 function current(){return sceneAt(t)}
 function head(k,title,desc){return '<div class="p2StageHead"><div><small>'+k+'</small><h3>'+title+'</h3></div><p>'+desc+'</p></div>'}
 function stats(a){return '<div class="p2Stats">'+a.map(function(x){return '<div class="p2Stat"><strong>'+x[0]+'</strong><span>'+x[1]+'</span></div>'}).join('')+'</div>'}
 function jumpBtn(i,label){return '<button class="p2Jump" data-p2jump="'+i+'" type="button">'+(label||'ورود به صحنهٔ '+sceneNo(i))+'</button>'}
 function open(v){view=v||view;ws.classList.add('on');ws.setAttribute('aria-hidden','false');$2('p2Launch').setAttribute('aria-expanded','true');playing=false;render();setTimeout(function(){$2('p2Close').focus()},60)}
 function close(back){ws.classList.remove('on');ws.setAttribute('aria-hidden','true');$2('p2Launch').setAttribute('aria-expanded','false');if(back!==false)$2('p2Launch').focus()}
 function selectView(v){view=v;document.querySelectorAll('.p2NavBtn').forEach(function(b){b.classList.toggle('on',b.dataset.p2view===v)});render();stage.scrollTop=0}
 function relatedScenes(id){var a=[];SCENES.forEach(function(s,i){if(s.hot.indexOf(id)>-1)a.push(i)});return a}
 function renderActors(){var groups={customer:['shipper','consignee'],capacity:['line','road','rail','oport','hub','dport','airO','airD','depot','cfs'],control:['expcus','impcus','broker','compliance','qhse','insp','docs'],finance:['agent','ins','bank'],core:['fwd','sales','pricing','tower','whs']};function btn(id){var n=ND[id];return n?'<button class="p2Actor'+(actorSel===id?' on':'')+'" data-actor="'+id+'" type="button">'+e2(n.fa)+'</button>':''}var n=ND[actorSel]||ND.fwd,rs=relatedScenes(n.id),kind={hq:'هماهنگ‌کنندهٔ مرکزی',pad:'نقش تخصصی',port:'گره حمل',gate:'گره نظارتی',whs:'گره انبار',depot:'گره تجهیز',rail:'گره ریلی',tower:'برج کنترل',box:'طرف تجاری'}[n.kind]||'بازیگر';stage.innerHTML=head('اکوسیستم بازیگران','نقشهٔ کامل نقش‌ها و وابستگی‌ها','هر بازیگر را انتخاب کنید تا نقش عملیاتی، صحنه‌های مرتبط و مسیر ورود به جزئیات او نمایش داده شود.')+stats([[NODES.length,'گرهٔ بازیگری و عملیاتی'],['۷','نقش‌گاه بین‌سازمانی'],['۳۸','نقش مرجع'],['۲۴۸','جریان توالی و پیام']])+'<div class="p2ActorMap"><section class="p2ActorZone customer"><h4>طرف‌های تجاری</h4><div class="p2Actors">'+groups.customer.map(btn).join('')+'</div></section><section class="p2ActorZone capacity"><h4>ظرفیت و زیرساخت حمل</h4><div class="p2Actors">'+groups.capacity.map(btn).join('')+'</div></section><section class="p2ActorZone control"><h4>گمرک، کنترل و کیفیت</h4><div class="p2Actors">'+groups.control.map(btn).join('')+'</div></section><section class="p2ActorZone finance"><h4>شبکه، بیمه و مالی</h4><div class="p2Actors">'+groups.finance.map(btn).join('')+'</div></section><section class="p2ActorCore"><h4>هستهٔ هماهنگ‌سازی</h4><div class="p2Actors" style="justify-content:center">'+groups.core.map(btn).join('')+'</div></section></div><div class="p2ActorDetail"><div class="p2Card"><div class="p2CardHd"><h4>'+e2(n.fa)+'</h4><span class="p2Badge">'+kind+'</span></div><p class="p2Muted">این بازیگر در '+faNum(rs.length)+' صحنه حضور مستقیم دارد و از طریق جریان‌های کالا، اطلاعات، مالی یا رابطهٔ تأمین به اکوسیستم متصل است.</p><div class="p2Tags" style="margin-top:10px">'+rs.slice(0,8).map(function(i){return '<span class="p2Tag">'+sceneNo(i)+' · '+e2(SCENES[i].ch)+'</span>'}).join('')+'</div></div><div class="p2Card"><div class="p2CardHd"><h4>ورود عملیاتی</h4><span class="p2Badge">Drill-down</span></div><p class="p2Muted">نخستین صحنهٔ مرتبط را باز کنید یا جزئیات صحنهٔ جاری را در نمای Drill-down بررسی کنید.</p><div style="display:flex;gap:6px;margin-top:10px">'+(rs.length?jumpBtn(rs[0],'نمایش نخستین صحنه'):'')+'<button class="p2Jump" data-p2viewgo="drill">جزئیات صحنه</button></div></div></div>';bindActors()}
 function nodeAt(pt){for(var i=0;i<NODES.length;i++)if(Math.abs(NODES[i].x-pt[0])<.01&&Math.abs(NODES[i].y-pt[1])<.01)return NODES[i];return null}
 function renderFlows(){var kinds=[['cargo','جریان فیزیکی کالا','#ff8a2b'],['info','جریان اطلاعات و اسناد','#32d3ff'],['money','جریان مالی و تسویه','#42d990'],['rel','روابط پایدار تأمین','#586a91']],html='';kinds.forEach(function(k){var es=EDGES.filter(function(e){return e.kind===k[0]}),nodes=es.map(function(e){var a=nodeAt(e.pts[0]),b=nodeAt(e.pts[e.pts.length-1]);return '<div class="p2FlowNode"><b>'+e2((a&&a.fa)||'گره مبدأ')+' ← '+e2((b&&b.fa)||'گره مقصد')+'</b><span>'+e2(e.id)+'</span></div>'}).join('');html+='<section class="p2FlowLane" style="--fc:'+k[2]+'"><div class="p2FlowLabel"><b>'+k[1]+'</b><span>'+faNum(es.length)+' پیوند</span></div><div class="p2FlowTrack">'+nodes+'</div></section>'});stage.innerHTML=head('معماری چندجریانی','کالا، اطلاعات، اسناد، پول و ظرفیت در یک نما','فیلترهای این نما با جریان‌های روی صحنهٔ اصلی همگام می‌شوند؛ هر مسیر، مبدأ و مقصد عملیاتی خود را نشان می‌دهد.')+stats([['۱۰','مسیر فیزیکی'],['۲۷','پیوند اطلاعاتی'],['۷','جریان مالی'],['۵','رابطهٔ تأمین']])+'<div class="p2FlowControls">'+kinds.map(function(k){return '<button class="p2Filter '+(FLOW_ON[k[0]]!==false?'on':'')+'" style="--fc:'+k[2]+'" data-flowtoggle="'+k[0]+'">'+k[1]+'</button>'}).join('')+'</div><div class="p2Card">'+html+'</div>';stage.querySelectorAll('[data-flowtoggle]').forEach(function(b){b.onclick=function(){toggleFlow(b.dataset.flowtoggle);renderFlows()}})}
 function renderDocuments(q){q=(q||'').trim().toLowerCase();var cats=['همه'].concat(Array.from(new Set(DOCS.map(function(d){return d[2]})))),list=DOCS.filter(function(d){return (docCat==='همه'||d[2]===docCat)&&(!q||d.join(' ').toLowerCase().indexOf(q)>-1)});stage.innerHTML=head('Document Explorer','کاوشگر چرخهٔ عمر اسناد','اسناد را بر اساس دسته، صادرکننده، دریافت‌کننده و صحنهٔ عملیاتی جست‌وجو کنید.')+stats([[DOCS.length,'سند کلیدی'],[cats.length-1,'دستهٔ سند'],['۳','منطق آزادسازی'],['۱','زنجیرهٔ نسخه و تأیید']])+'<div class="p2Toolbar"><input class="p2Search" id="p2DocSearch" type="search" placeholder="جست‌وجوی سند، کد، صادرکننده یا دریافت‌کننده" value="'+e2(q)+'">'+cats.map(function(c){return '<button class="p2Filter '+(docCat===c?'on':'')+'" data-doccat="'+c+'">'+c+'</button>'}).join('')+'</div><div class="p2DocGrid">'+list.map(function(d){return '<article class="p2Card p2Doc"><code>'+d[0]+'</code><h4>'+d[1]+'</h4><dl><dt>دسته</dt><dd>'+d[2]+'</dd><dt>صادرکننده</dt><dd>'+d[3]+'</dd><dt>دریافت‌کننده</dt><dd>'+d[4]+'</dd></dl>'+jumpBtn(d[5])+'</article>'}).join('')+'</div>';var inp=$2('p2DocSearch');inp.oninput=function(){renderDocuments(inp.value);setTimeout(function(){$2('p2DocSearch').focus()},0)};stage.querySelectorAll('[data-doccat]').forEach(function(b){b.onclick=function(){docCat=b.dataset.doccat;renderDocuments(inp.value)}});bindJumps()}
 function renderRisks(){var cells='';for(var imp=5;imp>=1;imp--)for(var pr=1;pr<=5;pr++){var rr=RISKS.filter(function(r){return r.i===imp&&r.p===pr});cells+='<div class="p2Cell" data-r="'+(imp*pr>=15?'high':'normal')+'" style="--risk:'+(imp*pr)+'"><span>'+pr+'×'+imp+'</span>'+rr.map(function(r,j){return '<button class="p2RiskDot" title="'+e2(r.n)+'" data-risk="'+r.id+'" style="right:'+(8+j*22)+'px;bottom:'+(8+(j%2)*22)+'px">'+r.id.replace('R','')+'</button>'}).join('')+'</div>'}stage.innerHTML=head('Risk Explorer','نقشهٔ حرارتی ریسک و کنترل','ریسک‌های عملیاتی بر اساس احتمال و اثر مرتب شده‌اند؛ انتخاب هر مورد، کنترل و مالک آن را نمایش می‌دهد.')+stats([[RISKS.length,'ریسک اولویت‌دار'],['۸','ریسک با اثر بسیار بالا'],['۵','دامنهٔ کنترل'],['۱۰۰٪','نیازمند مالک مشخص']])+'<div class="p2Heat"><div class="p2Card"><div class="p2CardHd"><h4>احتمال × اثر</h4><span class="p2Badge">۱ کم · ۵ زیاد</span></div><div class="p2Matrix">'+cells+'</div></div><div class="p2RiskList">'+RISKS.slice().sort(function(a,b){return b.p*b.i-a.p*a.i}).slice(0,9).map(function(r){return '<article class="p2Card p2RiskItem"><h4>'+r.id+' · '+r.n+'</h4><p>'+r.c+'</p><footer><span>'+r.o+'</span><span>'+r.p+'×'+r.i+'</span></footer>'+jumpBtn(r.s,'صحنهٔ مرتبط')+'</article>'}).join('')+'</div></div>';stage.querySelectorAll('[data-risk]').forEach(function(b){b.onclick=function(){var r=RISKS.find(function(x){return x.id===b.dataset.risk});if(r){var list=stage.querySelectorAll('.p2RiskItem');list.forEach(function(x){x.style.borderColor=''});var hit=Array.from(list).find(function(x){return x.textContent.indexOf(r.id+' ·')>-1});if(hit){hit.style.borderColor='#ff6577';hit.scrollIntoView({behavior:REDUCED?'auto':'smooth',block:'center'})}}}});bindJumps()}
 function renderKpis(){var chs=['همه'].concat(Array.from(new Set(SCENES.map(function(s){return s.ch})))),idx=[];SCENE_METRICS.forEach(function(m,i){if(kpiChapter==='همه'||SCENES[i].ch===kpiChapter)idx.push(i)});var featured=[1,4,13,22,35,36,49,66];stage.innerHTML=head('KPI Dashboard','داشبورد عملکرد سرتاسری','شاخص‌ها از سطح تجاری و عملیاتی تا مالی، انطباق و تأمین‌کننده در یک نمای قابل Drill-down ترکیب شده‌اند.')+stats([['۳۰','شاخص کلیدی مرجع'],['۱۰','دامنهٔ عملکرد'],['۷۵','سیگنال صحنه‌ای'],['۱۴','عدسی اجراپذیری']])+'<div class="p2Toolbar">'+chs.map(function(c){return '<button class="p2Filter '+(kpiChapter===c?'on':'')+'" data-kpich="'+c+'">'+c+'</button>'}).join('')+'</div><div class="p2KpiGrid">'+idx.map(function(i){var m=SCENE_METRICS[i];return '<article class="p2Card p2Kpi"><strong>'+e2(m[0])+'</strong><h4>'+e2(m[1])+'</h4><p>'+e2(SCENES[i].ch)+' · صحنه '+sceneNo(i)+'<br>'+e2(m[2])+'</p><div class="p2KpiBar"><i style="--n:'+m[3]+'%"></i></div>'+jumpBtn(i,'Drill-down')+'</article>'}).join('')+'</div>';stage.querySelectorAll('[data-kpich]').forEach(function(b){b.onclick=function(){kpiChapter=b.dataset.kpich;renderKpis()}});bindJumps()}
 function renderRaci(){var th=ROLES.map(function(r){return '<th>'+r+'</th>'}).join(''),rows=RACI.map(function(r){return '<tr><td>'+r[0]+'</td>'+r[1].map(function(x){return '<td><span class="p2Role '+x+'">'+x+'</span></td>'}).join('')+'</tr>'}).join('');stage.innerHTML=head('حاکمیت اجرایی','RACI و حقوق تصمیم','برای هر فعالیت یک پاسخ‌گوی روشن و برای تصمیم‌های حساس، حق توقف یا تأیید مشخص نگه داشته می‌شود.')+stats([['۲۵','ردیف RACI مرجع'],['۲۰','حق تصمیم'],['۵۲','SOP مرتبط'],['۱','پاسخ‌گو برای هر فعالیت']])+'<div class="p2TableWrap"><table class="p2Table"><thead><tr><th>فعالیت</th>'+th+'</tr></thead><tbody>'+rows+'</tbody></table></div><div class="p2DecisionGrid">'+DECISIONS.map(function(d){return '<article class="p2Card p2Decision"><h4>'+d[0]+'</h4><p>'+d[2]+'</p><b>صاحب اختیار: '+d[1]+'</b></article>'}).join('')+'</div><p class="p2Muted" style="margin-top:10px">A = پاسخ‌گو · R = مسئول اجرا · C = مشاور · I = مطلع</p>'}
 function renderCritical(){stage.innerHTML=head('گلوگاه و مسیر بحرانی','مسیر بحرانی از RFQ تا بستن پرونده','گام‌های دارای حاشیهٔ زمانی محدود با رنگ هشدار مشخص شده‌اند؛ شکست هرکدام می‌تواند زمان، هزینه یا SLA کل محموله را تغییر دهد.')+stats([['۱۴','گام بحرانی'],['۶','مهلت کنترلی'],['۵','گلوگاه پرتکرار'],['۳','مسیر جایگزین']])+'<div class="p2Critical">'+CRIT.map(function(x,i){return '<article class="p2Step '+(x[2]?'critical':'')+'"><strong>'+faNum(i+1)+'</strong><h4>'+x[0]+'</h4><p>'+x[1]+'</p><i>'+(x[2]?'گلوگاه بالقوه':'حاشیهٔ قابل مدیریت')+'</i></article>'}).join('')+'</div><div class="p2Grid3"><article class="p2Card p2Bottleneck"><div class="p2CardHd"><h4>دادهٔ ناقص در RFQ</h4><span class="p2Badge">ورودی</span></div><p class="p2Muted">باعث رفت‌وبرگشت، تأخیر قیمت‌گذاری و برآورد نادرست هزینه می‌شود.</p>'+jumpBtn(64)+'</article><article class="p2Card p2Bottleneck"><div class="p2CardHd"><h4>ظرفیت و مهلت رزرو</h4><span class="p2Badge">تأمین</span></div><p class="p2Muted">نبود سهمیه یا عبور از مهلت، انتقال به سفر بعد و افزایش هزینه را فعال می‌کند.</p>'+jumpBtn(7)+'</article><article class="p2Card p2Bottleneck"><div class="p2CardHd"><h4>اسناد و آزادسازی</h4><span class="p2Badge">کنترل</span></div><p class="p2Muted">مغایرت نسخه یا داده، توقف گمرکی و تأخیر تحویل را ایجاد می‌کند.</p>'+jumpBtn(67)+'</article></div>';bindJumps()}
 function renderDrill(){var i=current();p2LastScene=i;var s=SCENES[i],l=SCENE_LENS[i],m=SCENE_METRICS[i],tr=SCENE_TRACE[i]||[],actors=s.hot.filter(function(x){return ND[x]}).map(function(x){return ND[x].fa}),docs=DOCS.filter(function(d){return Math.abs(d[5]-i)<=1}).slice(0,5),risks=RISKS.filter(function(r){return Math.abs(r.s-i)<=1}).slice(0,5);stage.innerHTML=head('Scene-to-Process Drill-down','از صحنه به فرایند، کنترل و شواهد','تمام اجزای صحنهٔ جاری در یک نمای عملیاتی به نقش، خروجی، کنترل، ریسک، سند و شناسهٔ ردیابی متصل می‌شوند.')+'<div class="p2DrillHero"><div class="p2Card p2DrillTitle"><small>'+e2(s.ch)+' · صحنه '+sceneNo(i)+'</small><h3>'+e2(s.ti)+'</h3><p>'+e2(s.sb)+'<br>'+e2(s.card.tx)+'</p></div><div class="p2DrillActions"><button class="p2Jump" data-returnscene="1">بازگشت به صحنه</button><button class="p2Jump" data-openprocess="1">نقشهٔ فرایند</button></div></div><div class="p2DrillGrid"><div class="p2Card"><span>مسئول</span><b>'+e2(l.r)+'</b></div><div class="p2Card"><span>خروجی</span><b>'+e2(l.o)+'</b></div><div class="p2Card"><span>کنترل</span><b>'+e2(l.c)+'</b></div><div class="p2Card"><span>پیامد شکست</span><b>'+e2(l.f)+'</b></div><div class="p2Card"><span>شاخص</span><b>'+e2(m[0])+' · '+e2(m[1])+'</b></div><div class="p2Card"><span>وضعیت شواهد</span><b>'+e2(TIERFA[s.card.tr]||s.card.tr)+'</b></div><div class="p2Card"><span>منبع</span><b>'+e2(s.card.sr)+'</b></div><div class="p2Card"><span>شناسه‌های ردیابی</span><b>'+e2(tr.join(' · '))+'</b></div></div><div class="p2Links"><div class="p2Card"><div class="p2CardHd"><h4>بازیگران حاضر</h4><span class="p2Badge">'+faNum(actors.length)+'</span></div><div class="p2Tags">'+actors.map(function(x){return '<span class="p2Tag">'+e2(x)+'</span>'}).join('')+'</div></div><div class="p2Card"><div class="p2CardHd"><h4>اسناد نزدیک</h4><span class="p2Badge">'+faNum(docs.length)+'</span></div><div class="p2Tags">'+docs.map(function(x){return '<span class="p2Tag">'+x[0]+' · '+x[1]+'</span>'}).join('')+'</div></div><div class="p2Card"><div class="p2CardHd"><h4>ریسک‌های مرتبط</h4><span class="p2Badge">'+faNum(risks.length)+'</span></div><div class="p2Tags">'+risks.map(function(x){return '<span class="p2Tag">'+x.id+' · '+x.n+'</span>'}).join('')+'</div></div></div>';$2('p2SceneNow').textContent='صحنهٔ جاری: '+sceneNo(i)+' · '+s.ch;var r=stage.querySelector('[data-returnscene]');if(r)r.onclick=function(){close(false)};var op=stage.querySelector('[data-openprocess]');if(op)op.onclick=function(){close(false);if(elProcess){elProcess.classList.add('on');elProcess.setAttribute('aria-hidden','false')}}}
 function render(){document.querySelectorAll('.p2NavBtn').forEach(function(b){b.classList.toggle('on',b.dataset.p2view===view)});$2('p2SceneNow').textContent='صحنهٔ جاری: '+sceneNo(current())+' · '+SCENES[current()].ch;if(view==='actors')renderActors();else if(view==='flows')renderFlows();else if(view==='documents')renderDocuments();else if(view==='risks')renderRisks();else if(view==='kpis')renderKpis();else if(view==='raci')renderRaci();else if(view==='critical')renderCritical();else renderDrill()}
 function bindActors(){stage.querySelectorAll('[data-actor]').forEach(function(b){b.onclick=function(){actorSel=b.dataset.actor;renderActors()}});stage.querySelectorAll('[data-p2viewgo]').forEach(function(b){b.onclick=function(){selectView(b.dataset.p2viewgo)}});bindJumps()}
 function bindJumps(){stage.querySelectorAll('[data-p2jump]').forEach(function(b){b.onclick=function(){var i=parseInt(b.dataset.p2jump,10);jump(i);selectView('drill')}})}
 $2('p2Launch').addEventListener('click',function(){open('actors')});$2('p2Close').addEventListener('click',function(){close(true)});document.querySelectorAll('.p2NavBtn').forEach(function(b){b.addEventListener('click',function(){selectView(b.dataset.p2view)})});
 window.addEventListener('keydown',function(e){if(e.key==='Escape'&&ws.classList.contains('on')){e.stopImmediatePropagation();close(true)}else if(!(document.getElementById('p4Hub')&&document.getElementById('p4Hub').classList.contains('on'))&&!(document.getElementById('p3Lab')&&document.getElementById('p3Lab').classList.contains('on'))&&!/input|textarea/i.test((e.target.tagName||''))&&(e.key==='o'||e.key==='O')){ws.classList.contains('on')?close(true):open('actors')}} ,true);
 var h2=updHUD;updHUD=function(r){h2(r);if(ws.classList.contains('on')){$2('p2SceneNow').textContent='صحنهٔ جاری: '+sceneNo(r.idx)+' · '+r.s.ch;if(view==='drill'&&r.idx!==p2LastScene)renderDrill()}};
})();


/* ===== PHASE 3 · SIMULATION CONTROLLER ===== */
(function(){
 var $3=function(id){return document.getElementById(id)},lab=$3('p3Lab'),stage=$3('p3Stage'),view='scenario',history=[];
 var ROUTES=[
 {id:'sea-direct',n:'دریایی مستقیم',mode:'دریایی',days:30,cost:4200,risk:38,rel:78,carbon:18,cap:82,path:'شانگهای ← روتردام'},
 {id:'sea-hub',n:'دریایی با ترانشیپمنت',mode:'دریایی',days:36,cost:3650,risk:52,rel:68,carbon:20,cap:91,path:'شانگهای ← سنگاپور ← روتردام'},
 {id:'rail',n:'ریل چین–اروپا',mode:'ریلی',days:18,cost:6900,risk:46,rel:74,carbon:12,cap:64,path:'شی‌آن ← قزاقستان ← دویسبورگ'},
 {id:'middle',n:'کریدور میانی',mode:'چندوجهی',days:21,cost:7400,risk:58,rel:62,carbon:14,cap:55,path:'چین ← خزر ← قفقاز ← اروپا'},
 {id:'air',n:'هوایی مستقیم',mode:'هوایی',days:4,cost:19800,risk:24,rel:91,carbon:88,cap:72,path:'PVG ← FRA'},
 {id:'sea-air',n:'دریا–هوایی',mode:'چندوجهی',days:14,cost:11200,risk:42,rel:80,carbon:48,cap:70,path:'شانگهای ← دبی ← فرانکفورت'}
 ];
 var EVENTS={
 none:{n:'بدون بحران',delay:0,cost:0,rel:0,risk:0,owner:'برج کنترل',scene:0,root:'—'},
 congestion:{n:'ازدحام بندر',delay:3,cost:260,rel:6,risk:8,owner:'مدیر مسیر تجاری',scene:58,root:'تراکم عملیات و محدودیت اسکله'},
 rollover:{n:'انتقال به سفر بعد',delay:7,cost:480,rel:11,risk:10,owner:'تأمین و رزرو',scene:7,root:'سهمیهٔ ناکافی یا عبور از مهلت'},
 redsea:{n:'اختلال دریای سرخ',delay:10,cost:900,rel:14,risk:16,owner:'مدیریت بحران',scene:58,root:'ریسک ژئوپلیتیکی و انحراف مسیر'},
 customs:{n:'توقف گمرکی',delay:2,cost:320,rel:7,risk:11,owner:'گمرک و انطباق',scene:68,root:'داده یا سند ناکامل / انتخاب مسیر قرمز'},
 docs:{n:'مغایرت اسناد',delay:1.5,cost:180,rel:5,risk:7,owner:'مرکز اسناد',scene:67,root:'نسخه ناسازگار یا خطای داده'},
 strike:{n:'اعتصاب بندری',delay:5,cost:620,rel:10,risk:12,owner:'برج کنترل',scene:70,root:'عدم دسترسی به نیروی عملیاتی'},
 reefer:{n:'انحراف دمای ریفر',delay:1,cost:1400,rel:8,risk:19,owner:'QHSE',scene:70,root:'خرابی تجهیز، سنسور یا برق'},
 sanctions:{n:'تطابق تحریمی',delay:12,cost:650,rel:20,risk:24,owner:'مسئول انطباق',scene:65,root:'تطابق طرف، کشور یا کالای محدودشده'}
 };
 var st={route:'sea-direct',event:'none',severity:2,cargo:'عمومی',sell:5600,value:180000,capacity:82,fuel:0,fx:0,delay:0,free:5,dem:140,priority:'balanced',selectedAlt:'sea-direct'};
 function x3(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
 function fn(n,d){n=Number(n)||0;return faNum(n.toLocaleString('en-US',{maximumFractionDigits:d==null?1:d}))}
 function money(n){return '$'+fn(Math.round(n),0)}
 function route(){return ROUTES.find(function(r){return r.id===st.route})||ROUTES[0]}
 function event(){return EVENTS[st.event]||EVENTS.none}
 function calc(r){r=r||route();var e=event(),sev=st.severity,modeFactor=r.mode==='هوایی'?.45:(r.mode==='ریلی'?.75:1),delay=e.delay*sev*modeFactor+st.delay,cost=e.cost*sev+(r.cost*(st.fuel/100))+(r.cost*(st.fx/100))+Math.max(0,delay-st.free)*st.dem*.35,newCost=r.cost+cost,margin=st.sell-newCost,marginPct=st.sell?margin/st.sell*100:0,risk=Math.min(100,r.risk+e.risk*sev+Math.max(0,100-st.capacity)*.18),rel=Math.max(5,r.rel-e.rel*sev-Math.max(0,75-st.capacity)*.2-delay*.25);return {base:r,cost:newCost,costDelta:cost,days:r.days+delay,delay:delay,margin:margin,marginPct:marginPct,risk:risk,rel:rel,eta:r.days+delay,carbon:r.carbon}}
 function head(k,t,d){return '<div class="p3Head"><div><small>'+k+'</small><h3>'+t+'</h3></div><p>'+d+'</p></div>'}
 function stats(a){return '<div class="p3Stats">'+a.map(function(v){return '<div class="p3Stat '+(v[2]||'')+'"><strong>'+v[0]+'</strong><span>'+v[1]+'</span></div>'}).join('')+'</div>'}
 function choices(){return [1,2,3].map(function(n){return '<button class="p3Choice '+(st.severity===n?'on':'')+'" data-sev="'+n+'">'+(['','کم','متوسط','شدید'][n])+'</button>'}).join('')}
 function options(obj,sel){return Object.keys(obj).map(function(k){var v=obj[k];return '<option value="'+k+'" '+(k===sel?'selected':'')+'>'+x3(v.n||v)+'</option>'}).join('')}
 function open(v){view=v||view;var p2=document.getElementById('p2Workspace');if(p2&&p2.classList.contains('on')){p2.classList.remove('on');p2.setAttribute('aria-hidden','true')}document.querySelectorAll('.p1Panel.on').forEach(function(x){x.classList.remove('on');x.setAttribute('aria-hidden','true')});lab.classList.add('on');lab.setAttribute('aria-hidden','false');$3('p3Launch').setAttribute('aria-expanded','true');playing=false;render();setTimeout(function(){$3('p3Close').focus()},60)}
 function close(){lab.classList.remove('on');lab.setAttribute('aria-hidden','true');$3('p3Launch').setAttribute('aria-expanded','false');$3('p3Launch').focus()}
 function choose(v){view=v;document.querySelectorAll('.p3NavBtn').forEach(function(b){b.classList.toggle('on',b.dataset.p3view===v)});render();stage.scrollTop=0}
 function updateStatus(){var c=calc();$3('p3Status').textContent=EVENTS[st.event].n+' · '+ROUTES.find(function(r){return r.id===st.route}).n+' · '+fn(c.marginPct)+'٪ حاشیه'}
 function bindCommon(){stage.querySelectorAll('[data-sev]').forEach(function(b){b.onclick=function(){st.severity=+b.dataset.sev;render()}})}
 function scenarioResult(){var c=calc(),bad=c.margin<0?'bad':'good';return '<div class="p3Card p3ResultHero"><div class="p3CardHd"><h4>نتیجهٔ شبیه‌سازی</h4><span class="p3Badge">'+x3(event().n)+'</span></div><div class="p3ResultMain"><div><span>ETA جدید</span><strong>'+fn(c.eta)+' روز</strong><small class="p3Delta up">+'+fn(c.delay)+' روز</small></div><div><span>هزینهٔ اجرا</span><strong>'+money(c.cost)+'</strong><small class="p3Delta up">+'+money(c.costDelta)+'</small></div><div><span>حاشیه سود</span><strong class="'+bad+'">'+money(c.margin)+'</strong><small>'+fn(c.marginPct)+'٪ فروش</small></div><div><span>قابلیت اتکا</span><strong>'+fn(c.rel)+'٪</strong><small>ریسک '+fn(c.risk)+' / ۱۰۰</small></div></div><div class="p3Actions"><button class="p3Btn primary" id="p3Save">ذخیرهٔ سناریو</button><button class="p3Btn" data-go="crisis">تحلیل اثر بحران</button><button class="p3Btn" data-go="alternate">یافتن مسیر جایگزین</button></div></div>'}
 function renderScenario(){var routes={};ROUTES.forEach(function(r){routes[r.id]=r.n});stage.innerHTML=head('Scenario Engine','موتور سناریوی محموله','مسیر، بحران، شدت و اقتصاد پایه را تعریف کنید و اثر آن را بر زمان، هزینه، حاشیه سود، قابلیت اتکا و ریسک ببینید.')+stats([['۶','مسیر قابل مقایسه'],['۸','رخداد بحرانی'],['۳','سطح شدت'],['۴','خروجی تصمیم']])+'<div class="p3Grid2"><div class="p3Card"><div class="p3CardHd"><h4>پارامترهای سناریو</h4><span class="p3Badge">ورودی</span></div><div class="p3Form"><div class="p3Field"><label>مسیر پایه</label><select id="p3RouteSel">'+options(routes,st.route)+'</select></div><div class="p3Field"><label>رخداد</label><select id="p3EventSel">'+options(EVENTS,st.event)+'</select></div><div class="p3Field"><label>نوع محموله</label><select id="p3Cargo"><option>عمومی</option><option '+(st.cargo==='یخچالی'?'selected':'')+'>یخچالی</option><option '+(st.cargo==='کالای خطرناک'?'selected':'')+'>کالای خطرناک</option><option '+(st.cargo==='پروژه‌ای'?'selected':'')+'>پروژه‌ای</option></select></div><div class="p3Field"><label>ارزش فروش خدمت</label><input id="p3Sell" type="number" min="0" step="100" value="'+st.sell+'"></div><div class="p3Field" style="grid-column:1/-1"><label>شدت رخداد</label><div class="p3Severity">'+choices()+'</div></div></div></div>'+scenarioResult()+'</div><div class="p3Card p3ScenarioLog"><div class="p3CardHd"><h4>سناریوهای ذخیره‌شده</h4><span class="p3Badge">'+faNum(history.length)+'</span></div><div id="p3Log">'+(history.length?history.map(function(h,i){return '<div class="p3LogRow"><b>سناریو '+faNum(i+1)+'</b><span>'+x3(h.event)+' · '+x3(h.route)+'</span><span>'+fn(h.days)+' روز</span><span>'+money(h.cost)+'</span><span>'+fn(h.margin)+'٪</span></div>'}).join(''):'<p class="p3Muted">هنوز سناریویی ذخیره نشده است.</p>')+'</div></div>';bindCommon();$3('p3RouteSel').onchange=function(){st.route=this.value;renderScenario();updateStatus()};$3('p3EventSel').onchange=function(){st.event=this.value;renderScenario();updateStatus()};$3('p3Cargo').onchange=function(){st.cargo=this.value};$3('p3Sell').onchange=function(){st.sell=Math.max(0,+this.value||0);renderScenario();updateStatus()};$3('p3Save').onclick=function(){var c=calc();history.unshift({event:event().n,route:route().n,days:c.days,cost:c.cost,margin:c.marginPct});history=history.slice(0,5);renderScenario()};stage.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){choose(b.dataset.go)}});updateStatus()}
 function whatValues(){var c=calc();return {cost:c.cost,days:c.days,margin:c.marginPct,risk:c.risk,rel:c.rel}}
 function renderWhatIf(){var v=whatValues();stage.innerHTML=head('What-if Analysis','تحلیل حساسیت تصمیم‌ها','ظرفیت، سوخت، ارز، تأخیر و مهلت آزاد را تغییر دهید و حساسیت اقتصاد محموله را بدون تغییر دادهٔ پایه مشاهده کنید.')+stats([[fn(st.capacity)+'٪','دسترسی ظرفیت'],[fn(st.fuel)+'٪','تغییر هزینه سوخت',st.fuel>10?'bad':''],[fn(st.delay)+' روز','تأخیر افزوده',st.delay>3?'bad':''],[fn(v.margin)+'٪','حاشیه سود',v.margin<10?'bad':'good']])+'<div class="p3Grid2"><div class="p3Card"><div class="p3CardHd"><h4>اهرم‌های سناریو</h4><span class="p3Badge">زنده</span></div>'+slider('capacity','دسترسی ظرفیت',30,100,1,st.capacity,'٪')+slider('fuel','تغییر BAF / سوخت',-10,40,1,st.fuel,'٪')+slider('fx','نوسان ارز',-10,25,1,st.fx,'٪')+slider('delay','تأخیر افزوده',0,20,.5,st.delay,' روز')+slider('free','مهلت آزاد',0,14,1,st.free,' روز')+slider('dem','هزینهٔ روزانه رسوب/توقف',50,400,10,st.dem,'$')+'<div class="p3Actions"><button class="p3Btn" id="p3ResetWhat">بازنشانی اهرم‌ها</button></div></div><div class="p3Card"><div class="p3CardHd"><h4>مقایسه با خط پایه</h4><span class="p3Badge">اثر خالص</span></div><div class="p3CompareBars" id="p3WhatBars">'+bars(v)+'</div><div class="p3Approval"><i></i><div><b id="p3WhatAdvice">'+advice(v)+'</b><span>پیشنهاد بر اساس حاشیه سود، زمان و ریسک محاسبه می‌شود.</span></div></div></div></div>';['capacity','fuel','fx','delay','free','dem'].forEach(function(k){var el=$3('wi-'+k);el.oninput=function(){st[k]=+this.value;paintWhatIf()}});$3('p3ResetWhat').onclick=function(){Object.assign(st,{capacity:82,fuel:0,fx:0,delay:0,free:5,dem:140});renderWhatIf()}}
 function slider(k,label,min,max,step,val,suf){return '<div class="p3SliderRow"><div class="p3SliderTop"><label>'+label+'</label><output id="out-'+k+'">'+fn(val)+(suf||'')+'</output></div><input id="wi-'+k+'" type="range" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'"></div>'}
 function bars(v){var base=calc(route());return compareBar('هزینه',Math.min(100,v.cost/22000*100),money(v.cost),v.cost>route().cost)+compareBar('زمان',Math.min(100,v.days/60*100),fn(v.days)+' روز',v.days>route().days)+compareBar('حاشیه',Math.max(0,Math.min(100,v.margin+30)),fn(v.margin)+'٪',v.margin<15)+compareBar('ریسک',v.risk,fn(v.risk),v.risk>55)+compareBar('قابلیت اتکا',v.rel,fn(v.rel)+'٪',v.rel<70)}
 function compareBar(l,n,val,bad){return '<div class="p3CompareBar '+(bad?'bad':'')+'"><label>'+l+'</label><div class="p3Bar"><i style="--n:'+n+'%"></i></div><b>'+val+'</b></div>'}
 function advice(v){if(v.margin<0)return 'سناریو زیان‌ده است؛ نرخ فروش یا مسیر باید بازطراحی شود.';if(v.risk>70)return 'ریسک بالا است؛ تأیید انسانی و مسیر جایگزین لازم است.';if(v.rel<65)return 'قابلیت اتکا پایین است؛ ظرفیت و مهلت‌های عملیاتی بازبینی شوند.';return 'سناریو در محدودهٔ قابل‌قبول است؛ پیش از رزرو، اعتبار نرخ و ظرفیت تأیید شود.'}
 function paintWhatIf(){var v=whatValues(),ss=stage.querySelectorAll('.p3Stats .p3Stat');if(ss.length===4){ss[0].querySelector('strong').textContent=fn(st.capacity)+'٪';ss[1].querySelector('strong').textContent=fn(st.fuel)+'٪';ss[1].classList.toggle('bad',st.fuel>10);ss[2].querySelector('strong').textContent=fn(st.delay)+' روز';ss[2].classList.toggle('bad',st.delay>3);ss[3].querySelector('strong').textContent=fn(v.margin)+'٪';ss[3].classList.toggle('bad',v.margin<10);ss[3].classList.toggle('good',v.margin>=10)}['capacity','fuel','fx','delay','free','dem'].forEach(function(k){var o=$3('out-'+k);if(o)o.textContent=fn(st[k])+(k==='dem'?'$':(k==='capacity'||k==='fuel'||k==='fx'?'٪':' روز'))});$3('p3WhatBars').innerHTML=bars(v);$3('p3WhatAdvice').textContent=advice(v);updateStatus()}
 function routeCalc(r){return calc(r)}
 function routeScore(r,priority){var c=routeCalc(r),score;if(priority==='time')score=100-c.days*2-c.risk*.15;else if(priority==='cost')score=100-c.cost/260-c.risk*.12;else if(priority==='risk')score=110-c.risk-c.days*.3;else if(priority==='carbon')score=105-c.carbon-c.days*.2;else score=110-c.days*.75-c.cost/520-c.risk*.35+c.rel*.18;return Math.max(1,Math.min(99,score))}
 function bestRoute(){return ROUTES.slice().sort(function(a,b){return routeScore(b,st.priority)-routeScore(a,st.priority)})[0]}
 function renderRoutes(alternate){var best=bestRoute();stage.innerHTML=head(alternate?'Alternative Route Engine':'Route Comparison',alternate?'موتور انتخاب مسیر جایگزین':'مقایسهٔ مسیرهای حمل','زمان، هزینه، ریسک، قابلیت اتکا و کربن برای مسیرهای دریایی، ریلی، هوایی و چندوجهی با شرایط بحران جاری مقایسه می‌شوند.')+stats([[ROUTES.length,'گزینهٔ مسیر'],[best.n,'پیشنهاد فعلی'],[fn(routeScore(best,st.priority))+'/100','امتیاز تصمیم'],[event().n,'شرایط جاری']])+'<div class="p3Actions" style="margin:0 0 12px">'+[['balanced','متعادل'],['time','سریع‌ترین'],['cost','کم‌هزینه‌ترین'],['risk','کم‌ریسک‌ترین'],['carbon','کم‌کربن‌ترین']].map(function(p){return '<button class="p3Choice '+(st.priority===p[0]?'on':'')+'" data-priority="'+p[0]+'">'+p[1]+'</button>'}).join('')+'</div><div class="p3RouteGrid">'+ROUTES.slice().sort(function(a,b){return routeScore(b,st.priority)-routeScore(a,st.priority)}).map(function(r){var c=routeCalc(r),sc=routeScore(r,st.priority);return '<button class="p3Route '+(r.id===st.selectedAlt?'on ':'')+(r.id===best.id?'recommended':'')+'" data-routepick="'+r.id+'"><small>'+r.mode+' · '+x3(r.path)+'</small><h4>'+r.n+'</h4><div class="p3RouteMetrics"><div><span>ETA</span><b>'+fn(c.days)+' روز</b></div><div><span>هزینه</span><b>'+money(c.cost)+'</b></div><div><span>ریسک</span><b>'+fn(c.risk)+'</b></div><div><span>اتکا</span><b>'+fn(c.rel)+'٪</b></div></div><div class="p3Score"><i style="--n:'+sc+'%"></i></div></button>'}).join('')+'</div><div class="p3Card" style="margin-top:10px"><div class="p3CardHd"><h4>'+(alternate?'فعال‌سازی مسیر جایگزین':'جدول مقایسه')+'</h4><span class="p3Badge">'+best.n+'</span></div>'+routeTable()+(alternate?'<div class="p3Actions"><button class="p3Btn primary" id="p3Activate">فعال‌سازی گزینهٔ انتخاب‌شده</button><button class="p3Btn" data-go="crisis">بازمحاسبه اثر بحران</button></div>':'')+'</div>';stage.querySelectorAll('[data-priority]').forEach(function(b){b.onclick=function(){st.priority=b.dataset.priority;renderRoutes(alternate)}});stage.querySelectorAll('[data-routepick]').forEach(function(b){b.onclick=function(){st.selectedAlt=b.dataset.routepick;renderRoutes(alternate)}});if(alternate){$3('p3Activate').onclick=function(){st.route=st.selectedAlt;st.event='none';st.delay=0;choose('scenario')};stage.querySelector('[data-go]').onclick=function(){choose('crisis')}}}
 function routeTable(){return '<div style="overflow:auto"><table class="p3RouteTable"><thead><tr><th>مسیر</th><th>زمان</th><th>هزینه</th><th>ریسک</th><th>اتکا</th><th>کربن</th><th>امتیاز</th></tr></thead><tbody>'+ROUTES.map(function(r){var c=routeCalc(r);return '<tr><td>'+r.n+'</td><td>'+fn(c.days)+' روز</td><td>'+money(c.cost)+'</td><td>'+fn(c.risk)+'</td><td>'+fn(c.rel)+'٪</td><td>'+fn(c.carbon)+'</td><td>'+fn(routeScore(r,st.priority))+'</td></tr>'}).join('')+'</tbody></table></div>'}
 function renderCrisis(){var c=calc(),e=event(),impact=Math.min(100,c.risk*.55+c.delay*2+Math.max(0,-c.marginPct));stage.innerHTML=head('Crisis Impact','اثر بحران بر ETA، هزینه و حاشیه سود','رخداد انتخاب‌شده به مؤلفه‌های کمی شکسته می‌شود تا تصمیم‌گیر بتواند اثر زمان، هزینه، سود، ریسک و SLA را هم‌زمان ببیند.')+stats([['+'+fn(c.delay)+' روز','اثر بر ETA','bad'],['+'+money(c.costDelta),'افزایش هزینه','bad'],[fn(c.marginPct)+'٪','حاشیه سود',c.marginPct<10?'bad':'good'],[fn(c.rel)+'٪','قابلیت اتکا',c.rel<70?'bad':'good']])+'<div class="p3Impact"><div class="p3Card p3ImpactGauge"><div class="p3Ring" style="--risk:'+impact+'"><div><strong>'+fn(impact)+'</strong><span>شدت اثر / ۱۰۰</span></div></div><div class="p3Approval"><i></i><div><b>'+x3(e.n)+'</b><span>مالک: '+x3(e.owner)+' · شدت '+(['','کم','متوسط','شدید'][st.severity])+'</span></div></div></div><div class="p3Card"><div class="p3CardHd"><h4>شکست اثر به مؤلفه‌ها</h4><span class="p3Badge">قبل / بعد</span></div><div class="p3Waterfall">'+water('زمان حمل',Math.min(100,c.days/60*100),fn(route().days)+' ← '+fn(c.days)+' روز',true)+water('هزینه اجرا',Math.min(100,c.cost/22000*100),money(route().cost)+' ← '+money(c.cost),true)+water('حاشیه سود',Math.max(0,Math.min(100,c.marginPct+30)),fn((st.sell-route().cost)/st.sell*100)+'٪ ← '+fn(c.marginPct)+'٪',c.marginPct<10)+water('قابلیت اتکا',c.rel,fn(route().rel)+'٪ ← '+fn(c.rel)+'٪',c.rel<70)+water('ریسک کل',c.risk,fn(route().risk)+' ← '+fn(c.risk),true)+'</div><div class="p3Actions"><button class="p3Btn" data-scene="'+e.scene+'">مشاهدهٔ صحنهٔ مرتبط</button><button class="p3Btn primary" data-go="alternate">محاسبهٔ مسیر جایگزین</button><button class="p3Btn warn" data-go="exception">فعال‌سازی موتور استثنا</button></div></div></div>';stage.querySelector('[data-scene]').onclick=function(){jump(+this.dataset.scene);close()};stage.querySelectorAll('[data-go]').forEach(function(b){b.onclick=function(){choose(b.dataset.go)}})}
 function water(l,n,val,bad){return '<div class="p3Water '+(!bad?'good':'')+'"><label>'+l+'</label><div class="p3WaterTrack"><i style="--n:'+n+'%"></i></div><b>'+val+'</b></div>'}
 function renderException(){var e=event(),c=calc(),sev=st.severity,high=sev===3||c.risk>68,steps=[['کشف','رویداد از کریر، AIS، سند یا کاربر دریافت شد.'],['اعتبارسنجی','تکرار حذف و صحت منبع کنترل می‌شود.'],['طبقه‌بندی','نوع، شدت و اثر مالی/زمانی تعیین می‌شود.'],['تخصیص مالک','مالک استثنا و SLA پاسخ تعیین می‌شود.'],['تأیید انسانی',high?'برای اقدام پرریسک الزامی است.':'برای این شدت اختیاری است.'],['اقدام و بستن','نتیجه، هزینه و شواهد در دفتر رویداد ثبت می‌شود.']];stage.innerHTML=head('Exception & CAPA Engine','موتور استثنا و اقدام اصلاحی/پیشگیرانه','رخداد شناسایی، اعتبارسنجی، طبقه‌بندی و به مالک ارجاع می‌شود؛ سپس اقدام فوری و چرخهٔ CAPA به دفتر رویداد بازمی‌گردد.')+stats([[e.n,'استثنای فعال'],[(['','کم','متوسط','شدید'][sev]),'شدت'],[e.owner,'مالک'],[high?'الزامی':'اختیاری','تأیید انسانی',high?'bad':'good']])+'<div class="p3ExceptionFlow">'+steps.map(function(s,i){return '<article class="p3ExcStep '+(i<2?'done':(i===2?'active':''))+'"><b>'+faNum(i+1)+'</b><h4>'+s[0]+'</h4><p>'+s[1]+'</p></article>'}).join('')+'</div>'+(high?'<div class="p3Approval"><i></i><div><b>دروازهٔ تأیید انسانی فعال است</b><span>اقدام مسیر، آزادسازی، پرداخت یا توقف باید توسط '+x3(e.owner)+' تأیید شود.</span></div></div>':'')+'<div class="p3CapaGrid" style="margin-top:10px"><article class="p3Card p3Capa" style="--cc:#ff6577"><span>مهار فوری</span><h4>کاهش اثر جاری</h4><p>'+containment(e)+'</p></article><article class="p3Card p3Capa" style="--cc:#ff9d42"><span>علت ریشه‌ای</span><h4>'+x3(e.root)+'</h4><p>تحلیل پنج‌چرا و شواهد رویداد برای تأیید علت استفاده می‌شود.</p></article><article class="p3Card p3Capa" style="--cc:#4da3ff"><span>اقدام اصلاحی</span><h4>رفع علت رخداد</h4><p>'+corrective(e)+'</p></article><article class="p3Card p3Capa" style="--cc:#42d990"><span>اقدام پیشگیرانه</span><h4>جلوگیری از تکرار</h4><p>'+preventive(e)+'</p></article></div><div class="p3Grid2" style="margin-top:10px"><div class="p3Card"><div class="p3CardHd"><h4>مالکیت و موعد</h4><span class="p3Badge">CAPA</span></div><p class="p3Muted">مالک: '+x3(e.owner)+'<br>موعد پاسخ اولیه: '+(high?'۲ ساعت':'۸ ساعت')+'<br>موعد بستن CAPA: '+(high?'۷ روز':'۱۴ روز')+'</p></div><div class="p3Card"><div class="p3CardHd"><h4>اثر ثبت‌شده</h4><span class="p3Badge">دفتر رویداد</span></div><p class="p3Muted">ETA: +'+fn(c.delay)+' روز · هزینه: +'+money(c.costDelta)+' · حاشیه: '+fn(c.marginPct)+'٪ · ریسک: '+fn(c.risk)+'</p><div class="p3Actions"><button class="p3Btn" data-scene="'+e.scene+'">صحنهٔ مرتبط</button><button class="p3Btn primary" id="p3CloseCapa">ثبت و بستن شبیه‌سازی</button></div></div></div>';var sc=stage.querySelector('[data-scene]');sc.onclick=function(){jump(+sc.dataset.scene);close()};$3('p3CloseCapa').onclick=function(){st.event='none';st.severity=1;choose('scenario')}}
 function containment(e){if(st.event==='redsea'||st.event==='strike'||st.event==='congestion')return 'توقف رزرو جدید، اطلاع‌رسانی مشتری و نگهداشت ظرفیت مسیر جایگزین.';if(st.event==='docs'||st.event==='customs')return 'توقف آزادسازی، قرنطینهٔ نسخهٔ ناسازگار و تکمیل دادهٔ مفقود.';if(st.event==='reefer')return 'حفظ زنجیرهٔ سرد، انتقال به تجهیز سالم و ثبت دادهٔ دما.';if(st.event==='sanctions')return 'توقف تراکنش و ظرفیت تا تصمیم مسئول انطباق.';return 'ثبت رویداد، تعیین مالک و پایش اثر.'}
 function corrective(e){if(st.event==='rollover')return 'بازرزرو روی سفر تأییدشده و اصلاح کنترل سهمیه/مهلت.';if(st.event==='docs')return 'اصلاح سند، همسان‌سازی فیلدها و تأیید چهارچشمی.';if(st.event==='customs')return 'رفع نقص اظهار و ارائهٔ شواهد تکمیلی.';return 'اجرای اقدام مالک و اعتبارسنجی نتیجه پیش از آزادسازی.'}
 function preventive(e){if(st.event==='none')return 'پایش روند و بازبینی دوره‌ای کنترل‌ها.';return 'به‌روزرسانی SOP، آستانهٔ هشدار و آموزش نقش‌های درگیر؛ سنجش اثربخشی پس از ۳۰ روز.'}
 function render(){document.querySelectorAll('.p3NavBtn').forEach(function(b){b.classList.toggle('on',b.dataset.p3view===view)});if(view==='scenario')renderScenario();else if(view==='whatif')renderWhatIf();else if(view==='routes')renderRoutes(false);else if(view==='crisis')renderCrisis();else if(view==='alternate')renderRoutes(true);else renderException();updateStatus()}
 $3('p3Launch').addEventListener('click',function(){open('scenario')});$3('p3Close').addEventListener('click',close);document.querySelectorAll('.p3NavBtn').forEach(function(b){b.onclick=function(){choose(b.dataset.p3view)}});window.addEventListener('keydown',function(e){var typing=/input|textarea|select/i.test((e.target.tagName||''));if(lab.classList.contains('on')){if(e.key==='Escape'||((e.key==='s'||e.key==='S')&&!typing)){e.preventDefault();e.stopImmediatePropagation();close();return}if(!typing){e.preventDefault();e.stopImmediatePropagation()}return}if(!(document.getElementById('p4Hub')&&document.getElementById('p4Hub').classList.contains('on'))&&!typing&&(e.key==='s'||e.key==='S')){e.preventDefault();e.stopImmediatePropagation();open('scenario')}} ,true);
})();


/* ===== PHASE 4 · REFERENCE INTELLIGENCE CONTROLLER ===== */
(function(){
 var $4=function(id){return document.getElementById(id)},hub=$4('p4Hub'),stage=$4('p4Stage'),view='assistant';
 var state={query:'',evidence:'all',demo:false,report:'executive',lastAnswer:null,discFilter:'all'};
 var aliases={
  'تاخیر':['تاخیر','تأخیر','delay','eta','rollover','ازدحام','اعتصاب'],
  'اسناد':['سند','اسناد','document','docs','si','hbl','mbl','vgm','pod','invoice'],
  'گمرک':['گمرک','customs','hs','اظهار','ترخیص','تحریم','sanctions'],
  'هزینه':['هزینه','cost','قیمت','نرخ','rate','حاشیه','margin','مالی','صورتحساب'],
  'ریسک':['ریسک','risk','بحران','exception','capa','کنترل','failure'],
  'مسیر':['مسیر','route','بندر','دریایی','هوایی','ریل','کریدور'],
  'کانتینر':['کانتینر','container','fcl','lcl','reefer','vgm','تجهیز'],
  'رزرو':['رزرو','booking','carrier','کریر','ظرفیت','allocation']
 };
 var connectors=[
  {id:'tms',code:'TMS',name:'مدیریت حمل',desc:'Shipment، milestone، route و exception',color:'#38e0c4'},
  {id:'erp',code:'ERP',name:'مالی و ERP',desc:'فاکتور، هزینه، پرداخت و تسویه',color:'#4da3ff'},
  {id:'crm',code:'CRM',name:'فروش و مشتری',desc:'RFQ، فرصت، قرارداد و مخاطب',color:'#b892ff'},
  {id:'wms',code:'WMS',name:'انبار و موجودی',desc:'Receipt، load plan و dispatch',color:'#ffb74d'},
  {id:'ais',code:'AIS',name:'موقعیت کشتی',desc:'Position، port call و ETA estimate',color:'#42d990'},
  {id:'edi',code:'EDI',name:'کریر / EDI',desc:'Booking، BL، manifest و status',color:'#ff8a65'},
  {id:'cus',code:'CUS',name:'گمرک',desc:'Declaration، release و inspection',color:'#56c6ff'},
  {id:'rate',code:'RATE',name:'نرخ‌های بازار',desc:'Buy-rate، surcharge و validity',color:'#d89cff'},
  {id:'bank',code:'FIN',name:'بانک و خزانه',desc:'Collection، FX و reconciliation',color:'#8cd17d'}
 ];
 var alerts=[
  {sev:'بحرانی',color:'#ff6577',title:'ریسک عبور از cutoff اسناد',body:'نسخهٔ SI و دادهٔ booking در پنجرهٔ کنترل همگرا نشده‌اند.',prob:86,horizon:'۶ ساعت',scene:10,owner:'مرکز اسناد'},
  {sev:'بالا',color:'#ff9d42',title:'افت قابلیت اتکای ETA',body:'الگوی ازدحام و تغییرات برنامه، احتمال +۲٫۸ روز تأخیر را نشان می‌دهد.',prob:74,horizon:'۴۸ ساعت',scene:58,owner:'برج کنترل'},
  {sev:'بالا',color:'#ff9d42',title:'احتمال نشت حاشیه',body:'ترکیب BAF و FX می‌تواند حاشیهٔ مرجع را ۶٫۴ واحد درصد کاهش دهد.',prob:68,horizon:'۷ روز',scene:5,owner:'Pricing'},
  {sev:'متوسط',color:'#4da3ff',title:'ریسک Demurrage / Detention',body:'Free time با ETA و برنامهٔ تخلیه هم‌پوشانی شکننده دارد.',prob:61,horizon:'۵ روز',scene:60,owner:'Import Ops'},
  {sev:'متوسط',color:'#4da3ff',title:'شکاف شواهد POD',body:'تحویل فیزیکی ثبت شده، اما بستهٔ POD هنوز کامل نیست.',prob:57,horizon:'۲۴ ساعت',scene:19,owner:'Last Mile'}
 ];
 var discrepancies=[
  {type:'conflict',title:'Booking ↔ Shipping Instruction',a:['Booking','وزن ناخالص: 18,420 kg'],b:['SI','وزن ناخالص: 18,240 kg'],field:'Gross weight',impact:'ریسک اصلاح سند و missed cutoff',scene:10},
  {type:'conflict',title:'HBL ↔ MBL',a:['HBL','تعداد بسته: 1,248'],b:['MBL','تعداد بسته: 1,284'],field:'Package count',impact:'Hold سندی در مقصد',scene:17},
  {type:'warn',title:'Quote ↔ Supplier invoice',a:['Quote','Ocean freight: USD 4,200'],b:['Invoice','Ocean freight: USD 4,480'],field:'Freight amount',impact:'کاهش حاشیه: USD 280',scene:20},
  {type:'warn',title:'Carrier ETA ↔ AIS estimate',a:['Carrier','ETA: 18 Oct'],b:['AIS model','ETA: 20 Oct'],field:'Estimated arrival',impact:'بازبرنامه‌ریزی تحویل',scene:58},
  {type:'conflict',title:'VGM ↔ Packing data',a:['VGM','21,930 kg'],b:['Packing list','21,340 kg'],field:'Verified gross mass',impact:'کنترل SOLAS لازم است',scene:9},
  {type:'warn',title:'Declared HS ↔ Description',a:['Declaration','HS 8504.40'],b:['Invoice text','Battery power unit'],field:'Classification',impact:'بازبینی چهارچشمی HS',scene:11},
  {type:'match',title:'POD ↔ Delivery timestamp',a:['POD','14:32'],b:['TMS milestone','14:34'],field:'Delivery completion',impact:'انطباق در تلورانس',scene:19}
 ];
 function esc(v){return String(v==null?'':v).replace(/[&<>\"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
 function num(n){return typeof faNum==='function'?faNum(String(n)):String(n)}
 function currentIndex(){try{return sceneAt(t)}catch(e){return 0}}
 function sceneTitle(i){return SCENES[i]?SCENES[i].ti:'صحنه'}
 function pageHead(k,t,p,tag){return '<div class="p4PageHead"><div><small>'+k+'</small><h3>'+t+'</h3></div><p>'+p+'</p></div>'+(tag?'<div class="p4Notice"><i></i><div>'+tag+'</div></div>':'')}
 function announce(x){$4('p4Announce').textContent=x}
 function jumpScene(i){if(typeof jump==='function')jump(i);close();announce('پرش به '+sceneTitle(i))}
 function norm(x){return String(x||'').toLowerCase().replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[أإ]/g,'ا').replace(/[^a-z0-9\u0600-\u06ff]+/g,' ').trim()}
 function terms(q){var n=norm(q),arr=n.split(/\s+/).filter(Boolean),extra=[];Object.keys(aliases).forEach(function(k){var a=aliases[k],hit=a.some(function(w){return n.indexOf(norm(w))>-1});if(hit)extra=extra.concat(a)});return arr.concat(extra.map(norm)).filter(function(x,i,z){return x&&z.indexOf(x)===i})}
 function evidenceLabel(x){return {VERIFIED:'واقعیت تأییدشده',CLAIM:'ادعا',INFERRED:'استنتاج',CONFLICT:'تعارض',UNKNOWN:'نامعلوم'}[x]||x||'مرجع'}
 function buildCorpus(){return SCENES.map(function(s,i){var m=SCENE_METRICS[i]||[],l=SCENE_LENS[i]||{},tr=SCENE_TRACE[i]||[];return {i:i,title:s.ti,chapter:s.ch,sub:s.sb||'',card:s.card||{},metric:m,lens:l,trace:tr,text:[s.ti,s.ch,s.sb,s.card&&s.card.tx,s.card&&s.card.sr,m.join(' '),l.r,l.o,l.c,l.f,tr.join(' ')].join(' ')}})}
 var corpus=buildCorpus();
 function rank(q,limit){var ts=terms(q);if(!ts.length)return [];return corpus.map(function(d){var all=norm(d.text),title=norm(d.title+' '+d.chapter),score=0,hits=[];ts.forEach(function(w){if(title.indexOf(w)>-1){score+=18;hits.push(w)}else if(all.indexOf(w)>-1){score+=7;hits.push(w)}if(norm((d.trace||[]).join(' ')).indexOf(w)>-1)score+=6});if(d.card.tr==='VERIFIED')score+=2;score+=Math.max(0,3-Math.abs(d.i-currentIndex())/20);return {d:d,score:score,hits:hits.filter(function(x,i,z){return z.indexOf(x)===i})}}).filter(function(x){return x.score>3}).sort(function(a,b){return b.score-a.score}).slice(0,limit||8)}
 function answer(q){var res=rank(q,4),intent='overview',n=norm(q);if(/ریسک|بحران|تاخیر|تأخیر/.test(n))intent='risk';else if(/سند|مغایرت|hbl|mbl|vgm|si/.test(n))intent='docs';else if(/هزینه|حاشیه|قیمت|نرخ/.test(n))intent='cost';else if(/مسیر|route|بندر/.test(n))intent='route';var lead;if(!res.length){lead='در بستهٔ مرجع، شاهد مستقیم و کافی برای این پرسش پیدا نشد. عبارت دقیق‌تر، کد عملیاتی یا نام سند را وارد کنید؛ این پاسخ عمداً از حدس‌زدن خودداری می‌کند.'}else if(intent==='risk'){lead='بر اساس شواهد مرجع، نقاط حساس عمدتاً به کنترل زمان، کامل‌بودن داده و مالکیت استثنا مربوط‌اند. اولویت پیشنهادی: اعتبارسنجی منبع، تعیین مالک، سپس ثبت اثر ETA و هزینه.'}else if(intent==='docs'){lead='زنجیرهٔ سند باید با کنترل چهارچشمی و تطبیق فیلدهای کلیدی پیش از cutoff بررسی شود. مغایرت وزن، تعداد بسته، HS یا نسخهٔ سند باید به‌عنوان exception ردیابی شود.'}else if(intent==='cost'){lead='تحلیل مرجع هزینه باید Buy-rate، surcharge، FX و هزینهٔ تأخیر را از Sell-price جدا کند. اختلاف منبع یا اعتبار نرخ، قبل از گزارش حاشیه نیازمند تأیید انسانی است.'}else if(intent==='route'){lead='انتخاب مسیر به موازنهٔ زمان، هزینه، ظرفیت، قابلیت اتکا و ریسک وابسته است. خروجی این مرکز توصیهٔ مرجع است و نرخ یا ETA زنده محسوب نمی‌شود.'}else{lead='نزدیک‌ترین شواهد در مدل ۷۵ صحنه‌ای بازیابی شد. نتیجه با سطح شواهد، کنترل، مالک و شناسه‌های ردیابی ارائه می‌شود تا قابل بازبینی باشد.'}return {q:q,lead:lead,res:res,confidence:res.length?Math.min(94,52+res[0].score*1.7):18}}
 function sources(a){if(!a.res.length)return '<div class="p4Empty">هیچ منبع هم‌معنای کافی پیدا نشد.</div>';return '<div class="p4Ground">'+a.res.map(function(x){var d=x.d;return '<button class="p4Source" data-jump="'+d.i+'"><b>'+esc(d.title)+'</b><span>'+esc(evidenceLabel(d.card.tr))+' · '+esc(d.card.sr||'منبع مرجع')+' · '+esc((d.trace||[]).join(' / '))+'</span></button>'}).join('')+'</div>'}
 function bindJumps(){stage.querySelectorAll('[data-jump]').forEach(function(b){b.onclick=function(){jumpScene(+b.dataset.jump)}})}
 function renderAssistant(){var idx=currentIndex(),a=state.lastAnswer||answer('کنترل‌ها و ریسک‌های صحنه جاری '+sceneTitle(idx));state.lastAnswer=a;stage.innerHTML=pageHead('REFERENCE INTELLIGENCE','دستیار هوشمند عملیات','پاسخ‌های توضیح‌پذیر از روی ۷۵ صحنه، شاخص‌ها، لنزهای کنترلی و Trace IDها؛ بدون ارسال داده به سرویس بیرونی.','این موتور یک لایهٔ بازیابی و استدلال قاعده‌محور آفلاین است؛ «مدل زبانی زنده» یا اتصال عملیاتی واقعی نیست.')+'<div class="p4Grid2" style="margin-top:12px"><section class="p4Card"><div class="p4CardHd"><h4>پرسش از مدل عملیاتی</h4><span class="p4Badge live">زمینه: صحنه '+num(idx+1)+'</span></div><div class="p4Prompt"><input class="p4Input" id="p4Ask" aria-label="پرسش عملیاتی" value="'+esc(a.q)+'"><button class="p4Btn primary" id="p4AskBtn">تحلیل</button></div><div class="p4Chips"><button class="p4Chip">ریسک‌های تأخیر چیست؟</button><button class="p4Chip">کنترل مغایرت اسناد</button><button class="p4Chip">علت نشت حاشیه</button><button class="p4Chip">مسیر جایگزین مناسب</button></div><div class="p4Answer" id="p4Answer"><div class="p4AnswerLead">'+esc(a.lead)+'</div>'+sources(a)+'<div class="p4Confidence"><span>اطمینان بازیابی '+num(Math.round(a.confidence))+'٪</span><div><i style="width:'+a.confidence+'%"></i></div><span>تأیید انسانی لازم</span></div></div></section><aside class="p4Card"><div class="p4CardHd"><h4>زمینهٔ فعال</h4><span class="p4Badge">Grounding</span></div><h4 style="font:800 14px/1.7 Tahoma;margin:0">'+esc(sceneTitle(idx))+'</h4><p class="p4Muted">'+esc(SCENES[idx].sb||'')+'</p><div class="p4Meta"><span class="p4Tag">'+esc(SCENES[idx].ch)+'</span><span class="p4Tag">'+esc(evidenceLabel(SCENES[idx].card.tr))+'</span><span class="p4Tag">'+esc((SCENE_TRACE[idx]||[]).join(' / '))+'</span></div><div class="p4Card" style="margin-top:13px;background:#07121d"><div class="p4Muted">مالک</div><b style="display:block;margin:5px 0 11px;font:800 11px Tahoma">'+esc(SCENE_LENS[idx].r)+'</b><div class="p4Muted">کنترل</div><b style="display:block;margin-top:5px;font:800 11px Tahoma">'+esc(SCENE_LENS[idx].c)+'</b></div></aside></div>';function run(){var q=$4('p4Ask').value.trim();if(!q)return;state.lastAnswer=answer(q);renderAssistant();announce('پاسخ مرجع آماده شد')} $4('p4AskBtn').onclick=run;$4('p4Ask').onkeydown=function(e){if(e.key==='Enter')run()};stage.querySelectorAll('.p4Chip').forEach(function(b){b.onclick=function(){$4('p4Ask').value=b.textContent;run()}});bindJumps()}
 function resultHtml(x,max){var d=x.d,p=Math.max(32,Math.min(97,Math.round(x.score/(max||1)*96)));return '<article class="p4Result"><div class="p4Score" style="--score:'+p+'%"><b>'+num(p)+'</b></div><div><h4>'+esc(d.title)+'</h4><p>'+esc(d.sub||d.card.tx||'')+'</p><div class="p4Meta"><span class="p4Tag">'+esc(d.chapter)+'</span><span class="p4Tag">'+esc(evidenceLabel(d.card.tr))+'</span><span class="p4Tag">'+esc((d.trace||[]).join(' · '))+'</span></div></div><button class="p4Btn" data-jump="'+d.i+'">بازکردن صحنه</button></article>'}
 function renderSearch(){var q=state.query||'اسناد و کنترل گمرکی',res=rank(q,10),max=res[0]?res[0].score:1;if(state.evidence!=='all')res=res.filter(function(x){return x.d.card.tr===state.evidence});stage.innerHTML=pageHead('SEMANTIC RETRIEVAL','جست‌وجوی معنایی در مدل','تطبیق فارسی/انگلیسی، کدهای دامنه و مترادف‌ها با امتیازدهی به عنوان، شرح، کنترل، KPI و Trace ID.','امتیاز شباهت، احتمال یا واقعیت عملیاتی نیست؛ فقط قوت ارتباط با پرسش را نشان می‌دهد.')+'<div class="p4Card" style="margin-top:12px"><div class="p4SearchBar"><input class="p4Input" id="p4SearchInput" value="'+esc(q)+'" aria-label="جست‌وجوی معنایی"><select class="p4Select" id="p4Evidence"><option value="all">همهٔ سطوح شواهد</option><option value="VERIFIED">تأییدشده</option><option value="CLAIM">ادعا</option><option value="INFERRED">استنتاج</option><option value="CONFLICT">تعارض</option><option value="UNKNOWN">نامعلوم</option></select><button class="p4Btn primary" id="p4SearchGo">جست‌وجو</button></div><div class="p4Results">'+(res.length?res.map(function(x){return resultHtml(x,max)}).join(''):'<div class="p4Empty">نتیجه‌ای با این سطح شواهد یافت نشد.</div>')+'</div></div>';$4('p4Evidence').value=state.evidence;function go(){state.query=$4('p4SearchInput').value.trim();state.evidence=$4('p4Evidence').value;renderSearch()}$4('p4SearchGo').onclick=go;$4('p4SearchInput').onkeydown=function(e){if(e.key==='Enter')go()};$4('p4Evidence').onchange=go;bindJumps()}
 function renderConnectors(){var active=state.demo?connectors.length:0;stage.innerHTML=pageHead('OPTIONAL DATA FABRIC','مرکز اتصال‌دهنده‌های عملیاتی','وضعیت اتصال‌های بالقوه برای TMS، ERP، CRM، WMS، AIS، کریر، گمرک، نرخ و مالی.','همهٔ اتصال‌ها در شروع «قطع» هستند. حالت نمایش فقط دادهٔ ساختگی محلی تولید می‌کند و هیچ API، حساب یا دادهٔ زنده‌ای متصل نیست.')+'<div class="p4Stats" style="margin-top:12px"><div class="p4Stat"><span>اتصال واقعی</span><b>۰</b></div><div class="p4Stat"><span>حالت نمایش</span><b>'+num(active)+'</b></div><div class="p4Stat"><span>خطای اتصال</span><b>۰</b></div><div class="p4Stat"><span>آخرین همگام‌سازی</span><b style="font-size:12px">'+(state.demo?'همین حالا':'—')+'</b></div></div><div class="p4Actions" style="margin:0 0 12px"><button class="p4Btn '+(state.demo?'':'primary')+'" id="p4Demo">'+(state.demo?'خاموش‌کردن حالت نمایش':'فعال‌کردن حالت نمایش')+'</button><span class="p4Badge '+(state.demo?'live':'warn')+'">'+(state.demo?'DEMO · دادهٔ ساختگی':'DISCONNECTED · بدون دادهٔ زنده')+'</span></div><div class="p4ConnectorGrid">'+connectors.map(function(c){return '<article class="p4Card p4Connector" style="--cc:'+c.color+'"><div class="p4ConnIcon">'+c.code+'</div><h4>'+c.name+'</h4><p>'+c.desc+'</p><div class="p4ConnFoot"><span class="p4Badge '+(state.demo?'live':'')+'">'+(state.demo?'نمایشی':'قطع')+'</span><button class="p4Switch '+(state.demo?'on':'')+'" aria-label="'+(state.demo?'حالت نمایش فعال':'اتصال قطع')+'" data-conn="'+c.id+'"></button></div></article>'}).join('')+'</div>'+(state.demo?'<div class="p4Card" style="margin-top:12px"><div class="p4CardHd"><h4>جریان رویداد نمایشی</h4><span class="p4Badge live"><i class="p4Pulse"></i> local stream</span></div><div class="p4Feed"><div class="p4FeedRow"><span>۱۲:۰۴:۲۱</span><b>AIS ETA estimate updated</b><span>نمایشی</span></div><div class="p4FeedRow"><span>۱۲:۰۳:۰۸</span><b>Carrier booking status → Confirmed</b><span>نمایشی</span></div><div class="p4FeedRow"><span>۱۲:۰۱:۴۴</span><b>Invoice discrepancy detected</b><span>نمایشی</span></div></div></div>':'');$4('p4Demo').onclick=function(){state.demo=!state.demo;renderConnectors();announce(state.demo?'حالت نمایش فعال شد':'همهٔ اتصال‌ها قطع شدند')};stage.querySelectorAll('[data-conn]').forEach(function(b){b.onclick=function(){state.demo=!state.demo;renderConnectors()}})}
 function renderAlerts(){var risk=Math.round(alerts.reduce(function(a,x){return a+x.prob},0)/alerts.length),bars=[24,30,27,34,41,38,48,55,49,63,71,68,79,86,74,69,62,58];stage.innerHTML=pageHead('SIMULATED PREDICTION','هشدارهای پیش‌بینانه','سیگنال‌های سناریویی برای اولویت‌بندی اقدام؛ مبتنی بر آستانه‌ها و دادهٔ مرجع، نه پیش‌بینی زنده.','این هشدارها «شبیه‌سازی‌شده» هستند. برای تصمیم عملیاتی باید با دادهٔ واقعی و مالک فرایند اعتبارسنجی شوند.')+'<div class="p4Stats" style="margin-top:12px"><div class="p4Stat"><span>هشدار فعال</span><b>'+num(alerts.length)+'</b></div><div class="p4Stat"><span>بحرانی / بالا</span><b>۳</b></div><div class="p4Stat"><span>امتیاز ریسک</span><b>'+num(risk)+'</b></div><div class="p4Stat"><span>پوشش پیش‌بینی</span><b>۷ روز</b></div></div><div class="p4Grid2"><section class="p4Card"><div class="p4CardHd"><h4>صف هشدارهای اولویت‌دار</h4><span class="p4Badge bad">SIMULATED</span></div><div class="p4AlertList">'+alerts.map(function(a){return '<article class="p4Alert" style="--ac:'+a.color+'"><i></i><div><h4>'+a.title+'</h4><p>'+a.body+' · مالک: '+a.owner+'</p><div class="p4DiscActions"><button class="p4Chip" data-jump="'+a.scene+'">صحنه '+num(a.scene+1)+'</button></div></div><div class="p4AlertSide"><b>'+num(a.prob)+'%</b><span>'+a.sev+' · '+a.horizon+'</span></div></article>'}).join('')+'</div></section><aside class="p4Card"><div class="p4CardHd"><h4>افق ریسک مرکب</h4><span class="p4Badge">۷۲ ساعت</span></div><p class="p4Muted">روند نمایشی از تجمیع cutoff، ETA، حاشیه و شواهد سندی.</p><div class="p4Timeline">'+bars.map(function(h){return '<i style="--h:'+h+'%"></i>'}).join('')+'</div><div class="p4Card" style="margin-top:14px;background:#07131f"><span class="p4Muted">اقدام پیشنهادی</span><h4 style="font:800 13px/1.8 Tahoma;margin:6px 0">بازبینی SI پیش از cutoff و هم‌زمان‌سازی ETA</h4><p class="p4Muted">مالک انسانی باید منبع، شدت و اثر مالی را تأیید کند.</p></div><button class="p4Btn" id="p4Recalc" style="width:100%;margin-top:10px">بازمحاسبهٔ نمایشی</button></aside></div>';$4('p4Recalc').onclick=function(){alerts.forEach(function(a,i){a.prob=Math.max(38,Math.min(92,a.prob+(i%2?2:-1)))});renderAlerts();announce('هشدارهای نمایشی بازمحاسبه شدند')};bindJumps()}
 function renderDiscrepancy(){var arr=discrepancies.filter(function(d){return state.discFilter==='all'||d.type===state.discFilter}),counts={conflict:0,warn:0,match:0};discrepancies.forEach(function(d){counts[d.type]++});stage.innerHTML=pageHead('FIELD-LEVEL CONTROL','کشف مغایرت اسناد و داده','مقایسهٔ فیلدبه‌فیلد booking، SI، HBL/MBL، فاکتور، ETA، VGM، HS و POD.','موارد زیر مجموعه‌دادهٔ نمایشی‌اند؛ کشف واقعی نیازمند اتصال و نگاشت schema است. هیچ سند واقعی پردازش نشده است.')+'<div class="p4Stats" style="margin-top:12px"><div class="p4Stat"><span>تعارض قطعی</span><b style="color:#ff6577">'+num(counts.conflict)+'</b></div><div class="p4Stat"><span>نیازمند بازبینی</span><b style="color:#ffb74d">'+num(counts.warn)+'</b></div><div class="p4Stat"><span>همخوان</span><b style="color:#42d990">'+num(counts.match)+'</b></div><div class="p4Stat"><span>فیلد مقایسه‌شده</span><b>۷</b></div></div><div class="p4Card"><div class="p4CardHd"><h4>صف کنترل مغایرت</h4><div class="p4Chips" style="margin:0"><button class="p4Chip" data-filter="all">همه</button><button class="p4Chip" data-filter="conflict">تعارض</button><button class="p4Chip" data-filter="warn">بازبینی</button><button class="p4Chip" data-filter="match">همخوان</button></div></div><div class="p4DiscList">'+arr.map(function(d){var color=d.type==='conflict'?'#ff6577':d.type==='warn'?'#ffb74d':'#42d990',lab=d.type==='conflict'?'تعارض':d.type==='warn'?'بازبینی':'همخوان';return '<article class="p4Disc" style="--ac:'+color+'"><i></i><div><h4>'+d.title+' <span class="p4Badge '+(d.type==='conflict'?'bad':d.type==='warn'?'warn':'live')+'">'+lab+'</span></h4><div class="p4Compare"><div><span>'+d.a[0]+'</span><b>'+d.a[1]+'</b></div><em>≠</em><div><span>'+d.b[0]+'</span><b>'+d.b[1]+'</b></div></div><p style="margin-top:8px">فیلد: '+d.field+' · اثر: '+d.impact+'</p><div class="p4DiscActions"><button class="p4Chip" data-jump="'+d.scene+'">شاهد صحنه</button>'+(d.type!=='match'?'<button class="p4Chip" data-review>ارسال برای تأیید انسانی</button>':'')+'</div></div><div class="p4AlertSide"><b style="color:'+color+'">'+(d.type==='match'?'PASS':'CHECK')+'</b><span>قاعدهٔ تطبیق</span></div></article>'}).join('')+'</div></div>';stage.querySelectorAll('[data-filter]').forEach(function(b){b.onclick=function(){state.discFilter=b.dataset.filter;renderDiscrepancy()}});stage.querySelectorAll('[data-review]').forEach(function(b){b.onclick=function(){b.textContent='در صف بازبینی انسانی';b.disabled=true;announce('مورد به صف بازبینی انسانی افزوده شد')}});bindJumps()}
 var reportNames={scene:'خلاصهٔ صحنه',route:'یادداشت تصمیم مسیر',crisis:'گزارش اثر بحران',capa:'گزارش ریسک و CAPA',executive:'خلاصهٔ اجرایی عملیات'};
 function reportData(){var idx=currentIndex(),s=SCENES[idx],m=SCENE_METRICS[idx],l=SCENE_LENS[idx],type=state.report,title=reportNames[type],sections=[];if(type==='scene')sections=[['وضعیت',s.ti+' — '+s.sb],['مالک و خروجی',l.r+'؛ خروجی: '+l.o],['کنترل و شکست محتمل',l.c+'؛ '+l.f],['شواهد',evidenceLabel(s.card.tr)+'؛ '+s.card.sr+'؛ '+(SCENE_TRACE[idx]||[]).join(' / ')]];else if(type==='route')sections=[['تصمیم پیشنهادی','مقایسهٔ مسیر مستقیم دریایی با گزینه‌های ریل و دریا–هوا بر مبنای زمان، هزینه، ریسک، ظرفیت و کربن.'],['شرط تصمیم','ETA و نرخ‌ها مرجع/نمایشی‌اند؛ اعتبار نرخ و ظرفیت باید از منبع زنده تأیید شود.'],['دروازهٔ انسانی','تغییر مسیر با اثر مالی یا انطباقی نیازمند تأیید مالک مسیر و Pricing است.']];else if(type==='crisis')sections=[['رخداد مرجع','افت قابلیت اتکا در اثر ازدحام/تغییر برنامه؛ افق اثر ۴۸ ساعت.'],['اثر مدل','ETA: +۲٫۸ روز؛ احتمال افزایش هزینه و کاهش حاشیه.'],['اقدام','اعتبارسنجی کریر و AIS، اطلاع‌رسانی مشتری، بررسی مسیر جایگزین و ثبت exception.']];else if(type==='capa')sections=[['مسئله','مغایرت دادهٔ سندی یا عملیاتی با ریسک عبور از cutoff.'],['مهار فوری','توقف انتشار نسخهٔ ناسازگار و تعیین منبع معتبر.'],['اقدام اصلاحی','تطبیق فیلد، کنترل چهارچشمی و ثبت شواهد تصمیم.'],['اقدام پیشگیرانه','قواعد validation، مالکیت master data و هشدار پیش از cutoff.']];else sections=[['نمای مدیریتی','شبکهٔ ۷۵ صحنه‌ای از تقاضا تا تسویه با تمرکز بر کنترل، ریسک و ردیابی‌پذیری مرور شد.'],['سیگنال‌های اولویت‌دار','ریسک cutoff اسناد، نوسان ETA، نشت حاشیه و تکمیل‌نشدن POD.'],['تصمیم‌های لازم','۱) اعتبارسنجی SI؛ ۲) هم‌زمان‌سازی ETA؛ ۳) بازبینی حاشیه؛ ۴) تعیین مالک exception.'],['محدودیت داده','این خروجی از دادهٔ مرجع و سناریوی محلی تولید شده؛ اتصال زنده وجود ندارد و اعداد باید تأیید شوند.']];return {title:title,scene:idx+1,generated:new Date().toLocaleString('fa-IR'),sections:sections,metric:m}}
 function reportHtml(d){return '<div class="p4ReportTitle"><span class="p4Badge live">AUTO-DRAFT · نیازمند تأیید</span><h4>'+d.title+'</h4><p class="p4Muted">شناسه: REF-'+String(d.scene).padStart(3,'0')+' · تولید محلی: '+d.generated+'</p></div><div class="p4ReportBody">'+d.sections.map(function(x){return '<h5>'+x[0]+'</h5><p>'+x[1]+'</p>'}).join('')+'<h5>ردیابی</h5><p>صحنه '+num(d.scene)+' · '+esc(sceneTitle(d.scene-1))+' · '+esc((SCENE_TRACE[d.scene-1]||[]).join(' / '))+'</p></div>'}
 function download(name,text,type){var a=document.createElement('a'),blob=new Blob([text],{type:type||'text/plain;charset=utf-8'});a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500)}
 function renderReports(){var d=reportData();stage.innerHTML=pageHead('CLIENT-SIDE REPORTING','گزارش‌ساز خودکار','ساخت پیش‌نویس مدیریتی، تصمیم مسیر، بحران، ریسک/CAPA یا خلاصهٔ صحنه با خروجی TXT و JSON.','گزارش‌ها در مرورگر و از دادهٔ مرجع تولید می‌شوند؛ برچسب AUTO-DRAFT تا زمان بازبینی و تأیید انسانی حفظ می‌شود.')+'<div class="p4ReportTypes" style="margin-top:12px">'+Object.keys(reportNames).map(function(k){return '<button class="p4ReportType '+(state.report===k?'on':'')+'" data-report="'+k+'"><b>'+reportNames[k]+'</b>پیش‌نویس ردیابی‌پذیر</button>'}).join('')+'</div><article class="p4Card p4Report" id="p4Report">'+reportHtml(d)+'</article><div class="p4Actions"><button class="p4Btn primary" id="p4Txt">دریافت TXT</button><button class="p4Btn" id="p4Json">دریافت JSON</button><button class="p4Btn" id="p4Print">چاپ / PDF</button><button class="p4Btn" data-jump="'+(d.scene-1)+'">بازکردن صحنهٔ مرجع</button></div>';stage.querySelectorAll('[data-report]').forEach(function(b){b.onclick=function(){state.report=b.dataset.report;renderReports()}});$4('p4Txt').onclick=function(){var x=reportData(),txt=x.title+'\n'+'شناسه: REF-'+String(x.scene).padStart(3,'0')+'\n\n'+x.sections.map(function(s){return s[0]+'\n'+s[1]}).join('\n\n');download('phase4-report-fa.txt',txt)};$4('p4Json').onclick=function(){download('phase4-report-fa.json',JSON.stringify(reportData(),null,2),'application/json;charset=utf-8')};$4('p4Print').onclick=function(){window.print()};bindJumps()}
 function render(){document.querySelectorAll('.p4NavBtn').forEach(function(b){b.classList.toggle('on',b.dataset.p4view===view)});if(view==='assistant')renderAssistant();else if(view==='search')renderSearch();else if(view==='connectors')renderConnectors();else if(view==='alerts')renderAlerts();else if(view==='discrepancy')renderDiscrepancy();else renderReports();stage.scrollTop=0}
 function open(v){if(document.getElementById('p3Lab'))document.getElementById('p3Lab').classList.remove('on');if(document.getElementById('p2Workspace'))document.getElementById('p2Workspace').classList.remove('on');document.querySelectorAll('.p1Panel.on').forEach(function(x){x.classList.remove('on');x.setAttribute('aria-hidden','true')});view=v||'assistant';hub.classList.add('on');hub.setAttribute('aria-hidden','false');$4('p4Launch').setAttribute('aria-expanded','true');playing=false;render();setTimeout(function(){$4('p4Close').focus()},60)}
 function close(){hub.classList.remove('on');hub.setAttribute('aria-hidden','true');$4('p4Launch').setAttribute('aria-expanded','false');$4('p4Launch').focus()}
 $4('p4Launch').addEventListener('click',function(){open('assistant')});$4('p4Close').addEventListener('click',close);document.querySelectorAll('.p4NavBtn').forEach(function(b){b.onclick=function(){view=b.dataset.p4view;render()}});
 window.addEventListener('keydown',function(e){var typing=/input|textarea|select/i.test((e.target.tagName||''));if(hub.classList.contains('on')){if(e.key==='Escape'||((e.key==='i'||e.key==='I')&&!typing)){e.preventDefault();e.stopImmediatePropagation();close();return}if(!typing){e.preventDefault();e.stopImmediatePropagation()}return}if(!typing&&(e.key==='i'||e.key==='I')){e.preventDefault();e.stopImmediatePropagation();open('assistant')}} ,true);
})();


/* motion dynamics UI */
(function(){var p=document.getElementById('mdPanel'),b=document.getElementById('motionTune'),range=document.getElementById('mdTrail'),cam=document.getElementById('mdCamera'),ops=document.getElementById('mdOps'),sh=document.getElementById('mdShadow'),lab=document.getElementById('mdStateLabel');if(!p||!b)return;function sync(){cam.classList.toggle('on',MD.camera);ops.classList.toggle('on',MD.ops);sh.classList.toggle('on',MD.shadow);lab.textContent='رد '+(typeof faNum==='function'?faNum(Math.round(MD.trail*100)):Math.round(MD.trail*100))+'٪ · عملیات '+(MD.ops?'فعال':'خاموش')}b.onclick=function(){var on=!p.classList.contains('on');p.classList.toggle('on',on);p.setAttribute('aria-hidden',on?'false':'true');b.setAttribute('aria-expanded',on?'true':'false')};range.oninput=function(){MD.trail=+range.value/100;sync()};cam.onclick=function(){MD.camera=!MD.camera;sync()};ops.onclick=function(){MD.ops=!MD.ops;sync()};sh.onclick=function(){MD.shadow=!MD.shadow;sync()};window.addEventListener('keydown',function(e){if(!/input|textarea|select/i.test((e.target.tagName||''))&&(e.key==='g'||e.key==='G')&&!(document.getElementById('p4Hub')&&document.getElementById('p4Hub').classList.contains('on'))){e.preventDefault();b.click()}},true);sync()})();


/* presentation theme controller */
(function(){
 var body=document.body,p=document.getElementById('vtPanel'),launch=document.getElementById('themeTune'),label=document.getElementById('vtStateLabel');if(!p||!launch)return;
 var names={default:'سینمایی اصلی',mono:'Monochrome مدیریتی',light:'روشن',contrast:'کنتراست بالا'};
 var palette={bg:C.bg,g1:C.g1,g2:C.g2,ink:C.ink,dim:C.dim,cargo:C.cargo,info:C.info,money:C.money,risk:C.risk,rel:C.rel,bd:C.bd,bdL:C.bdL,bdD:C.bdD,tp:C.tp,tpL:C.tpL,hq:C.hq,port:C.port,gate:C.gate,pad:C.pad,twr:C.twr,warn:C.warn};
 function canvasTheme(mode){Object.keys(palette).forEach(function(k){C[k]=palette[k]});if(mode==='mono'){C.bg='#080a0d';C.g1='#15191f';C.g2='#252b33';C.ink='#f4f4f4';C.dim='#a4a8ad';C.cargo='#d7d7d7';C.info='#f2f2f2';C.money='#bababa';C.risk='#ffffff';C.rel='#72777d';C.hq='#e5e5e5';C.warn='#fff'}else if(mode==='light'){C.bg='#e9eff5';C.g1='#d6e0e9';C.g2='#bdcbd8';C.ink='#16273b';C.dim='#536b82';C.cargo='#cc5f00';C.info='#007b9c';C.money='#08784c';C.risk='#c62e46';C.rel='#75869a';C.bd='#b8c7d5';C.bdL='#93a9bc';C.bdD='#d6e0e9';C.tp='#7193ad';C.tpL='#456e8c';C.hq='#c77700';C.port='#4b8ca8';C.gate='#8059a0';C.pad='#a7b9c9';C.twr='#168c80';C.warn='#a86600'}else if(mode==='contrast'){C.bg='#000000';C.g1='#101010';C.g2='#484848';C.ink='#ffffff';C.dim='#ffffff';C.cargo='#ff9d00';C.info='#00e5ff';C.money='#00ff8a';C.risk='#ff3157';C.rel='#b7c8ff';C.bd='#111';C.bdL='#3b4b62';C.bdD='#000';C.tp='#39bfff';C.tpL='#fff';C.hq='#ffd000';C.port='#00c8ff';C.gate='#d9a0ff';C.pad='#203655';C.twr='#00ffd0';C.warn='#ffea00'}
 }
 function updateNodePalette(mode){if(!window.NODES)return;NODES.forEach(function(n){if(mode==='light'){if(n.kind==='hq')n.col=C.hq;else if(n.kind==='port')n.col=C.port;else if(n.kind==='gate')n.col=C.gate;else if(n.kind==='pad')n.col=C.pad;else if(n.kind==='tower')n.col=C.twr;else n.col=C.bdL}else if(mode==='contrast'){if(n.kind==='hq')n.col=C.hq;else if(n.kind==='port')n.col=C.port;else if(n.kind==='gate')n.col=C.gate;else if(n.kind==='tower')n.col=C.twr;else n.col=C.bdL}else if(mode==='mono'){n.col=n.kind==='hq'?'#ededed':n.kind==='tower'?'#cfcfcf':n.kind==='port'?'#929292':n.kind==='gate'?'#b7b7b7':'#5f656c'}else{if(n.kind==='hq')n.col=palette.hq;else if(n.kind==='port')n.col=palette.port;else if(n.kind==='gate')n.col=palette.gate;else if(n.kind==='pad')n.col=palette.pad;else if(n.kind==='tower')n.col=palette.twr;else n.col=palette.bdL}})}
 function apply(mode,save){if(!names[mode])mode='default';body.classList.remove('theme-mono','theme-light','theme-contrast');if(mode!=='default')body.classList.add('theme-'+mode);body.dataset.theme=mode;canvasTheme(mode);updateNodePalette(mode);document.querySelectorAll('.vtMode').forEach(function(b){var on=b.dataset.theme===mode;b.classList.toggle('on',on);b.setAttribute('aria-checked',on?'true':'false')});label.textContent=names[mode];if(save){try{localStorage.setItem('ff-presentation-theme',mode)}catch(e){}}var live=document.getElementById('live');if(live)live.textContent='تم '+names[mode]+' فعال شد'}
 launch.onclick=function(){var on=!p.classList.contains('on'),mp=document.getElementById('mdPanel');if(mp){mp.classList.remove('on');mp.setAttribute('aria-hidden','true');var mb=document.getElementById('motionTune');if(mb)mb.setAttribute('aria-expanded','false')}p.classList.toggle('on',on);p.setAttribute('aria-hidden',on?'false':'true');launch.setAttribute('aria-expanded',on?'true':'false')};
 document.querySelectorAll('.vtMode').forEach(function(b){b.onclick=function(){apply(b.dataset.theme,true)}});
 window.addEventListener('keydown',function(e){if(/input|textarea|select/i.test((e.target.tagName||'')))return;if((e.key==='t'||e.key==='T')&&!(document.getElementById('p4Hub')&&document.getElementById('p4Hub').classList.contains('on'))){e.preventDefault();launch.click()}},true);
 var start='default';try{start=localStorage.getItem('ff-presentation-theme')||'default'}catch(e){}apply(start,false);
 window.setPresentationTheme=apply;
})();

requestAnimationFrame(frame);

