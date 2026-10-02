/* ===== PHASE 2 · OPERATIONAL DEPTH CONTROLLER · ARA ===== */
(function(){
  var $2=function(id){return document.getElementById(id)},
      ws=$2('p2Workspace'),stage=$2('p2Stage'),
      view='nodes',nodeSel='kernel',p2LastScene=-1;
  /* یازده وضعیت استاندارد داده (واژگان مشترک پلتفرم) */
  var DATA_STATES=[
    ['T','کامل','تمام فیلدهای الزامی معتبر و پوشش کافی','#42d990'],
    ['P','پوشش جزئی','برخی زیرگروه‌ها فاقد داده؛ صریح، نه صفر','#4da3ff'],
    ['M','مغایرت','دو منبع ناسازگار؛ نیازمند حل اختلاف','#ff9d42'],
    ['V','در اعتبارسنجی','در صف کنترل فیلد و درجه‌بندی','#b892ff'],
    ['D','کهنه','خارج از تناوب مجاز منبع','#7f91aa'],
    ['S','کمبود منبع','قطعی منبع بدون پشتیبان','#ff6577'],
    ['R','رد شده','در صف رد؛ مسیر بازگشت یا ارجاع انسانی','#ff6577'],
    ['B','بلوک','شرط انتشار برقرار نیست','#ff6577'],
    ['C','کالیبره‌نشده','وزن/آستانه در انتظار تأیید','#ffd166'],
    ['N','نامعلوم','سطح شاهد UNKNOWN؛ هرگز به‌عنوان واقعیت نمایش داده نمی‌شود','#7f91aa'],
    ['X','معوق','نیازمند اعتبارسنجی انسانی','#f4698a']
  ];
  /* ماتریس RACI گام‌های فرایند داده */
  var ROLES=['مالک منبع','سرویس ورود','مالک رجیستر','مالک هسته','مالک تحلیل','مالک انتشار'];
  var RACI=[
    ['ثبت منیفست منبع',['R','A','C','I','I','I']],
    ['واکشی و اعتبارسنجی',['I','R','C','A','I','I']],
    ['نگاشت به کد شاخص',['C','I','R','A','I','I']],
    ['وزن‌دهی و تجمیع',['I','I','C','R','A','C']],
    ['تشخیص گلوگاه',['I','I','I','C','R','A']],
    ['کارت تصمیم',['I','I','I','C','R','A']],
    ['دروازهٔ انتشار',['C','I','C','I','C','R']],
    ['حل اختلاف رجیستر',['C','I','R','C','I','A']],
    ['ثبت CAPA',['R','C','I','I','C','R']],
    ['بازخورد و یادگیری',['C','R','I','I','C','A']]
  ];
  /* مسیر بحرانی: گام‌های پردازش با زمان مرجع */
  var CRIT=[
    ['ثبت منیفست و کشف منبع','۱۰ دقیقه',1],
    ['واکشی و کش تازه/کهنه','۲ دقیقه',1],
    ['اعتبارسنجی فیلد و درجه‌بندی','۵ دقیقه',1],
    ['نگاشت متغیر خام → کد شاخص','۳ دقیقه',1],
    ['نرمال‌سازی ۰..۱۰۰','۲ دقیقه',1],
    ['وزن‌دهی نسخه‌دار و تجمیع','۳ دقیقه',1],
    ['سکور زنجیرهٔ C-A-U-E-O','۲ دقیقه',1],
    ['تشخیص گلوگاه','۲ دقیقه',0],
    ['کارت تصمیم محله','۴ دقیقه',1],
    ['شش شرط دروازهٔ انتشار','۵ دقیقه',1],
    ['تأیید انسانی و انتشار','۸ دقیقه',1]
  ];
  function e2(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function head(small,title,desc,note){
    return '<div class="p2StageHead"><div><small>'+e2(small)+'</small><h3>'+e2(title)+'</h3></div>'+
           '<p>'+e2(desc||'')+(note?'<br>'+e2(note):'')+'</p></div>';
  }
  function sceneNo(i){return faNum(i+1)}
  function current(){return sceneAt(t)}
  /* ---------- views ---------- */
  function renderNodes(){
    var rows=[[8,'ردیف A · منابع داده'],['0','ردیف B · ورود، دروازه و انبار'],
              ['-9','ردیف C · رجیسترهای مرجع'],['-18','ردیف D · هستهٔ محاسبات'],
              ['-27','ردیف E · تحلیل و تصمیم'],['-36','ردیف F · سرو و اتصال']];
    var html=head('NODE MAP','نقشهٔ گره‌های داده','هر گره یک گام مشخص از زنجیرهٔ منبع تا تصمیم است؛ با کلیک روی نام، صحنهٔ معرف آن باز می‌شود.');
    html+='<div class="p2Stats">'+
      '<div class="p2Stat"><strong>'+faNum(NODES.length)+'</strong><span>گرهٔ داده و موتور</span></div>'+
      '<div class="p2Stat"><strong>'+faNum(EDGES.length)+'</strong><span>جریان فعال</span></div>'+
      '<div class="p2Stat"><strong>'+faNum(SCENES.length)+'</strong><span>صحنهٔ روایی</span></div>'+
      '<div class="p2Stat"><strong>'+faNum(Object.keys(CHCOL).length)+'</strong><span>فصل روایی</span></div></div>';
    rows.forEach(function(row){
      var list=NODES.filter(function(n){return String(n.y)===row[0]});
      html+='<div class="p2Card" style="margin-bottom:9px"><div class="p2CardHd"><h4>'+e2(row[1])+'</h4><span class="p2Badge">'+faNum(list.length)+'</span></div><div class="p2Tags">'+
        list.map(function(n){
          var i=-1;
          for(var k=0;k<SCENES.length;k++)if(SCENES[k].hot.indexOf(n.id)>-1){i=k;break}
          return '<button class="p2Tag" type="button" data-node="'+n.id+'" data-scene="'+i+'">'+
                 e2(n.fa)+'<small>'+e2(KINDFA[n.kind]||'')+'</small></button>';
        }).join('')+'</div></div>';
    });
    stage.innerHTML=html;
    stage.querySelectorAll('[data-node]').forEach(function(b){
      b.onclick=function(){
        nodeSel=b.dataset.node;
        if(parseInt(b.dataset.scene,10)>=0)jump(parseInt(b.dataset.scene,10));
      };
    });
  }

  function renderFlows(){
    var fams=['source','ingest','store','compute','decision','serve','audit'];
    var html=head('MULTI-FLOW','نمایش چندجریانی','شش خانوادهٔ جریان داده روی میدان ایزومتریک؛ با خاموش‌کردن خانواده، مسیر و بسته‌های آن حذف می‌شوند.');
    fams.forEach(function(f){
      var list=EDGES.filter(function(e){return e.kind===f});
      html+='<div class="p2Card" style="margin-bottom:9px;border-right:3px solid '+KCOL[f]+'">'+
        '<div class="p2CardHd"><h4>'+e2(KFA[f])+'</h4><span class="p2Badge">'+faNum(list.length)+' جریان</span></div>'+
        '<div class="p2Tags">'+list.map(function(e){
          var ids=e.pts.length>1?'چند نقطه':e.id;
          return '<span class="p2Tag" title="'+e2(e.id)+'">'+e2(e.id)+(e.dash?' · خط‌چین':'')+'</span>';
        }).join('')+'</div>'+
        '<p class="p2Muted" style="margin-top:8px">بسته‌ی در جریان: '+e2(moverKind(f)==='record'?'رکورد خام':(moverKind(f)==='stream'?'جریان استریم':(moverKind(f)==='table'?'جدول/رجیستر':(moverKind(f)==='metric'?'مقدار شاخص':(moverKind(f)==='flag'?'کارت تصمیم':(moverKind(f)==='query'?'درخواست API':'سند'))))))+
        ' · با کلید ۱ تا ۶ قابل خاموش‌کردن است.</p></div>';
    });
    stage.innerHTML=html;
  }
  function renderIndicators(){
    var i=current();
    var html=head('INDICATOR EXPLORER','کاوشگر شاخص‌ها','رجیسترهای نسخه‌دار پلتفرم؛ مقادیر از صحنه‌ها و چکیده‌های مرجع خوانده می‌شوند، نه از اعداد فرضی.');
    html+='<div class="p2Stats">'+
      '<div class="p2Stat"><strong>۴۱۹</strong><span>شاخص مادر (رجیستر ۴۱۹)</span></div>'+
      '<div class="p2Stat"><strong>۱۶۴</strong><span>شاخص تصمیم‌یار</span></div>'+
      '<div class="p2Stat"><strong>۴۰</strong><span>هستهٔ شاخص</span></div>'+
      '<div class="p2Stat"><strong>۸۳</strong><span>سنجهٔ برخط</span></div></div>';
    /* آخرین شاخص‌هایی که در صحنه‌های این فصل دیده شده‌اند */
    var ch=SCENES[i].ch,seen=[];
    for(var k=0;k<SCENES.length&&seen.length<8;k++){
      var m=SCENE_METRICS[k];
      if(SCENES[k].ch===ch&&m)seen.push([k,m]);
    }
    html+='<div class="p2Card"><div class="p2CardHd"><h4>شاخص‌های فصل «'+e2(ch)+'»</h4><span class="p2Badge">'+faNum(seen.length)+'</span></div><div class="p2Tags">'+
      seen.map(function(pair){
        var m=pair[1];
        return '<span class="p2Tag">'+e2(m[0])+' · '+e2(m[1])+'<small>'+m[3]+'٪</small></span>';
      }).join('')+'</div></div>';
    html+='<div class="p2Card" style="margin-top:9px"><div class="p2CardHd"><h4>کلاس خودکارسازی ۱۶۴ شاخص</h4><span class="p2Badge">A–D</span></div>'+
      '<div class="p2Tags"><span class="p2Tag">A خودکار<small>۳۸</small></span><span class="p2Tag">B نیمه‌خودکار<small>۳۱</small></span>'+
      '<span class="p2Tag">C اپراتوری<small>۲۲</small></span><span class="p2Tag">D قراردادی<small>۹</small></span></div></div>';
    stage.innerHTML=html;
    stage.querySelectorAll('[data-p2jump]').forEach(bindJump);
  }
  function renderStatus(){
    var html=head('DATA STATE MACHINE','ماشین وضعیت داده','یازده وضعیت استاندارد؛ هر گره، هر مقدار و هر خروجی دقیقاً یکی از این وضعیت‌ها را دارد.');
    html+='<div class="p2Card"><div class="p2CardHd"><h4>واژگان مشترک وضعیت</h4><span class="p2Badge">'+faNum(DATA_STATES.length)+'</span></div>'+
      '<div class="p2Tags">'+DATA_STATES.map(function(s){
        return '<span class="p2Tag" style="border-right:3px solid '+s[3]+'"><b>'+s[0]+' · '+e2(s[1])+'</b><small>'+e2(s[2])+'</small></span>';
      }).join('')+'</div></div>';
    html+='<div class="p2Card" style="margin-top:9px"><div class="p2CardHd"><h4>قاعدهٔ گذار</h4><span class="p2Badge">RULE</span></div>'+
      '<p class="p2Muted">وضعیت‌ها فقط با شاهد تغییر می‌کنند: T ← V (پس از اعتبارسنجی)، V ← M یا S ← R (پس از برقراری مغایرت یا رد)، M ← X (ارجاع انسانی) و X ← T/B (پس از تصمیم). هیچ مقداری بدون گذار ثبت‌شده جابه‌جا نمی‌شود.</p></div>';
    stage.innerHTML=html;
  }
  function renderControls(){
    var html=head('CONTROL MATRIX','ماتریس کنترل','کنترل، مالک و پیامد شکست هر فصل از زنجیرهٔ داده؛ از داده‌های lensِ صحنه‌ها ساخته می‌شود.');
    var seen={},rows=[];
    for(var i=0;i<SCENES.length;i++){
      var l=SCENE_LENS[i];
      if(!l)continue;
      var key=l.r+'|'+l.c;
      if(!seen[key]){seen[key]=1;rows.push([i,l]);}
    }
    html+='<div class="p2Tags">'+rows.slice(0,14).map(function(pair){
      var i=pair[0],l=pair[1];
      return '<span class="p2Tag"><b>'+e2(l.r)+'</b><small>کنترل: '+e2(l.c)+'</small><small class="p2Jump" data-p2jump="'+i+'" role="button" tabindex="0">صحنهٔ '+sceneNo(i)+' ↗</small></span>';
    }).join('')+'</div>';
    html+='<div class="p2Card" style="margin-top:9px"><div class="p2CardHd"><h4>پیامدهای شکست</h4><span class="p2Badge">FAIL</span></div>'+
      '<div class="p2Tags">'+rows.slice(0,8).map(function(pair){
        return '<span class="p2Tag" style="border-right:3px solid #ff6577">'+e2(SCENE_LENS[pair[0]].f)+'</span>';
      }).join('')+'</div></div>';
    stage.innerHTML=html;
    stage.querySelectorAll('[data-p2jump]').forEach(bindJump);
  }

  function renderRaci(){
    var html=head('RACI & DECISION RIGHTS','RACI و حقوق تصمیم','شش نقش کلیدی داده؛ R=مسئول، A=پاسخ‌گو، C=مشاور، I=مطلع.');
    html+='<div class="p2Card"><div class="p2CardHd"><h4>ماتریس</h4><span class="p2Badge">'+faNum(RACI.length)+'</span></div>'+
      '<div class="p2Tags"><span class="p2Tag"><b>گام</b>'+ROLES.map(function(r){return '<small>'+e2(r)+'</small>'}).join('')+'</span>'+
      RACI.map(function(row){
        return '<span class="p2Tag"><b>'+e2(row[0])+'</b>'+row[1].map(function(v){
          var col=v==='R'?'#42d990':(v==='A'?'#ffd166':(v==='C'?'#4da3ff':'#7f91aa'));
          return '<small style="color:'+col+'">'+v+'</small>';
        }).join('')+'</span>';
      }).join('')+'</div></div>';
    html+='<div class="p2Card" style="margin-top:9px"><div class="p2CardHd"><h4>حقوق تصمیم</h4><span class="p2Badge">GATE</span></div>'+
      '<p class="p2Muted">A فقط یکی است: انتشار مالک انتشار، حل اختلاف رجیستر مالک رجیستر، و اعداد نهایی مالک هسته. تصمیم با اثر مالی یا انتشاری همیشه نیازمند تأیید انسانی و ثبت در دفتر رویداد است.</p></div>';
    stage.innerHTML=html;
  }
  function renderCritical(){
    var html=head('CRITICAL PATH','مسیر بحرانی داده','ترتیب الزامی پردازش؛ گام‌های شرطی با رنگ جدا نشان داده می‌شوند.');
    html+='<div class="p2Card"><div class="p2CardHd"><h4>۱۱ گام پردازش</h4><span class="p2Badge">'+faNum(CRIT.length)+'</span></div><div class="p2Tags">'+
      CRIT.map(function(c,i2){
        var col=c[2]?'#42d990':'#ffd166';
        return '<span class="p2Tag" style="border-right:3px solid '+col+'"><b>'+faNum(i2+1)+' · '+e2(c[0])+'</b><small>'+e2(c[1])+(c[2]?' · الزامی':' · شرطی')+'</small></span>';
      }).join('')+'</div></div>';
    html+='<div class="p2Stats" style="margin-top:9px">'+
      '<div class="p2Stat"><strong>۱۰</strong><span>گام الزامی</span></div>'+
      '<div class="p2Stat"><strong>۱</strong><span>گام شرطی</span></div>'+
      '<div class="p2Stat"><strong>۴۵</strong><span>دقیقه چرخهٔ کامل</span></div>'+
      '<div class="p2Stat"><strong>۶</strong><span>دروازهٔ انتشار</span></div></div>';
    html+='<div class="p2Card" style="margin-top:9px"><div class="p2CardHd"><h4>تمرین گلوگاه</h4><span class="p2Badge">BOTTLENECK</span></div>'+
      '<p class="p2Muted">گام ۱۰ (تأیید انسانی، ۸ دقیقه) تنگناست؛ گام‌های ۲ و ۵ می‌توانند موازی شوند. تشخیص گلوگاه قاعده‌محور و مستقل از مدل است و در صحنهٔ ۴۸ روایت می‌شود.</p>'+
      '<div class="p2Actions"><button class="p2Jump" type="button" data-p2jump="47">صحنهٔ گلوگاه ↗</button></div></div>';
    stage.innerHTML=html;
    stage.querySelectorAll('[data-p2jump]').forEach(bindJump);
  }

  function renderDrill(){
    var i=current();p2LastScene=i;
    var s=SCENES[i],l=SCENE_LENS[i],m=SCENE_METRICS[i],tr=SCENE_TRACE[i]||[];
    var actors=s.hot.filter(function(x){return ND[x]}).map(function(x){return ND[x].fa});
    var flows=s.hot.filter(function(x){return ED[x]});
    var html=head('SCENE DRILL-DOWN','جزئیات صحنه','از صحنه به گره، جریان، کنترل و شناسهٔ ردیابی');
    html+='<div class="p2Card"><small>'+e2(s.ch)+' · صحنه '+sceneNo(i)+'</small><h3 style="margin:6px 0">'+e2(s.ti)+'</h3>'+
      '<p class="p2Muted">'+e2(s.sb)+'<br>'+e2(s.card.tx)+'</p>'+
      '<div class="p2Actions"><button class="p2Jump" type="button" data-returnscene="1">بازگشت به صحنه</button></div></div>';
    html+='<div class="p2Stats" style="margin-top:9px">'+
      '<div class="p2Stat"><strong>'+e2(l.r)+'</strong><span>خروجی: '+e2(l.o)+'</span></div>'+
      '<div class="p2Stat"><strong>'+e2(m[0])+'</strong><span>'+e2(m[1])+' · '+m[3]+'٪</span></div>'+
      '<div class="p2Stat"><strong>'+e2(TIERFA[s.card.tr])+'</strong><span>وضعیت شاهد</span></div>'+
      '<div class="p2Stat"><strong>'+e2(tr.join(' · '))+'</strong><span>شناسه‌های ردیابی</span></div></div>';
    html+='<div class="p2Card" style="margin-top:9px"><div class="p2CardHd"><h4>کنترل و شکست</h4><span class="p2Badge">LENS</span></div>'+
      '<div class="p2Tags"><span class="p2Tag"><b>کنترل</b><small>'+e2(l.c)+'</small></span>'+
      '<span class="p2Tag"><b>پیامد شکست</b><small>'+e2(l.f)+'</small></span>'+
      '<span class="p2Tag"><b>منبع</b><small>'+e2(s.card.sr)+'</small></span></div></div>';
    html+='<div class="p2Card" style="margin-top:9px"><div class="p2CardHd"><h4>گره‌ها و جریان‌های فعال</h4><span class="p2Badge">'+faNum(s.hot.length)+'</span></div><div class="p2Tags">'+
      actors.map(function(a){return '<span class="p2Tag">'+e2(a)+'</span>'}).join('')+
      flows.map(function(f){return '<span class="p2Tag">'+e2(f.id)+' <small>'+e2(KFA[f.kind]||f.kind)+'</small></span>'}).join('')+
      '</div></div>';
    stage.innerHTML=html;
    var rs=stage.querySelector('[data-returnscene]');
    if(rs)rs.onclick=function(){close(false)};
    stage.querySelectorAll('[data-p2jump]').forEach(bindJump);
    $2('p2SceneNow').textContent='صحنهٔ جاری: '+sceneNo(i)+' · '+s.ch;
  }
  function bindJump(el){
    el.onclick=function(){jump(parseInt(el.dataset.p2jump,10));selectView('drill')};
  }
  function render(){
    document.querySelectorAll('.p2NavBtn').forEach(function(b){
      b.classList.toggle('on',b.dataset.p2view===view);
    });
    if(view==='nodes')renderNodes();
    else if(view==='flows')renderFlows();
    else if(view==='indicators')renderIndicators();
    else if(view==='status')renderStatus();
    else if(view==='controls')renderControls();
    else if(view==='raci')renderRaci();
    else if(view==='critical')renderCritical();
    else renderDrill();
    $2('p2SceneNow').textContent='صحنهٔ جاری: '+sceneNo(current())+' · '+SCENES[current()].ch;
    stage.scrollTop=0;
  }
  function selectView(v){view=v||'nodes';render()}
  function open(v){
    if(document.getElementById('p3Lab'))document.getElementById('p3Lab').classList.remove('on');
    if(document.getElementById('p4Hub'))document.getElementById('p4Hub').classList.remove('on');
    document.querySelectorAll('.p1Panel.on').forEach(function(x){x.classList.remove('on');x.setAttribute('aria-hidden','true')});
    ws.classList.add('on');ws.setAttribute('aria-hidden','false');
    $2('p2Launch').setAttribute('aria-expanded','true');
    playing=false;selectView(v||'nodes');
    setTimeout(function(){var c=$2('p2Close');if(c)c.focus()},60);
  }
  function close(returnFocus){
    ws.classList.remove('on');ws.setAttribute('aria-hidden','true');
    $2('p2Launch').setAttribute('aria-expanded','false');
    if(returnFocus)$2('p2Launch').focus();
  }
  $2('p2Launch').addEventListener('click',function(){open('nodes')});
  $2('p2Close').addEventListener('click',function(){close(true)});
  document.querySelectorAll('.p2NavBtn').forEach(function(b){
    b.addEventListener('click',function(){selectView(b.dataset.p2view)});
  });
  window.addEventListener('keydown',function(e){
    var typing=/input|textarea/i.test((e.target.tagName||''));
    if(e.key==='Escape'&&ws.classList.contains('on')){
      e.stopImmediatePropagation();close(true);
    }else if(!(document.getElementById('p4Hub')&&document.getElementById('p4Hub').classList.contains('on'))&&
             !(document.getElementById('p3Lab')&&document.getElementById('p3Lab').classList.contains('on'))&&
             !typing&&(e.key==='o'||e.key==='O')){
      ws.classList.contains('on')?close(true):open('nodes');
    }
  },true);
  var h2=updHUD;
  updHUD=function(r){
    h2(r);
    if(ws.classList.contains('on')){
      $2('p2SceneNow').textContent='صحنهٔ جاری: '+sceneNo(r.idx)+' · '+r.s.ch;
      if(view==='drill'&&r.idx!==p2LastScene)renderDrill();
    }
  };
})();

