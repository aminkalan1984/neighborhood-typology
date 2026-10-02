// ============================================================
// کاتالوگ زیرشاخص‌ها — مدل سه‌بعدی برکت (بخش ۴ سند فنی)
// P1..P42 (کالبدی)، B1..B25 (رفتاری)، N1..N20 (هنجاری)
// هر زیرشاخص: کد / فرمول / منبع عمومی / جهت / پرچم Proxy /
//             اعتمادپذیری ۱..۵ / خوشه / وزن seed AHP / تابع محاسبه
// ============================================================
import type { SubIndicator, ZoneRaw } from './types';

// ─── خوشه‌ها و وزن seed (بخش ۶.۴ سند) ────────────────────────
const CLUSTER_WEIGHT: Record<string, number> = {
  'پایه و زیرساخت': 0.2,
  'محیط‌زیست/اقلیم/مخاطرات': 0.3,
  'حمل‌ونقل/دسترسی': 0.25,
  'اتصال‌پذیری': 0.2,
  'سلامت/دسترسی/WASH': 0.25,
  'اقتصاد/نور شبانه/دسترسی مالی': 0.5,
  'آموزش/سرمایه انسانی/سواد دیجیتال': 0.5,
  'ساختار خانوار/جمعیت': 0.4,
  'سرمایه اجتماعی مکانی/حکمرانی': 0.35,
  'آموزش مدنی/رفاه سلامت': 0.25,
};

// شمارندهٔ زیرشاخص درون هر خوشه (برای تقسیم وزن خوشه بین اعضا)
const clusterCounters: Record<string, number> = {};
function countIn(cluster: string): number {
  clusterCounters[cluster] = (clusterCounters[cluster] ?? 0) + 1;
  return clusterCounters[cluster];
}
// پیش‌شمارش: تعداد اعضای هر خوشه قبل از ساخت کاتالوگ
// (پس از تعریف آرایه، seed نهایی = وزن خوشه / تعداد اعضا)

interface IndDef {
  code: string;
  layer: SubIndicator['layer'];
  name: string;
  formula: string;
  source: string;
  sourceKey: string;
  direction: SubIndicator['direction'];
  proxy: boolean;
  reliability: number;
  cluster: string;
  compute: (raw: ZoneRaw) => number | null;
}

const DEFS: IndDef[] = [
  // ═══════════════ لایهٔ کالبدی–زیرساختی (P) ═══════════════
  { code: 'P1', layer: 'P', name: 'ضریب نفوذ انشعابات', formula: 'نسبت واحدهای دارای آب/برق/گاز به کل واحدها', source: 'مرکز آمار ایران (SCI)', sourceKey: 'SCI', direction: 'asc', proxy: false, reliability: 4, cluster: 'پایه و زیرساخت', compute: (r) => r.utilityPenetration },
  { code: 'P2', layer: 'P', name: 'کیفیت و پایداری ابنیه', formula: '۱ − سهم واحد با مصالح کم‌دوام', source: 'مرکز آمار ایران (SCI) — مسکن', sourceKey: 'SCI', direction: 'asc', proxy: false, reliability: 4, cluster: 'پایه و زیرساخت', compute: (r) => r.solidHousing },
  { code: 'P3', layer: 'P', name: 'پایداری اینترنت/پهن‌باند', formula: 'ضریب نفوذ پهن‌باند منطقه‌ای (Proxy)', source: 'آمار عمومی ICT', sourceKey: 'ICT', direction: 'asc', proxy: true, reliability: 3, cluster: 'پایه و زیرساخت', compute: (r) => r.broadband },
  { code: 'P4', layer: 'P', name: 'امنیت محیطی (CPTED)', formula: 'روشنایی شبانه (VIIRS) × نبود نقاط کور (OSM) × نفوذپذیری معابر', source: 'VIIRS + OSM', sourceKey: 'VIIRS', direction: 'asc', proxy: true, reliability: 3, cluster: 'پایه و زیرساخت', compute: (r) => r.nightlight * (1 - r.blindSpots) * r.permeability },
  { code: 'P5', layer: 'P', name: 'دسترسی به خدمات', formula: 'میانگین فاصله تا مدرسه/درمانگاه/بازار (شبکه معابر)', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'desc', proxy: false, reliability: 4, cluster: 'پایه و زیرساخت', compute: (r) => r.serviceDistance },
  { code: 'P6', layer: 'P', name: 'فضای اشتراکی/کارگاهی', formula: 'تراکم فضاهای چندمنظوره (حسینیه/سوله/کارگاه)', source: 'OSM + میدانی', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 3, cluster: 'پایه و زیرساخت', compute: (r) => r.multiPurposeSpaces },
  { code: 'P7', layer: 'P', name: 'تاب‌آوری محیطی', formula: '۱ − قرارگیری در پهنه مخاطره (سیل/گسل/فرونشست/شیب)', source: 'زمین‌شناسی + DEM', sourceKey: 'GEOLOGY', direction: 'asc', proxy: false, reliability: 3, cluster: 'پایه و زیرساخت', compute: (r) => 1 - r.hazardExposure },
  { code: 'P8', layer: 'P', name: 'ریزدانگی/بافت', formula: 'سهم قطعات ریزدانه و فرسوده', source: 'SCI / بافت فرسوده', sourceKey: 'SCI', direction: 'desc', proxy: false, reliability: 4, cluster: 'پایه و زیرساخت', compute: (r) => r.fineGrainShare },
  { code: 'P9', layer: 'P', name: 'آلاینده NO₂ هوا', formula: 'میانگین پهنه‌ای NO2 ستونی (Sentinel-5P)', source: 'Sentinel-5P/GEE', sourceKey: 'SENTINEL5P', direction: 'desc', proxy: false, reliability: 4, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.no2 },
  { code: 'P10', layer: 'P', name: 'آلاینده SO₂ هوا', formula: 'میانگین پهنه‌ای SO2 (Sentinel-5P)', source: 'Sentinel-5P/GEE', sourceKey: 'SENTINEL5P', direction: 'desc', proxy: false, reliability: 4, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.so2 },
  { code: 'P11', layer: 'P', name: 'هواویز/گردوغبار (AI)', formula: 'شاخص جذب هواویز (Sentinel-5P)', source: 'Sentinel-5P/GEE', sourceKey: 'SENTINEL5P', direction: 'desc', proxy: false, reliability: 4, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.aerosol },
  { code: 'P12', layer: 'P', name: 'ذرات معلق PM2.5', formula: 'غلظت سطحی PM2.5 (میانگین رستر)', source: 'WashU ACAG', sourceKey: 'ACAG', direction: 'desc', proxy: false, reliability: 4, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.pm25 },
  { code: 'P13', layer: 'P', name: 'دمای سطح/گرمای شهری', formula: 'LST تابستانه (MODIS MOD11A1)', source: 'MODIS/GEE', sourceKey: 'MODIS', direction: 'desc', proxy: false, reliability: 4, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.lst },
  { code: 'P14', layer: 'P', name: 'دمای سطح تفکیک‌بالا', formula: 'ST_B10 بدون‌ابر (Landsat 8/9)', source: 'Landsat/GEE', sourceKey: 'LANDSAT', direction: 'desc', proxy: false, reliability: 3, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.lst },
  { code: 'P15', layer: 'P', name: 'سرسبزی/پوشش گیاهی', formula: 'NDVI=(B8−B4)/(B8+B4) فصل رشد (Sentinel-2)', source: 'Sentinel-2/GEE', sourceKey: 'SENTINEL2', direction: 'asc', proxy: false, reliability: 4, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.ndvi },
  { code: 'P16', layer: 'P', name: 'پوشش گیاهی (سری‌زمانی)', formula: 'NDVI (MODIS MOD13A1)', source: 'MODIS/GEE', sourceKey: 'MODIS', direction: 'asc', proxy: false, reliability: 4, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.ndvi },
  { code: 'P17', layer: 'P', name: 'سطح ساخته‌شده', formula: 'سهم سطح ساخته‌شده پهنه (GHSL)', source: 'JRC GHSL/GEE', sourceKey: 'GHSL', direction: 'asc', proxy: false, reliability: 3, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.builtShare },
  { code: 'P18', layer: 'P', name: 'ردپای سکونتگاه', formula: 'سهم پیکسل سکونتگاهی (WSF2015)', source: 'DLR WSF/GEE', sourceKey: 'WSF', direction: 'asc', proxy: false, reliability: 3, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.settlementFootprint },
  { code: 'P19', layer: 'P', name: 'تراکم جمعیت شبکه‌ای', formula: 'جمعیت رستر ۱۰۰م بر مساحت پهنه', source: 'WorldPop', sourceKey: 'WORLDPOP', direction: 'neutral', proxy: false, reliability: 3, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.populationDensity },
  { code: 'P20', layer: 'P', name: 'آب سطحی/مواجهه سیل', formula: 'سهم پهنه در کلاس آب دائمی/فصلی (GSW)', source: 'JRC GSW/GEE', sourceKey: 'GSW', direction: 'desc', proxy: false, reliability: 3, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.waterSurfaceShare },
  { code: 'P21', layer: 'P', name: 'خشک‌سالی (SPEI)', formula: 'مقدار SPEI پهنه (مثبت = تر / منفی = خشک)', source: 'SPEI/CSIC', sourceKey: 'SPEI', direction: 'asc', proxy: false, reliability: 3, cluster: 'محیط‌زیست/اقلیم/مخاطرات', compute: (r) => r.spei },
  { code: 'P22', layer: 'P', name: 'تراکم تقاطع معابر', formula: 'تقاطع (گره≥۳) بر km² با OSMnx', source: 'OSM/OSMnx', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'حمل‌ونقل/دسترسی', compute: (r) => r.intersectionDensity },
  { code: 'P23', layer: 'P', name: 'اتصال‌پذیری معابر', formula: 'میانگین درجه گره/نسبت بن‌بست (OSMnx)', source: 'OSM/OSMnx', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'حمل‌ونقل/دسترسی', compute: (r) => r.connectivity },
  { code: 'P24', layer: 'P', name: 'زیرساخت پیاده', formula: 'طول footway/sidewalk بر مساحت', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'حمل‌ونقل/دسترسی', compute: (r) => r.pedestrianInfra },
  { code: 'P25', layer: 'P', name: 'دسترسی ایستگاه اتوبوس', formula: 'تراکم/بافر ۴۰۰م ایستگاه اتوبوس', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'حمل‌ونقل/دسترسی', compute: (r) => r.busStops },
  { code: 'P26', layer: 'P', name: 'دسترسی مترو/راه‌آهن', formula: 'فاصله شبکه‌ای تا ایستگاه (railway=station)', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'desc', proxy: false, reliability: 4, cluster: 'حمل‌ونقل/دسترسی', compute: (r) => r.metroAccess },
  { code: 'P27', layer: 'P', name: 'دسترسی شبکه‌ای خدمات (2SFCA)', formula: 'کاچمنت شناور دومرحله‌ای روی شبکه پیاده', source: 'OSM/OSMnx', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 3, cluster: 'حمل‌ونقل/دسترسی', compute: (r) => r.serviceAccess2sfca },
  { code: 'P28', layer: 'P', name: 'پیاده‌مداری ترکیبی', formula: 'z-score تقاطع+پیاده‌رو+آمیختگی کاربری', source: 'OSM/OSMnx', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 3, cluster: 'حمل‌ونقل/دسترسی', compute: (r) => r.walkability },
  { code: 'P29', layer: 'P', name: 'سرعت پهن‌باند ثابت', formula: 'تجمیع کاشی سرعت ثابت (کیفیت اتصال)', source: 'Ookla Open Data', sourceKey: 'OOKLA', direction: 'asc', proxy: false, reliability: 4, cluster: 'اتصال‌پذیری', compute: (r) => r.fixedBroadbandSpeed },
  { code: 'P30', layer: 'P', name: 'سرعت پهن‌باند همراه', formula: 'تجمیع کاشی سرعت همراه', source: 'Ookla Open Data', sourceKey: 'OOKLA', direction: 'asc', proxy: false, reliability: 4, cluster: 'اتصال‌پذیری', compute: (r) => r.mobileSpeed },
  { code: 'P31', layer: 'P', name: 'تراکم دکل همراه', formula: 'تراکم رکورد سلولی بر بلوک', source: 'OpenCelliD', sourceKey: 'OPENCELLID', direction: 'asc', proxy: false, reliability: 3, cluster: 'اتصال‌پذیری', compute: (r) => r.cellTowers },
  { code: 'P32', layer: 'P', name: 'نسل شبکه LTE/5G', formula: 'سهم سلول LTE/5G (فیلد radio)', source: 'OpenCelliD', sourceKey: 'OPENCELLID', direction: 'asc', proxy: false, reliability: 3, cluster: 'اتصال‌پذیری', compute: (r) => r.lte5gShare },
  { code: 'P33', layer: 'P', name: 'تراکم جایگاه سوخت', formula: 'شمارش amenity=fuel', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'اتصال‌پذیری', compute: (r) => r.fuelStations },
  { code: 'P34', layer: 'P', name: 'دسترسی بیمارستان', formula: 'فاصله amenity=hospital + Healthsites', source: 'OSM/Healthsites', sourceKey: 'HEALTHSITES', direction: 'desc', proxy: false, reliability: 4, cluster: 'سلامت/دسترسی/WASH', compute: (r) => r.hospitalDist },
  { code: 'P35', layer: 'P', name: 'دسترسی داروخانه', formula: 'تراکم amenity=pharmacy', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'سلامت/دسترسی/WASH', compute: (r) => r.pharmacyDensity },
  { code: 'P36', layer: 'P', name: 'دسترسی درمانگاه/خانه بهداشت', formula: 'clinic/healthcare=centre + Healthsites', source: 'OSM/Healthsites', sourceKey: 'HEALTHSITES', direction: 'asc', proxy: false, reliability: 4, cluster: 'سلامت/دسترسی/WASH', compute: (r) => r.clinicDensity },
  { code: 'P37', layer: 'P', name: 'تراکم مراکز درمانی سرانه', formula: 'مراکز Healthsites بر جمعیت پهنه', source: 'Healthsites', sourceKey: 'HEALTHSITES', direction: 'asc', proxy: false, reliability: 3, cluster: 'سلامت/دسترسی/WASH', compute: (r) => r.healthCentersPerCap },
  { code: 'P38', layer: 'P', name: 'دسترسی فروشگاه غذایی', formula: 'تراکم shop=supermarket/grocery', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'سلامت/دسترسی/WASH', compute: (r) => r.foodShops },
  { code: 'P39', layer: 'P', name: 'آب آشامیدنی سالم', formula: 'نردبان آب JMP (کیفیت خدمت، نیازمند ریزمقیاس)', source: 'WHO/UNICEF JMP', sourceKey: 'JMP', direction: 'asc', proxy: false, reliability: 2, cluster: 'سلامت/دسترسی/WASH', compute: (r) => r.safeWater },
  { code: 'P40', layer: 'P', name: 'فاضلاب بهبودیافته', formula: 'نردبان بهداشت JMP', source: 'WHO/UNICEF JMP', sourceKey: 'JMP', direction: 'asc', proxy: false, reliability: 2, cluster: 'سلامت/دسترسی/WASH', compute: (r) => r.improvedSanitation },
  { code: 'P41', layer: 'P', name: 'خدمات بهداشت دست', formula: 'نردبان hygiene JMP', source: 'WHO/UNICEF JMP', sourceKey: 'JMP', direction: 'asc', proxy: false, reliability: 2, cluster: 'سلامت/دسترسی/WASH', compute: (r) => r.handwashing },
  { code: 'P42', layer: 'P', name: 'سهم شهرنشینی/نوع سکونتگاه', formula: 'نسبت جمعیت شهری/روستایی (سرشماری ۱۳۹۵)', source: 'Iran Data Portal (SCI)', sourceKey: 'IRANOPENDATA', direction: 'neutral', proxy: false, reliability: 4, cluster: 'سلامت/دسترسی/WASH', compute: (r) => r.urbanizationShare },

  // ═══════════════ لایهٔ رفتاری–اجتماعی (B) ═══════════════
  { code: 'B1', layer: 'B', name: 'نرخ خوداشتغالی', formula: 'سهم شاغلان مستقل/کارگاه خرد', source: 'مرکز آمار ایران (SCI) — اشتغال', sourceKey: 'SCI', direction: 'asc', proxy: false, reliability: 4, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.selfEmployment },
  { code: 'B2', layer: 'B', name: 'تمایل به حرفه‌آموزی/تغییر مسیر', formula: 'Proxy: نسبت جوانان + دسترسی به مراکز فنی‌وحرفه‌ای', source: 'SCI + OSM', sourceKey: 'SCI', direction: 'asc', proxy: true, reliability: 3, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.youthShare },
  { code: 'B3', layer: 'B', name: 'ظرفیت تنوع مرتبط/زنجیره ارزش', formula: 'تنوع رسته‌های اقتصادی POI (شاخص شانون تنوع)', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.relatedVariety },
  { code: 'B4', layer: 'B', name: 'جذب تکنولوژی', formula: 'Proxy: نفوذ اینترنت × شدت نور شبانه (فعالیت)', source: 'ICT + VIIRS', sourceKey: 'ICT', direction: 'asc', proxy: true, reliability: 3, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.techAdoption },
  { code: 'B5', layer: 'B', name: 'پویایی اقتصادی', formula: 'تراکم و فعالیت POI اقتصادی + روند نور شبانه', source: 'OSM + VIIRS', sourceKey: 'VIIRS', direction: 'asc', proxy: false, reliability: 4, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.economicDynamism },
  { code: 'B6', layer: 'B', name: 'الگوی مهاجرت', formula: 'نرخ مهاجرفرستی/نسبت مهاجر (منفی برای فرستی)', source: 'مرکز آمار ایران (SCI)', sourceKey: 'SCI', direction: 'desc', proxy: false, reliability: 3, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.outMigration },
  { code: 'B7', layer: 'B', name: 'نرخ بیکاری', formula: 'نرخ بیکاری منطقه‌ای', source: 'مرکز آمار ایران (SCI)', sourceKey: 'SCI', direction: 'desc', proxy: false, reliability: 4, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.unemployment },
  { code: 'B8', layer: 'B', name: 'شدت نور شبانه', formula: 'میانگین رادیانس سالانه شب (VIIRS)', source: 'EOG VIIRS', sourceKey: 'VIIRS', direction: 'asc', proxy: true, reliability: 4, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.nightlight },
  { code: 'B9', layer: 'B', name: 'روند زمانی نور شبانه', formula: 'شیب چندساله رادیانس؛ رشد/افول محلی', source: 'EOG VIIRS', sourceKey: 'VIIRS', direction: 'asc', proxy: true, reliability: 4, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.nightlightTrend },
  { code: 'B10', layer: 'B', name: 'تراکم بانک/خودپرداز', formula: 'شمارش amenity=bank/atm؛ دسترسی مالی فیزیکی', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.bankAtmDensity },
  { code: 'B11', layer: 'B', name: 'تراکم بازار/بازارچه', formula: 'شمارش amenity=marketplace', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.marketDensity },
  { code: 'B12', layer: 'B', name: 'تراکم/تنوع کسب‌وکار', formula: 'شمارش + آنتروپی shop/office/craft', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.businessDiversity },
  { code: 'B13', layer: 'B', name: 'مالکیت کالای بادوام', formula: 'جداول کالای بادوام سرشماری ۱۳۹۵', source: 'Iran Data Portal (SCI)', sourceKey: 'IRANOPENDATA', direction: 'asc', proxy: false, reliability: 4, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.durableGoods },
  { code: 'B14', layer: 'B', name: 'نسبت وابستگی سنی', formula: '(۰-۱۴ + ۶۵+)/(۱۵-۶۴) از باندهای سن‌وجنس WorldPop', source: 'WorldPop', sourceKey: 'WORLDPOP', direction: 'desc', proxy: false, reliability: 3, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.dependencyRatio },
  { code: 'B15', layer: 'B', name: 'سهم جوانان ۱۵-۲۹', formula: 'جمع باندهای سنی جوان بر کل (WorldPop)', source: 'WorldPop', sourceKey: 'WORLDPOP', direction: 'asc', proxy: false, reliability: 3, cluster: 'اقتصاد/نور شبانه/دسترسی مالی', compute: (r) => r.youth1529 },
  { code: 'B16', layer: 'B', name: 'سواد به تفکیک سن/جنس', formula: 'نرخ باسوادی از سرشماری ۱۳۹۵', source: 'Iran Data Portal (SCI)', sourceKey: 'IRANOPENDATA', direction: 'asc', proxy: false, reliability: 4, cluster: 'آموزش/سرمایه انسانی/سواد دیجیتال', compute: (r) => r.literacy },
  { code: 'B17', layer: 'B', name: 'میانگین سال‌های تحصیل', formula: 'پروفایل تحصیلات UIS؛ تخصیص به پهنه', source: 'UNESCO UIS', sourceKey: 'UIS', direction: 'asc', proxy: false, reliability: 2, cluster: 'آموزش/سرمایه انسانی/سواد دیجیتال', compute: (r) => r.meanSchooling },
  { code: 'B18', layer: 'B', name: 'سهم تحصیلات عالی', formula: 'سهم دارای مدرک عالی (سرشماری ۱۳۹۵)', source: 'Iran Data Portal (SCI)', sourceKey: 'IRANOPENDATA', direction: 'asc', proxy: false, reliability: 4, cluster: 'آموزش/سرمایه انسانی/سواد دیجیتال', compute: (r) => r.higherEduShare },
  { code: 'B19', layer: 'B', name: 'نرخ اتمام متوسطه', formula: 'نرخ اتمام UIS SDG4', source: 'UNESCO UIS', sourceKey: 'UIS', direction: 'asc', proxy: false, reliability: 2, cluster: 'آموزش/سرمایه انسانی/سواد دیجیتال', compute: (r) => r.secondaryCompletion },
  { code: 'B20', layer: 'B', name: 'نرخ بازماندگی از تحصیل', formula: 'نرخ خارج‌ازمدرسه UIS', source: 'UNESCO UIS', sourceKey: 'UIS', direction: 'desc', proxy: false, reliability: 2, cluster: 'آموزش/سرمایه انسانی/سواد دیجیتال', compute: (r) => r.dropoutRate },
  { code: 'B21', layer: 'B', name: 'برابری جنسیتی آموزش', formula: 'شاخص برابری جنسیتی GPI', source: 'UNESCO UIS', sourceKey: 'UIS', direction: 'asc', proxy: false, reliability: 2, cluster: 'آموزش/سرمایه انسانی/سواد دیجیتال', compute: (r) => r.genderParity },
  { code: 'B22', layer: 'B', name: 'تراکم مدرسه', formula: 'شمارش amenity=school/kindergarten/college/university', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'آموزش/سرمایه انسانی/سواد دیجیتال', compute: (r) => r.schoolDensity },
  { code: 'B23', layer: 'B', name: 'نسبت دانش‌آموز/معلم', formula: 'نسبت شاگرد/معلم (UIS/سالنامه آماری)', source: 'UNESCO UIS', sourceKey: 'UIS', direction: 'desc', proxy: false, reliability: 2, cluster: 'آموزش/سرمایه انسانی/سواد دیجیتال', compute: (r) => r.pupilTeacherRatio },
  { code: 'B24', layer: 'B', name: 'نرخ ثبت‌نام آموزش عالی', formula: 'سری SE.TER.ENRR بانک جهانی', source: 'World Bank', sourceKey: 'WORLD_BANK', direction: 'asc', proxy: false, reliability: 2, cluster: 'آموزش/سرمایه انسانی/سواد دیجیتال', compute: (r) => r.tertiaryEnrollment },
  { code: 'B25', layer: 'B', name: 'سواد دیجیتال ساکنان', formula: 'نرخ کاربری اینترنت (پیمایش ICT، سطح استان)', source: 'مرکز آمار (ICT)', sourceKey: 'ICT', direction: 'asc', proxy: false, reliability: 3, cluster: 'آموزش/سرمایه انسانی/سواد دیجیتال', compute: (r) => r.digitalLiteracy },

  // ═══════════════ لایهٔ هنجاری–ادراکی (N) ═══════════════
  { code: 'N1', layer: 'N', name: 'نفوذ/اعتماد به معتمدین (امام محله)', formula: 'Proxy: تراکم و مرکزیت نهادهای مذهبی/محلی (OSM)', source: 'OSM + میدانی', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: true, reliability: 3, cluster: 'پایه و زیرساخت', compute: (r) => r.religiousInstitutions },
  { code: 'N2', layer: 'N', name: 'یادگیری جمعی/انتقال بین‌نسلی', formula: 'Proxy: تراکم نهادهای آموزشی/کانون', source: 'OSM + میدانی', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: true, reliability: 3, cluster: 'پایه و زیرساخت', compute: (r) => r.learningCenters },
  { code: 'N3', layer: 'N', name: 'اعتماد نهادی (مردم↔نهاد)', formula: 'Proxy: نرخ مشارکت انتخاباتی/مدنی', source: 'داده انتخابات عمومی', sourceKey: 'IRANOPENDATA', direction: 'asc', proxy: true, reliability: 3, cluster: 'پایه و زیرساخت', compute: (r) => r.electoralParticipation },
  { code: 'N4', layer: 'N', name: 'ریسک‌پذیری/گشودگی فکری', formula: 'Proxy پیمایشی (اختیاری) — پیش‌فرض data_gap', source: 'میدانی', sourceKey: 'FIELD', direction: 'asc', proxy: true, reliability: 5, cluster: 'پایه و زیرساخت', compute: (r) => (r.fieldSurvey ? 0.35 + 0.65 * (r.digitalLiteracy * 0.5 + r.electoralParticipation * 0.5) : null) },
  { code: 'N5', layer: 'N', name: 'امنیت و شمولیت', formula: '۱ − نرخ آسیب اجتماعی + امنیت فضای بی‌دفاع (CPTED)', source: 'آمار عمومی + OSM/VIIRS', sourceKey: 'SCI', direction: 'asc', proxy: false, reliability: 3, cluster: 'پایه و زیرساخت', compute: (r) => 1 - r.socialHarmRate },
  { code: 'N6', layer: 'N', name: 'انسجام و تعلق محلی', formula: 'Proxy: پایداری سکونت (۱ − نرخ جابجایی) + تراکم تشکل', source: 'SCI + OSM', sourceKey: 'SCI', direction: 'asc', proxy: true, reliability: 3, cluster: 'پایه و زیرساخت', compute: (r) => r.residentialStability },
  { code: 'N7', layer: 'N', name: 'نوع تصرف مسکن (مالک/اجاره)', formula: 'سهم مالکیت از متغیر OWNERSHIP (IPUMS ۲۰۱۱)', source: 'IPUMS International', sourceKey: 'IPUMS', direction: 'asc', proxy: false, reliability: 2, cluster: 'ساختار خانوار/جمعیت', compute: (r) => r.ownershipShare },
  { code: 'N8', layer: 'N', name: 'سهم خانوار زن‌سرپرست', formula: 'سهم سرپرست زن؛ پراکسی آسیب‌پذیری', source: 'IPUMS/IHSN', sourceKey: 'IPUMS', direction: 'desc', proxy: true, reliability: 2, cluster: 'ساختار خانوار/جمعیت', compute: (r) => r.femaleHeadShare },
  { code: 'N9', layer: 'N', name: 'میانگین بعد خانوار', formula: 'جمعیت/تعداد خانوار (جدول سرشماری ۱۳۹۵)', source: 'Iran Data Portal (SCI)', sourceKey: 'IRANOPENDATA', direction: 'neutral', proxy: false, reliability: 4, cluster: 'ساختار خانوار/جمعیت', compute: (r) => r.householdSize },
  { code: 'N10', layer: 'N', name: 'سهم سالمندان ۶۵+', formula: 'جمع باند سنی ۶۵-۸۰ بر کل (WorldPop)', source: 'WorldPop', sourceKey: 'WORLDPOP', direction: 'desc', proxy: false, reliability: 3, cluster: 'ساختار خانوار/جمعیت', compute: (r) => r.elderlyShare },
  { code: 'N11', layer: 'N', name: 'سهم خانوار چندنسلی', formula: 'سهم خانوار چندنسلی از ساختار RELATE (IPUMS)', source: 'IPUMS International', sourceKey: 'IPUMS', direction: 'asc', proxy: true, reliability: 2, cluster: 'ساختار خانوار/جمعیت', compute: (r) => r.multigenShare },
  { code: 'N12', layer: 'N', name: 'تراکم NGO/انجمن', formula: 'شمارش office=ngo/association (پراکسی مکانی)', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: true, reliability: 3, cluster: 'سرمایه اجتماعی مکانی/حکمرانی', compute: (r) => r.ngoDensity },
  { code: 'N13', layer: 'N', name: 'تراکم اماکن مذهبی', formula: 'شمارش place_of_worship؛ پراکسی کانون اعتماد', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: true, reliability: 3, cluster: 'سرمایه اجتماعی مکانی/حکمرانی', compute: (r) => r.worshipDensity },
  { code: 'N14', layer: 'N', name: 'سرانه پارک/فضای عمومی', formula: 'مساحت leisure=park سرانه', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'سرمایه اجتماعی مکانی/حکمرانی', compute: (r) => r.parkPerCap },
  { code: 'N15', layer: 'N', name: 'مشارکت انتخاباتی', formula: 'نرخ مشارکت استانی/شهرستانی (وزارت کشور)', source: 'Iran Data Portal', sourceKey: 'IRANOPENDATA', direction: 'asc', proxy: false, reliability: 4, cluster: 'سرمایه اجتماعی مکانی/حکمرانی', compute: (r) => r.electoralParticipation },
  { code: 'N16', layer: 'N', name: 'رویداد اعتراض/تنش', formula: 'شمارش رویداد ژئوکدشده در بافر پهنه', source: 'ACLED', sourceKey: 'ACLED', direction: 'desc', proxy: false, reliability: 3, cluster: 'سرمایه اجتماعی مکانی/حکمرانی', compute: (r) => r.protestEvents },
  { code: 'N17', layer: 'N', name: 'مشارکت پیش‌دبستانی', formula: 'نرخ مشارکت پیش‌دبستانی (UIS)', source: 'UNESCO UIS', sourceKey: 'UIS', direction: 'asc', proxy: false, reliability: 2, cluster: 'آموزش مدنی/رفاه سلامت', compute: (r) => r.preschoolParticipation },
  { code: 'N18', layer: 'N', name: 'تراکم کتابخانه عمومی', formula: 'شمارش amenity=library بر پهنه', source: 'OSM', sourceKey: 'OSM_OVERPASS', direction: 'asc', proxy: false, reliability: 4, cluster: 'آموزش مدنی/رفاه سلامت', compute: (r) => r.libraryDensity },
  { code: 'N19', layer: 'N', name: 'امید به زندگی زیرملی', formula: 'مقدار WHO GHO (IRN) + برآورد استانی GBD', source: 'WHO GHO/GBD', sourceKey: 'GHO', direction: 'asc', proxy: false, reliability: 2, cluster: 'آموزش مدنی/رفاه سلامت', compute: (r) => r.lifeExpectancy },
  { code: 'N20', layer: 'N', name: 'بار بیماری زیرملی (DALY)', formula: 'برآورد DALY استانی IHME GBD (۳۱ استان)', source: 'IHME GBD', sourceKey: 'GBD', direction: 'desc', proxy: false, reliability: 2, cluster: 'آموزش مدنی/رفاه سلامت', compute: (r) => r.dalyBurden },
];

// ─── ساخت کاتالوگ نهایی با وزن seed نرمال‌شدهٔ درون‌لایه ───────
// وزن هر زیرشاخص = وزن خوشه / تعداد اعضای خوشه (پس از نرمال درون‌لایه)
function buildCatalog(): SubIndicator[] {
  const clusterSizes: Record<string, number> = {};
  DEFS.forEach((d) => {
    clusterSizes[d.cluster] = (clusterSizes[d.cluster] ?? 0) + 1;
  });

  // وزن seed خام هر زیرشاخص (پیش از نرمال‌سازی درون‌لایه)
  const rawSeed: Record<string, number> = {};
  DEFS.forEach((d) => {
    rawSeed[d.code] = CLUSTER_WEIGHT[d.cluster] / clusterSizes[d.cluster];
  });

  // نرمال‌سازی درون‌لایه (جمع وزن هر لایه = ۱)
  const layerSum: Record<SubIndicator['layer'], number> = { P: 0, B: 0, N: 0 };
  DEFS.forEach((d) => {
    layerSum[d.layer] += rawSeed[d.code];
  });

  return DEFS.map((d) => ({
    code: d.code,
    layer: d.layer,
    name: d.name,
    formula: d.formula,
    source: d.source,
    sourceKey: d.sourceKey,
    direction: d.direction,
    proxy: d.proxy,
    reliability: d.reliability,
    cluster: d.cluster,
    seedWeight: rawSeed[d.code] / layerSum[d.layer],
    compute: d.compute,
  }));
}

export const INDICATOR_CATALOG: SubIndicator[] = buildCatalog();

export const INDICATORS_BY_LAYER: Record<SubIndicator['layer'], SubIndicator[]> = {
  P: INDICATOR_CATALOG.filter((i) => i.layer === 'P'),
  B: INDICATOR_CATALOG.filter((i) => i.layer === 'B'),
  N: INDICATOR_CATALOG.filter((i) => i.layer === 'N'),
};

export function indicatorByCode(code: string): SubIndicator | undefined {
  return INDICATOR_CATALOG.find((i) => i.code === code);
}

// محاسبهٔ مقدار خام همهٔ زیرشاخص‌ها برای یک پهنه
export function computeAllRaw(raw: ZoneRaw): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const ind of INDICATOR_CATALOG) {
    out[ind.code] = ind.compute(raw);
  }
  return out;
}
