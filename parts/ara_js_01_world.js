/* ================= WORLD: NODES (platform data architecture) ================= */
/* kinds: src | ingest | store | engine | block | gate | tower | decision | serve | audit */
/* rows (isometric depth):  y = -34 .. -30 governance/roadmap · -24 audit · -16 decision
                           y = -8 registries · 0 gate/store · 8 sources · 16 compute grid  */
var NODES=[
/* ── ردیف A · منابع داده (y=8) ─────────────────────────────────────────── */
{id:'remote',x:-54,y:8,kind:'src',fa:'سنجش از دور ماهواره‌ای',w:9,d:8,h:4,col:C.src},
{id:'climate',x:-42,y:8,kind:'src',fa:'اقلیم، آب و کیفیت هوا',w:9,d:8,h:4,col:C.src},
{id:'maps',x:-30,y:8,kind:'src',fa:'نقشه، معابر و خدمات عمومی',w:9,d:8,h:4,col:C.src},
{id:'officialsrc',x:-18,y:8,kind:'src',fa:'منابع رسمی و رجیستری‌های ملی',w:9,d:8,h:4,col:C.src},
{id:'survey',x:-6,y:8,kind:'src',fa:'پیمایش میدانی و ادراکی',w:9,d:8,h:4,col:C.src},
{id:'benchmark',x:6,y:8,kind:'src',fa:'بنچمارک بین‌الملل و کلان',w:9,d:8,h:4,col:C.src},
{id:'satpipe',x:18,y:8,kind:'src',fa:'خط لولهٔ ماهواره‌ای (STAC)',w:10,d:6,h:3,col:C.src},

/* ── ردیف B · ورود، دروازه و انبار داده (y=0) ───────────────────────────── */
{id:'proxy',x:-50,y:0,kind:'ingest',fa:'پروکسی دادهٔ بیرونی',w:11,d:8,h:5,col:C.ingest},
{id:'gateway',x:-37,y:0,kind:'gate',fa:'دروازهٔ منابع (منیفست)',w:7,d:9,h:7,col:C.ingest,big:1},
{id:'cache',x:-24,y:0,kind:'store',fa:'کش تازه / کهنه',w:8,d:6,h:3,col:C.ingest},
{id:'ingest',x:-11,y:0,kind:'ingest',fa:'موتور ورود داده',w:10,d:8,h:5,col:C.ingest},
{id:'valid',x:3,y:0,kind:'gate',fa:'اعتبارسنج و دروازهٔ کیفیت',w:7,d:9,h:7,col:C.ingest},
{id:'evidence',x:16,y:0,kind:'store',fa:'دفتر شواهد منابع',w:9,d:7,h:4,col:C.store},
{id:'reject',x:29,y:0,kind:'audit',fa:'صف رد و بازگشت',w:7,d:6,h:3,col:C.risk},

/* ── ردیف C · رجیسترها و کاتالوگ (y=-9) ────────────────────────────────── */
{id:'reg419',x:-52,y:-9,kind:'store',fa:'رجیستر ۴۱۹ شاخص مادر',w:10,d:7,h:5,col:C.store},
{id:'reg164',x:-39,y:-9,kind:'store',fa:'رجیستر ۱۶۴ شاخص تصمیم‌یار',w:10,d:7,h:5,col:C.store},
{id:'regcore',x:-26,y:-9,kind:'store',fa:'هستهٔ ۴۰ و سنجهٔ برخط ۸۳',w:10,d:7,h:5,col:C.store},
{id:'regsrc',x:-13,y:-9,kind:'store',fa:'رجیستر منابع و رویه‌های ۲۵گانه',w:10,d:7,h:5,col:C.store},
{id:'regweights',x:0,y:-9,kind:'store',fa:'رجیستر وزن، آستانه و نسخهٔ محاسبه',w:11,d:7,h:5,col:C.store},
{id:'regq',x:14,y:-9,kind:'store',fa:'پرسش‌نامه و شاخص ادراکی',w:9,d:7,h:4,col:C.store},

/* ── ردیف D · هستهٔ محاسبات و موتورها (y=-18) ──────────────────────────── */
{id:'kernel',x:-46,y:-18,kind:'engine',fa:'هستهٔ محاسبات (Kernel)',w:13,d:13,h:12,col:C.kernel},
{id:'normalize',x:-28,y:-18,kind:'engine',fa:'مهندسی شاخص و نرمال‌سازی',w:11,d:9,h:6,col:C.kernel},
{id:'weight',x:-13,y:-18,kind:'engine',fa:'موتور وزن‌دهی و تجمیع',w:11,d:9,h:6,col:C.kernel},
{id:'chain',x:2,y:-18,kind:'engine',fa:'زنجیرهٔ C-A-U-E-O',w:10,d:9,h:6,col:C.analyze},
{id:'quality',x:16,y:-18,kind:'engine',fa:'سنجهٔ Q · T · R (جدا)',w:10,d:9,h:7,col:C.analyze},
{id:'confidence',x:30,y:-18,kind:'engine',fa:'موتور اطمینان شواهد',w:11,d:9,h:6,col:C.analyze},
{id:'bottleneck',x:44,y:-18,kind:'engine',fa:'موتور تشخیص گلوگاه',w:11,d:9,h:7,col:C.analyze},

/* ── ردیف E · تحلیل، توصیه و تصمیم (y=-27) ─────────────────────────────── */
{id:'diagnosis',x:-32,y:-27,kind:'engine',fa:'تشخیص علّی و عدالت',w:11,d:9,h:6,col:C.analyze},
{id:'intervention',x:-17,y:-27,kind:'engine',fa:'سبد مداخله و اولویت‌بندی',w:11,d:9,h:6,col:C.analyze},
{id:'learning',x:-2,y:-27,kind:'engine',fa:'حافظهٔ یادگیری و چرخهٔ آزمایش',w:11,d:9,h:6,col:C.analyze},
{id:'card',x:13,y:-27,kind:'decision',fa:'کارت تصمیم محله',w:11,d:10,h:8,col:C.decision},
{id:'publish',x:28,y:-27,kind:'gate',fa:'دروازهٔ انتشار و ممیزی',w:8,d:9,h:8,col:C.decision,big:1},
{id:'report',x:42,y:-27,kind:'decision',fa:'گزارش، خلاصهٔ اجرایی و برچسب',w:11,d:8,h:5,col:C.decision},
{id:'archive',x:55,y:-27,kind:'audit',fa:'آرشیو، ردیابی مبدأ و خروجی',w:9,d:7,h:4,col:C.decision},

/* ── ردیف F · سرو، اتصال و تحویل (y=-36) ──────────────────────────────── */
{id:'api',x:-30,y:-36,kind:'serve',fa:'لایهٔ API و سرویس‌های داده',w:11,d:8,h:5,col:C.serve},
{id:'ui',x:-14,y:-36,kind:'serve',fa:'کانال‌های رابط کاربری',w:11,d:8,h:5,col:C.serve},
{id:'feedback',x:2,y:-36,kind:'serve',fa:'بازخورد، ممیزی و بازآموزی',w:11,d:8,h:5,col:C.serve}
];
var ND={};for(var ni=0;ni<NODES.length;ni++){ND[NODES[ni].id]=NODES[ni];NODES[ni].app=0;}
function P(id){var n=ND[id];return [n.x,n.y];}
