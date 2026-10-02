#!/usr/bin/env node
// ============================================================
// اجرای هم‌زمان بک‌اند API و سرور توسعهٔ Vite (برای پیش‌نمایش)
// ------------------------------------------------------------
// Vite «لنگر» است: اگر بسته شود، بک‌اند هم خاتمه می‌یابد تا پورت‌ها
// رها شوند. اگر بک‌اند به هر دلیل بسته شود، Vite زنده می‌ماند تا
// رابط کاربری همچنان قابل استفاده باشد و خطا در لاگ دیده شود.
// اجرا:  bun run dev:full
// ============================================================
import { spawn } from 'node:child_process';

const PREVIEW_PORT = process.env.DEV_PORT || '3000';
const children = [];
let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.killed || child.pid == null) continue;
    // کل گروه فرایند را خاتمه می‌دهیم تا فرزندان تو در تو (سرویس پایتون kernel)
    // به‌صورت یتیم روی پورت ۴۱۰۵ باقی نمانند.
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      try {
        child.kill('SIGTERM');
      } catch {
        /* ignore */
      }
    }
  }
  // فرصت کوتاه برای خاتمهٔ نرم، سپس خروج قطعی
  setTimeout(() => process.exit(code ?? 0), 300);
}

function start(name, command, args, { anchor = false } = {}) {
  // detached: هر فرایند رهبر گروه خودش می‌شود تا هنگام خاموشی، درخت کامل خاتمه یابد.
  const child = spawn(command, args, { stdio: 'inherit', env: process.env, detached: true });
  children.push(child);
  child.on('error', (error) => {
    console.error(`[dev-full] failed to start ${name}: ${error.message}`);
    if (anchor) shutdown(1);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[dev-full] ${name} exited (code=${code ?? 'null'}, signal=${signal ?? 'none'})`);
    if (anchor) shutdown(code ?? 0);
  });
  return child;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// بک‌اند API (پورت ۴۰۰۱) + سرور توسعهٔ Vite (پورت پیش‌نمایش)
start('api', 'tsx', ['server/index.ts']);
start('vite', 'vite', ['--port', PREVIEW_PORT, '--host', '0.0.0.0'], { anchor: true });
