# راهنمای عملیاتی بارگذاری پروژه در GitHub

> وضعیت فعلی: مخزن محلی آماده است — کامیت اولیه `ba7c6eb` روی شاخه `main`
> (۵۰۰ فایل، حدود ۲۵ مگابایت — کاملاً تمیز و سبک).
> فقط دو گام «احراز هویت» و «پوش» باقی مانده است.

---

## ۱) چه چیزهایی عمداً در مخزن نیست (و چرا)

| مورد | حجم | دلیل | نحوه بازتولید بعد از کلون |
|---|---|---|---|
| `node_modules/` | بزرگ | وابستگی‌های npm | `npm install` |
| `dist/` | ~۴۰۶MB | خروجی بیلد | `npm run build` |
| `iran.pbf` | ~۱۹۲MB | داده خام OpenStreetMap ایران | دانلود از `download.geofabrik.de/asia/iran-latest.osm.pbf` یا کپی از نسخه محلی |
| `public/data/` | ~۳۸۳MB | لایه‌های استخراج‌شده از PBF و تایل‌ها | `python scripts/extract_pbf_layers.py iran.pbf` سپس `python scripts/build_vtiles.py` |
| `server/data/` و `artifacts/` | متغیر | کش و خروجی‌های runtime سرور | خودکار در اولین اجرا ساخته می‌شوند |
| `*.log` | کوچک | لاگ‌های توسعه | — |
| `.env.local` | کوچک | کلیدهای API (محرمانه!) | از روی `.env.example` بسازید |
| `.claude/` `.freebuff/` `.kombai/` `.mimocode/` `.qodo/` | کوچک | پوشه‌های ابزارهای هوش مصنوعی | — |

**نتیجه:** مخزن سبک (~۲۵MB)، بدون هیچ کلید API یا داده قابل بازتولید، و کامل قابل اجرا.

---

## ۲) احراز هویت GitHub — دو روش

### روش الف — با GitHub CLI (پیشنهادی؛ ساده‌ترین راه)

`gh` روی سیستم شما نصب است (نسخه 2.97). کافی است:

```bash
gh auth login
```

و در سؤالات به این ترتیب پاسخ دهید:
1. **GitHub.com**
2. **HTTPS**
3. **Yes** (احراز هویت با اعتبارنامه‌های Git)
4. **Login with a web browser** → کد نمایش‌داده‌شده را کپی و در مرورگر وارد کنید.

بعد از ورود، گیت به‌طور خودکار از اعتبارنامه gh استفاده می‌کند.

### روش ب — با Personal Access Token (بدون مرورگر)

1. در GitHub وارد شوید → Settings → Developer settings → **Personal access tokens** → **Tokens (classic)**
2. **Generate new token (classic)** با گزینش دسترسی `repo`
3. توکن را کپی کنید (فقط یک‌بار نمایش داده می‌شود!)
4. هنگام `git push` وقتی نام کاربری/رمز خواست:
   - Username: نام کاربری گیت‌هاب شما
   - Password: همان توکن (نه رمز اکانت!)

نکته: در ایران اگر دسترسی مستقیم به GitHub ندارید، از VPN/تحریم‌شکن استفاده کنید و در صورت لزوم پروکسی گیت را تنظیم کنید:
```bash
git config --global http.proxy http://127.0.0.1:PORT
git config --global https.proxy http://127.0.0.1:PORT
```

---

## ۳) ساخت مخزن و پوش — دو روش

### روش الف — با GitHub CLI (بعد از `gh auth login`)

```bash
# ساخت مخزن خصوصی neighborhood-typology و پوش مستقیم
gh repo create neighborhood-typology --private --source=. --remote=origin --push
```

این یک دستور، همه کارها را انجام می‌دهد: ساخت مخزن در حساب شما، اتصال remote و آپلود شاخه main.

### روش ب — دستی از وب‌سایت GitHub

1. به `https://github.com/new` بروید.
2. Repository name: `neighborhood-typology`
3. Visibility: **Private** ✓
4. **هیچ‌کدام از گزینه‌های** «Add a README / .gitignore / license» را **تیک نزنید** (مخزن باید خالی باشد).
5. **Create repository**
6. سپس در همین پوشه پروژه:

```bash
git remote add origin https://github.com/<نام-کاربری-شما>/neighborhood-typology.git
git push -u origin main
```

---

## ۴) تأیید نهایی

بعد از پوش:
```bash
git remote -v          # باید origin را نشان دهد
git log --oneline      # باید ba7c6eb را ببینید
```
و در مرورگر صفحه مخزن را باز کنید — باید ۵۰۰ فایل را ببینید.

---

## ۵) چرخه کار روزمره (از این به بعد)

```bash
git add -A
git commit -m "توضیح تغییرات"
git push
```

توجه: داده‌های جدید تولیدشده در `public/data/`، `server/data/`، `dist/` و لاگ‌ها
به‌صورت خودکار توسط `.gitignore` نادیده گرفته می‌شوند و وارد مخزن نمی‌شوند.

---

## ۶) واکشی پروژه روی سیستم دیگر (بازگردانی کامل و اجرایی)

```bash
git clone https://github.com/<نام-کاربری>/neighborhood-typology.git
cd neighborhood-typology

npm install                      # وابستگی‌های فرانت و سرور

# داده‌های مکانی (اگر نیاز به لایه‌های OSM دارید):
#   فایل iran.pbf را از Geofabrik دانلود یا از نسخه پشتیبان کپی کنید، سپس:
python scripts/extract_pbf_layers.py iran.pbf
python scripts/build_vtiles.py

cp .env.example .env.local       # و کلیدهای API را وارد کنید

npm run dev:full                 # اجرای همزمان سرور (tsx) و فرانت (vite)
```

---

## ۷) نکات امنیتی مهم

- `.env.local` هرگز به مخزن اضافه نمی‌شود — کلیدهای API فقط همین‌جا بمانند.
- اگر به‌اشتباه فایلی با کلید کامیت شد، توکن را فوراً باطل کنید و تاریخچه را پاک‌سازی کنید.
- مخزن خصوصی = فقط اعضای دعوت‌شده دسترسی دارند؛ برای همکاری: Settings → Collaborators.
