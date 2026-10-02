# هستهٔ روش‌شناختی پلتفرم هوش محله‌ای — نسخهٔ MVP-0 (فاز ۰ + هستهٔ محاسبات)

این بسته، برش واقعی و اثبات‌پذیر (نه دموی ساختگی) از پلتفرم «سنجش، تشخیص، تجویز و یادگیری کیفیت محله» است که مستقیماً از دو فایل مرجع ساخته شده:
- اطلس جامع شاخص‌ها (JSON، file_id: da8e3939-76fd-478e-a563-8b7821873253)
- الگوریتم جامع (algo.txt، file_id: 253b7b39-847e-4740-985c-2ed403981f28)

## محتوا
- registries/registry_419.json — رجیستر مادر (۴۱۹ شاخص، ۳۳ فیلد) — verbatim
- registries/core_40.json — هستهٔ تصمیم (۴۰ شاخص) — verbatim
- registries/online_83.json — سنجه‌های برخط (۸۳) — verbatim
- سه لایه از نظر فیزیکی جدا نگه‌داشته شده‌اند (constraint 4).
- registries/procedures_25.json, questionnaire_15.json, sources_23.json — پشتیبان
- schema/*.schema.json — JSON Schema (draft 2020-12) برای هر لایه + مدل مقدار/وضعیت + شواهد/منشأ + وزن/آستانه
- registries/weight_registry_v1.json — وزن‌های برابر v1 (calibrated=false, §5.2)
- registries/threshold_registry_v1.json — باندهای §5.4 + L/U هر شاخص (۵۰ مورد PENDING_VALIDATION)
- engine/ — موتور محاسبات واقعی (calc_engine.py, status.py, provenance.py) + tests/test_formulas.py
- engine/no_data_run.json — اثبات ضد جعل: بدون داده، همه‌چیز WAITING_FOR_DATA
- registries/source_inventory.{json,csv} — فهرست منابع با وضعیت دسترسی (از شواهد اطلس)
- registries/min_nonfield_indicator_set.{json,csv} — حداقل شاخص‌های غیرمیدانی (۲۵۱)
- registries/validation_report.json — گزارش اعتبارسنجی + SHA-256 همهٔ آرتیفکت‌ها

## کلید بازتولیدپذیری (constraint 8)
هر نتیجهٔ منتشرشده باید از این شش نسخه بازتولید شود:
Data Version + Methodology Version + Indicator Version + Weight Set (W-v1) + Threshold Set (T-v1) + Calculation Version (CALC-v0.1)

## قواعد یکپارچگی (اجرا شده)
داده ساختگی هرگز؛ missing هرگز = صفر؛ سه لایه جدا؛ Q/T/R جدا؛ وزن/آستانه نسخه‌دار و کالیبره‌نشده؛ پروکسی صریحاً برچسب‌خورده؛ عدد فقط از موتور محاسبات.
