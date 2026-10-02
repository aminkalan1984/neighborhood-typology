# بسته آغازین سازوکار هوشمند گونه‌بندی محلات ایران

این بسته یک هسته اجرایی و قابل آزمون برای برنامه‌ریزی تأمین داده و محاسبه نمره سه‌ساحتی است. اینترنت به‌تنهایی همه ۴۱۹ شاخص را پر نمی‌کند؛ گردآورنده‌های سازمانی، پیمایشی و میدانی باید مطابق راهنمای عملیاتی تکمیل شوند.

## فایل‌ها
- `indicator_registry_419.csv`: رجیستر ۴۱۹ شاخص با کد، وزن، جهت، منبع، فرمول، مسیر دسترسی، خانواده محاسبه و نگاشت پایه به ۱۰ پیشران.
- `online_metrics_83.json`: ۸۳ سنجه برخط.
- `online_sources_23.json`: ۲۳ خانواده منبع.
- `typology_engine.py`: تولید برنامه تأمین داده و محاسبه P/B/N، ضریب پایداری و گونه.
- `config.yml`: آستانه‌های حاکمیتی و کیفیت.
- `sql/schema.sql`: شِمای PostGIS برای شواهد، مقادیر و نتایج.
- `tests/test_engine.py`: آزمون نمونه‌های محاسباتی سند.

## اجرا
```bash
python3 typology_engine.py plan --registry indicator_registry_419.csv --request example/request.json --out example/plan.json
python3 typology_engine.py score --registry indicator_registry_419.csv --measurements example/measurements_synthetic.csv --out example/result.json
python3 -m unittest discover -s tests -v
```

فایل نمونه کاملاً مصنوعی است و فقط برای آزمون نرم‌افزار استفاده می‌شود.
