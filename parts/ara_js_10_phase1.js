/* ===== PHASE 1 · INTERACTIVE PRESENTATION CONTROLLER · ARA ===== */
(function(){
  var state={panel:null,mode:'cinematic',layer:'summary',narr:'short',ribbon:false,last:-1};
  var $=function(id){return document.getElementById(id)},
      panels=[].slice.call(document.querySelectorAll('.p1Panel')),
      dock=$('p1Dock'),live=$('p1Live');
  /* واژه‌نامهٔ عملیاتی پلتفرم آرا */
  var glossary={
    'منیفست':'منیفست اعلانی؛ تنها منبع حقیقت فرادادهٔ هر منبع داده (مالک، مجوز، تناوب، دستهٔ خودکارسازی).',
    'رجیستر':'انبار نسخه‌دار شاخص‌ها/منابع/وزن‌ها؛ هر تغییر نسخه و اثر انگشت دارد.',
    'نرمال‌سازی':'تبدیل مقدار خام به نمرهٔ مقیاس ۰ تا ۱۰۰ با جهت و واحد مشخص.',
    'Q و T و R':'سه خروجی کیفیت (کیفیت، اطمینان، پوشش) که هرگز با هم ادغام نمی‌شوند.',
    'CAPA':'اقدام اصلاحی و پیشگیرانه برای حذف علت ریشه‌ای شکست زنجیرهٔ داده.',
    'RACI':'ماتریس مسئول، پاسخ‌گو، مشاور و مطلع برای هر گام فرایند داده.',
    'KPI':'شاخص کلیدی عملکرد برای سنجش نتیجه یا کیفیت اجرا.',
    'ETA':'تخمین زمان تکمیل ورود داده یا انتشار؛ در لایهٔ منابع تغذیه می‌شود.',
    'DQ':'کیفیت داده (Data Quality)؛ شامل کمبود، هاله، مرکزگرایی و سوگیری تأییدی.',
    'SLA':'توافق سطح خدمت: تازگی، تناوب و زمان پاسخ هر منبع داده.',
    'UCP':'پروتکل حل اختلاف پنج‌گامی برای تعارض میان نسخه‌های رجیستر.',
    'استنتاج':'سطح شاهد INFERENCE؛ قابل اتکا اما نه راستی‌آزمایی‌شده.',
    'تعارض':'سطح شاهد CONFLICT؛ دو منبع ناسازگار و نیازمند ارجاع انسانی.',
    'کش':'حافظهٔ تازه/کهنهٔ منابع؛ کش کهنه مسیر جایگزین هنگام قطعی منبع است.',
    'منیفست‌گذاری':'ثبت اعلانی منبع پیش از هر واکشی؛ بدون آن ورود داده مجاز نیست.',
    'پوشش':'نسبت خانواده‌های تکمیل‌شدهٔ شاخص؛ زیر ۶۰٪ شاخص منتشر نمی‌شود.',
    'دروازهٔ انتشار':'شش شرط پیش از خروجی: کد، سطح شاهد، نبود بلوک، پوشش هسته، پوشش سرمایه، کیفیت.',
    'بلوک':'وضعیت ممنوعیت انتشار؛ شاخص یا گزارش تا رفع شرط خروجی مسدود است.',
    'اثر انگشت':'SHA هر نسخهٔ محاسبه؛ عدد بدون آن قابل انتساب نیست.',
    'کلاس خودکارسازی':'طبقه‌بندی A تا D هر شاخص بر اساس میزان خودکار بودن محاسبه.'
  };
  function esc(x){return String(x==null?'':x).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
  function sceneColor(ch){return (window.CHCOL&&CHCOL[ch])||'#42d7ff'}
  function announce(x){if(live)live.textContent=x}
  function closePanels(returnFocus){
    panels.forEach(function(p){p.classList.remove('on');p.setAttribute('aria-hidden','true')});
    document.body.classList.remove('p1-panel-open');
    document.querySelectorAll('.p1Tool[data-panel]').forEach(function(b){b.setAttribute('aria-expanded','false')});
    var old=state.panel;state.panel=null;
    if(returnFocus&&old){var b=document.querySelector('.p1Tool[data-panel="'+old.id+'"]');if(b)b.focus()}
  }
  function openPanel(id){
    var p=$(id);if(!p)return;
    if(state.panel===p){closePanels(true);return}
    closePanels(false);state.panel=p;p.classList.add('on');p.setAttribute('aria-hidden','false');
    document.body.classList.add('p1-panel-open');
    var b=document.querySelector('.p1Tool[data-panel="'+id+'"]');
    if(b)b.setAttribute('aria-expanded','true');
    setTimeout(function(){
      var f=id==='p1SearchPanel'?$('p1SearchInput'):p.querySelector('input,button');
      if(f)f.focus();
    },60);
    if(id==='p1LayerPanel')renderLayers();
    if(id==='p1NarrPanel')renderNarr();
    var h=p.querySelector('h2');if(h)announce(h.textContent);
  }
  document.querySelectorAll('.p1Tool[data-panel]').forEach(function(b){
    b.addEventListener('click',function(){openPanel(b.dataset.panel)});
  });
  document.querySelectorAll('.p1Close').forEach(function(b){
    b.addEventListener('click',function(){closePanels(true)});
  });

  /* ---- navigation: mini-map + chapter list ---- */
  function buildNavigation(){
    var mm=$('p1MiniMap'),cc=$('p1Chapters');if(!mm||!cc)return;
    var chs=[],map={};
    SCENES.forEach(function(s,i){
      if(!map[s.ch]){map[s.ch]={first:i,count:0};chs.push(s.ch)}
      map[s.ch].count++;
      var d=document.createElement('button');
      d.className='p1MiniDot';d.type='button';
      d.setAttribute('role','listitem');
      d.setAttribute('aria-label','صحنه '+faNum(i+1)+'، '+s.ti);
      d.title=s.ti;d.dataset.i=i;
      d.style.setProperty('--dot',sceneColor(s.ch));
      d.addEventListener('click',function(){jump(i);closePanels(false)});
      mm.appendChild(d);
    });
    chs.forEach(function(ch){
      var b=document.createElement('button');
      b.className='p1Chapter';b.type='button';b.dataset.ch=ch;
      b.innerHTML='<span>'+esc(ch)+'</span><b>'+faNum(map[ch].count)+' صحنه</b>';
      b.addEventListener('click',function(){jump(map[ch].first);closePanels(false)});
      cc.appendChild(b);
    });
  }
  function updateNavigation(i){
    document.querySelectorAll('.p1MiniDot').forEach(function(d){
      var di=parseInt(d.dataset.i,10);
      d.classList.toggle('on',di===i);
      d.classList.toggle('past',di<i);
      if(di===i)d.setAttribute('aria-current','true');else d.removeAttribute('aria-current');
    });
    document.querySelectorAll('.p1Chapter').forEach(function(b){
      var s=SCENES[i];if(!s)return;
      b.classList.toggle('on',b.dataset.ch===s.ch);
    });
  }
  /* ---- search ---- */
  function searchable(i){
    var s=SCENES[i],l=SCENE_LENS[i]||{},m=SCENE_METRICS[i]||[];
    var nodes=s.hot.filter(function(x){return ND[x]}).map(function(x){return ND[x].fa});
    return [s.ti,s.sb,s.ch,s.card.tx,s.card.sr,l.r,l.o,l.c,l.f,m[0],m[1]].concat(nodes).join(' ');
  }
  function runSearch(q){
    var box=$('p1SearchResults'),meta=$('p1SearchMeta');
    if(!box)return;
    q=(q||'').trim();
    if(!q){box.innerHTML='';if(meta)meta.textContent='';return}
    var hits=[],i;
    for(i=0;i<SCENES.length;i++)if(searchable(i).indexOf(q)>-1)hits.push(i);
    if(meta)meta.textContent=hits.length?'نتایج: '+faNum(hits.length)+' از '+faNum(SCENES.length):'نتیجه‌ای یافت نشد';
    box.innerHTML=hits.slice(0,40).map(function(i){
      var s=SCENES[i];
      return '<button class="p1Result" data-i="'+i+'" type="button"><b>صحنه '+faNum(i+1)+'</b><span>'+esc(s.ti)+'</span><em>'+esc(s.ch)+'</em></button>';
    }).join('')||'<p class="p1Hint">عبارت دیگری بیازمایید؛ جست‌وجو عنوان، متن، شاخص و نام گره‌ها را پوشش می‌دهد.</p>';
    box.querySelectorAll('.p1Result').forEach(function(b){
      b.addEventListener('click',function(){jump(parseInt(b.dataset.i,10));closePanels(false)});
    });
  }

  /* ---- layers ---- */
  function layerHTML(i,layer){
    var s=SCENES[i],l=SCENE_LENS[i]||{},m=SCENE_METRICS[i]||[],tr=SCENE_TRACE[i]||[];
    var nodes=s.hot.filter(function(x){return ND[x]}).map(function(x){return ND[x]});
    var edges=s.hot.filter(function(x){return ED[x]}).map(function(x){return ED[x]});
    function tbl(rows){return '<div class="p1LayerList">'+rows.join('')+'</div>'}
    if(layer==='summary'){
      return tbl([
        '<div class="p1LayerRow"><span>عنوان</span><b>'+esc(s.ti)+'</b></div>',
        '<div class="p1LayerRow"><span>چکیده</span><b>'+esc(s.sb)+'</b></div>',
        '<div class="p1LayerRow"><span>شاخص</span><b>'+esc(m[0])+' · '+esc(m[1])+' ('+m[3]+'٪)</b></div>',
        '<div class="p1LayerRow"><span>سطح شاهد</span><b style="color:'+(TIERCOL[s.card.tr]||'#fff')+'">'+TIERFA[s.card.tr]+'</b></div>',
        '<div class="p1LayerRow"><span>منبع</span><b>'+esc(s.card.sr)+'</b></div>'
      ]);
    }
    if(layer==='flow'){
      if(!nodes.length&&!edges.length)return '<p class="p1Hint">این صحنه گره یا جریان فعالی ندارد.</p>';
      return tbl([
        '<div class="p1LayerRow"><span>گره‌های فعال</span><b>'+nodes.map(function(n){return esc(n.fa)}).join(' · ')+'</b></div>',
        '<div class="p1LayerRow"><span>جریان‌ها</span><b>'+edges.map(function(e){return esc(e.id)+' ('+esc(KFA[e.kind]||e.kind)+')'}).join(' · ')+'</b></div>',
        '<div class="p1LayerRow"><span>خانواده‌های جریان</span><b>'+edges.map(function(e){return KFA[e.kind]||e.kind}).filter(function(v,i2,a){return a.indexOf(v)===i2}).join(' · ')+'</b></div>'
      ]);
    }
    if(layer==='control'){
      return tbl([
        '<div class="p1LayerRow"><span>مالک</span><b>'+esc(l.r)+'</b></div>',
        '<div class="p1LayerRow"><span>خروجی</span><b>'+esc(l.o)+'</b></div>',
        '<div class="p1LayerRow"><span>کنترل</span><b>'+esc(l.c)+'</b></div>',
        '<div class="p1LayerRow"><span>شناسه‌های ردیابی</span><b>'+esc(tr.join(' · '))+'</b></div>'
      ]);
    }
    if(layer==='risk'){
      return tbl([
        '<div class="p1LayerRow"><span>پیامد شکست</span><b>'+esc(l.f)+'</b></div>',
        '<div class="p1LayerRow"><span>سطح شاهد</span><b style="color:'+(TIERCOL[s.card.tr]||'#fff')+'">'+TIERFA[s.card.tr]+'</b></div>',
        '<div class="p1LayerRow"><span>مسیر جایگزین</span><b>'+(edges.some(function(e){return e.dash})?'خطوط‌چین روی میدان فعال‌اند':'بدون مسیر جایگزین در این صحنه')+'</b></div>'
      ]);
    }
    return tbl([
      '<div class="p1LayerRow"><span>منبع</span><b>'+esc(s.card.sr)+'</b></div>',
      '<div class="p1LayerRow"><span>سطح شاهد</span><b>'+TIERFA[s.card.tr]+'</b></div>',
      '<div class="p1LayerRow"><span>ردیابی</span><b>'+esc(tr.join(' · '))+'</b></div>'
    ]);
  }
  function renderLayers(){
    var i=sceneAt(t),title=$('p1LayerTitle'),box=$('p1LayerContent');
    if(title)title.textContent='لایه‌های صحنهٔ '+faNum(i+1);
    if(box)box.innerHTML=layerHTML(i,state.layer);
    document.querySelectorAll('#p1LayerTabs .p1Tab').forEach(function(b){
      b.classList.toggle('on',b.dataset.layer===state.layer);
    });
  }
  document.querySelectorAll('#p1LayerTabs .p1Tab').forEach(function(b){
    b.addEventListener('click',function(){state.layer=b.dataset.layer;renderLayers()});
  });

  /* ---- narration ---- */
  function narrText(i,kind){
    var s=SCENES[i],l=SCENE_LENS[i]||{},m=SCENE_METRICS[i]||[],tr=SCENE_TRACE[i]||[];
    var lead='صحنهٔ '+faNum(i+1)+' از '+faNum(SCENES.length)+'، فصل '+s.ch+'؛ '+s.ti+'. '+s.sb+'. ';
    if(kind==='exec')return lead+'شاخص: '+m[0]+' ('+m[1]+'). وضعیت شاهد: '+TIERFA[s.card.tr]+'. '+s.card.tx;
    var body=s.card.tx+' مالک: '+l.r+'. خروجی: '+l.o+'. کنترل: '+l.c+'.';
    if(kind==='long')body+=' پیامد شکست محتمل: '+l.f+'. ردیابی: '+tr.join('، ')+'. منبع: '+s.card.sr+'.';
    return lead+body;
  }
  function renderNarr(){
    var tx=narrText(sceneAt(t),state.narr),el=$('p1NarrText'),rib=$('p1NarrRibbon');
    if(el)el.textContent=tx;
    if(rib){
      rib.innerHTML='<b>روایت</b> '+esc(tx.slice(0,180))+(tx.length>180?'…':'');
      rib.setAttribute('aria-hidden',state.ribbon?'false':'true');
      rib.classList.toggle('on',state.ribbon);
    }
    document.querySelectorAll('#p1NarrTabs .p1Tab').forEach(function(b){
      b.classList.toggle('on',b.dataset.narr===state.narr);
    });
  }
  document.querySelectorAll('#p1NarrTabs .p1Tab').forEach(function(b){
    b.addEventListener('click',function(){state.narr=b.dataset.narr;renderNarr()});
  });
  var show=$('p1NarrShow'),speak=$('p1Speak'),stop=$('p1NarrStop');
  if(show)show.addEventListener('click',function(){
    state.ribbon=!state.ribbon;
    document.body.classList.toggle('narration-on',state.ribbon);
    renderNarr();announce(state.ribbon?'روایت روی نوار فعال شد':'روایت پنهان شد');
  });
  if(speak)speak.addEventListener('click',function(){
    if(!('speechSynthesis' in window)){announce('خواندن صوتی در این مرورگر پشتیبانی نمی‌شود');return}
    speechSynthesis.cancel();
    var u=new SpeechSynthesisUtterance(narrText(sceneAt(t),state.narr));
    u.lang='fa-IR';u.rate=.92;speechSynthesis.speak(u);
  });
  if(stop)stop.addEventListener('click',function(){
    if('speechSynthesis' in window)speechSynthesis.cancel();
    state.ribbon=false;document.body.classList.remove('narration-on');renderNarr();
  });
  /* ---- presentation mode ---- */
  function setMode(mode){
    state.mode=mode;
    document.body.classList.toggle('mode-explore',mode==='explore');
    document.body.classList.toggle('mode-calm',mode==='calm');
    document.querySelectorAll('.p1ModeBtn').forEach(function(b){
      b.classList.toggle('on',b.dataset.mode===mode);
    });
    announce('حالت '+({cinematic:'سینمایی',explore:'کاوش',calm:'آرام'})[mode]+' فعال شد');
  }
  document.querySelectorAll('.p1ModeBtn').forEach(function(b){
    b.addEventListener('click',function(){setMode(b.dataset.mode)});
  });
  /* ---- terminology tooltips ---- */
  function markTerms(el){
    if(!el)return;
    var txt=el.textContent||'',keys=Object.keys(glossary).sort(function(a,b){return b.length-a.length});
    var hit=false,html=esc(txt);
    keys.forEach(function(k){
      var re=new RegExp('(^|[^\\u0600-\\u06FF0-9])('+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?=$|[^\\u0600-\\u06FF0-9])','g');
      html=html.replace(re,function(_,p,w){hit=true;return p+'<span class="term" tabindex="0" data-term="'+esc(k)+'">'+w+'</span>'});
    });
    if(hit)el.innerHTML=html;
  }
  function showTerm(x){
    var tip=$('p1TermTip');if(!tip)return;
    var r=x.getBoundingClientRect();
    $('p1TermName').textContent=x.dataset.term;
    $('p1TermDef').textContent=glossary[x.dataset.term]||'';
    tip.style.left=Math.max(12,Math.min(innerWidth-320,r.left))+'px';
    tip.style.top=Math.min(innerHeight-120,r.bottom+8)+'px';
    tip.classList.add('on');tip.setAttribute('aria-hidden','false');
  }
  function hideTerm(){
    var tip=$('p1TermTip');if(!tip)return;
    tip.classList.remove('on');tip.setAttribute('aria-hidden','true');
  }
  function bindTermEvents(){
    document.addEventListener('pointerover',function(e){
      var x=e.target.closest&&e.target.closest('.term');if(x)showTerm(x);
    });
    document.addEventListener('pointerout',function(e){
      if(e.target.closest&&e.target.closest('.term'))hideTerm();
    });
    document.addEventListener('focusin',function(e){
      if(e.target.classList&&e.target.classList.contains('term'))showTerm(e.target);
    });
    document.addEventListener('focusout',function(e){
      if(e.target.classList&&e.target.classList.contains('term'))hideTerm();
    });
  }
  function refreshTerms(){markTerms(elSub);markTerms(elCard);markTerms(elMetricLabel)}

  /* ---- canvas explore mode: click a node to jump to its scene ---- */
  CV.setAttribute('tabindex','0');
  CV.setAttribute('role','img');
  CV.setAttribute('aria-label','میدان ایزومتریک جریان دادهٔ سامانه آرا؛ در حالت کاوش برای رفتن به صحنهٔ مرتبط روی یک گره کلیک کنید.');
  CV.addEventListener('click',function(ev){
    if(state.mode!=='explore')return;
    var best=null,bd=34;
    NODES.forEach(function(n){
      var p=iso(n.x,n.y,n.h*.55),d=Math.hypot(ev.clientX-p.x,ev.clientY-p.y);
      if(d<bd){bd=d;best=n}
    });
    if(best){
      for(var i=0;i<SCENES.length;i++)if(SCENES[i].hot.indexOf(best.id)>-1){
        jump(i);announce('پرش به '+best.fa);break;
      }
    }
  });
  /* ---- hooks ---- */
  var oldTrigger=triggerSceneTransition;
  triggerSceneTransition=function(r){
    oldTrigger(r);
    var tr=$('p1Transition');
    if(tr&&!REDUCED&&state.mode==='cinematic'){
      $('p1TransNo').textContent=(r.idx+1<10?'0':'')+(r.idx+1);
      $('p1TransTitle').textContent=r.s.ti;
      $('p1TransChapter').textContent=r.s.ch;
      tr.classList.remove('go');void tr.offsetWidth;tr.classList.add('go');
    }
  };
  var oldHUD=updHUD;
  updHUD=function(r){
    oldHUD(r);
    if(r.idx!==state.last){
      state.last=r.idx;
      updateNavigation(r.idx);
      if(state.panel&&state.panel.id==='p1LayerPanel')renderLayers();
      if((state.panel&&state.panel.id==='p1NarrPanel')||state.ribbon)renderNarr();
      setTimeout(refreshTerms,0);
      announce('صحنه '+faNum(r.idx+1)+' از '+faNum(SCENES.length)+'، '+r.s.ti);
    }
  };
  /* ---- keyboard ---- */
  window.addEventListener('keydown',function(e){
    var tag=(e.target.tagName||'').toLowerCase(),typing=tag==='input'||tag==='textarea';
    if(e.key==='Escape'){closePanels(true);hideTerm();return}
    if(typing)return;
    if(e.key==='/'){e.preventDefault();openPanel('p1SearchPanel');
      setTimeout(function(){var f=$('p1SearchInput');if(f)f.focus()},80);
    }else if(e.key==='v'||e.key==='V'){setMode(state.mode==='cinematic'?'explore':'cinematic')}
    else if(e.key==='n'||e.key==='N'){openPanel('p1NarrPanel')}
    else if(e.key==='l'||e.key==='L'){openPanel('p1LayerPanel')}
    else if(e.key==='m'||e.key==='M'){openPanel('p1NavPanel')}
  });
  /* ---- boot ---- */
  var si=$('p1SearchInput');
  if(si)si.addEventListener('input',function(){runSearch(si.value)});
  var sp=$('p1SearchPanel');
  if(sp)sp.addEventListener('transitionend',function(){
    if(this.classList.contains('on'))$('p1SearchInput').focus({preventScroll:true});
  });
  buildNavigation();bindTermEvents();setMode('cinematic');
  updateNavigation(sceneAt(t));renderNarr();renderLayers();
})();
