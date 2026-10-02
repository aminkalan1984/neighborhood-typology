// ============================================================
// «حکیم» — لایهٔ دانش مرجع (Grounding)
// هوش مصنوعی و چت‌بات بر پایهٔ دو سند اصلی الگوریتم آموزش‌دیده و عمل می‌کند:
//   - algorithm_neighborhood_typology_fa (16).md  (سند فنی الگوریتم نهایی)
//   - iran_typology_all_indicators_master_fa.json (کاتالوگ مادر ۶۰۱ شاخص)
// کاتالوگ مادر فقط هنگام نیاز به‌صورت lazy بارگذاری و کش می‌شود تا باندل اصلی سبک بماند.
// ============================================================
import catalogUrl from '../../iran_typology_all_indicators_master_fa.json?url';
import divisionsSummaryUrl from '../data/portals/divisions/divisions-summary.json?url';
import icpdUrl from '../data/portals/development/icpd-indicators.json?url';
import populationUrl from '../data/portals/population/projections-1396-1415.json?url';
import blocksUrl from '../data/portals/geo/blocks-per-province.json?url';
import mdgUrl from '../data/portals/development/mdg-2014.json?url';
import amarrasmiUrl from '../data/portals/statistical/amarrasmi-registry.json?url';
import nationalPopUrl from '../data/portals/population/national-1375-1395.json?url';
import householdsUrl from '../data/portals/population/households-1385-1395.json?url';
import provinceGeoStatsUrl from '../data/spatial/province-geo-stats.json?url';
import healthFacilitiesUrl from '../data/spatial/health-facilities.json?url';
import hospitalAccessUrl from '../data/spatial/hospital-access.json?url';

// ─── مشخصات فشردهٔ الگوریتم (استخراج وفادار از سند فنی، بخش‌های ۰ تا ۱۰) ───
export const ALGORITHM_SPEC = `الگوریتم نهایی گونه‌بندی محلات و مناطق هدف (مدل سه‌بعدی برکت) — سند فنی مرجع:

فلسفه: خروجی سامانه فقط «برچسب محرومیت» نیست، بلکه «نسخهٔ درمانی مکان‌محور» است؛ هر محرومیت ماهیتی دارد و کلید قفل آن در یکی از سه ساحت نهفته است.

واحد تحلیل: «پهنهٔ ۴۰۰ خانواری» حول یک محور اجتماعی (مسجد/امامزاده/حسینیه)، ساخته‌شده از تجمیع بلوک‌های آماری مرکز آمار ایران. سطوح: کلان (مناطق ده‌گانه کشوری)، میانی (شهرستان = سلول اجتماعی)، خرد (محلهٔ شهری/کانون روستایی).

سه ساحت بنیادین (لایه‌ها):
- کالبدی–زیرساختی (P): «سخت‌افزار» توسعه؛ زیرساخت و مسکن، دسترسی و خدمات، تاب‌آوری محیطی، امنیت محیطی CPTED، ضریب نفوذ انشعابات، پایداری اینترنت پهن‌باند.
- رفتاری–اجتماعی (B): «نرم‌افزار» توسعه؛ عقل معاش و اشتغال، زنجیرهٔ ارزش و بازار، «تنوع مرتبط»، خوداشتغالی، جذب تکنولوژی، الگوهای مهاجرتی و پویایی اجتماعی.
- هنجاری–ادراکی (N): «سیستم‌عامل ذهنی و قانونی»؛ سرمایهٔ اجتماعی، نقش امام محله/معتمدین، یادگیری جمعی، اعتماد نهادی، ریسک‌پذیری و گشودگی فکری. اصل کلیدی: بدون تغییر در سیستم‌عامل ذهنی، بهترین سخت‌افزارها نیز به توسعهٔ ماندگار نمی‌انجامند؛ نمرهٔ هنجاری بالا در اولویت اول تخصیص بودجه است.

پایپلاین (چرخهٔ بستهٔ ۱۱ مرحله‌ای): تعریف پهنه → گردآوری دادهٔ عمومی → پاکسازی و نرمال‌سازی → موتور شاخص → وزن‌دهی → امتیاز لایه (۱..۵) → پایداری (SI) → گونه‌بندی و ماتریس ۹ حالته → رادار و تجویز مداخله → خروجی GIS و داشبورد → پایش KPI با بازخورد.

منابع داده: تنها منابع عمومی و باز — مرکز آمار ایران (SCI)، داده‌بازهای شهری، OpenStreetMap/Overpass، Open-Meteo، ماهوارهٔ رایگان (Sentinel/Landsat/VIIRS)، داده‌های باز پژوهشی. اصول: شفافیت منشأ (منبع/تاریخ/روش)، صداقت داده (هرگز مقدار ساختگی؛ مقدار NaN + پرچم data_gap).

امتیازدهی و نرمال‌سازی: Min–Max به بازهٔ ۰..۱ (جهت صعودی x_norm=(x−xmin)/(xmax−xmin)؛ جهت نزولی معکوس)، قیچی‌کردن صدک ۱ و ۹۹ (winsorize)، سپس نگاشت به مقیاس ۱..۵ با Rubric SOP: score = 1 + round(4·x_norm). سطوح مرجع: ۱=بحرانی، ۳=متوسط، ۵=پیشران. امتیاز هر لایه = میانگین وزنی زیرشاخص‌های همان لایه.

دادهٔ گمشده: زیرشاخص NaN از تجمیع کنار گذاشته و وزن‌ها بازنرمال می‌شوند (Safe-drop)؛ اگر بیش از ۴۰٪ وزن لایه گمشده باشد، لایه با پرچم low_confidence علامت می‌خورد. خطاهای ارزیابی: خطای هاله (فقر کالبدی نباید نمرهٔ هنجاری را بکاهد)، خطای مرکزگرایی (نمرهٔ ۳ به همه ممنوع)، سوگیری تأییدی (ثبت حداقل ۳ «ظرفیت پنهان» در هر پهنه).

وزن‌دهی: آنتروپی شانون (عینی، داده‌محور: p_ij=r_ij/Σr، E_j=−k·Σp·lnp، w=d_j/Σd_j) + AHP (قضاوت خبره با مقیاس ساعتی ۱..۹، CR<0.1). وزن ترکیبی: w_final = α·w_entropy + (1−α)·w_ahp (α پیش‌فرض ۰٫۵)؛ سپس w_final در (reliability/5) ضرب می‌شود تا شاخص‌های کم‌اعتماد سهم کمتری بگیرند.

ضریب پایداری (SI): میانگین هندسی SI = (P × B × N)^(1/3) تا ناترازی پنهان نشود (با کف ε=۰٫۱ و پرچم critical_layer). نمونهٔ سند: P=1.8، B=2.0، N=4.25 → میانگین حسابی ۲٫۶۸ (گمراه‌کننده) اما SI واقعی ≈ ۲٫۴۸.

گونه‌بندی درون هر لایه (آستانه‌ها: score<2.5 → گونه۱؛ 2.5≤score<3.75 → گونه۲؛ score≥3.75 → گونه۳):
- کالبدی: نهفته (انزوای فیزیکی) / پهنه‌بین (نیازمند بازسازی) / سراسربین (توسعه‌یافته، CPTED کامل).
- رفتاری: بی‌تفاوت (فعالیت بی‌بازده) / مستعد تعامل (نیمه‌متمرکز، ضعف تعامل دوسویه) / عامل (متمرکز شبکه‌مند).
- هنجاری: پس‌رونده (فقدان انسجام و اعتماد) / در حال گذار (مشارکت مشروط) / پیشرو (خودیاری، بلوغ اعتماد).

ماتریس ۹ حالتهٔ تشخیص و تجویز (هر لایه به دو سطح کم ↓ / زیاد ↑ با آستانهٔ ۳٫۰ تقلیل می‌یابد):
۱) P↑B↑N↓ = گسست نهادی و خطر زوال → بازسازی تنظیمات نهادی؛ تقویت همیاری معتمدین (امام محله).
۲) P↑B↓N↓ = زیرساخت پیشرفته، فقر سرمایهٔ اجتماعی → بازسازی سرمایهٔ اجتماعی و تنظیمات نهادی؛ میانجی‌گری.
۳) P↓B↑N↑ = ظرفیت نهفته و آمادهٔ جهش → توسعهٔ زیرساخت و تجهیز فناوری؛ تبدیل به پلتفرم تولید.
۴) P↓B↑N↓ = ظرفیت کنشگری بدون پشتیبان نهادی → توسعهٔ زیرساخت + میانجی‌گری کنشگران↔نهاد.
۵) P↑B↓N↑ = کمبود مشارکت/سرمایهٔ اجتماعی (کالبد و نهاد خوب) → افزایش انسجام اجتماعی؛ تقاطع‌گری بین گروه‌ها.
۶) P↑B↓N↑ = رکود معیشتی و قفل‌شدگی (Lock-in) → تغییر مسیر توسعه (Path Renewal)؛ زنجیرهٔ ارزش و «تنوع مرتبط».
۷) P↓B↓N↓ = محرومیت مطلق → مداخلهٔ همه‌جانبه با اولویت زیرساخت + میانجی‌گری.
۸) P↑B↑N↑ = پیشران (قطب پیشرفته) → شتاب‌دهی و الگوبرداری؛ آمادهٔ خروج تسهیلگر.
۹) P↓B↓N↑ = سرمایهٔ معنوی نهفته → اهرم‌سازی سرمایهٔ اجتماعی: تزریق هم‌زمان زیرساخت + حرفه‌آموزی با محوریت امام محله.
نکته: حالت‌های ۵ و ۶ امضای یکسان (P↑B↓N↑) دارند؛ اگر ضعف در مشارکت/انسجام باشد → ۵، اگر در مسیر معیشت/زنجیرهٔ ارزش باشد → ۶ (تفکیک با مؤلفه‌های رفتاری).

رادار و توازن: BalanceGap = max(P,B,N) − min(P,B,N) (هرچه کمتر متوازن‌تر)؛ AreaRadar = 0.5·sin(120°)·(P·B + B·N + N·P). مساحت کوچک → محرومیت مطلق؛ کشیدگی به سمت کالبد → نیاز به مداخلهٔ نرم؛ کشیدگی به سمت هنجار → آمادگی برای توسعهٔ زیرساخت.

موتور تجویز: خروجی رکورد prescription شامل state_id، diagnosis، intervention_package، budget_priority، target_scores، exit_kpi. اولویت بودجه با N↑ (نرخ بازگشت سرمایهٔ اجتماعی تضمین‌شده). پروتکل حالت ۹ «تزریق هم‌زمان»: دو مسیر موازی (زیرساخت + مهارت) هم‌زمان اجرا شوند تا اعتماد اجتماعی فرّار هدر نرود.

رنگ‌بندی GIS (نظام چهارطبقه بر مبنای SI): قرمز = مداخلهٔ فوری (SI<2.0)؛ نارنجی = نیازمند مداخله (2.0≤SI<3.0)؛ زرد = نسبتاً مناسب (3.0≤SI<4.0)؛ سبز = مناسب (SI≥4.0).`;

export interface HakimGrounding {
  algorithmSpec: string;
  /** ردیف‌های فشردهٔ همهٔ شاخص‌های چهار لایهٔ کاتالوگ مادر (P/B/N/A) */
  catalogDigest: string;
  /** گزیدهٔ سبک برای گفتگوهای سریع چت */
  catalogDigestForChat: string;
  /** دیجست محرک‌های توسعهٔ منطقه‌ای (بخش regional_development_drivers) */
  regionalDigest: string;
  /** گزیدهٔ سبک منطقه‌ای برای گفتگو */
  regionalDigestForChat: string;
  /** سلسله‌مراتب رسمی تقسیمات کشوری مرکز آمار (استان ← شهرستان ← بخش ← دهستان/شهر) */
  divisionsDigest: string;
  /** شاخص‌های توسعه (ICPD — فهرست تقسیمات/توسعهٔ مرکز آمار) */
  icpdDigest: string;
  /** پیش‌بینی/برآورد جمعیت استانی (۱۳۹۶–۱۴۱۵) */
  populationDigest: string;
  /** بلوک‌های سرشماری ۹۵ به تفکیک استان */
  blocksDigest: string;
  /** آمار توسعهٔ بین‌المللی MDG 2014 (ماتریس استان×سال) */
  mdgDigest: string;
  /** شناسنامهٔ آمار رسمی مرکز آمار (فهرست ۱۴۰۲–۱۴۰۴) */
  amarrasmiDigest: string;
  /** سری ملی جمعیت ۱۳۷۵–۱۳۹۵ و خانوارهای استانی */
  nationalSeriesDigest: string;
  /** اطلس مکانی استان‌ها: زیرساخت به تفکیک گروه + جمعیت/محیط‌زیست/ماهواره + مراکز درمانی + دسترسی درمانی */
  spatialDigest: string;
  /** گزیدهٔ سبک اطلس مکانی برای گفتگو */
  spatialDigestForChat: string;
}

interface MasterJson {
  neighborhood_typology?: {
    description?: string;
    layers?: Record<string, { layer_fa?: string; count?: number; indicators?: Array<Record<string, unknown>> }>;
  };
  regional_development_drivers?: {
    description?: string;
    clusters?: Record<string, { count?: number; indicators?: Array<Record<string, unknown>> }>;
  };
}

interface CatalogRow {
  uid: string;
  name: string;
  cluster: string;
}

/** حذف بخش انگلیسی داخل پرانتز از نام شاخص */
function faName(name: string): string {
  return (name || '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
}

function digestLines(rows: CatalogRow[]): string {
  return rows.map((r) => `- ${r.uid} | ${r.name} | ${r.cluster}`).join('\n');
}

let cache: Promise<HakimGrounding> | null = null;

async function load(): Promise<HakimGrounding> {
  try {
    const res = await fetch(catalogUrl);
    if (!res.ok) throw new Error(`catalog http ${res.status}`);
    const json = (await res.json()) as MasterJson;
    const layers = json.neighborhood_typology?.layers ?? {};

    const rows: CatalogRow[] = [];
    for (const layer of ['P', 'B', 'N', 'A']) {
      const l = layers[layer];
      if (!l || !Array.isArray(l.indicators)) continue;
      for (const ind of l.indicators) {
        const uid = String(ind.uid ?? ind.code ?? '').trim();
        if (!uid) continue;
        rows.push({
          uid,
          name: faName(String(ind.name ?? '')),
          cluster: String(ind.cluster_domain ?? ind.cluster ?? '').trim(),
        });
      }
    }

    const specIntro = `کاتالوگ مادر شاخص‌های الگوریتم گونه‌بندی (از فایل iran_typology_all_indicators_master_fa.json): ${rows.length} شاخص در چهار لایه. برای محاسبه و استدلال، از همین شناسه‌ها (uid)، نام و خوشهٔ موضوعی استفاده کن:\n`;
    const catalogDigest = specIntro + digestLines(rows);

    // گزیدهٔ سبک برای چت: نمایندهٔ هر لایه + ساختار کلی
    const byLayer: Record<string, CatalogRow[]> = { P: [], B: [], N: [], A: [] };
    for (const r of rows) {
      const layer = r.uid[0]?.toUpperCase() ?? '';
      if (byLayer[layer]) byLayer[layer].push(r);
    }
    const chatParts: string[] = [];
    for (const layer of ['P', 'B', 'N', 'A']) {
      const list = byLayer[layer];
      if (!list || list.length === 0) continue;
      const sample = list.slice(0, 10);
      chatParts.push(`لایهٔ ${layer} (${list.length} شاخص) — نمونه: ` + sample.map((r) => `${r.uid} ${r.name}`).join('، '));
    }
    const catalogDigestForChat =
      `کاتالوگ مادر شاخص‌های گونه‌بندی (${rows.length} شاخص در چهار لایهٔ P/B/N/A):\n` + chatParts.join('\n');

    // ── محرک‌های توسعهٔ منطقه‌ای (بخش regional_development_drivers) ──
    const regional = json.regional_development_drivers;
    const clusters = regional?.clusters ?? {};
    const rRows: Array<{ code: string; name: string; cluster: string; dimension: string }> = [];
    for (const clusterName of Object.keys(clusters)) {
      const c = clusters[clusterName];
      if (!c || !Array.isArray(c.indicators)) continue;
      for (const ind of c.indicators) {
        const code = String(ind.code ?? '').trim();
        if (!code) continue;
        rRows.push({
          code,
          name: String(ind.name_fa ?? ind.name ?? '').trim(),
          cluster: clusterName,
          dimension: String(ind.dimension ?? '').trim(),
        });
      }
    }
    const regionalIntro =
      `کاتالوگ محرک‌های توسعهٔ منطقه‌ای (از iran_typology_all_indicators_master_fa.json): ${rRows.length} محرک علّی در ۱۲ خوشه. برای استدلال دربارهٔ تفاوت توسعه‌یافتگی مناطق، از همین شناسه‌ها و خوشه‌ها استفاده کن:\n`;
    const regionalDigest =
      regionalIntro +
      rRows.map((r) => `- ${r.code} | ${r.name} | خوشه: ${r.cluster}${r.dimension ? ` | بعد: ${r.dimension}` : ''}`).join('\n');

    const rByCluster: Record<string, number> = {};
    const rSamples: Record<string, string[]> = {};
    for (const r of rRows) {
      rByCluster[r.cluster] = (rByCluster[r.cluster] ?? 0) + 1;
      (rSamples[r.cluster] = rSamples[r.cluster] || []).push(r.code);
    }
    const regionalDigestForChat =
      `محرک‌های توسعهٔ منطقه‌ای (${rRows.length} محرک در ۱۲ خوشه):\n` +
      Object.keys(clusters)
        .map((c) => `- ${c}: ${rByCluster[c] ?? 0} محرک (نمونه: ${(rSamples[c] || []).slice(0, 4).join('، ')})`)
        .join('\n');

    // ── تقسیمات رسمی کشوری (از فهرست تقسیمات ۱۴۰۱ مرکز آمار) ──
    let divisionsDigest = '';
    let icpdDigest = '';
    let populationDigest = '';
    let blocksDigest = '';
    let mdgDigest = '';
    let amarrasmiDigest = '';
    let nationalSeriesDigest = '';
    try {
      const [dRes, iRes, pRes, bRes, mRes, aRes, nRes, hRes] = await Promise.all([
        fetch(divisionsSummaryUrl), fetch(icpdUrl), fetch(populationUrl), fetch(blocksUrl),
        fetch(mdgUrl), fetch(amarrasmiUrl), fetch(nationalPopUrl), fetch(householdsUrl),
      ]);
      if (dRes.ok) {
        const divs = (await dRes.json()) as Array<{ code: string; name: string; counties: number; bakhshs: number; dehestans: number; cities: number }>;
        divisionsDigest =
          `تقسیمات رسمی کشوری مرکز آمار ایران (فهرست ۱۴۰۱، ${divs.length} استان):\n` +
          divs
            .map((d) => `- استان ${d.name} (کد ${d.code}): ${d.counties} شهرستان · ${d.bakhshs} بخش · ${d.dehestans} دهستان · ${d.cities} شهر`)
            .join('\n');
      }
      if (iRes.ok) {
        const rows = (await iRes.json()) as Array<{ indicator: string; sub: string; year: string; level: string; value: string; scale: string; source: string }>;
        icpdDigest =
          `شاخص‌های توسعهٔ مرکز آمار ایران (ICPD، ${rows.length} ردیف):\n` +
          rows
            .filter((r) => r.indicator || r.sub)
            .map((r) => `- ${r.indicator || ''} | ${r.sub || ''} | سال ${r.year || '—'} | ${r.level || '—'}: ${r.value || '—'}`)
            .join('\n');
      }
      if (pRes.ok) {
        const pops = (await pRes.json()) as Array<{ year: string; province: string; total: number; urban_total: number; urban_male: number; urban_female: number; rural_total: number }>;
        // فشرده: برای هر استان، جمعیت سال ۱۳۹۶ و ۱۴۱۵ (نقطهٔ شروع و پایان پیش‌بینی)
        const byProv: Record<string, Record<string, { total: number; urban: number }>> = {};
        for (const p of pops) {
          (byProv[p.province] = byProv[p.province] || {})[p.year] = {
            total: Math.round(p.total), urban: Math.round(p.urban_total),
          };
        }
        populationDigest =
          `پیش‌بینی جمعیت استان‌ها ۱۳۹۶–۱۴۱۵ (مرکز آمار ایران؛ هزار نفر):\n` +
          Object.entries(byProv)
            .map(([prov, yrs]) => {
              const a = yrs['1396'] ?? Object.values(yrs)[0];
              const b = yrs['1415'] ?? Object.values(yrs)[Object.keys(yrs).length - 1];
              const growth = a && b && a.total ? (((b.total - a.total) / a.total) * 100).toFixed(1) : '—';
              const urb = b ? Math.round((b.urban / b.total) * 100) : '—';
              return `- ${prov}: ${a?.total ?? '—'} ← ${b?.total ?? '—'} (رشد ${growth}٪، شهرنشینی ${urb}٪)`;
            })
            .join('\n');
      }
      if (bRes.ok) {
        const blocks = (await bRes.json()) as Array<{ code: string; province: string; blocks: number }>;
        blocksDigest =
          `بلوک‌های آماری سرشماری ۱۳۹۵ به تفکیک استان (${blocks.length} استان):\n` +
          blocks.map((b) => `- ${b.province} (کد ${b.code}): ${b.blocks.toLocaleString('fa-IR')} بلوک`).join('\n');
      }
      if (mRes.ok) {
        const mdg = (await mRes.json()) as Array<{ indicator: string; province_en: string; year: string; value: string }>;
        const byInd: Record<string, { n: number; years: Set<string> }> = {};
        for (const m of mdg) {
          (byInd[m.indicator] = byInd[m.indicator] || { n: 0, years: new Set() }).n++;
          byInd[m.indicator].years.add(m.year);
        }
        mdgDigest =
          `آمار توسعهٔ جمعیتی MDG/ICPD نسخهٔ انگلیسی ۲۰۱۴ (${Object.keys(byInd).length} شاخص، ${mdg.length} ردیف استان×سال):\n` +
          Object.entries(byInd)
            .map(([ind, v]) => `- ${ind} (${v.n} مقدار، سال‌های ${[...v.years].sort().join('، ')})`)
            .join('\n');
      }
      if (aRes.ok) {
        const reg = (await aRes.json()) as Array<{ title: string; group: string; owner: string; status: string }>;
        const byOwner: Record<string, number> = {};
        for (const r of reg) {
          if (r.owner) byOwner[r.owner] = (byOwner[r.owner] ?? 0) + 1;
        }
        const topOwners = Object.entries(byOwner).sort((a, b) => b[1] - a[1]).slice(0, 8);
        amarrasmiDigest =
          `شناسنامهٔ آمار رسمی ایران (فهرست ۱۴۰۲–۱۴۰۴، ${reg.length} آمار رسمی):\n` +
          `تولیدکنندگان اصلی: ${topOwners.map(([o, n]) => `${o} (${n})`).join('، ')}\n` +
          `نمونه‌ها: ${reg.slice(0, 12).map((r) => r.title).join('، ')}`;
      }
      if (nRes.ok) {
        const nat = (await nRes.json()) as Array<{ year: string; total: number; urban_total: number }>;
        nationalSeriesDigest =
          `سری ملی جمعیت ایران ۱۳۷۵–۱۳۹۵ (هزار نفر):\n` +
          nat.map((n) => `- ${n.year}: ${Math.round(n.total).toLocaleString('fa-IR')} (شهری ${Math.round(n.urban_total).toLocaleString('fa-IR')})`).join('\n');
      }
      if (hRes.ok) {
        const hh = (await hRes.json()) as Array<{ province: string; years: Record<string, number> }>;
        const latest = Object.values(hh[0]?.years ?? {})[0];
        const lines = hh.slice(0, 8).map((h) => {
          const ks = Object.keys(h.years).sort();
          return `- ${h.province}: ${ks.length ? `${ks[0]}: ${h.years[ks[0]]} ← ${ks[ks.length - 1]}: ${h.years[ks[ks.length - 1]]}` : '—'}`;
        });
        nationalSeriesDigest += `\n\nخانوارهای استان‌ها ۱۳۸۵–۱۳۹۵ (هزار خانوار؛ نمونهٔ ${hh.length} استان):\n` + lines.join('\n');
      }
    } catch {
      // دیجست‌های فرعی اختیاری‌اند
    }

    // ── اطلس مکانی استان‌ها (از پوشهٔ geojson/ — زیرساخت، مراکز درمانی، دسترسی) ──
    let spatialDigest = '';
    let spatialDigestForChat = '';
    try {
      const [geoRes, healthRes, accessRes] = await Promise.all([
        fetch(provinceGeoStatsUrl),
        fetch(healthFacilitiesUrl),
        fetch(hospitalAccessUrl),
      ]);
      const geo = geoRes.ok ? ((await geoRes.json()) as { provinces: Record<string, any> }) : null;
      const health = healthRes.ok
        ? ((await healthRes.json()) as { byProvince: Record<string, number>; byProvinceCategory: Record<string, { categories: Record<string, number> }>; categories: string[] })
        : null;
      const access = accessRes.ok ? ((await accessRes.json()) as { provinces: Record<string, any>; nameToCode: Record<string, string> }) : null;
      if (geo && geo.provinces) {
        const lines: string[] = [];
        for (const code of Object.keys(geo.provinces)) {
          const p = geo.provinces[code];
          const groups = Object.entries(p.byGroup ?? {})
            .map(([g, v]) => `${g}:${v}`)
            .join('، ');
          const healthTotal = health?.byProvince[code] ?? 0;
          const topCat = health?.byProvinceCategory[code]
            ? Object.entries(health.byProvinceCategory[code].categories).sort((a, b) => b[1] - a[1])[0]
            : null;
          const accessEntry = access?.provinces ? Object.values(access.provinces).find((a: any) => a.code === code) : null;
          const hospShare = accessEntry?.بیمارستان?.withinSharePct;
          lines.push(
            `- ${p.nameFa ?? code} (${code}): ${p.totalFeatures ?? 0} عارضهٔ زیرساخت [${groups}]؛ جمعیت ۱۳۹۵: ${(p.socioeconomic?.population_2016 ?? 0).toLocaleString('fa-IR')}؛ بارش ${p.environmental?.precip_mm ?? '—'}mm، AQI ${p.environmental?.aqi_2024 ?? '—'}، NDVI ${p.satellite?.ndvi_mean != null ? Math.round(p.satellite.ndvi_mean * 100) : '—'}٪، محرومیت ${p.satellite?.deprivation_level ?? '—'}؛ ${healthTotal} مرکز درمانی${topCat ? ` (بیشترین: ${topCat[0]} ${topCat[1]})` : ''}${hospShare != null ? `؛ دسترسی بیمارستان ${hospShare}٪` : ''}`
          );
        }
        spatialDigest =
          `اطلس مکانی استان‌های ایران (از داده‌های geojson/ — HOT OSM + Healthsites.io + HeiGIT + SCI + ماهواره): ${lines.length} استان. برای استدلال دربارهٔ تفاوت‌های زیرساختی، بهداشتی و محیطی استان‌ها از همین اعداد استفاده کن:\n` +
          lines.join('\n');
        const topByInfra = Object.entries(geo.provinces)
          .sort((a, b) => (b[1].totalFeatures ?? 0) - (a[1].totalFeatures ?? 0))
          .slice(0, 5)
          .map(([c, p]) => `${(p.nameFa ?? c).replace('استان ', '')} ${p.totalFeatures}`);
        const topHealth = health?.byProvince
          ? Object.entries(health.byProvince).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c, n]) => `${c} ${n}`)
          : [];
        spatialDigestForChat =
          `اطلس مکانی (${lines.length} استان): پرتراکم‌ترین زیرساخت: ${topByInfra.join('، ')}؛ بیشترین مرکز درمانی: ${topHealth.join('، ')}؛ مجموع مراکز درمانی کشور: ${Object.values(health?.byProvince ?? {}).reduce((a, b) => a + b, 0).toLocaleString('fa-IR')}`;
      }
    } catch {
      // دیجست اطلس مکانی اختیاری است
    }

    return {
      algorithmSpec: ALGORITHM_SPEC,
      catalogDigest,
      catalogDigestForChat,
      regionalDigest,
      regionalDigestForChat,
      divisionsDigest,
      icpdDigest,
      populationDigest,
      blocksDigest,
      mdgDigest,
      amarrasmiDigest,
      nationalSeriesDigest,
      spatialDigest,
      spatialDigestForChat,
    };
  } catch {
    // اگر کاتالوگ در دسترس نبود، دست‌کم مشخصات الگوریتم (فشردهٔ داخلی) باقی می‌ماند
    return {
      algorithmSpec: ALGORITHM_SPEC,
      catalogDigest: '',
      catalogDigestForChat: '',
      regionalDigest: '',
      regionalDigestForChat: '',
      divisionsDigest: '',
      icpdDigest: '',
      populationDigest: '',
      blocksDigest: '',
      mdgDigest: '',
      amarrasmiDigest: '',
      nationalSeriesDigest: '',
      spatialDigest: '',
      spatialDigestForChat: '',
    };
  }
}

/** دریافت دانش مرجع (کش‌شده)؛ پس از اولین بار همگام و بی‌هزینه است */
export function getHakimGrounding(): Promise<HakimGrounding> {
  if (!cache) cache = load();
  return cache;
}

/**
 * گزیدهٔ فشردهٔ داده‌های مرکز آمار برای تزریق به پرامپت‌های گفتگو/بازبینی:
 * اولویت با دیجست‌های کوتاه و پراطلاعات است تا پرامپت سنگین نشود.
 */
export function sciDigestForChat(g: HakimGrounding | undefined, scope: 'full' | 'light' = 'light'): string {
  if (!g) return '';
  const parts: string[] = [];
  if (g.divisionsDigest) parts.push(g.divisionsDigest);
  if (g.populationDigest) parts.push(g.populationDigest);
  if (g.blocksDigest && scope === 'full') parts.push(g.blocksDigest);
  if (g.nationalSeriesDigest && scope === 'full') parts.push(g.nationalSeriesDigest);
  if (scope === 'full') {
    if (g.mdgDigest) parts.push(g.mdgDigest);
    if (g.amarrasmiDigest) parts.push(g.amarrasmiDigest);
  }
  if (g.icpdDigest && scope === 'full') parts.push(g.icpdDigest);
  if (g.spatialDigest && scope === 'full') parts.push(g.spatialDigest);
  return parts.join('\n\n');
}
