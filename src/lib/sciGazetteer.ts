// ============================================================
// گازتیر رسمی مرکز آمار ایران (SCI) — دادهٔ استخراج‌شده از
// Portals → src/data/portals (فهرست تقسیمات کشوری ۱۴۰۱)
// ------------------------------------------------------------
// این ماژول نام‌ها و سلسله‌مراتب رسمی (استان ← شهرستان ← بخش ←
// دهستان/شهر) را به‌صورت lazy بارگذاری و جست‌وجوی عادی‌شدهٔ فارسی
// ارائه می‌دهد و کد عددی استان را به شناسهٔ الفبایی برنامه نگاشت می‌کند.
// گازتیر فاقد مختصات است؛ مختصات توسط Nominatim تأمین می‌شود.
// ============================================================
import gazetteerUrl from '../data/portals/divisions/gazetteer.json?url';
import summaryUrl from '../data/portals/divisions/divisions-summary.json?url';
import { PROVINCES_DATA } from '../data/iranProvincePaths';

/** ردیف گازتیر (آرایهٔ فشرده): [استان,نام,شهرستان,نام,بخش,نام,دهستان,نام,نوع] */
export type SciEntry = [
  ostanCode: string,
  ostanName: string,
  countyCode: string,
  countyName: string,
  bakhshCode: string,
  bakhshName: string,
  dehestanCode: string,
  dehestanName: string,
  type: 'city' | 'dehestan' | 'bakhsh',
];

export interface SciSummary {
  code: string;
  name: string;
  counties: number;
  bakhshs: number;
  dehestans: number;
  cities: number;
}

export interface SciMatch {
  name: string;            // نام رسمی (محله/شهر/دهستان)
  countyName: string;
  ostanName: string;
  ostanCode: string;
  provinceId: string;      // کد الفبایی برنامه (TEH, ISF, ...)
  provinceFa: string;
  typeFa: string;          // شهر/دهستان/بخش
  type: SciEntry[8];
  /** مرکز استان به‌عنوان نقطهٔ تقریبی (تا زمانی که مختصات دقیق از Nominatim بیاید) */
  lat: number;
  lng: number;
}

const TYPE_FA: Record<SciEntry[8], string> = {
  city: 'شهر',
  dehestan: 'دهستان',
  bakhsh: 'بخش',
};

function norm(s: string): string {
  return s
    .replace(/\u200c/g, ' ')
    .replace(/[\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

let cache: {
  entries: SciEntry[];
  summary: SciSummary[];
  byAlpha: Map<string, string>;   // alpha → ostanCode
  centerByAlpha: Map<string, { lat: number; lng: number }>;
} | null = null;

async function load(): Promise<typeof cache extends null ? never : NonNullable<typeof cache>> {
  if (cache) return cache;
  const [gRes, sRes] = await Promise.all([fetch(gazetteerUrl), fetch(summaryUrl)]);
  if (!gRes.ok || !sRes.ok) throw new Error('SCI gazetteer http error');
  const entries = (await gRes.json()) as SciEntry[];
  const summary = (await sRes.json()) as SciSummary[];

  // نگاشت کد عددی SCI ← کد الفبایی برنامه با تطبیق نام استان
  const byName = new Map<string, string>();
  for (const p of PROVINCES_DATA) byName.set(norm(p.name), p.id);
  const byAlpha = new Map<string, string>();     // alpha → ostanCode
  const centerByAlpha = new Map<string, { lat: number; lng: number }>();
  for (const p of PROVINCES_DATA) centerByAlpha.set(p.id, { lat: p.lat, lng: p.lng });
  for (const s of summary) {
    const alpha = byName.get(norm(s.name));
    if (alpha) byAlpha.set(alpha, s.code);
  }
  cache = { entries, summary, byAlpha, centerByAlpha };
  return cache;
}

/** دریافت گازتیر رسمی (lazy + کش) */
export function getSciGazetteer(): Promise<NonNullable<typeof cache>> {
  return load();
}

/** کد عددی SCI استان بر اساس شناسهٔ الفبایی برنامه */
export async function sciCodeForProvince(alpha: string): Promise<string | undefined> {
  const g = await load();
  return g.byAlpha.get(alpha);
}

/**
 * جست‌وجوی نام رسمی در گازتیر SCI — عادی‌سازی فارسی (ی/ک/نیم‌فاصله).
 * تطبیق: شروع/شامل بودن نام یا نام شهرستان؛ اولویت با تطابق کامل و نوع شهری.
 */
export async function searchSciNames(q: string, limit = 5): Promise<SciMatch[]> {
  const g = await load();
  const nq = norm(q).toLowerCase();
  if (nq.length < 2) return [];

  const byName = new Map<string, string>();
  for (const p of PROVINCES_DATA) byName.set(norm(p.name), p.id);

  const alphaFor = (ostanName: string): string => byName.get(norm(ostanName)) ?? '';
  const provData = (alpha: string) => PROVINCES_DATA.find((p) => p.id === alpha);

  const scored: Array<{ score: number; m: SciMatch }> = [];
  for (const e of g.entries) {
    const [oc, on, cc, cn, bc, bn, dc, dn, type] = e;
    const name = type === 'dehestan' ? dn : type === 'city' ? dn : bn;
    if (!name) continue;
    const nn = norm(name).toLowerCase();
    const cnN = norm(cn).toLowerCase();
    const onN = norm(on).toLowerCase();
    let hit = 0;
    if (nn === nq) hit = 100;
    else if (nn.startsWith(nq)) hit = 70;
    else if (nn.includes(nq)) hit = 40;
    else if (cnN === nq || cnN.startsWith(nq) || cnN.includes(nq)) hit = 25;
    else if (onN === nq) hit = 10;
    else continue;
    // امتیاز نوع: شهر > بخش > دهستان (هدف جستجوی نام محله)
    const typeBonus = type === 'city' ? 12 : type === 'bakhsh' ? 6 : 0;
    const alpha = alphaFor(on);
    const pd = alpha ? provData(alpha) : undefined;
    scored.push({
      score: hit + typeBonus,
      m: {
        name: type === 'dehestan' || type === 'city' ? dn : bn,
        countyName: cn,
        ostanName: on,
        ostanCode: oc,
        provinceId: alpha || '',
        provinceFa: pd?.name ?? on,
        typeFa: TYPE_FA[type],
        type,
        lat: pd?.lat ?? 0,
        lng: pd?.lng ?? 0,
      },
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.m);
}
