/* ===== PHASE 3 · ANALYSIS & SCENARIO LAB · ARA ===== */
(function(){
  var $3=function(id){return document.getElementById(id)},
      lab=$3('p3Lab'),stage=$3('p3Stage'),view='pipeline';
  /* خط لولهٔ هفت‌مرحله‌ای (صحنه‌های ۳۵ تا ۴۴) */
  var PIPE=[
    ['پذیرش دفتر شواهد','۱۰۰٪',100,'evidence'],
    ['نرمال‌سازی ۰..۱۰۰','۹۴٪',94,'normalize'],
    ['دروازهٔ واجدشرایطی','۸۸٪',88,'weight'],
    ['وزن‌دهی و تجمیع','۸۵٪',85,'weight'],
    ['سکور زنجیرهٔ C-A-U-E-O','۸۲٪',82,'chain'],
    ['سنجه‌های Q/T/R','۸۰٪',80,'quality'],
    ['کارت تصمیم و انتشار','۷۸٪',78,'card']
  ];
  /* منابع واقعی برای مقایسه (۷ خانواده / ۲۳ مجموعه داده) */
  var SRC_ROWS=[
    ['سنجش از دور','Sentinel-2 L2A','۱۰ متر','محله‌ای اصلی','STAC','۱۰ روزه','کیفیت عالی'],
    ['سنجش از دور','Landsat C2 L2','۳۰ متر','محله‌ای اصلی','HTTP','۱۶ روزه','کیفیت خوب'],
    ['سنجش از دور','GHSL Built-up','۱۰۰ متر','محله‌ای/میانی','HTTP','سالانه','پوشش جهانی'],
    ['اقلیم و هوا','ERA5-Land','۱۱ کیلومتر','زمینه‌ای','HTTP','ماهانه','تست تفکیک ریزمحله ندارد'],
    ['اقلیم و هوا','VIIRS Black Marble','۵۰۰ متر','کمکی','HTTP','ماهانه','نور شب'],
    ['نقشه و خدمات','OSM Overpass','متغیر','محله‌ای','Overpass','برخط','نیازمند اعتبارسنجی'],
    ['مرجعیت','بانک جهانی WDI','کلان','زمینه‌ای','HTTP','سالانه','بنچمارک کلان'],
    ['سلامت','WHO GHO / Healthsites','کلان/محله‌ای','مختلط','HTTP','سالانه','تأییدشده'],
    ['خاک','SoilGrids 250m','۲۵۰ متر','کمکی','HTTP','ثابت','تمرکز پیرامونی']
  ];
  function x3(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function head(k,t,d,note){
    return '<div class="p3Head"><div><small>'+x3(k)+'</small><h3>'+x3(t)+'</h3></div><p>'+x3(d||'')+(note?'<br>'+x3(note):'')+'</p></div>';
  }
  function stats(a){
    return '<div class="p3Stats">'+a.map(function(v){
      return '<div class="p3Stat '+(v[2]||'')+'"><strong>'+v[0]+'</strong><span>'+v[1]+'</span></div>';
    }).join('')+'</div>';
  }
  var st={cache:1,strict:1,refresh:2,event:'none'};
  /* ---------- pipeline ---------- */
  function pipeCalc(){
    var cacheBoost=[0,4,-3][st.cache],strictPen=[0,4,9][st.strict];
    return PIPE.map(function(p,i2){
      var pct=Math.max(30,Math.min(100,p[2]+cacheBoost-(st.strict>1?strictPen-i2:0)));
      return [p[0],p[1],pct,p[3]];
    });
  }
  function renderPipeline(){
    var rows=pipeCalc(),ok=rows[rows.length-1][2];
    var html=head('PIPELINE SIMULATOR','شبیه‌ساز خط لوله','هفت مرحلهٔ محاسبه با سه اهرم: سیاست کش، سخت‌گیری اعتبارسنجی و تازگی.');
    html+=stats([
      [faNum(Math.round(ok))+'٪','کارایی خروجی',ok>=75?'':'warn'],
      [faNum(rows[2][2])+'٪','پوشش واجدشرایطی',rows[2][2]>=60?'':'warn'],
      [st.cache===0?'تازه':(st.cache===1?'ترکیبی':'کهنه'),'سیاست کش'],
      [['شل','متعادل','سخت‌گاه'][st.strict],'شدت اعتبارسنجی']
    ]);
    html+='<div class="p3Card"><div class="p3CardHd"><h4>مراحل</h4><span class="p3Badge">۷</span></div><div class="p3Tags">'+
      rows.map(function(r){
        var col=r[2]>=80?'#42d990':(r[2]>=60?'#ffd166':'#ff6577');
        return '<span class="p2Tag" style="border-right:3px solid '+col+'"><b>'+x3(r[0])+'</b><small>'+faNum(r[2])+'٪</small></span>';
      }).join('')+'</div></div>';
    html+='<div class="p3Card" style="margin-top:10px"><div class="p3CardHd"><h4>اهرم‌ها</h4><span class="p3Badge">TUNE</span></div>'+
      '<div class="p3Row"><label>سیاست کش</label>'+
        ['تازه','ترکیبی','کهنه'].map(function(l,i2){return '<button class="p3Choice '+(st.cache===i2?'on':'')+'" data-k="cache" data-v="'+i2+'">'+l+'</button>'}).join('')+'</div>'+
      '<div class="p3Row"><label>شدت اعتبارسنجی</label>'+
        ['شل','متعادل','سخت‌گاه'].map(function(l,i2){return '<button class="p3Choice '+(st.strict===i2?'on':'')+'" data-k="strict" data-v="'+i2+'">'+l+'</button>'}).join('')+'</div>'+
      '<p class="p3Muted">کش «کهنه» در قطعی منبع حیات است اما تازگی را قربانی می‌کند؛ سخت‌گاهی بیش از حد، پوشش را زیر ۶۰٪ می‌برد و انتشار را بلوک می‌کند.</p></div>';
    stage.innerHTML=html;
    stage.querySelectorAll('[data-k]').forEach(function(b){
      b.onclick=function(){st[b.dataset.k]=parseInt(b.dataset.v,10);renderPipeline();};
    });
  }


  /* ---------- what-if ---------- */
  function renderWhatIf(){
    var html=head('WHAT-IF','تحلیل سناریو','اگر پوشش، وزن یا کیفیت تغییر کند، چه بر سر وضعیت انتشار می‌آید؟');
    var cases=[
      ['پوشش هسته از ۸۰٪ به ۶۲٪','بلوک انتشار','زیر آستانهٔ شرط چهارم دروازهٔ انتشار','ff6577','56'],
      ['حذف یک منبع اصلی (ماهواره‌ای)','۲۲٪ کاهش پوشش','کش کهنه + Landsat پشتیبان وارد می‌شود','ff9d42','11'],
      ['تغییر وزن ۳ شاخص کلیدی','بازمحاسبهٔ نسخهٔ محاسبه','اثر انگشت جدید؛ ردیابی قبلی حفظ می‌شود','ffd166','38'],
      ['افزایش شدت اعتبارسنجی به سخت‌گاه','۹٪ افت کارایی مرحلهٔ سوم','۲۰٪ داده به صف رد می‌رود','ffd166','21'],
      ['کشف هاله در نمونه‌گیری','ریسک CONFLICT','ارجاع انسانی + باند هشدار کیفیت','ff6577','44'],
      ['کالیبراسیون وزن‌ها','فعلاً معلق (۵۰٪)','تا تأیید مالک رجیستر انتشار ناقص','4da3ff','31']
    ];
    html+='<div class="p3Grid">'+cases.map(function(c){
      return '<article class="p3Card p3Scenario"><span>اگر</span><h4>'+x3(c[0])+'</h4>'+
        '<p class="p3Muted">'+x3(c[2])+'</p>'+
        '<div class="p3ScenarioOut" style="color:#'+c[3]+'">'+x3(c[1])+'</div>'+
        '<button class="p3Btn" data-scene="'+c[4]+'">شاهد صحنه</button></article>';
    }).join('')+'</div>';
    html+='<div class="p3Approval"><i></i><div><b>دروازهٔ تأیید انسانی فعال است</b><span>هر تغییر وزن، آستانه یا وضعیت انتشار باید توسط مالک مربوط تأیید و در دفتر رویداد ثبت شود.</span></div></div>';
    stage.innerHTML=html;
    stage.querySelectorAll('[data-scene]').forEach(function(b){
      b.onclick=function(){jump(parseInt(b.dataset.scene,10));close();};
    });
  }
  /* ---------- sources ---------- */
  function renderSources(){
    var html=head('SOURCE COMPARISON','مقایسهٔ منابع','نُه مجموعهٔ نمونه از ۲۳ مجموعهٔ پلتفرم؛ تفکیک مکانی و تازگی، توانایی ریزمحله را تعیین می‌کند.');
    html+='<div class="p3Card"><div class="p3CardHd"><h4>جدول مقایسه</h4><span class="p3Badge">۲۳ مجموعه</span></div>'+
      '<div class="p3Tags">'+SRC_ROWS.map(function(r){
        return '<span class="p2Tag"><b>'+x3(r[1])+'</b><small>'+x3(r[0])+' · '+x3(r[2])+' · '+x3(r[3])+'</small><small>'+x3(r[5])+' · '+x3(r[7])+'</small></span>';
      }).join('')+'</div></div>';
    html+='<div class="p3Card" style="margin-top:10px"><div class="p3CardHd"><h4>قاعدهٔ تفکیک</h4><span class="p3Badge">RULE</span></div>'+
      '<p class="p3Muted">منبع اقلیمی (۱۱ کیلومتر) هرگز برای تفکیک ریزمحله استفاده نمی‌شود و برچسب «زمینه‌ای» اجباری است؛ تنها منابع ۱۰ تا ۳۰ متری واجد شرایط طبقه‌بندی محله‌ای‌اند.</p></div>';
    stage.innerHTML=html;
  }

  /* ---------- outage ---------- */
  var EVENTS={
    none:{n:'بدون اختلال',loss:0,delay:0,scene:0,owner:'مالک منبع',root:'—',cover:'۱۰۰٪',fb:'—'},
    satpipe:{n:'قطعی خط لولهٔ ماهواره‌ای',loss:22,delay:3,scene:11,owner:'مالک منابع دوربرد',
             root:'محدودیت سهمیه یا خطای STAC',cover:'۷۸٪',fb:'کش کهنه + منبع Landsat پشتیبان'},
    osm:{n:'اختلال Overpass (نقشه/خدمات)',loss:14,delay:1,scene:7,owner:'مالک نقشه و خدمات',
         root:'محدودیت نرخ درخواست',cover:'۸۶٪',fb:'کش ۲۴ساعته + نسخهٔ محلی شبکه'},
    weather:{n:'تأخیر منابع اقلیم',loss:9,delay:6,scene:6,owner:'مالک اقلیم',
             root:'تأخیر انتشار مرجع',cover:'۹۱٪',fb:'میانگین متحرک + برچسب کهنه'},
    reg:{n:'مغایرت رجیستر ۱۶۴',loss:18,delay:4,scene:33,owner:'مالک رجیستر',
         root:'نسخهٔ وزن بدون کالیبراسیون',cover:'۸۲٪',fb:'پروتکل پنج‌گامی حل اختلاف'},
    quality:{n:'افت کیفیت: هاله و سوگیری',loss:26,delay:2,scene:44,owner:'کنترل‌کنندهٔ کیفیت',
             root:'تمرکز جغرافیایی نمونه',cover:'۷۴٪',fb:'وزن اصلاحی + باند هشدار'}
  };
  function renderOutage(){
    var ev=EVENTS[st.event]||EVENTS.none;
    var html=head('SOURCE OUTAGE','اثر قطعی منبع','یک منبع قطع شود؛ کدام شاخص‌ها و فصل‌ها آسیب می‌بینند و مسیر جایگزین چیست؟');
    html+='<div class="p3Card"><div class="p3CardHd"><h4>نوع اختلال</h4><span class="p3Badge">EVENT</span></div>'+
      '<div class="p3Tags">'+Object.keys(EVENTS).map(function(k){
        return '<button class="p3Chip '+(st.event===k?'on':'')+'" data-event="'+k+'">'+x3(EVENTS[k].n)+'</button>';
      }).join('')+'</div></div>';
    html+=stats([
      [ev.loss?'−'+faNum(ev.loss)+'٪':'۰٪','افت پوشش',ev.loss>15?'warn':''],
      [ev.delay?'+'+faNum(ev.delay)+' روز':'۰ روز','تأخیر اثر',ev.delay>3?'warn':''],
      [ev.cover,'پوشش باقی‌مانده'],
      [x3(ev.owner),'مالک پاسخ']
    ]);
    html+='<div class="p3Grid2">'+
      '<div class="p3Card"><div class="p3CardHd"><h4>علت ریشه‌ای</h4><span class="p3Badge">ROOT</span></div><p class="p3Muted">'+x3(ev.root)+'</p>'+
      '<button class="p3Btn" data-scene="'+ev.scene+'">صحنهٔ مرتبط</button></div>'+
      '<div class="p3Card"><div class="p3CardHd"><h4>مسیر جایگزین</h4><span class="p3Badge">FALLBACK</span></div><p class="p3Muted">'+x3(ev.fb)+'</p>'+
      '<p class="p3Muted">منبع قطع‌شده هرگز به‌عنوان «صفر» شمرده نمی‌شود؛ وضعیت به S (کمبود منبع) می‌رود و تا بازگشت، برچسب کهنه می‌گیرد.</p></div></div>';
    stage.innerHTML=html;
    stage.querySelectorAll('[data-event]').forEach(function(b){
      b.onclick=function(){st.event=b.dataset.event;renderOutage();};
    });
    stage.querySelectorAll('[data-scene]').forEach(function(b){
      b.onclick=function(){jump(parseInt(b.dataset.scene,10));close();};
    });
  }
  /* ---------- publish gate ---------- */
  function renderGate(){
    var cover=100-({none:0,satpipe:22,osm:14,weather:9,reg:18,quality:26}[st.event]||0);
    var conds=[
      ['۱ · کد شاخص یکتا','۱۶۴/۱۶۴',true],
      ['۲ · سطح شاهد ≥ واقعیت منبع‌دار','CONFLICT صفر',st.event!=='reg'],
      ['۳ · نبود بلوک فعال','بدون بلوک',st.event!=='quality'],
      ['۴ · پوشش هسته ≥ ۸۰٪',faNum(Math.min(cover,94))+'٪',cover>=80],
      ['۵ · پوشش سرمایه ≥ ۶۰٪',faNum(Math.min(cover+8,96))+'٪',cover+8>=60],
      ['۶ · کیفیت ≥ ۷۰٪',faNum(Math.max(35,cover-8))+'٪',cover-8>=70]
    ];
    var pass=conds.filter(function(c){return c[2]}).length;
    var html=head('PUBLISH GATE','دروازهٔ انتشار','شش شرط انگشت‌شماری‌شده؛ همه سبز باشند تا کارت تصمیم منتشر شود.');
    html+=stats([
      [pass+' / ۶','شرط‌های برقرار',pass===6?'':'warn'],
      [pass===6?'قابل انتشار':'بلاک',pass===6?'وضعیت خروجی':'وضعیت خروجی',pass===6?'':'warn'],
      [x3(EVENTS[st.event]||EVENTS.none).n,'رویداد اثرگذار'],
      [pass===6?'ENFORCED':'BLOCKED','حالت دروازه',pass===6?'':'warn']
    ]);
    html+='<div class="p3Card"><div class="p3CardHd"><h4>شروط</h4><span class="p3Badge">۶</span></div><div class="p3Tags">'+
      conds.map(function(c){
        return '<span class="p2Tag" style="border-right:3px solid '+(c[2]?'#42d990':'#ff6577')+'"><b>'+(c[2]?'✔':'✘')+' '+x3(c[0])+'</b><small>'+x3(c[1])+'</small></span>';
      }).join('')+'</div></div>';
    html+='<div class="p3Approval"><i></i><div><b>تأیید انسانی همیشه لازم است</b><span>حتی با شش شرط سبز، انتشار نهایی نیازمند امضای مالک انتشار و ثبت در دفتر رویه‌هاست.</span></div></div>';
    html+='<div class="p3Actions"><button class="p3Btn" data-scene="56">صحنهٔ شش شرط</button>'+
      '<button class="p3Btn primary" data-scene="65">صحنهٔ تأیید انسانی</button></div>';
    stage.innerHTML=html;
    stage.querySelectorAll('[data-scene]').forEach(function(b){
      b.onclick=function(){jump(parseInt(b.dataset.scene,10));close();};
    });
  }


  /* ---------- shortage & CAPA ---------- */
  var CAPAS=[
    ['کمبود پوشش هستهٔ ۴۰','تا۲ روز از انتشار ناقص جلوگیری و برچسب ناقص بزن',
     'زیرگروه شهری بدون دادهٔ سرمایه','وزن اصلاحی زیرگروه + ورود منبع جایگزین',
     'قواعد پوشش، آستانهٔ ۸۰٪، اعلان پیش از فروریختن','۷ روز','#ff6577','45'],
    ['فرسایش تعریف شاخص بدون نسخه','قفل نسخهٔ فعلی رجیستر تا تأیید تغییر',
     'ویرایش مستقیم روی رکورد زنده','نسخه‌بندی اجباری + بازبینی چهارچشمی',
     'مالکیت رجیستر و دفتر تغییرات','۱۴ روز','#ff9d42','71'],
    ['ورود دادهٔ نامعتبر از منبع برخط','توقف بارگیری منبع متخلف',
     'نبود اعتبارسنجی فیلد در کانکتور','درجه‌بندی اجباری + تلاش مجدد کنترل‌شده',
     'منیفست و کانکتور استاندارد','۷ روز','#ffd166','21'],
    ['تعارض نسخهٔ وزن (کالیبراسیون معلق)','اخراج نسخهٔ معلق از محاسبهٔ انتشار',
     'طرح وزن بدون آزمون میدانی','چرخهٔ آزمایش + تأیید مالک رجیستر',
     'رجیستر وزن نسخه‌دار و بستهٔ اعتبارسنجی','۱۴ روز','#4da3ff','31']
  ];
  function renderCapa(){
    var html=head('GAPS & CAPA','کمبود و اقدام اصلاحی','هر کمبود، چهار اقدام ثبت‌شده دارد: مهار فوری، علت ریشه‌ای، اصلاحی و پیشگیرانه.');
    html+='<div class="p3Grid">'+CAPAS.map(function(c){
      return '<article class="p3Card p3Capa" style="--cc:'+c[6]+'">'+
        '<span>مسئله</span><h4>'+x3(c[0])+'</h4>'+
        '<p class="p3Muted"><b>مهار:</b> '+x3(c[1])+'<br><b>علت:</b> '+x3(c[2])+
        '<br><b>اصلاحی:</b> '+x3(c[3])+'<br><b>پیشگیرانه:</b> '+x3(c[4])+'</p>'+
        '<div class="p3CapaFoot"><span>موعد: '+x3(c[5])+'</span>'+
        '<button class="p3Btn" data-scene="'+c[7]+'">شاهد صحنه</button></div></article>';
    }).join('')+'</div>';
    html+='<div class="p3Approval"><i></i><div><b>بستن CAPA نیازمند اثربخشی است</b><span>پس از موعد مقرر، اثربخشی در سنجش ۳۰ روزه تأیید و در دفتر رویداد ثبت می‌شود.</span></div></div>';
    stage.innerHTML=html;
    stage.querySelectorAll('[data-scene]').forEach(function(b){
      b.onclick=function(){jump(parseInt(b.dataset.scene,10));close();};
    });
  }
  /* ---------- dispatcher ---------- */
  function render(){
    document.querySelectorAll('.p3NavBtn').forEach(function(b){
      b.classList.toggle('on',b.dataset.p3view===view);
    });
    if(view==='pipeline')renderPipeline();
    else if(view==='whatif')renderWhatIf();
    else if(view==='sources')renderSources();
    else if(view==='outage')renderOutage();
    else if(view==='gate')renderGate();
    else renderCapa();
    var s3=document.getElementById('p3Status');
    if(s3)s3.textContent=(view==='gate')?'دروازهٔ انتشار · '+(100-({none:0,satpipe:22,osm:14,weather:9,reg:18,quality:26}[st.event]||0))+'٪ پوشش':'پایهٔ مرجع · آمادهٔ اجرا';
    stage.scrollTop=0;
  }
  function choose(v){view=v||'pipeline';render()}
  function open(v){
    if(document.getElementById('p2Workspace'))document.getElementById('p2Workspace').classList.remove('on');
    if(document.getElementById('p4Hub'))document.getElementById('p4Hub').classList.remove('on');
    document.querySelectorAll('.p1Panel.on').forEach(function(x){x.classList.remove('on');x.setAttribute('aria-hidden','true')});
    lab.classList.add('on');lab.setAttribute('aria-hidden','false');
    $3('p3Launch').setAttribute('aria-expanded','true');
    playing=false;choose(v||'pipeline');
    setTimeout(function(){var c=$3('p3Close');if(c)c.focus()},60);
  }
  function close(){
    lab.classList.remove('on');lab.setAttribute('aria-hidden','true');
    $3('p3Launch').setAttribute('aria-expanded','false');
    $3('p3Launch').focus();
  }
  $3('p3Launch').addEventListener('click',function(){open('pipeline')});
  $3('p3Close').addEventListener('click',close);
  document.querySelectorAll('.p3NavBtn').forEach(function(b){
    b.addEventListener('click',function(){choose(b.dataset.p3view)});
  });
  window.addEventListener('keydown',function(e){
    var typing=/input|textarea|select/i.test((e.target.tagName||''));
    if(lab.classList.contains('on')){
      if(e.key==='Escape'||((e.key==='s'||e.key==='S')&&!typing)){
        e.preventDefault();e.stopImmediatePropagation();close();return;
      }
      if(!typing){e.preventDefault();e.stopImmediatePropagation();return;}
    }
    if(!(document.getElementById('p4Hub')&&document.getElementById('p4Hub').classList.contains('on'))&&
       !typing&&(e.key==='s'||e.key==='S')){
      e.preventDefault();e.stopImmediatePropagation();open('pipeline');
    }
  },true);
})();
