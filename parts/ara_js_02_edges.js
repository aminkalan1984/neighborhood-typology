/* ================= WORLD: EDGES (data-flow graph) ================= */
function E(id,kind,ids,opt){
  var pts=[],k;
  for(k=0;k<ids.length;k++){
    if(typeof ids[k]==='string')pts.push(P(ids[k]));
    else if(ids[k]&&ids[k].id)pts.push(P(ids[k].id));
    else if(ids[k]&&ids[k].at)pts.push([ND[ids[k].at].x+(ids[k].dx||0),ND[ids[k].at].y+(ids[k].dy||0)]);
    else pts.push(ids[k]);
  }
  var e={id:id,kind:kind,pts:pts,app:0};
  if(opt)for(k in opt)e[k]=opt[k];
  return e;
}
var EDGES=[
/* ── flows.source : منابع خام → دروازهٔ منابع ───────────────────────────── */
E('s_remote','source',['remote',{at:'gateway',dx:-6,dy:12},'proxy'],{dash:1}),
E('s_climate','source',['climate',{at:'proxy',dx:-6,dy:10},'proxy'],{dash:1}),
E('s_maps','source',['maps',{at:'proxy',dx:0,dy:11},'proxy'],{dash:1}),
E('s_officials','source',['officialsrc',{at:'proxy',dx:5,dy:10},'proxy'],{dash:1}),
E('s_survey','source',['survey',{at:'proxy',dx:4,dy:11},'proxy'],{dash:1}),
E('s_bench','source',['benchmark',{at:'proxy',dx:-9,dy:10},'proxy'],{dash:1}),
E('s_satpipe','source',['satpipe',{at:'cache',dx:2,dy:10},'cache'],{dash:1}),

/* ── flows.ingest : دروازه، واکشی، اعتبارسنجی ──────────────────────────── */
E('g_proxy','ingest',['proxy','cache']),
E('g_catalog','ingest',['gateway','proxy'],{rev:1}),
E('g_cache','ingest',['cache','ingest']),
E('g_stale','ingest',['cache',{at:'ingest',dx:-4,dy:11},'ingest'],{dash:1,alt:1}),
E('g_validate','ingest',['ingest','valid']),
E('g_quality','ingest',['valid','evidence']),
E('g_reject','ingest',['valid',{at:'reject',dx:0,dy:-8},'reject'],{dash:1,alt:1}),
E('g_human','ingest',['reject','ingest'],{dash:1,alt:1}),

/* ── flows.store : دفتر شواهد و رجیسترهای نسخه‌دار ─────────────────────── */
E('r_evidence','store',['evidence',{at:'reg164',dx:12,dy:11},'reg164'],{dash:1}),
E('r_419','store',['reg419','reg164']),
E('r_core','store',['reg164','regcore']),
E('r_src','store',['regsrc','regweights']),
E('r_core2','store',['regcore','regweights']),
E('r_q','store',['regq','evidence']),
E('r_lineage','store',['regweights','kernel'],{dash:1}),

/* ── flows.compute : هستهٔ محاسبات و موتورهای تحلیل ────────────────────── */
E('k_intake','compute',['evidence','kernel']),
E('k_norm','compute',['kernel','normalize']),
E('k_weight','compute',['normalize','weight']),
E('k_chain','compute',['weight','chain']),
E('k_qtr','compute',['chain','quality']),
E('k_conf','compute',['quality','confidence']),
E('k_bottle','compute',['confidence','bottleneck']),

/* ── flows.analyze/compute : تحلیل، توصیه و یادگیری ────────────────────── */
E('a_diag','compute',['quality','diagnosis']),
E('a_bottle','compute',['bottleneck','diagnosis']),
E('a_equity','compute',['confidence','diagnosis']),
E('a_interv','compute',['diagnosis','intervention']),
E('a_learn','compute',['bottleneck','learning']),
E('a_feed','compute',['learning','card']),
E('a_capa','compute',['reject','learning'],{dash:1,alt:1}),

/* ── flows.decision : کارت تصمیم، انتشار و ممیزی ───────────────────────── */
E('d_card','decision',['intervention','card']),
E('d_card2','decision',['bottleneck','card']),
E('d_publish','decision',['card','publish']),
E('d_refuse','decision',['card',{at:'publish',dx:-6,dy:12},'publish'],{dash:1,alt:1}),
E('d_report','decision',['publish','report']),
E('d_archive','decision',['report','archive']),
E('d_audit','audit',['archive','regweights'],{dash:1,alt:1,kindOverride:'serve'}),

/* ── flows.serve : سرو، رابط کاربری و بازخورد ──────────────────────────── */
E('v_api','serve',['report','api']),
E('v_ui','serve',['api','ui']),
E('v_feedback','serve',['ui','feedback']),
E('v_loop','serve',['feedback','gateway'],{dash:1,alt:1}),
E('v_loop2','serve',['feedback','learning'],{dash:1,alt:1}),
E('v_monitor','serve',['api','evidence'],{dash:1,alt:1})
];
var ED={};for(var ei=0;ei<EDGES.length;ei++)ED[EDGES[ei].id]=EDGES[ei];
