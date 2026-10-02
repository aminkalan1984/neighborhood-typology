/* ===== PHASE 4 · DATA-FLOW INTELLIGENCE HUB · ARA ===== */
(function(){
  var $4=function(id){return document.getElementById(id)},
      hub=$4('p4Hub'),stage=$4('p4Stage'),view='assistant';
  var state={query:'',evidence:'all',report:'executive',discFilter:'all'};
  /* term aliases: Persian + English + node/edge ids */
  var aliases={
    'منبع':['منبع','source','remote','climate','maps','survey','benchmark','satpipe','stac'],
    'ورود':['ورود','ingest','gateway','proxy','cache','valid','evidence','منیفست','کش','اعتبارسنج'],
    'رجیستر':['رجیستر','reg419','reg164','regcore','regsrc','regweights','registry','نسخه'],
    'هسته':['هسته','kernel','normalize','weight','chain','نرمال','وزن','زنجیره','محاسبه','calc'],
    'اطمینان':['اطمینان','confidence','quality','bottleneck','گلوگاه','کیفیت','پوشش'],
    'تصمیم':['تصمیم','card','publish','report','کارت','انتشار','گزارش'],
    'رابط':['رابط','api','ui','feedback','بازخورد','سرو'],
    'ردیابی':['ردیابی','archive','audit','provenance','آرشیو','ممیزی'],
    'شاهد':['شاهد','tier','verified','fact','claim','inference','conflict','unknown','pending','سطح']
  };
  /* the 12 connected manifests (live-platform registry) */
  var connectors=[
    {id:'open-meteo-air',code:'AIR',name:'Open-Meteo کیفیت هوا',desc:'هواشناسی و آلودگی ایستگاهی',color:'#38e0c4',ok:true,lat:'۱۲دقیقه'},
    {id:'open-meteo-climate',code:'CLM',name:'Open-Meteo آرشیو اقلیمی',desc:'دما، بارش، رطوبت روزانه',color:'#4da3ff',ok:true,lat:'روزانه'},
    {id:'worldbank',code:'WDI',name:'بانک جهانی',desc:'بنچمارک کلان اقتصادی-اجتماعی',color:'#b892ff',ok:true,lat:'سالانه'},
    {id:'who-gho',code:'GHO',name:'WHO سلامت',desc:'شاخص‌های سلامت و بهداشت',color:'#ffb74d',ok:true,lat:'سالانه'},
    {id:'osm-pois',code:'OSM',name:'نقشهٔ خدمات (Overpass)',desc:'مدارس، درمانگاه‌ها، ایستگاه‌ها',color:'#42d990',ok:true,lat:'برخط'},
    {id:'osm-walkability',code:'WLK',name:'پیاده‌مداری OSM',desc:'شبکهٔ معابر و دسترسی پیاده',color:'#ff8a65',ok:true,lat:'برخط'},
    {id:'healthsites',code:'HLT',name:'تأسیسات سلامت',desc:'موقعیت مراکز درمانی',color:'#56c6ff',ok:true,lat:'هفتگی'},
    {id:'satellite-stac',code:'STAC',name:'کاتالوگ ماهواره‌ای',desc:'متادیتای Sentinel-2 (کاشی و سهمیه)',color:'#d89cff',ok:false,lat:'قطعی سهمیه'},
    {id:'openaq',code:'AQ',name:'OpenAQ ایستگاهی',desc:'PM2.5 و کیفیت هوای ساعتی',color:'#8cd17d',ok:true,lat:'ساعتی'},
    {id:'firms',code:'FIRE',name:'آتش فعال FIRMS',desc:'نقاط داغ VIIRS (بلادرنگ)',color:'#ff6577',ok:true,lat:'بلادرنگ'},
    {id:'osrm',code:'OSRM',name:'زمان سفر شبکه',desc:'مسیر‌یابی و مدت سفر معابر',color:'#ffd166',ok:true,lat:'برخط'},
    {id:'glofas-flood',code:'FLD',name:'دبی رودخانه GloFAS',desc:'سیل‌خیزی و رواناب',color:'#35e0c1',ok:false,lat:'تأخیر ۶روزه'}
  ];


  /* predictive data alerts */
  var alerts=[
    {sev:'بحرانی',color:'#ff6577',title:'خطر عبور پوشش از ۶۰٪',body:'افت منابع ماهواره‌ای و اقلیم، کارایی خروجی را به ۵۸٪ می‌رساند.',prob:86,horizon:'۶ ساعت',scene:11,owner:'مالک منابع دوربرد'},
    {sev:'بالا',color:'#ff9d42',title:'افت قابلیت اتکای تازگی',body:'الگوی تأخیر انتشار مرجع، احتمال ۶ روز کهنگی کش اقلیم را نشان می‌دهد.',prob:74,horizon:'۴۸ ساعت',scene:6,owner:'مالک اقلیم'},
    {sev:'بالا',color:'#ff9d42',title:'احتمال مغایرت رجیستر ۱۶۴',body:'نسخهٔ وزن بدون کالیبراسیون در صف تأیید؛ احتمال CONFLICT در صحنهٔ ۳۴.',prob:68,horizon:'۷ روز',scene:33,owner:'مالک رجیستر'},
    {sev:'متوسط',color:'#4da3ff',title:'ریسک بلوک انتشار',body:'شرط پوشش هسته (۸۰٪) با افت ۴٪ در آستانهٔ شکست است.',prob:61,horizon:'۵ روز',scene:56,owner:'مالک انتشار'},
    {sev:'متوسط',color:'#4da3ff',title:'شکاف شواهد ادراکی',body:'پرسش‌نامهٔ ۱۵ گویه در ۲ زیرگروه تکمیل نشده؛ سطح شاهد نامعلوم.',prob:57,horizon:'۲۴ ساعت',scene:30,owner:'مالک پیمایش'}
  ];
  /* data discrepancies */
  var discrepancies=[
    {type:'conflict',title:'رجیستر ۴۱۹ در برابر محاسبهٔ هسته',a:['رجیستر','کد UN-0419 · جهت مثبت'],b:['هسته','جهت محاسبه معکوس'],field:'جهت شاخص',impact:'ریسک امتیاز معکوس؛ بلوک انتشار',scene:33},
    {type:'conflict',title:'کش تازه در برابر کش کهنه (اقلیم)',a:['تازه','میانگین ۷روزه: ۳۴٫۲'],b:['کهنه','میانگین ۳۰روزه: ۳۱٫۸'],field:'تازگی',impact:'برچسب کهنه اجباری؛ عدم ادغام',scene:17},
    {type:'warn',title:'منبع رسمی در برابر منبع میدانی',a:['رسمی','پوشش مدرسه: ۹۲٪'],b:['میدانی','پوشش مدرسه: ۷۶٪'],field:'پوشش خدمات',impact:'ارجاع انسانی و وزن اصلاحی',scene:24},
    {type:'warn',title:'وزن جاری در برابر وزن معلق',a:['جاری','W-v1 · اثر انگشت ثبت‌شده'],b:['معلق','W-v2 · کالیبراسیون نشده'],field:'نسخهٔ محاسبه',impact:'W-v2 از انتشار اخراج شد',scene:31},
    {type:'conflict',title:'سطح شاهد منبع در برابر محاسبه',a:['منبع','ادعای عملیاتی'],b:['هسته','واقعیت تأییدشده'],field:'سطح شاهد',impact:'انتشار با سطح CLAIM؛ تأیید لازم',scene:56},
    {type:'warn',title:'تفکیک اقلیمی در برابر نیاز ریزمحله',a:['ERA5','۱۱ کیلومتر'],b:['نیاز','۱۰ تا ۳۰ متر'],field:'تفکیک مکانی',impact:'برچسب زمینه‌ای؛ عدم رتبه‌بندی',scene:6},
    {type:'match',title:'اثر انگشت در برابر دفتر رویداد',a:['SHA','a3f9…c21d'],b:['رویداد','ثبت‌شده ۱۴:۳۲'],field:'یکپارچگی',impact:'ردیابی کامل؛ انتشار مجاز',scene:61}
  ];
  function x4(v){return String(v==null?'':v).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function num(n){return faNum(n)}
  function sceneTitle(i){return (SCENES[i]||{}).ti||''}
  function currentIndex(){return sceneAt(t)}
  function announce(x){var a=$4('p4Announce');if(a)a.textContent=x}
  function evidenceLabel(tr){return TIERFA[tr]||tr}


  /* ---------- assistant ---------- */
  function answerQuery(q){
    q=(q||'').trim();
    if(!q)return null;
    var hits=[],i,s,famHit={};
    for(var alias in aliases){
      for(var k=0;k<aliases[alias].length;k++){
        if(q.indexOf(aliases[alias][k])>-1)famHit[alias]=(famHit[alias]||0)+1;
      }
    }
    for(i=0;i<SCENES.length;i++){
      s=SCENES[i];
      var txt=s.ti+' '+s.sb+' '+s.card.tx+' '+s.card.sr+' '+(SCENE_LENS[i]||{}).r;
      if(txt.indexOf(q)>-1)hits.push(i);
    }
    var famScenes={'منبع':4,'ورود':13,'رجیستر':26,'هسته':34,'اطمینان':43,'تصمیم':55,'رابط':66,'ردیابی':61,'شاهد':3};
    for(var f in famHit)if(famScenes[f]!=null&&hits.indexOf(famScenes[f])<0)hits.push(famScenes[f]);
    return {q:q,hits:hits.slice(0,6),fams:Object.keys(famHit)};
  }
  function renderAssistant(){
    var d=state.lastAnswer;
    var html='<div class="p4Head"><div><small>DATA-FLOW ASSISTANT</small><h3>دستیار جریان داده</h3></div>'+
      '<p>پرسش فارسی یا انگلیسی؛ پاسخ فقط از ۷۵ صحنه، رجیسترها و گره‌های میدان استخراج می‌شود.</p></div>';
    html+='<div class="p4SearchRow"><input class="p4Input" id="p4Query" type="search" placeholder="دروازهٔ انتشار، منیفست، کش کهنه…" value="'+x4(state.query)+'">'+
      '<button class="p4Btn primary" id="p4Ask">پرسش</button></div>';
    if(d){
      html+='<article class="p4Card p4Answer">';
      if(!d.hits.length){
        html+='<div class="p4AnswerLead">شاهدی در ۷۵ صحنه یافت نشد.</div>'+
          '<p class="p4Muted">عبارت‌های «منبع، ورود، رجیستر، هسته، تصمیم، انتشار، ردیابی» را بیازمایید.</p>';
      }else{
        html+='<div class="p4AnswerLead">پاسخ از '+num(d.hits.length)+' صحنهٔ شاهد'+(state.evidence!=='all'?' (فیلتر: '+x4(state.evidence)+')':'')+':</div>';
        html+=d.hits.map(function(i){
          var s=SCENES[i],tr=SCENE_TRACE[i]||[];
          if(state.evidence!=='all'&&s.card.tr!==state.evidence)return '';
          return '<div class="p4Source"><b>صحنهٔ '+num(i+1)+' · '+x4(s.ti)+'</b>'+
            '<span>'+x4(s.card.tx.slice(0,140))+(s.card.tx.length>140?'…':'')+'</span>'+
            '<div class="p4Meta"><i style="color:'+(TIERCOL[s.card.tr]||'#fff')+'">'+x4(evidenceLabel(s.card.tr))+'</i>'+
            ' · '+x4(tr.join(' / '))+'</div>'+
            '<button class="p4Chip" data-jump="'+i+'">بازکردن صحنه</button></div>';
        }).join('');
      }
      html+='</article>';
    }else{
      html+='<div class="p4QuickRow">'+
        ['دروازهٔ انتشار','منیفست منبع','کش کهنه','کالیبراسیون وزن','حل اختلاف رجیستر'].map(function(qx){
          return '<button class="p4Chip" data-q="'+x4(qx)+'">'+x4(qx)+'</button>';
        }).join('')+'</div>';
    }
    html+='<div class="p4FilterRow"><span>سطح شاهد:</span>'+['all','VERIFIED','FACT','CLAIM','INFERENCE','CONFLICT','UNKNOWN','PENDING'].map(function(v2){
      return '<button class="p4Chip '+(state.evidence===v2?'on':'')+'" data-ev="'+v2+'">'+(v2==='all'?'همه':TIERFA[v2])+'</button>';
    }).join('')+'</div>';
    stage.innerHTML=html;
    bindJumps();
    var ask=$4('p4Ask'),inp=$4('p4Query');
    function go(){
      state.query=inp.value;state.lastAnswer=answerQuery(inp.value);renderAssistant();
      var back=$4('p4Query');
      if(back){back.focus();back.setSelectionRange(back.value.length,back.value.length);}
      announce(state.lastAnswer&&state.lastAnswer.hits.length?state.lastAnswer.hits.length+' شاهد یافت شد':'شاهدی یافت نشد');
    }
    if(ask)ask.onclick=go;
    if(inp)inp.addEventListener('keydown',function(e){if(e.key==='Enter')go();e.stopPropagation();});
    stage.querySelectorAll('[data-ev]').forEach(function(b){
      b.onclick=function(){state.evidence=b.dataset.ev;renderAssistant();};
    });
    stage.querySelectorAll('[data-q]').forEach(function(b){
      b.onclick=function(){state.query=b.dataset.q;state.lastAnswer=answerQuery(b.dataset.q);renderAssistant();};
    });
  }


  /* ---------- semantic search ---------- */
  function renderSearch(){
    var q=(state.query||'').trim();
    var famHit={};
    if(q)for(var alias in aliases){
      for(var k=0;k<aliases[alias].length;k++){
        if(q.indexOf(aliases[alias][k])>-1)famHit[alias]=(famHit[alias]||0)+1;
      }
    }
    var html='<div class="p4Head"><div><small>SEMANTIC SEARCH</small><h3>جست‌وجوی معنایی</h3></div>'+
      '<p>بر اساس خانواده‌های مفهومی (منبع، ورود، رجیستر، هسته، تصمیم، انتشار، ردیابی) و متن صحنه‌ها.</p></div>';
    html+='<div class="p4SearchRow"><input class="p4Input" id="p4Semantic" type="search" placeholder="یک یا چند واژه… مثلاً محاسبه انتشار" value="'+x4(state.query)+'">'+
      '<button class="p4Btn primary" id="p4GoSemantic">جست‌وجو</button></div>';
    if(q){
      var hits=[];
      for(var i=0;i<SCENES.length;i++){
        var s=SCENES[i],txt=s.ti+' '+s.sb+' '+s.card.tx+' '+s.card.sr+' '+(SCENE_LENS[i]||{}).r;
        if(txt.indexOf(q)>-1)hits.push(i);
      }
      html+='<div class="p4Card"><div class="p4CardHd"><h4>تطابق‌های مستقیم</h4><span class="p4Badge">'+num(hits.length)+'</span></div>';
      if(hits.length){
        html+='<div class="p4Tags">'+hits.slice(0,12).map(function(i){
          var s2=SCENES[i];
          return '<span class="p2Tag" data-jump="'+i+'" role="button" tabindex="0"><b>'+num(i+1)+' · '+x4(s2.ti)+'</b><small>'+x4(s2.ch)+'</small></span>';
        }).join('')+'</div>';
      }else html+='<p class="p4Muted">تطابق مستقیمی نیست؛ خانواده‌های زیر نزدیک‌ترین‌اند.</p>';
      html+='</div>';
      var fams=Object.keys(famHit);
      if(fams.length){
        html+='<div class="p4Card" style="margin-top:10px"><div class="p4CardHd"><h4>خانواده‌های مفهومی</h4><span class="p4Badge">'+num(fams.length)+'</span></div><div class="p4Tags">'+
          fams.map(function(f){return '<span class="p2Tag">'+x4(f)+' <small>'+num(famHit[f])+' تطابق</small></span>'}).join('')+
          '</div></div>';
      }
    }
    stage.innerHTML=html;
    bindJumps();
    var btn=$4('p4GoSemantic'),inp=$4('p4Semantic');
    function go(){state.query=inp.value;renderSearch();var b2=$4('p4Semantic');if(b2)b2.focus();}
    if(btn)btn.onclick=go;
    if(inp)inp.addEventListener('keydown',function(e){if(e.key==='Enter')go();e.stopPropagation();});
    stage.querySelectorAll('.p2Tag[data-jump]').forEach(function(el){
      el.onclick=function(){jump(parseInt(el.dataset.jump,10));close();};
    });
  }
  /* ---------- connectors ---------- */
  function renderConnectors(){
    var ok=connectors.filter(function(c){return c.ok}),bad=connectors.filter(function(c){return !c.ok});
    var html='<div class="p4Head"><div><small>CONNECTORS & HEALTH</small><h3>کانکتورها و سلامت</h3></div>'+
      '<p>۱۲ کانکتور رجیستری زندهٔ پلتفرم؛ دو کانکتور هم‌اکنون نیازمند مسیر جایگزین‌اند.</p></div>';
    html+='<div class="p4Stats">'+
      '<div class="p4Stat"><strong>'+num(ok.length)+'</strong><span>کانکتور سالم</span></div>'+
      '<div class="p4Stat bad"><strong>'+num(bad.length)+'</strong><span>نیازمند جایگزین</span></div>'+
      '<div class="p4Stat"><strong>'+num(connectors.length)+'</strong><span>مجموع کانکتورها</span></div></div>';
    html+='<div class="p4Grid2">'+connectors.map(function(c){
      return '<article class="p4Connector" style="--ac:'+c.color+'"><i></i><div>'+
        '<h4>'+x4(c.name)+' <span class="p4Badge '+(c.ok?'live':'warn')+'">'+(c.ok?'ONLINE':'DEGRADED')+'</span></h4>'+
        '<p>'+x4(c.desc)+'</p><p class="p4Muted">شناسه: '+x4(c.id)+' · تازگی: '+x4(c.lat)+'</p>'+
        (c.ok?'':'<p class="p4Muted">مسیر جایگزین: کش کهنه + منبع پشتیبان؛ وضعیت داده: S (کمبود منبع).</p>')+
        '</div></div>';
    }).join('')+'</div>';
    stage.innerHTML=html;
  }

  /* ---------- predictive alerts ---------- */
  function renderAlerts(){
    var html='<div class="p4Head"><div><small>EARLY WARNINGS</small><h3>هشدارهای پیش‌بینانه</h3></div>'+
      '<p>از روند تازگی، سهمیه و کالیبراسیون؛ هر هشدار به صحنهٔ شاهد و مالک پاسخ متصل است.</p></div>';
    html+='<div class="p4AlertList">'+alerts.map(function(a){
      return '<article class="p4Alert" style="--ac:'+a.color+'"><i></i><div>'+
        '<h4>'+x4(a.title)+' <span class="p4Badge '+(a.sev==='بحرانی'?'bad':(a.sev==='بالا'?'warn':'live'))+'">'+x4(a.sev)+'</span></h4>'+
        '<p>'+x4(a.body)+'</p>'+
        '<div class="p4Meta"><b>'+num(a.prob)+'٪</b> احتمال · افق '+x4(a.horizon)+' · مالک: '+x4(a.owner)+'</div>'+
        '<button class="p4Chip" data-jump="'+a.scene+'">شاهد صحنه</button>'+
        '</div><div class="p4AlertSide"><b style="color:'+a.color+'">'+num(a.prob)+'٪</b><span>اطمینان</span></div></article>';
    }).join('')+'</div>';
    stage.innerHTML=html;
    bindJumps();
  }
  /* ---------- discrepancy discovery ---------- */
  function renderDiscrepancy(){
    var rows=discrepancies.filter(function(d){
      return state.discFilter==='all'||d.type===state.discFilter;
    });
    var html='<div class="p4Head"><div><small>DATA CONFLICTS</small><h3>کشف مغایرت داده</h3></div>'+
      '<p>تطبیق دودویی رجیسترها، کش‌ها و نسخه‌ها؛ تعارض قرمز، بازبینی نارنجی، همخوان سبز.</p></div>';
    html+='<div class="p4FilterRow">'+['all','conflict','warn','match'].map(function(k){
      var lab=k==='all'?'همه':(k==='conflict'?'تعارض':(k==='warn'?'بازبینی':'همخوان'));
      return '<button class="p4Chip '+(state.discFilter===k?'on':'')+'" data-filter="'+k+'">'+lab+'</button>';
    }).join('')+'</div>';
    html+='<div class="p4DiscList">'+rows.map(function(d){
      var color=d.type==='conflict'?'#ff6577':(d.type==='warn'?'#ffb74d':'#42d990');
      var lab=d.type==='conflict'?'تعارض':(d.type==='warn'?'بازبینی':'همخوان');
      return '<article class="p4Disc" style="--ac:'+color+'"><i></i><div>'+
        '<h4>'+x4(d.title)+' <span class="p4Badge '+(d.type==='conflict'?'bad':(d.type==='warn'?'warn':'live'))+'">'+lab+'</span></h4>'+
        '<div class="p4Compare"><div><span>'+x4(d.a[0])+'</span><b>'+x4(d.a[1])+'</b></div><em>≠</em>'+
        '<div><span>'+x4(d.b[0])+'</span><b>'+x4(d.b[1])+'</b></div></div>'+
        '<p style="margin-top:8px">فیلد: '+x4(d.field)+' · اثر: '+x4(d.impact)+'</p>'+
        '<div class="p4DiscActions"><button class="p4Chip" data-jump="'+d.scene+'">شاهد صحنه</button>'+
        (d.type!=='match'?'<button class="p4Chip" data-review>ارسال برای تأیید انسانی</button>':'')+
        '</div></div><div class="p4AlertSide"><b style="color:'+color+'">'+(d.type==='match'?'PASS':'CHECK')+'</b><span>قاعدهٔ تطبیق</span></div></article>';
    }).join('')+'</div>';
    stage.innerHTML=html;
    bindJumps();
    stage.querySelectorAll('[data-filter]').forEach(function(b){
      b.onclick=function(){state.discFilter=b.dataset.filter;renderDiscrepancy();};
    });
    stage.querySelectorAll('[data-review]').forEach(function(b){
      b.onclick=function(){b.textContent='در صف بازبینی انسانی';b.disabled=true;announce('مورد به صف بازبینی انسانی افزوده شد');};
    });
  }


  /* ---------- report builder ---------- */
  var reportNames={scene:'خلاصهٔ صحنه',route:'یادداشت تصمیم خط لوله',crisis:'گزارش اثر اختلال',capa:'گزارش کمبود و CAPA',executive:'خلاصهٔ اجرایی جریان داده'};
  function reportData(){
    var idx=currentIndex(),s=SCENES[idx],m=SCENE_METRICS[idx],l=SCENE_LENS[idx],type=state.report;
    var title=reportNames[type],sections=[];
    if(type==='scene')sections=[
      ['وضعیت',s.ti+' — '+s.sb],
      ['مالک و خروجی',l.r+'؛ خروجی: '+l.o],
      ['کنترل و شکست محتمل',l.c+'؛ '+l.f],
      ['شواهد',evidenceLabel(s.card.tr)+'؛ '+s.card.sr+'؛ '+(SCENE_TRACE[idx]||[]).join(' / ')]
    ];
    else if(type==='route')sections=[
      ['تصمیم پیشنهادی','مقایسهٔ خط لولهٔ مستقیم با مسیرهای کش‌محور و اعتبارسنجی‌شده بر مبنای پوشش، تازگی و برچسب.'],
      ['شرط تصمیم','پوشش هسته بالاتر از ۸۰٪ و کیفیت بالاتر از ۷۰٪؛ تازگی باید از کانکتور زنده تأیید شود.'],
      ['دروازهٔ انسانی','تغییر وزن یا انتشار نیازمند تأیید مالک رجیستر و ثبت اثر انگشت است.']
    ];
    else if(type==='crisis')sections=[
      ['رخداد مرجع','افت پوشش در اثر قطعی منبع یا تأخیر انتشار؛ افق اثر ۴۸ ساعت تا ۶ روز.'],
      ['اثر مدل','پوشش: ۹ تا ۲۶ درصد افت؛ جایگزین: کش کهنه یا منبع پشتیبان با برچسب.'],
      ['اقدام','اعتبارسنجی کانکتور، اطلاع‌رسانی مالک منبع، فعال‌سازی جایگزین و ثبت در دفتر رویداد.']
    ];
    else if(type==='capa')sections=[
      ['کمبود','کمبود پوشش، مغایرت رجیستر یا ورود دادهٔ نامعتبر با وضعیت کمبود/رد/نامعلوم.'],
      ['مهار فوری','توقف بارگیری منبع متخلف، قفل نسخه یا برچسب ناقص تا موعد ۷ تا ۱۴ روز.'],
      ['اصلاحی و پیشگیرانه','نسخه‌بندی اجباری، درجه‌بندی کانکتور، وزن اصلاحی و آزمون میدانی.']
    ];
    else sections=[
      ['نمای مدیریتی','زنجیرهٔ ۷۵ صحنه‌ای از منبع خام تا کارت تصمیم با تمرکز بر شاهد، کنترل و ردیابی‌پذیری.'],
      ['سیگنال‌های اولویت‌دار','قطعی سهمیهٔ ماهواره‌ای، مغایرت رجیستر ۱۶۴، کالیبراسیون معلق و تکمیل‌نشدن پیمایش.'],
      ['تصمیم‌های لازم','۱) جایگزین ماهواره‌ای؛ ۲) تأیید کالیبراسیون؛ ۳) تکمیل پیمایش؛ ۴) تعیین مالک کمبود.'],
      ['محدودیت داده','این خروجی از دادهٔ مرجع محلی تولید شده؛ اتصال زنده وجود ندارد و اعداد باید تأیید شوند.']
    ];
    return {title:title,scene:idx+1,generated:new Date().toLocaleString('fa-IR'),sections:sections,metric:m};
  }
  function reportHtml(d){
    return '<div class="p4ReportTitle"><span class="p4Badge live">AUTO-DRAFT · نیازمند تأیید</span><h4>'+d.title+'</h4>'+
      '<p class="p4Muted">شناسه: ARA-'+String(d.scene).padStart(3,'0')+' · تولید محلی: '+d.generated+'</p></div>'+
      '<div class="p4ReportBody">'+d.sections.map(function(x){return '<h5>'+x[0]+'</h5><p>'+x[1]+'</p>'}).join('')+
      '<h5>ردیابی</h5><p>صحنه '+num(d.scene)+' · '+x4(sceneTitle(d.scene-1))+' · '+x4((SCENE_TRACE[d.scene-1]||[]).join(' / '))+'</p></div>';
  }
  function download(name,text,type){
    var a=document.createElement('a'),blob=new Blob([text],{type:type||'text/plain;charset=utf-8'});
    a.href=URL.createObjectURL(blob);a.download=name;
    document.body.appendChild(a);a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},500);
  }

  function renderReports(){
    var d=reportData();
    var html='<div class="p4Head"><div><small>AUTO-REPORTING</small><h3>گزارش‌ساز خودکار</h3></div>'+
      '<p>پیش‌نویس مدیریتی از دادهٔ مرجع؛ برچسب AUTO-DRAFT تا تأیید انسانی حفظ می‌شود.</p></div>';
    html+='<div class="p4ReportTypes" style="margin-top:12px">'+Object.keys(reportNames).map(function(k){
      return '<button class="p4ReportType '+(state.report===k?'on':'')+'" data-report="'+k+'"><b>'+reportNames[k]+'</b>پیش‌نویس ردیابی‌پذیر</button>';
    }).join('')+'</div>';
    html+='<article class="p4Card p4Report" id="p4Report">'+reportHtml(d)+'</article>'+
      '<div class="p4Actions"><button class="p4Btn primary" id="p4Txt">دریافت TXT</button>'+
      '<button class="p4Btn" id="p4Json">دریافت JSON</button>'+
      '<button class="p4Btn" id="p4Print">چاپ / PDF</button>'+
      '<button class="p4Btn" data-jump="'+(d.scene-1)+'">بازکردن صحنهٔ مرجع</button></div>';
    stage.innerHTML=html;
    bindJumps();
    stage.querySelectorAll('[data-report]').forEach(function(b){
      b.onclick=function(){state.report=b.dataset.report;renderReports();};
    });
    $4('p4Txt').onclick=function(){
      var x=reportData();
      var txt=x.title+'\nشناسه: ARA-'+String(x.scene).padStart(3,'0')+'\n\n'+
        x.sections.map(function(s){return s[0]+'\n'+s[1]}).join('\n\n');
      download('phase4-report-fa.txt',txt);
    };
    $4('p4Json').onclick=function(){download('phase4-report-fa.json',JSON.stringify(reportData(),null,2),'application/json;charset=utf-8')};
    $4('p4Print').onclick=function(){window.print()};
  }
  /* ---------- dispatcher ---------- */
  function bindJumps(){
    stage.querySelectorAll('[data-jump]').forEach(function(b){
      b.onclick=function(){jump(parseInt(b.dataset.jump,10));close();};
    });
  }
  function render(){
    document.querySelectorAll('.p4NavBtn').forEach(function(b){
      b.classList.toggle('on',b.dataset.p4view===view);
    });
    if(view==='assistant')renderAssistant();
    else if(view==='search')renderSearch();
    else if(view==='connectors')renderConnectors();
    else if(view==='alerts')renderAlerts();
    else if(view==='discrepancy')renderDiscrepancy();
    else renderReports();
    stage.scrollTop=0;
  }
  function open(v){
    if(document.getElementById('p3Lab'))document.getElementById('p3Lab').classList.remove('on');
    if(document.getElementById('p2Workspace'))document.getElementById('p2Workspace').classList.remove('on');
    document.querySelectorAll('.p1Panel.on').forEach(function(x){x.classList.remove('on');x.setAttribute('aria-hidden','true')});
    view=v||'assistant';
    hub.classList.add('on');hub.setAttribute('aria-hidden','false');
    $4('p4Launch').setAttribute('aria-expanded','true');
    playing=false;render();
    setTimeout(function(){$4('p4Close').focus()},60);
  }
  function close(){
    hub.classList.remove('on');hub.setAttribute('aria-hidden','true');
    $4('p4Launch').setAttribute('aria-expanded','false');
    $4('p4Launch').focus();
  }
  $4('p4Launch').addEventListener('click',function(){open('assistant')});
  $4('p4Close').addEventListener('click',close);
  document.querySelectorAll('.p4NavBtn').forEach(function(b){
    b.onclick=function(){view=b.dataset.p4view;render();};
  });
  window.addEventListener('keydown',function(e){
    var typing=/input|textarea|select/i.test((e.target.tagName||''));
    if(hub.classList.contains('on')){
      if(e.key==='Escape'||((e.key==='i'||e.key==='I')&&!typing)){
        e.preventDefault();e.stopImmediatePropagation();close();return;
      }
      if(!typing){e.preventDefault();e.stopImmediatePropagation();}
      return;
    }
    if(!typing&&(e.key==='i'||e.key==='I')){
      e.preventDefault();e.stopImmediatePropagation();open('assistant');
    }
  },true);
})();
