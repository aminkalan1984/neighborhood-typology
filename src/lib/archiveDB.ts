// ============================================================
// خزانهٔ دادهٔ آرا (Ara Data Vault) — پایگاه دادهٔ محلی مرورگر
// ------------------------------------------------------------
// یک لایهٔ ذخیره‌سازی ساخت‌یافته (IndexedDB) برای کل پلتفرم:
//   zones      — نتایج گونه‌بندی ذخیره‌شده (SI/لایه‌ها/رادار/حالت + نمونه‌ها)
//   extractions— استخراج‌های کامل ۳۲۹ شاخص (خودکار، قابل بارگذاری مجدد)
//   analyses   — خروجی‌های هوش مصنوعی حکیم (بازبینی/گزارش/مقایسه/NLQ)
//   chats      — گفتگوهای حکیم (بازیابی جلسهٔ آخر)
//   events     — سوابق فعالیت کاربر (تاریخچهٔ کار با پلتفرم)
//   kv         — تنظیمات/پرچم‌های نسخه
// اگر IndexedDB در دسترس نباشد (حالت خصوصی/محدود)، به‌صورت خودکار به
// localStorage با همان ساختار فروشگاه‌ها (JSON) سقوط می‌کند.
// ============================================================

export type ArchiveStore = 'zones' | 'extractions' | 'analyses' | 'chats' | 'events' | 'kv';

export interface ArchiveRecord {
  id: string;
  /** برچسب زمانی عددی (Date.now()) — برای مرتب‌سازی نزولی؛ در صورت نبود، هنگام ذخیره تنظیم می‌شود */
  at?: number;
}

const DB_NAME = 'ara-data-vault';
const DB_VERSION = 1;

/** نام کلید localStorage میراثیِ صفحهٔ گونه‌شناسی (برای مهاجرت یک‌باره) */
export const LEGACY_TYPOLOGY_KEY = 'ara:typology:saved:v1';

export interface ArchiveHandle {
  put<T extends ArchiveRecord>(store: ArchiveStore, rec: T): Promise<void>;
  get<T extends ArchiveRecord>(store: ArchiveStore, id: string): Promise<T | null>;
  list<T extends ArchiveRecord>(store: ArchiveStore, limit?: number): Promise<T[]>;
  remove(store: ArchiveStore, id: string): Promise<void>;
  clear(store: ArchiveStore): Promise<void>;
  count(store: ArchiveStore): Promise<number>;
}

// ─── پیاده‌سازی IndexedDB ─────────────────────────────────────
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      const mk = (name: ArchiveStore, withAtIndex: boolean) => {
        if (!db.objectStoreNames.contains(name)) {
          const os = db.createObjectStore(name, { keyPath: 'id' });
          if (withAtIndex) os.createIndex('byAt', 'at');
          if (name === 'analyses') os.createIndex('byKind', 'kind');
        }
      };
      mk('zones', true);
      mk('extractions', true);
      mk('analyses', true);
      mk('chats', false);
      mk('events', true);
      mk('kv', false);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('indexedDB open failed'));
    req.onblocked = () => reject(new Error('indexedDB blocked'));
  });
}

let dbPromise: Promise<IDBDatabase> | null = null;
let fallback = false;

function withDb<T>(store: ArchiveStore, mode: IDBTransactionMode, run: (os: IDBObjectStore) => IDBRequest<T> | Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    dbPromise!
      .then((db) => {
        const tr = db.transaction(store, mode);
        const os = tr.objectStore(store);
        const r = run(os);
        if (r instanceof Promise) {
          r.then(resolve, reject);
        } else {
          r.onsuccess = () => resolve(r.result as T);
          r.onerror = () => reject(r.error ?? new Error('request failed'));
        }
        tr.onerror = () => reject(tr.error ?? new Error('tx failed'));
      }, reject);
  });
}

function listAll<T extends ArchiveRecord>(os: IDBObjectStore, limit?: number): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const out: T[] = [];
    let idx: IDBIndex | IDBObjectStore;
    try {
      idx = os.index('byAt');
    } catch {
      idx = os;
    }
    const req = idx.openCursor(null, 'prev'); // نزولی بر اساس at
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) {
        resolve(out);
        return;
      }
      out.push(cur.value as T);
      if (limit && out.length >= limit) {
        resolve(out);
        return;
      }
      cur.continue();
    };
    req.onerror = () => reject(req.error ?? new Error('cursor failed'));
  });
}

// ─── سقوط به localStorage ─────────────────────────────────────
const LS_PREFIX = 'ara:vault:';
function lsKey(store: ArchiveStore, id: string): string {
  return `${LS_PREFIX}${store}:${id}`;
}
function lsIdx(store: ArchiveStore): string {
  return `${LS_PREFIX}${store}:__idx__`;
}

const lsHandle: ArchiveHandle = {
  async put<T extends ArchiveRecord>(store: ArchiveStore, rec: T): Promise<void> {
    try {
      localStorage.setItem(lsKey(store, rec.id), JSON.stringify({ ...rec, at: rec.at ?? Date.now() }));
      const idx = JSON.parse(localStorage.getItem(lsIdx(store)) ?? '[]') as string[];
      if (!idx.includes(rec.id)) {
        idx.push(rec.id);
        localStorage.setItem(lsIdx(store), JSON.stringify(idx));
      }
    } catch {
      // حافظه پر/مسدود — بهترین تلاش
    }
  },
  async get<T extends ArchiveRecord>(store: ArchiveStore, id: string): Promise<T | null> {
    const raw = localStorage.getItem(lsKey(store, id));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async list<T extends ArchiveRecord>(store: ArchiveStore, limit?: number): Promise<T[]> {
    const idx = JSON.parse(localStorage.getItem(lsIdx(store)) ?? '[]') as string[];
    const rows: T[] = [];
    for (const id of [...idx].reverse()) {
      const rec = await lsHandle.get<T>(store, id);
      if (rec) rows.push(rec);
      if (limit && rows.length >= limit) break;
    }
    return rows.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));
  },
  async remove(store: ArchiveStore, id: string): Promise<void> {
    localStorage.removeItem(lsKey(store, id));
    try {
      const idx = JSON.parse(localStorage.getItem(lsIdx(store)) ?? '[]') as string[];
      localStorage.setItem(lsIdx(store), JSON.stringify(idx.filter((x) => x !== id)));
    } catch {
      // نادیده بگیر
    }
  },
  async clear(store: ArchiveStore): Promise<void> {
    const idx = JSON.parse(localStorage.getItem(lsIdx(store)) ?? '[]') as string[];
    idx.forEach((id) => localStorage.removeItem(lsKey(store, id)));
    localStorage.removeItem(lsIdx(store));
  },
  async count(store: ArchiveStore): Promise<number> {
    const idx = JSON.parse(localStorage.getItem(lsIdx(store)) ?? '[]') as string[];
    return idx.length;
  },
};

// ─── دسترسی واحد (singleton) ─────────────────────────────────
export async function getArchive(): Promise<ArchiveHandle> {
  if (fallback) return lsHandle;
  if (!dbPromise) dbPromise = openDb();
  try {
    const db = await dbPromise;
    return {
      put: <T extends ArchiveRecord>(store: ArchiveStore, rec: T) =>
        withDb(store, 'readwrite', (os) => os.put({ ...rec, at: rec.at ?? Date.now() }) as IDBRequest<IDBValidKey>).then(() => undefined),
      get: <T extends ArchiveRecord>(store: ArchiveStore, id: string) =>
        withDb<ArchiveRecord | undefined>(store, 'readonly', (os) => os.get(id) as IDBRequest<ArchiveRecord | undefined>).then((v) => (v ?? null) as T | null),
      list: <T extends ArchiveRecord>(store: ArchiveStore, limit?: number) =>
        withDb(store, 'readonly', (os) => listAll<ArchiveRecord>(os, limit)).then((v) => v as T[]),
      remove: (store: ArchiveStore, id: string) =>
        withDb(store, 'readwrite', (os) => os.delete(id)).then(() => undefined),
      clear: (store: ArchiveStore) =>
        withDb(store, 'readwrite', (os) => os.clear()).then(() => undefined),
      count: (store: ArchiveStore) =>
        withDb(store, 'readonly', (os) => os.count()),
    } as ArchiveHandle;
  } catch {
    fallback = true;
    return lsHandle;
  }
}

// ─── رویدادهای فعالیت کاربر (سوابق کار) ──────────────────────
export interface ArchiveEvent extends ArchiveRecord {
  kind: string;      // extract | save | load | compare | audit | report | nlq | chat | delete | migrate | search | clear
  title: string;
  detail?: string;
  refId?: string;
  refType?: string;
}

/** ثبت رویداد در سوابق فعالیت — هرگز نباید جریان اصلی را مختل کند */
export async function recordEvent(
  kind: ArchiveEvent['kind'],
  title: string,
  detail?: string,
  ref?: { refId?: string; refType?: string },
): Promise<void> {
  try {
    const ev: ArchiveEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      kind,
      title,
      detail,
      refId: ref?.refId,
      refType: ref?.refType,
    };
    const a = await getArchive();
    await a.put('events', ev);
  } catch {
    // بی‌صدا
  }
}

export async function listEvents(limit = 30): Promise<ArchiveEvent[]> {
  try {
    const a = await getArchive();
    return await a.list<ArchiveEvent>('events', limit);
  } catch {
    return [];
  }
}

export async function clearEvents(): Promise<void> {
  try {
    const a = await getArchive();
    await a.clear('events');
  } catch {
    // بی‌صدا
  }
}

// ─── مهاجرت دادهٔ میراثی localStorage (یک‌بار) ────────────────
const MIGRATED_FLAG = 'legacy:typology:v1:migrated';

/** دادهٔ آرشیو صفحهٔ گونه‌شناسی را از localStorage نسخهٔ ۱ به خزانه وارد می‌کند */
export async function migrateLegacyTypologyZones(): Promise<number> {
  try {
    const a = await getArchive();
    const flag = await a.get<ArchiveRecord>('kv', MIGRATED_FLAG);
    if (flag) return 0;
    const raw = localStorage.getItem(LEGACY_TYPOLOGY_KEY);
    await a.put('kv', { id: MIGRATED_FLAG, at: Date.now() });
    if (!raw) return 0;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return 0;
    }
    if (!Array.isArray(parsed)) return 0;
    let imported = 0;
    for (const rec of parsed) {
      const r = rec as { id?: unknown; savedAt?: unknown } & Record<string, unknown>;
      if (!r || typeof r.id !== 'string') continue;
      await a.put('zones', {
        ...r,
        id: `z-${r.id}`,
        at: typeof r.savedAt === 'number' ? r.savedAt : Date.now(),
        origin: 'legacy-localStorage',
      } as ArchiveRecord);
      imported += 1;
    }
    return imported;
  } catch {
    return 0;
  }
}
