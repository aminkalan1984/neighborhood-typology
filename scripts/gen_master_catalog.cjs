// ============================================================
// Generator: iran_typology_all_indicators_master_fa.json
//   → src/algorithm/masterCatalog.ts
// Assigns each indicator: extraction strategy + target raw field
//   (pipeline ZoneRaw field), by code-match then keyword rules.
// Run: node scripts/gen_master_catalog.cjs
// ============================================================
const fs = require('fs');

const master = JSON.parse(
  fs.readFileSync('iran_typology_all_indicators_master_fa.json', 'utf8'),
);
const layersObj = master.neighborhood_typology.layers; // {P,B,N,A}
const layerFa = Object.fromEntries(
  Object.entries(layersObj).map(([k, v]) => [k, v.layer_fa || k]),
);

// ── 1) pipeline catalog: code → raw field it touches ─────────
// Parse indicators.ts: each sub-indicator object has `code` and a
// `compute` body referencing raw.<field>. Grab the first/main field.
const indSrc = fs.readFileSync('src/algorithm/indicators.ts', 'utf8');
const codeToRaw = new Map();
const chunks = indSrc.split(/code:\s*'/).slice(1);
for (const c of chunks) {
  const code = c.slice(0, 3).trim(); // e.g. "P1"
  const m = [...c.matchAll(/raw\.(\w+)/g)].map((x) => x[1]);
  if (m.length && !codeToRaw.has(code)) codeToRaw.set(code, m[0]);
}

// ── 2) strategy rules (by source URL + method) ───────────────
const stratRules = [
  [/open-meteo|meteostat/i, 'meteo'],
  [/nominatim|openstreetmap\.org\/search/i, 'nominatim'],
  [/overpass|osm[\s/_-]|openstreetmap|poi/i, 'osm'],
  [/usgs|earthquake|fdsn/i, 'usgs'],
  [/openalex/i, 'openalex'],
  [/earth-engine|earthengine|google\s*\.com\/earth|gee\b|sentinel|landsat|modis|viirs|eogdata|noaa|copernicus|hydroweb|grace/i, 'satellite-proxy'],
];
const fallbackStrat = 'province-proxy';
function strategyFor(src, method) {
  const hay = `${src || ''} ${method || ''}`;
  for (const [re, s] of stratRules) if (re.test(hay)) return s;
  return fallbackStrat;
}

// ── 3) keyword rules: name/method → ZoneRaw field ────────────
const rawRules = [
  [/no2|نیتروژن/i, 'no2'],
  [/so2|گوگرد/i, 'so2'],
  [/pm2\.?\s?5|ذرات\s*۲\.۵|ذرات.*2\.5/i, 'pm25'],
  [/pm10|ذرات\s*۱۰/i, 'aerosol'],
  [/نور شبانه|نور شب|night.?time|nightlight|رادیانس/i, 'nightlight'],
  [/روند.*نور|trend.*night|night.*trend/i, 'nightlightTrend'],
  [/دمای سطح|lst\b|thermal|حرارتی|گرمای شهری|island/i, 'lst'],
  [/ndvi|پوشش گیاهی|vegetation|سبزینگی|greenness/i, 'ndvi'],
  [/سهم.*بنا|built.?up|ساختوساز|مساحت ساخته|settlement|اثرپای سکونت/i, 'builtShare'],
  [/تراکم جمعیت|population density/i, 'populationDensity'],
  [/پهنه آبی|مساحت آب|water surface|بستر آب/i, 'waterSurfaceShare'],
  [/خشکسالی|spei|drought|نزولات|بارش/i, 'spei'],
  [/مخاطره|hazard|سیل|زلزله|راندگی/i, 'hazardExposure'],
  [/نفوذپذیری|permeability/i, 'permeability'],
  [/اتصالپذیری|connectivity|اتصال/i, 'connectivity'],
  [/تقاطع|intersection/i, 'intersectionDensity'],
  [/پیاده|pedestrian/i, 'pedestrianInfra'],
  [/اتوبوس|bus stop/i, 'busStops'],
  [/مترو|metro/i, 'metroAccess'],
  [/پهنباند|broadband|سرعت.*اینترنت|fixed broadband/i, 'fixedBroadbandSpeed'],
  [/نفوذ.*پهنباند|broadband.*(پوشش|نفوذ)|adoption.*broadband/i, 'broadband'],
  [/دیتای همراه|mobile.*(speed|data)|سرعت.*موبایل/i, 'mobileSpeed'],
  [/دکل|برج.*مخابرات|cell tower/i, 'cellTowers'],
  [/5g|lte/i, 'lte5gShare'],
  [/پمپ.*سوخت|fuel station/i, 'fuelStations'],
  [/بیمارستان|hospital/i, 'hospitalDist'],
  [/داروخانه|pharmacy/i, 'pharmacyDensity'],
  [/درمانگاه|clinic|پایگاه بهداشت|خانه بهداشت/i, 'clinicDensity'],
  [/مرکز درمان|health center|مرکز سلامت/i, 'healthCentersPerCap'],
  [/آب آشامیدنی|آب سالم|safe water/i, 'safeWater'],
  [/بهداشت|فاضلاب|sanitation/i, 'improvedSanitation'],
  [/شستشوی دست|handwashing/i, 'handwashing'],
  [/شهریشدن|urbanization|سهم شهری/i, 'urbanizationShare'],
  [/خوداشتغالی|self.?employment/i, 'selfEmployment'],
  [/جوانان\s*۱۵|۱۵–۲۹|۱۵-۲۹|youth.*15/i, 'youth1529'],
  [/نسبت جوان|جوانی|youth/i, 'youthShare'],
  [/تنوع|diversity|variety|شانون|shannon/i, 'relatedVariety'],
  [/فناوری|tech adoption|تکنولوژی|نوآوری/i, 'techAdoption'],
  [/پویایی|dynamism|رونق اقتصادی/i, 'economicDynamism'],
  [/مهاجرت|migration|خروج.*جمعیت/i, 'outMigration'],
  [/بیکاری|unemployment/i, 'unemployment'],
  [/بانک|atm/i, 'bankAtmDensity'],
  [/بازار|market/i, 'marketDensity'],
  [/کالای بادوام|durable/i, 'durableGoods'],
  [/بار تکفل|وابستگی|dependency/i, 'dependencyRatio'],
  [/سواد|literacy/i, 'literacy'],
  [/تحصیلات عالی|دانشگاه|higher.?edu/i, 'higherEduShare'],
  [/دبیرستان|secondary|متوسطه/i, 'secondaryCompletion'],
  [/ترک تحصیل|dropout/i, 'dropoutRate'],
  [/برابری جنسیتی|gender parity/i, 'genderParity'],
  [/مدرسه|school/i, 'schoolDensity'],
  [/معلم|نسبت.*دانشآموز|pupil|teacher/i, 'pupilTeacherRatio'],
  [/آموزش عالی|tertiary|enrollment|ثبتنام/i, 'tertiaryEnrollment'],
  [/سواد دیجیتال|digital literacy/i, 'digitalLiteracy'],
  [/سالهای تحصیل|schooling|تحصیلات$/i, 'meanSchooling'],
  [/نهاد مذهبی|مذهبی|مسجد|حسینیه|religious/i, 'religiousInstitutions'],
  [/مرکز یادگیری|learning center/i, 'learningCenters'],
  [/انتخابات|electoral|رأی|مشارکت سیاسی/i, 'electoralParticipation'],
  [/آسیب اجتماعی|social harm|جرم/i, 'socialHarmRate'],
  [/ثبات سکونت|residential stability/i, 'residentialStability'],
  [/مالکیت|تصرف|ownership|tenure/i, 'ownershipShare'],
  [/سرپرست زن|female head/i, 'femaleHeadShare'],
  [/بعد خانوار|household size/i, 'householdSize'],
  [/سالمند|elderly/i, 'elderlyShare'],
  [/چندنسلی|multigen/i, 'multigenShare'],
  [/سمن|ngo|نهاد مدنی|سازمان مردمنهاد/i, 'ngoDensity'],
  [/محل عبادت|عبادت|worship/i, 'worshipDensity'],
  [/پارک|فضای سبز|park/i, 'parkPerCap'],
  [/تجمع|اعتراض|protest/i, 'protestEvents'],
  [/پیشدبستانی|preschool/i, 'preschoolParticipation'],
  [/کتابخانه|library/i, 'libraryDensity'],
  [/امید|life expectancy|طول عمر/i, 'lifeExpectancy'],
  [/دالی|daly|بار بیماری|burden/i, 'dalyBurden'],
  [/چندمنظوره|multi.?purpose/i, 'multiPurposeSpaces'],
  [/نقطه کور|cpted|blind/i, 'blindSpots'],
  [/فرسوده|ریزدانه|fine.?grain/i, 'fineGrainShare'],
  [/کیفیت ابنیه|بنا.*کیفیت|solid housing/i, 'solidHousing'],
  [/نفوذ.*آب|utility|آب.*برق|گاز/i, 'utilityPenetration'],
  [/فاصله.*خدمات|service distance/i, 'serviceDistance'],
  [/دسترسی فضایی|2sfca|دسترسی.*خدمات/i, 'serviceAccess2sfca'],
  [/قابلیت پیادهروی|walkability|پیادهپذیری/i, 'walkability'],
  [/فعالیت اقتصادی|economic activity|اقتصادی/i, 'economicDynamism'],
];
function rawFor(ind) {
  // 1) exact code match with the pipeline catalog
  const direct = codeToRaw.get(ind.uid);
  if (direct) return direct;
  // 2) keyword rules on name + method
  const hay = `${ind.name} ${ind.extraction_method || ''}`;
  for (const [re, f] of rawRules) if (re.test(hay)) return f;
  return undefined;
}

// ── 4) assemble ──────────────────────────────────────────────
const all = [];
for (const [layer, v] of Object.entries(layersObj)) {
  for (const ind of v.indicators || []) {
    all.push({
      uid: ind.uid || ind.code,
      layer,
      name: (ind.name || '').trim(),
      cluster: (ind.cluster_domain || '').trim(),
      sourceUrl: ind.source_url || ind.source || '',
      method: (ind.extraction_method || '').trim(),
      spatial: (ind.spatial_resolution || '').trim(),
      frequency: (ind.update_frequency || '').trim(),
      confidence: Number(ind.confidence_score) || 3,
      direction: (ind.notes_direction_flag || '').trim(),
      strategy: strategyFor(ind.source_url || ind.source, ind.extraction_method),
      rawTarget: rawFor(ind),
    });
  }
}

const layerKeys = Object.keys(layersObj);
const layerMeta = layerKeys
  .map((k) => ({ key: k, fa: (layersObj[k].layer_fa || '').replace(/\s*\(.*\)$/, ''), count: (layersObj[k].indicators || []).length }));

// ── 5) emit TS ───────────────────────────────────────────────
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const rows = all
  .map((i) => {
    const rt = i.rawTarget ? `, raw: '${i.rawTarget}'` : '';
    return (
      `  { uid: '${i.uid}', layer: '${i.layer}', name: \`${esc(i.name)}\`, cluster: \`${esc(i.cluster)}\`, ` +
      `strategy: '${i.strategy}'${rt}, confidence: ${i.confidence}, direction: \`${esc(i.direction)}\`, ` +
      `method: \`${esc(i.method)}\`, spatial: \`${esc(i.spatial)}\`, freq: \`${esc(i.frequency)}\`, src: \`${esc(i.sourceUrl)}\` },`
    );
  })
  .join('\n');

const out = `// ============================================================
// کاتالوگ مادر شاخص‌های گونه‌بندی محله — ۳۲۹ شاخص (P/B/N/A)
// تولیدشده توسط: node scripts/gen_master_catalog.cjs
// هر شاخص: استراتژی استخراج برخط + فیلد خام هدف در موتور پایپلاین
// (s = strategy, raw = ZoneRaw field, f = confidence 1..5, d = direction)
// ============================================================
export type IndicatorStrategy =
  | 'osm' | 'meteo' | 'nominatim' | 'usgs' | 'openalex'
  | 'satellite-proxy' | 'province-proxy';

export const STRATEGY_FA: Record<IndicatorStrategy, string> = {
  osm: 'بافت و خدمات (OpenStreetMap)',
  meteo: 'اقلیم و کیفیت هوا (Open-Meteo)',
  nominatim: 'مکان‌یابی (Nominatim)',
  usgs: 'لرزه‌نگاری (USGS)',
  openalex: 'آموزش عالی (OpenAlex)',
  'satellite-proxy': 'برآورد ماهواره‌ای (پراکسی مستند)',
  'province-proxy': 'برآورد استانی (پراکسی مستند)',
};

export interface MasterIndicator {
  uid: string;
  layer: 'P' | 'B' | 'N' | 'A';
  name: string;
  cluster: string;
  strategy: IndicatorStrategy;
  raw?: string;        // فیلد خام هدف در ZoneRaw (در صورت نگاشت)
  confidence: number;  // 1..5
  direction: string;
  method: string;      // روش استخراج از منبع
  spatial: string;     // دقت مکانی
  freq: string;        // دفعات به‌روزرسانی
  src: string;         // لینک منبع تعیین‌شده
}

export interface MasterLayerMeta {
  key: 'P' | 'B' | 'N' | 'A';
  fa: string;
  count: number;
}

export const MASTER_LAYERS: MasterLayerMeta[] = ${JSON.stringify(layerMeta).replace(/"([A-Z])":/g, "$1:")};

export const MASTER_INDICATORS: MasterIndicator[] = [
${rows}
];

export const MASTER_INDICATOR_COUNT = ${all.length};

/** سرچ فوری بر اساس uid / نام / خوشه / لایه */
export function searchMasterIndicators(q: string, layer?: string): MasterIndicator[] {
  const s = q.trim().toLowerCase();
  return MASTER_INDICATORS.filter((i) => {
    if (layer && i.layer !== layer) return false;
    if (!s) return true;
    return (
      i.uid.toLowerCase().includes(s) ||
      i.name.toLowerCase().includes(s) ||
      i.cluster.toLowerCase().includes(s) ||
      (i.raw ?? '').toLowerCase().includes(s)
    );
  });
}
`;

fs.writeFileSync('src/algorithm/masterCatalog.ts', out, 'utf8');

// ── 6) report ────────────────────────────────────────────────
const byStrat = all.reduce((m, i) => { m[i.strategy] = (m[i.strategy] || 0) + 1; return m; }, {});
const mapped = all.filter((i) => i.rawTarget).length;
const codeMapped = all.filter((i) => codeToRaw.has(i.uid)).length;
console.log('wrote src/algorithm/masterCatalog.ts —', all.length, 'indicators');
console.log('by strategy:', JSON.stringify(byStrat));
console.log('raw-mapped:', mapped, `(code-match ${codeMapped}, keyword ${mapped - codeMapped})`);
console.log('by layer:', JSON.stringify(all.reduce((m, i) => { m[i.layer] = (m[i.layer] || 0) + 1; return m; }, {})));
console.log('distinct raw targets:', new Set(all.map((i) => i.rawTarget).filter(Boolean)).size);
