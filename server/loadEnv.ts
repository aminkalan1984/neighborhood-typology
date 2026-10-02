// ============================================================
// بارگذاری متغیرهای محیطی پیش از هر ماژول دیگر.
// در ESM، importها به ترتیب اجرا می‌شوند؛ پس این ماژول باید
// نخستین import فایل server/index.ts باشد تا مقادیری مثل
// SCI_PORT / KERNEL_SERVICE_PORT / ARA_ANTHROPIC_* پیش از
// خوانده‌شدن توسط سایر ماژول‌ها در process.env حاضر باشند.
// اولویت: متغیرهای واقعی محیط (Docker/PaaS) > .env.local > .env
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CANDIDATE_FILES = ['.env.local', '.env'];

export const LOADED_ENV_FILES: string[] = [];

for (const name of CANDIDATE_FILES) {
  const file = path.join(PROJECT_ROOT, name);
  if (!fs.existsSync(file)) continue;
  // override:false → متغیرهای موجود در محیط کانتینر بازنویسی نمی‌شوند.
  dotenv.config({ path: file, override: false, quiet: true });
  LOADED_ENV_FILES.push(name);
}
