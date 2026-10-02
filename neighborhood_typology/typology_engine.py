#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, json, math, os, sys, tempfile
from collections import defaultdict
from pathlib import Path

DOMAIN_LABELS={
 'physical': [('نهفته',0,2),('پهنه‌بین',2,4),('سراسربین',4,5.000001)],
 'behavioral':[('بی‌تفاوت',0,2),('مستعد تعامل',2,4),('عامل',4,5.000001)],
 'normative':[('پس‌رونده',0,2),('در حال گذار',2,4),('پیشرو',4,5.000001)]}

def load_csv(path):
    with open(path,encoding='utf-8-sig',newline='') as f:
        return [dict(row) for row in csv.DictReader(f) if isinstance(row,dict)]

def finite(value):
    try:
        number=float(value)
    except (TypeError,ValueError):
        return None
    return number if math.isfinite(number) else None

def truthy(value):
    return str(value or '').strip().lower() in {'1','true','yes','y'}

def normalize_status(value):
    return str(value or 'measured').strip().lower()

def evidence_complete(measurement):
    if truthy(measurement.get('synthetic')):
        return False
    evidence_id=str(measurement.get('evidence_id') or '').strip()
    source_version=str(measurement.get('source_version') or measurement.get('version') or '').strip()
    reference_date=str(measurement.get('reference_date') or '').strip()
    checksum=str(measurement.get('checksum') or '').strip()
    license_name=str(measurement.get('license') or '').strip()
    source=str(measurement.get('source_url') or measurement.get('device') or '').strip()
    return bool(evidence_id and source_version and reference_date and checksum and license_name and source)

def atomic_write_json(path,result):
    target=Path(path)
    target.parent.mkdir(parents=True,exist_ok=True)
    descriptor,temporary=tempfile.mkstemp(prefix=f'.{target.name}.',suffix='.tmp',dir=target.parent)
    try:
        with os.fdopen(descriptor,'w',encoding='utf-8',newline='\n') as output:
            json.dump(result,output,ensure_ascii=False,indent=2)
            output.write('\n')
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary,target)
    except Exception:
        try: os.unlink(temporary)
        except OSError: pass
        raise

def band(v):
    return 'L' if v < 2 else ('M' if v < 4 else 'H')

def domain_label(domain,v):
    if domain not in DOMAIN_LABELS or not isinstance(v,(int,float)) or not math.isfinite(v):
        raise ValueError(v)
    for label,lo,hi in DOMAIN_LABELS[domain]:
        if lo <= v < hi: return label
    raise ValueError(v)

def scenario(P,B,N,driver_scores=None):
    pat=''.join(map(band,(P,B,N)))
    if 'M' in pat: return {'pattern':pat,'label':'گذار/ناترازی میانی','requires_review':True}
    labels={
      'HHL':'گسست نهادی و خطر زوال',
      'HLL':'زیرساخت پیشرفته با ضعف رفتاری و نهادی',
      'LHH':'ظرفیت نهفته و آماده جهش',
      'LLH':'الگوی نامحتمل؛ نیازمند بازبینی شواهد',
      'LHL':'ظرفیت کنشگری با ضعف کالبدی و نهادی',
      'LLL':'بحرانی چندبعدی؛ الگوی منبع نیازمند راستی‌آزمایی',
      'HHH':'پیشران متوازن'
    }
    if pat=='HLH':
        label='رکود رفتاری در بستر کالبدی و نهادی قوی'
        if driver_scores:
            econ=min(driver_scores.get('B1',5),driver_scores.get('B2',5))
            other=min(driver_scores.get('B3',5),driver_scores.get('B4',5))
            label='قفل‌شدگی معیشتی و نیاز به تغییر مسیر توسعه' if econ <= other else 'کمبود مشارکت/جذب اجتماعی'
        return {'pattern':pat,'label':label,'requires_review':True}
    return {'pattern':pat,'label':labels.get(pat,'الگوی نیازمند بازبینی'),'requires_review':pat in {'LLH','LLL'}}

def aggregate(registry, measurements, min_coverage=0.70, min_driver_coverage=0.50):
    invalid=[]; reg={}; registry_rows=[]
    for index,row in enumerate(registry or []):
        if not isinstance(row,dict):
            invalid.append({'code':'','reason':'malformed_registry_row','index':index}); continue
        code=str(row.get('code') or '').strip().upper()
        domain=str(row.get('domain') or '').strip()
        driver=str(row.get('driver_id') or '').strip()
        weight=finite(row.get('domain_weight_percent'))
        if not code or domain not in DOMAIN_LABELS or not driver or weight is None or weight < 0:
            invalid.append({'code':code,'reason':'invalid_registry_row','index':index}); continue
        if code in reg:
            invalid.append({'code':code,'reason':'duplicate_registry_code','index':index}); continue
        normalized={**row,'code':code,'domain':domain,'driver_id':driver,'_weight':weight}
        reg[code]=normalized; registry_rows.append(normalized)

    selected={}; duplicates=set()
    for index,measurement in enumerate(measurements or []):
        if not isinstance(measurement,dict):
            invalid.append({'code':'','reason':'malformed_measurement','index':index}); continue
        code=str(measurement.get('code') or measurement.get('indicator_code') or '').strip().upper()
        if code in selected:
            duplicates.add(code)
            invalid.append({'code':code,'reason':'duplicate_active_measurement','index':index})
            continue
        selected[code]=(measurement,index)

    by_domain=defaultdict(list); by_driver=defaultdict(list)
    evidence_failures=[]; synthetic_inputs=[]
    for code,(measurement,index) in selected.items():
        if code not in reg:
            invalid.append({'code':code,'reason':'unknown_code','index':index}); continue
        status=normalize_status(measurement.get('status'))
        if status not in {'measured','validated'}:
            if status not in {'missing','suppressed','not_recorded','failed_qa'}:
                invalid.append({'code':code,'reason':'unknown_status','index':index})
            continue
        score=finite(measurement.get('score_1_5'))
        if score is None:
            invalid.append({'code':code,'reason':'invalid_score','index':index}); continue
        if not 1 <= score <= 5:
            invalid.append({'code':code,'reason':'score_out_of_range','index':index}); continue
        quality=finite(measurement.get('quality_score') or measurement.get('quality'))
        if quality is None or not 0 <= quality <= 1:
            invalid.append({'code':code,'reason':'invalid_quality','index':index}); continue
        flags={flag.strip().upper() for flag in str(measurement.get('quality_flags') or '').split(',') if flag.strip()}
        if 'FAILED_QA' in flags:
            invalid.append({'code':code,'reason':'failed_qa','index':index}); continue
        formula_version=str(measurement.get('formula_version') or '').strip()
        if not formula_version:
            evidence_failures.append({'code':code,'reason':'formula_version_missing'})
        if truthy(measurement.get('synthetic')):
            synthetic_inputs.append(code)
        elif not evidence_complete(measurement):
            evidence_failures.append({'code':code,'reason':'evidence_metadata_incomplete'})
        row=reg[code]; weight=row['_weight']
        by_domain[row['domain']].append((score,weight,code,quality))
        by_driver[row['driver_id']].append((score,weight,code,quality))

    domain_scores={}; coverage={}; confidence={}; driver_scores={}; driver_coverage={}
    for d in ('physical','behavioral','normative'):
        items=by_domain[d]; used=sum(w for _,w,_,_ in items)
        total=sum(row['_weight'] for row in registry_rows if row['domain']==d)
        coverage[d]=used/total if total else 0
        domain_scores[d]=sum(s*w for s,w,_,_ in items)/used if used else None
        confidence[d]=sum(q*w for _,w,_,q in items)/used if used else None
    driver_totals=defaultdict(float)
    for row in registry_rows: driver_totals[row['driver_id']]+=row['_weight']
    for drv,total in driver_totals.items():
        items=by_driver[drv]; used=sum(w for _,w,_,_ in items)
        driver_coverage[drv]=used/total if total else 0
        driver_scores[drv]=sum(s*w for s,w,_,_ in items)/used if used else None
    complete=all(domain_scores[d] is not None for d in domain_scores)
    si=(domain_scores['physical']*domain_scores['behavioral']*domain_scores['normative'])**(1/3) if complete else None
    gates=[]
    if not complete: gates.append('domain_scores_incomplete')
    gates.extend(f'{domain}_coverage_below_{min_coverage:.2f}' for domain,value in coverage.items() if value < min_coverage)
    gates.extend(f'{driver}_coverage_below_{min_driver_coverage:.2f}' for driver,value in driver_coverage.items() if value < min_driver_coverage)
    if invalid: gates.append('invalid_measurements_present')
    if evidence_failures: gates.append('evidence_or_formula_incomplete')
    if synthetic_inputs: gates.append('synthetic_inputs_not_certifiable')
    certified=not gates
    result={'domain_scores':domain_scores,'domain_labels':{},'weighted_coverage':coverage,
            'driver_scores':driver_scores,'driver_coverage':driver_coverage,'SI':si,
            'confidence':confidence,'status':'certified' if certified else 'provisional',
            'invalid_measurements':invalid,'evidence_failures':evidence_failures,
            'certification_gates':{'eligible':certified,'failures':sorted(set(gates))},
            'synthetic_inputs':synthetic_inputs}
    if complete:
        result['domain_labels']={d:domain_label(d,v) for d,v in domain_scores.items()}
        result['scenario']=scenario(domain_scores['physical'],domain_scores['behavioral'],domain_scores['normative'],driver_scores)
    return result

def make_plan(registry, request):
    if not isinstance(request,dict):
        raise SystemExit('request must be a JSON object')
    if not request.get('neighborhood_name') or not request.get('province') or not request.get('city_or_county'):
        raise SystemExit('neighborhood_name, province, and city_or_county are required')
    groups=defaultdict(list)
    for r in registry:
        if not isinstance(r,dict) or not r.get('code'):
            continue
        groups[str(r.get('access_mode') or 'unspecified')].append({'code':r['code'],'indicator':r.get('indicator',''),
          'playbooks':str(r.get('playbook_codes') or '').split(','),'source_requirements':r.get('source_requirements',''),
          'formula':r.get('formula_text',''),'calc_family':r.get('calc_family','')})
    return {'request':request,'status':'boundary_confirmation_required',
            'counts':{k:len(v) for k,v in groups.items()},'tasks':groups}

def main():
    if hasattr(sys.stdout,'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    ap=argparse.ArgumentParser(); sub=ap.add_subparsers(dest='cmd',required=True)
    p=sub.add_parser('plan'); p.add_argument('--registry',required=True); p.add_argument('--request',required=True); p.add_argument('--out',required=True)
    s=sub.add_parser('score'); s.add_argument('--registry',required=True); s.add_argument('--measurements',required=True); s.add_argument('--out',required=True); s.add_argument('--min-coverage',type=float,default=.70)
    a=ap.parse_args()
    try:
        registry=load_csv(a.registry)
        if a.cmd=='plan': result=make_plan(registry,json.loads(Path(a.request).read_text(encoding='utf-8')))
        else: result=aggregate(registry,load_csv(a.measurements),a.min_coverage)
    except (OSError,ValueError,TypeError,json.JSONDecodeError) as error:
        result={'status':'rejected','error':{'code':'ENGINE_INPUT_ERROR','message':str(error)}}
    atomic_write_json(a.out,result)
    print(json.dumps(result,ensure_ascii=False,indent=2))
if __name__=='__main__': main()
