/**
 * P0 — قرارداد مشترک منابع دادهٔ عمومی.
 *
 * هدف: افزودن یک منبع جدید = افزودن یک «منیفست اعلانی» + (اختیاری) یک تابع
 * transform، بدون دست‌زدن به route، کش، retry یا UI.
 */

export type SourceTransport =
  | 'http-json'
  | 'overpass'
  | 'stac'
  | 's3-parquet'
  | 'gee'
  | 'ogc'
  | 'file'
  | 'survey';

/** سطح مکانی که کانکتور برای پرس‌وجو لازم دارد */
export type SpatialLevel = 'point' | 'bbox' | 'polygon' | 'tile' | 'zone' | 'national';

/** آیا منبع مجاز است وارد امتیاز شود یا فقط شاهد است */
export type SourceRole = 'score_eligible' | 'evidence_only';

/** کلاس خودکارسازی هم‌تراز رجیستر ۱۶۴ شاخصی */
export type AutomationClass =
  | 'A_PUBLIC_AUTOMATIC'
  | 'B_PUBLIC_SEMI_AUTOMATIC'
  | 'C_OPERATOR_ENTERED'
  | 'D_CONTRACT_ONLY';

export type AllowedOutput = 'PROVISIONAL_PUBLIC' | 'REQUIRES_REVIEW' | 'INTERNAL_ONLY';

export type AuthScheme = 'none' | 'header' | 'query' | 'bearer';

export interface SourceAuth {
  scheme: AuthScheme;
  /** نام متغیر محیطی حاوی کلید؛ هرگز مقدار کلید ذخیره نمی‌شود */
  envVar?: string;
  /** نام هدر یا پارامتر درخواست */
  param?: string;
}

export interface SourceTemporal {
  /** دورهٔ طبیعی به‌روزرسانی منبع */
  cadence: 'realtime' | 'hourly' | 'daily' | 'monthly' | 'annual' | 'static';
  /** ماندگاری کش تازه (میلی‌ثانیه) */
  ttlMs: number;
  /** ماندگاری کش کهنه (قابل استفاده به‌عنوان fallback) */
  staleTtlMs?: number;
  /** پشتیبانی از پرس‌وجوی زمان گذشته */
  historical?: boolean;
}

export interface SourceLicense {
  name: string;
  attribution: string;
  commercial: boolean;
  url?: string;
}

/**
 * نگاشت مقدار خام به امتیاز ۰..۱۰۰ شاخص.
 * `score = clamp((value - worst) / (best - worst) * 100, 0, 100)`
 * برای شاخص‌هایی که «کمتر بهتر است» کافی است `best < worst` بگذاریم.
 */
export interface FeedScoring {
  /** مقدار خامی که امتیاز ۱۰۰ (بهترین) را می‌گیرد */
  best: number;
  /** مقدار خامی که امتیاز ۰ (بدترین) را می‌گیرد */
  worst: number;
  /** وزن در تجمیع چند متغیر روی یک کد شاخص (پیش‌فرض ۱) */
  weight?: number;
}

/** اتصال یک متغیر خروجی به کد شاخص تصمیم‌یار */
export interface SourceFeed {
  variable: string;
  /** کد شاخص در کاتالوگ تصمیم‌یار (در صورت وجود) */
  indicatorCode?: string;
  unit?: string;
  transform?: 'identity' | 'invert' | 'percent' | 'count';
  /** تنها متغیرهای دارای scoring وارد امتیاز می‌شوند */
  scoring?: FeedScoring;
  /** این متغیر پروکسی است، نه سنجش مستقیم شاخص */
  proxy?: boolean;
}

export interface SourceQuality {
  /** ۱..۵ */
  minReliability: number;
  gates?: string[];
  /** منبع در شرایط نبود داده هرگز صفر نمی‌دهد */
  neverZeroFills?: boolean;
}

/** اعلان کامل یک منبع — تنها منبع حقیقت */
export interface SourceManifest {
  id: string;
  title: string;
  /** شناسهٔ متناظر در SOURCE_REGISTRY موجود (برای مهاجرت تدریجی) */
  registryId?: string;
  transport: SourceTransport;
  endpoint: string;
  auth: SourceAuth;
  spatial: SpatialLevel;
  temporal: SourceTemporal;
  license: SourceLicense;
  feeds: SourceFeed[];
  role: SourceRole;
  quality: SourceQuality;
  automationClass: AutomationClass;
  allowedOutput: AllowedOutput;
  /** منابع جایگزین به‌ترتیب اولویت */
  fallbacks?: string[];
  notes?: string;
}

/** زمینهٔ پرس‌وجو که resolver به کانکتور می‌دهد */
export interface ConnectorContext {
  point?: { lat: number; lng: number };
  bbox?: [number, number, number, number];
  zoneId?: string;
  /** زمان مشاهده (ISO) در صورت پشتیبانی منبع */
  at?: string;
  timeoutMs?: number;
}

export interface SourceVariable {
  variable: string;
  value: number | null;
  unit?: string;
  observedAt?: string;
  indicatorCode?: string;
}

export interface SourceProvenance {
  sourceId: string;
  endpoint: string;
  license: string;
  attribution: string;
  fetchedAt: string;
  latencyMs: number;
  cache: 'MISS' | 'HIT' | 'STALE' | 'DISABLED';
  /** منبع واقعاً پاسخ داد یا fallback وارد شد */
  provider: 'live' | 'fallback' | 'local';
  fallbackFrom?: string;
  evidenceOnly: boolean;
  requestIds?: string[];
}

export interface SourceResult {
  sourceId: string;
  variables: SourceVariable[];
  provenance: SourceProvenance;
  raw?: unknown;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface SourceHealth {
  sourceId: string;
  state: CircuitState;
  requests: number;
  successes: number;
  failures: number;
  consecutiveFailures: number;
  lastLatencyMs: number | null;
  lastSuccessAt: string | null;
  lastError: string | null;
}

export interface Connector {
  manifest: SourceManifest;
  query(ctx: ConnectorContext, signal?: AbortSignal): Promise<SourceResult>;
}
