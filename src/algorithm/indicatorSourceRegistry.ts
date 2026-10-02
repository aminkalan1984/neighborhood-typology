// ============================================================
// رجیستر منبع داده برای هر شاخص الگوریتم
// هر شاخص منبع اصلی + منابع جایگزین + نوع داده + ویژگی‌ها
// ============================================================
import type { CapitalKey, ChainStage, IndicatorRole } from './types';

export type DataSourceType = 'objective' | 'spatial' | 'behavioral' | 'perceptual';

export interface IndicatorSourceMapping {
  indicatorCode: string;
  capitalKey: CapitalKey;
  chainStage: ChainStage;
  role: IndicatorRole;
  primarySource: string;
  alternativeSources: string[];
  dataSourceType: DataSourceType;
  extractionMethod: string;
  refreshFrequency: string;
  spatialResolution: string;
  minReliability: number;
  proxy: boolean;
  calibrationNote?: string;
}

export const INDICATOR_SOURCE_REGISTRY: IndicatorSourceMapping[] = [
  // ═══ H — انسانی ═══
  { indicatorCode: 'H1', capitalKey: 'H', chainStage: 'CAPACITY', role: 'capacity', primarySource: 'مرکز آمار ایران (سرشماری)', alternativeSources: ['پیمایش محلی', 'آمارنامه استانی'], dataSourceType: 'objective', extractionMethod: 'درصد جمعیت ۲۵+ با حداقل دیپلم', refreshFrequency: 'هر ۵ سال + تخمین سالانه', spatialResolution: 'بخش آماری / پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'H2', capitalKey: 'H', chainStage: 'CAPACITY', role: 'capacity', primarySource: 'پیمایش محلی', alternativeSources: ['آمار اشتغال'], dataSourceType: 'perceptual', extractionMethod: 'پرسش از مهارت‌های حرفه‌ای', refreshFrequency: 'سالانه', spatialResolution: 'پهنه ۴۰۰ خانواری', minReliability: 3, proxy: false },
  { indicatorCode: 'H3', capitalKey: 'H', chainStage: 'OUTCOME', role: 'outcome', primarySource: 'پیمایش / تأمین اجتماعی', alternativeSources: ['آمار اشتغال'], dataSourceType: 'objective', extractionMethod: 'نرخ اشتغال پایدار', refreshFrequency: 'سالانه', spatialResolution: 'منطقه', minReliability: 4, proxy: false },
  { indicatorCode: 'H4', capitalKey: 'H', chainStage: 'CAPACITY', role: 'conversion', primarySource: 'پیمایش', alternativeSources: [], dataSourceType: 'behavioral', extractionMethod: 'تناسب شغل با مهارت', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: true, calibrationNote: 'نیازمند تعریف دقیق مهارت و شغل مرتبط' },
  { indicatorCode: 'H5', capitalKey: 'H', chainStage: 'OUTCOME', role: 'reproduction', primarySource: 'پیمایش / مراکز آموزشی', alternativeSources: ['آمار آموزش'], dataSourceType: 'behavioral', extractionMethod: 'مشارکت در آموزش', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },

  // ═══ S — اجتماعی ═══
  { indicatorCode: 'S1', capitalKey: 'S', chainStage: 'CAPACITY', role: 'capacity', primarySource: 'پیمایش', alternativeSources: [], dataSourceType: 'perceptual', extractionMethod: 'میانگین لیکرت اعتماد', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'S2', capitalKey: 'S', chainStage: 'EXPERIENCE', role: 'experience', primarySource: 'پیمایش', alternativeSources: [], dataSourceType: 'perceptual', extractionMethod: 'میانگین احساس تعلق', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'S3', capitalKey: 'S', chainStage: 'CAPACITY', role: 'capacity', primarySource: 'پیمایش', alternativeSources: [], dataSourceType: 'perceptual', extractionMethod: 'درصد دارای همکاری متقابل', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'S4', capitalKey: 'S', chainStage: 'USE', role: 'conversion', primarySource: 'پیمایش', alternativeSources: ['پرونده پروژه'], dataSourceType: 'behavioral', extractionMethod: 'درصد مشارکت‌کنندگان حل مسئله', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'S5', capitalKey: 'S', chainStage: 'OUTCOME', role: 'outcome', primarySource: 'پرونده پروژه / پیمایش', alternativeSources: [], dataSourceType: 'behavioral', extractionMethod: 'نرخ حل مسئله مشارکتی', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },

  // ═══ E — اقتصادی ═══
  { indicatorCode: 'E1', capitalKey: 'E', chainStage: 'CAPACITY', role: 'capacity', primarySource: 'پیمایش / داده رسمی', alternativeSources: ['آمار درآمد'], dataSourceType: 'objective', extractionMethod: 'نسبت درآمد خانوار به میانه شهر', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'E2', capitalKey: 'E', chainStage: 'CAPACITY', role: 'capacity', primarySource: 'GIS / اصناف', alternativeSources: ['پیمایش'], dataSourceType: 'spatial', extractionMethod: 'تراکم شغلی', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'E3', capitalKey: 'E', chainStage: 'OUTCOME', role: 'outcome', primarySource: 'اصناف', alternativeSources: ['داده ثبتی'], dataSourceType: 'objective', extractionMethod: 'نرخ ماندگاری کسب‌وکار', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'E4', capitalKey: 'E', chainStage: 'ACCESS', role: 'equity', primarySource: 'پیمایش / بازار', alternativeSources: ['آمار مسکن'], dataSourceType: 'objective', extractionMethod: 'نسبت هزینه مسکن به درآمد', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'E5', capitalKey: 'E', chainStage: 'OUTCOME', role: 'reproduction', primarySource: 'داده اقتصادی', alternativeSources: [], dataSourceType: 'objective', extractionMethod: 'سهم ارزش مانده در محله', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: true, calibrationNote: 'دشوار در اندازه‌گیری مستقیم' },

  // ═══ P — کالبدی ═══
  { indicatorCode: 'P1', capitalKey: 'P', chainStage: 'CAPACITY', role: 'capacity', primarySource: 'GIS / پایگاه ساختمان', alternativeSources: ['سرشماری مسکن'], dataSourceType: 'spatial', extractionMethod: 'پایداری ابنیه', refreshFrequency: 'هر ۵ سال', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'P2', capitalKey: 'P', chainStage: 'CAPACITY', role: 'capacity', primarySource: 'GIS', alternativeSources: ['OSM'], dataSourceType: 'spatial', extractionMethod: 'پیوستگی شبکه معابر', refreshFrequency: 'هر ۳ سال', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'P3', capitalKey: 'P', chainStage: 'USE', role: 'use', primarySource: 'ممیزی میدانی', alternativeSources: ['پیمایش'], dataSourceType: 'behavioral', extractionMethod: 'امتیاز مشاهده‌ای فضای عمومی', refreshFrequency: 'هر ۲ سال', spatialResolution: 'نقطه‌ای / پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'P4', capitalKey: 'P', chainStage: 'ACCESS', role: 'access', primarySource: 'GIS', alternativeSources: ['OSM'], dataSourceType: 'spatial', extractionMethod: 'پوشش دسترسی خدمات', refreshFrequency: 'هر ۳ سال', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'P5', capitalKey: 'P', chainStage: 'ACCESS', role: 'access', primarySource: 'GIS', alternativeSources: ['OSM', 'داده حمل‌ونقل'], dataSourceType: 'spatial', extractionMethod: 'دسترسی حمل‌ونقل عمومی', refreshFrequency: 'هر ۳ سال', spatialResolution: 'پهنه', minReliability: 4, proxy: false },

  // ═══ N — طبیعی ═══
  { indicatorCode: 'N1', capitalKey: 'N', chainStage: 'ACCESS', role: 'access', primarySource: 'GIS', alternativeSources: ['OSM'], dataSourceType: 'spatial', extractionMethod: 'دسترسی پیاده به فضای سبز', refreshFrequency: 'هر ۳ سال', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'N2', capitalKey: 'N', chainStage: 'CAPACITY', role: 'capacity', primarySource: 'سنجش‌ازدور / GIS', alternativeSources: ['Sentinel-2', 'MODIS'], dataSourceType: 'spatial', extractionMethod: 'NDVI فصل رشد', refreshFrequency: 'سالانه', spatialResolution: '۱۰-۳۰ متر', minReliability: 4, proxy: false },
  { indicatorCode: 'N3', capitalKey: 'N', chainStage: 'OUTCOME', role: 'outcome', primarySource: 'پایش محیطی', alternativeSources: ['Sentinel-5P', 'ایستگاه‌ها'], dataSourceType: 'spatial', extractionMethod: 'غلظت PM2.5', refreshFrequency: 'روزانه', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'N4', capitalKey: 'N', chainStage: 'CAPACITY', role: 'risk', primarySource: 'GIS', alternativeSources: ['زمین‌شناسی'], dataSourceType: 'spatial', extractionMethod: 'جمعیت در پهنه خطر', refreshFrequency: 'هر ۵ سال', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'N5', capitalKey: 'N', chainStage: 'OUTCOME', role: 'reproduction', primarySource: 'GIS / داده اقلیمی', alternativeSources: ['SPEI', 'GSW'], dataSourceType: 'spatial', extractionMethod: 'امتیاز ترکیبی تاب‌آوری', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },

  // ═══ C — فرهنگی ═══
  { indicatorCode: 'C1', capitalKey: 'C', chainStage: 'CAPACITY', role: 'capacity', primarySource: 'GIS / اسناد', alternativeSources: ['OSM'], dataSourceType: 'spatial', extractionMethod: 'تراکم دارایی فرهنگی', refreshFrequency: 'هر ۳ سال', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'C2', capitalKey: 'C', chainStage: 'USE', role: 'conversion', primarySource: 'مشاهده', alternativeSources: ['پیمایش'], dataSourceType: 'behavioral', extractionMethod: 'نرخ فعال‌بودن دارایی‌ها', refreshFrequency: 'سالانه', spatialResolution: 'نقطه‌ای', minReliability: 3, proxy: false },
  { indicatorCode: 'C3', capitalKey: 'C', chainStage: 'EXPERIENCE', role: 'experience', primarySource: 'پیمایش', alternativeSources: [], dataSourceType: 'perceptual', extractionMethod: 'میانگین احساس هویت', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'C4', capitalKey: 'C', chainStage: 'USE', role: 'use', primarySource: 'پیمایش', alternativeSources: [], dataSourceType: 'behavioral', extractionMethod: 'مشارکت فرهنگی', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'C5', capitalKey: 'C', chainStage: 'OUTCOME', role: 'reproduction', primarySource: 'پیمایش', alternativeSources: [], dataSourceType: 'perceptual', extractionMethod: 'انتقال هویت به نسل جوان', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },

  // ═══ G — نهادی ═══
  { indicatorCode: 'G1', capitalKey: 'G', chainStage: 'USE', role: 'conversion', primarySource: 'اسناد / پیمایش', alternativeSources: [], dataSourceType: 'behavioral', extractionMethod: 'مشارکت در تصمیم‌گیری', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'G2', capitalKey: 'G', chainStage: 'ACCESS', role: 'conversion', primarySource: 'داده مدیریت شهری', alternativeSources: [], dataSourceType: 'objective', extractionMethod: 'نرخ پاسخگویی', refreshFrequency: 'ماهانه', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'G3', capitalKey: 'G', chainStage: 'USE', role: 'conversion', primarySource: 'ارزیابی خبرگان', alternativeSources: [], dataSourceType: 'perceptual', extractionMethod: 'امتیاز هماهنگی نهادی', refreshFrequency: 'هر ۲ سال', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'G4', capitalKey: 'G', chainStage: 'CAPACITY', role: 'capacity', primarySource: 'داده پروژه', alternativeSources: [], dataSourceType: 'objective', extractionMethod: 'نرخ تکمیل پروژه', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'G5', capitalKey: 'G', chainStage: 'OUTCOME', role: 'reproduction', primarySource: 'اسناد', alternativeSources: [], dataSourceType: 'objective', extractionMethod: 'نرخ استفاده از ارزیابی', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },

  // ═══ R — شبکه‌ای ═══
  { indicatorCode: 'R1', capitalKey: 'R', chainStage: 'ACCESS', role: 'access', primarySource: 'GIS', alternativeSources: ['OSM'], dataSourceType: 'spatial', extractionMethod: 'زمان سفر به مراکز اصلی', refreshFrequency: 'هر ۳ سال', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'R2', capitalKey: 'R', chainStage: 'ACCESS', role: 'conversion', primarySource: 'GIS', alternativeSources: ['داده بازار کار'], dataSourceType: 'spatial', extractionMethod: 'تعداد فرصت شغلی در شعاع', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'R3', capitalKey: 'R', chainStage: 'ACCESS', role: 'conversion', primarySource: 'GIS', alternativeSources: ['OSM'], dataSourceType: 'spatial', extractionMethod: 'زمان تا مرکز آموزشی', refreshFrequency: 'هر ۳ سال', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
  { indicatorCode: 'R4', capitalKey: 'R', chainStage: 'USE', role: 'conversion', primarySource: 'پیمایش / داده اقتصادی', alternativeSources: [], dataSourceType: 'behavioral', extractionMethod: 'شدت اتصال اقتصادی', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 3, proxy: false },
  { indicatorCode: 'R5', capitalKey: 'R', chainStage: 'OUTCOME', role: 'reproduction', primarySource: 'اپراتور / پیمایش', alternativeSources: ['Ookla', 'OpenCelliD'], dataSourceType: 'behavioral', extractionMethod: 'پوشش × کیفیت × استفاده مؤثر', refreshFrequency: 'سالانه', spatialResolution: 'پهنه', minReliability: 4, proxy: false },
];

export function getSourceMapping(code: string): IndicatorSourceMapping | undefined {
  return INDICATOR_SOURCE_REGISTRY.find(s => s.indicatorCode === code);
}

export function getSourceTypeCounts(): Record<DataSourceType, number> {
  const counts: Record<DataSourceType, number> = { objective: 0, spatial: 0, behavioral: 0, perceptual: 0 };
  for (const s of INDICATOR_SOURCE_REGISTRY) counts[s.dataSourceType]++;
  return counts;
}
