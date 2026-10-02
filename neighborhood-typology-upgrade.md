# Neighborhood Typology Upgrade

این فایل خلاصه اجرای ارتقای فنی است. فهرست کامل قابلیت‌ها، اجزای رابط، قراردادهای API، مدل داده و نقشه راه در [کاتالوگ جامع قابلیت‌ها](./neighborhood-typology-capability-catalog.md) نگهداری می‌شود.

## وضعیت این release

- چرخه ایجاد اجرا تا گزارش و بازبینی انسانی فعال است.
- رجیستر ۴۱۹ شاخص و محاسبه قطعی P/B/N، پیشران‌ها و SI به اجرا متصل است.
- دفتر شواهد، idempotency، provenance، gate انتشار و خط زمانی ممیزی فعال است.
- صف کمبود داده عنوان شاخص، مسیر تأمین، اقدام فارسی و مسئول پیشنهادی دارد.
- داده‌های نام‌گذاری خراب در ورودی جدید رد و در پاسخ اجراهای قدیمی با fallback امن نمایش داده می‌شوند.
- پنل حاکمیت بین «آماده تصمیم بازبین» و «انتشار تأییدشده» تفکیک می‌کند.

## Verification

- `npm run lint`
- `npx tsx --test src/components/typology/api.test.ts src/components/typology/TypologyGovernancePanel.test.tsx server/typologyRouter.test.ts server/typologyReliability.test.ts server/typology.test.ts server/typology/typology.test.ts`
- `python -m unittest discover -s neighborhood_typology/tests -v`
- `npm run build`
