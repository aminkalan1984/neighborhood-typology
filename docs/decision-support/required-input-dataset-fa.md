# فهرست جامع داده‌های ورودی موردنیاز «تصمیم‌یار جامع محله» تا کف اعتبار مصوب

> **مبنا:** بازخوانی کامل کد اجرایی — `server/decisionSupportService.ts` (خط لوله ۱۶ مرحله‌ای)، `server/decisionSupportRouter.ts`، `server/decisionSupportEvidence.ts` (دروازه رجیستر شواهد)، `server/decisionSupportRegistry164.ts`، `kernel/engine/*` (موتور قطعی پایتون)، `server/typology/*` + `neighborhood_typology/*` (موتور گونه‌بندی)، `src/algorithm/*`، و اسناد `docs/decision-support/*`.
> **هدف:** تعیین دقیق «تمام داده‌های ورودی که باید تأمین شوند» تا برای محلهٔ انتخابی کاربر، خروجی **حداقل اعتبار لازم** را داشته باشد — نه کارت تعلیق‌شده، نه عدد جعلی.

---

## بخش ۰ — سه سطح کفایت (که با هم اشتباه نشوند)

| سطح | شرط عبور | مرجع کد | نتیجه |
|---|---|---|---|
| **کف اجرا** (کارت ساخته می‌شود) | حداقل ۱ شاخص اندازه‌گیری‌شده + حداقل ۱ شاخص در **هر ۸ سرمایه** + **حداقل یک سرمایه با دو مرحلهٔ پیوستهٔ اندازه‌گیری‌شده** (تا یک گذار قابل‌مقایسه C-A-U-E-O وجود داشته باشد) | `DecisionSupportService.analyze` / `locateBottleneck` | کارت ۱۲ جزئی صادر می‌شود، اما با پیمایش‌نشده و بدون تفکیک، «حکم ادراکی» و «حکم عدالت» صادر **نمی‌شود** |
| **کف انتشار معتبر** (کارت از دروازه رجیستر شواهد عبور می‌کند) | ≥ **۸۰٪ از ۴۰ شاخص هسته** `score-eligible` (یعنی ≥ **۳۲ شاخص**) + ≥ **۶۰٪ پوشش در هر سرمایه** (≥۳ از ۵) + پوشش **هر ۵ مرحله زنجیره** + **مرز تأییدشده** + کیفیت هر مشاهده ≥ **۰٫۷۰** | `server/decisionSupportEvidence.ts` (`MIN_CORE_COVERAGE=0.8`, `MIN_CAPITAL_COVERAGE=0.6`, `MIN_QUALITY_SCORE=0.7`) | `publishable=true` → `card` ساخته و `publicationLevel='VALIDATED'` می‌شود؛ در غیر اینصورت `status='EVIDENCE_ONLY'` و `warnings: «امتیاز Q/T/R تا عبور از دروازه پوشش و کیفیت منتشر نمی‌شود.»` |
| **کف اعتبار موتور کرنل** (سطح اتکای هر عدد) | پوشش هر سرمایه ≥ **۵۰٪** + هم‌گرایی ≥۲ جریان مستقل + پرچم تست/کالیبراسیون + کالیبره‌بودن L/U | `kernel/engine/calc_engine.py`, `kernel/engine/confidence.py` | سطح «ناکافی/محدود/قابل اتکا/همگرا/آزمون‌شده»؛ تک‌جریانه=حداکثر «محدود»؛ پوشش <۷۵٪=سقف «محدود» |

**قاعده حاکم بر کل سیستم (غیرقابل‌مذاکره):** داده مفقود هرگز صفر نمی‌شود؛ داده مصنوعی/پیش‌فرض ممنوع؛ داده ادراکی با پروکسی عینی (POI، LLM، تصویر ماهواره‌ای، داده ملی) جایگزین نمی‌شود (`honestyBoundary` در `decisionSupportEvidence.ts`).

---

## بلوک ۱ — داده‌های زمینه‌ای و مرزی اجرا (اجباری)

| # | فیلد | قالب/دامنه | اگر نباشد چه می‌شود | مصرف |
|---|---|---|---|---|
| ۱ | `neighborhoodName` | متن | خطای ۴۰۰ `MISSING_FIELD` | کل زنجیره + کلید روند/حافظه |
| ۲ | `cityOrCounty` | متن | مقایسه زمینه‌ای و «علت بیرونی» ناقص | E1 (میانه شهر)، D-EXTERNAL-CAUSE |
| ۳ | `province` | متن | رده‌بندی جغرافیایی ناقص | بنچمارک استانی |
| ۴ | `purpose` | `baseline` \| `monitoring` \| `intervention_priority` | پیش‌فرض baseline | تفسیر کارت و طرح ارزیابی |
| ۵ | `boundary` | `geometry` (Polygon مرز مصوب محله) **یا** حداقل `bbox: [minLng,minLat,maxLng,maxLat]` + `version` (نسخه مرز) | `gateFailures += confirmed_boundary_missing` → انتشار مسدود | همه‌ی «نسبت به کل» (تراکم، پوشش، دسترسی) |
| ۶ | `boundary.confidence` | عدد ۰–۱ | زیر ۰٫۹ → نتیجه در سطح آزمایشی/موقت | موتور گونه‌بندی: `boundaryConfidenceMinimum=0.9` |
| ۷ | `population` | عدد > ۰ | فاکتور جمعیت در اولویت مداخله به مقدار خنثی ۰٫۵ سقوط می‌کند | P-POPULATION در فرمول `شدت×جمعیت×اهرم×امکان×عدالت` |
| ۸ | `aoi` | `{bbox, geometry?}` | جریان شواهد مکانی خالی می‌ماند | تشخیص علّی + شواهد ماهواره‌ای |
| ۹ | `liveSources` | `{lat, lng, at?, mergePolicy:'fill_missing'\|'prefer_live'}`؛ کرانه ایران: عرض ۲۴–۴۰٫۵، طول ۴۳–۶۴ | اجرای «تأمین داده برخط» متوقف | تقویت خودکار شاخص‌ها |
| ۱۰ | `respondentGroup` | متن (برای پیمایش) | تفکیک ادراکی بین گروه‌ها ناممکن | عدالت ادراکی |
| ۱۱ | `runId` + زمان | سیستمی | — | خط پایه، روند Q/T/R، حافظه |

**داده‌های مکانی محلی موجود در مخزن:** `mahalat/محلات رسمی شهرداری تهران (۳۹۱ محله).geojson`، `mahalat/محلات شهر کرج.geojson`، `iran.pbf` (پیش‌نمایش کامل OSM ایران، ۲۰۰MB)، `public/data/pbf/*` (لایه‌های مشتق‌شده + index نقطه‌ای OSM). برای شهرهای دیگر، مرز مصوب محله باید تأمین شود؛ در نبود آن نام محله با «ژئوکد + تأیید انسانی» (`requires_confirmation`) به نقطه/مرز تبدیل می‌شود.

---

## بلوک ۲ — هسته ۴۰ شاخص هشت سرمایه (کد یکتا: `M-CORE-x#`)

**قاعده:** هر مقدار باید **امتیاز ۰–۱۰۰ نرمال‌شده** با `normalizedScore`، فراداده کامل (بلوک ۷) و `method.registryVersion == registry.version` باشد. مقیاس اصلی هر شاخص: درصد مگر خلاف آن ذکر شود. کد یکتای رجیستر برای هر ردیف `M-CORE-<کد>` است (مثلاً `M-CORE-P2`)؛ در ورودی `indicatorValues` سرویس `/analyze` از همان کد کوتاه جدول استفاده می‌شود.

| کد | سرمایه | مرحله زنجیره | کلاس اتوماسیون | سطح خروجی مجاز | منبع تأمین در کد فعلی / مسیر تأمین لازم |
|---|---|---|---|---|---|
| H1 | انسانی | CAPACITY | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | سرشماری (قرارداد داده)؛ فعلاً proxy |
| H2 | انسانی | CAPACITY | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | فنی‌وحرفه‌ای + پیمایش |
| H3 | انسانی | OUTCOME | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | تأمین اجتماعی (بیمه‌شدگان) |
| H4 | انسانی | CAPACITY | D_HYBRID | PROVISIONAL_THEN_REVIEW | نیروی کار + بازبینی انسانی |
| H5 | انسانی | OUTCOME | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | مراکز آموزشی (ثبت‌نام ۱۲ماهه) |
| S1 | اجتماعی | CAPACITY | **E_SURVEY** | SURVEY_ONLY | **فقط پیمایش (E3)** — غیرقابل جایگزینی |
| S2 | اجتماعی | EXPERIENCE | **E_SURVEY** | SURVEY_ONLY | **فقط پیمایش (E2)** |
| S3 | اجتماعی | CAPACITY | **E_SURVEY** | SURVEY_ONLY | **فقط پیمایش** |
| S4 | اجتماعی | USE | D_HYBRID | PROVISIONAL_THEN_REVIEW | پرونده پروژه + پیمایش |
| S5 | اجتماعی | OUTCOME | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | پرونده پروژه/۱۳۷ |
| E1 | اقتصادی | CAPACITY | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | هزینه‌درآمد SCI (میانه محله ÷ میانه شهر) |
| E2 | اقتصادی | CAPACITY | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | اصناف/مالیات (شغل ÷ جمعیت فعال ×۱۰۰۰) |
| E3 | اقتصادی | OUTCOME | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | اصناف (کسب‌وکار ۳+ ساله) |
| E4 | اقتصادی | ACCESS | D_HYBRID | PROVISIONAL_THEN_REVIEW | پیمایش/بازار مسکن (جهت نزولی) |
| E5 | اقتصادی | OUTCOME | D_HYBRID | PROVISIONAL_THEN_REVIEW | حساب محلی/بنگاه |
| P1 | کالبدی | CAPACITY | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | پایگاه ساختمان (بناهای ناپایدار) |
| P2 | کالبدی | CAPACITY | **A_PUBLIC** | PROVISIONAL_PUBLIC | OSM/OSRM (`osm-walkability`) — P0 |
| P3 | کالبدی | USE | **E_FIELD_AUDIT** | FIELD_AUDIT_ONLY | **فقط ممیزی میدانی** |
| P4 | کالبدی | ACCESS | **A_PUBLIC** | PROVISIONAL_PUBLIC | OSM POI + Healthsites + WorldPop — P0 |
| P5 | کالبدی | ACCESS | **A_PUBLIC** | PROVISIONAL_PUBLIC | GTFS/OSM (POI حمل‌ونقل) |
| N1 | طبیعی | ACCESS | **A_PUBLIC** | PROVISIONAL_PUBLIC | OSM walkability + شبکه سبز — P0 |
| N2 | طبیعی | CAPACITY | **A_PUBLIC (EO)** | VERIFIED_OPEN_EO | Sentinel-2 روی polygon (فقط این شاخص دارای خروجی EO تأییدشده) — P0 |
| N3 | طبیعی | OUTCOME | **A_PUBLIC** | PROVISIONAL_PUBLIC | Open-Meteo / OpenAQ (PM2.5، نزولی) |
| N4 | طبیعی | CAPACITY | **A_PUBLIC** | PROVISIONAL_PUBLIC | پهنه‌های مخاطره + DEM + GloFAS (نزولی) |
| N5 | طبیعی | OUTCOME | D_HYBRID | PROVISIONAL_THEN_REVIEW | ERA5/CHIRPS/LST (میانگین وزنی تاب‌آوری) |
| C1 | فرهنگی | CAPACITY | **A_PUBLIC** | PROVISIONAL_PUBLIC | Wikidata/OSM (دارایی فرهنگی ÷ جمعیت ×۱۰۰۰) |
| C2 | فرهنگی | USE | D_HYBRID | PROVISIONAL_THEN_REVIEW | تقویم رویداد/بلیت (دارایی فعال) |
| C3 | فرهنگی | EXPERIENCE | **E_SURVEY** | SURVEY_ONLY | **فقط پیمایش** |
| C4 | فرهنگی | USE | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | ثبت‌نام/بلیت + پیمایش |
| C5 | فرهنگی | OUTCOME | D_HYBRID | PROVISIONAL_THEN_REVIEW | ثبت برنامه + پیمایش (نسل جوان) |
| G1 | نهادی | USE | D_HYBRID | PROVISIONAL_THEN_REVIEW | صورت‌جلسه/مشورت (مشارکت واقعی) |
| G2 | نهادی | ACCESS | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | ۱۳۷/۱۸۸۸/CRM (SLA پاسخگویی) |
| G3 | نهادی | USE | D_HYBRID | PROVISIONAL_THEN_REVIEW | ارزیابی خبرگان/توافق‌نامه |
| G4 | نهادی | CAPACITY | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | سامانه پروژه/بودجه |
| G5 | نهادی | OUTCOME | D_HYBRID | PROVISIONAL_THEN_REVIEW | گزارش ارزیابی پیشین |
| R1 | شبکه‌ای | ACCESS | **A_PUBLIC** | PROVISIONAL_PUBLIC | OSRM isochrone (زمان سفر، نزولی) — P0 |
| R2 | شبکه‌ای | ACCESS | D_HYBRID | PROVISIONAL_THEN_REVIEW | فرصت شغلی مجاز + GIS |
| R3 | شبکه‌ای | ACCESS | **A_PUBLIC** | PROVISIONAL_PUBLIC | OSRM + ثبت رسمی آموزش — P0 |
| R4 | شبکه‌ای | OUTCOME | B_RESTRICTED | VERIFIED_AFTER_CONTRACT | تراکنش تجمیعی بنگاه |
| R5 | شبکه‌ای | CAPACITY | D_HYBRID | PROVISIONAL_THEN_REVIEW | Ookla/M-Lab/اپراتور |

**ترکیب لازم برای عبور از دروازه ۸۰٪:**
- توزیع کلاس‌ها: **۱۰ شاخص A** (خودکار عمومی) + **۱۳ شاخص B** (قرارداد داده) + **۱۲ شاخص D** (ترکیبی/بازبینی) + **۵ شاخص E** (پیمایش/ممیانی).
- پوشش مراحل زنجیره در رجیستر: CAPACITY ۱۳ شاخص، OUTCOME ۱۰، ACCESS ۸، USE ۷، EXPERIENCE ۲. **مرحله EXPERIENCE فقط با دو شاخص (S2 و C3) تأمین می‌شود و هر دو پیمایشی‌اند** → بدون پیمایش، `gateFailures += chain_stage_experience_missing` و سطح انتشار مسدود می‌ماند.

---

## بلوک ۳ — پیمایش ادراکی (بدون آن، دو مرحله زنجیره و حکم ادراکی/عدالت از دست می‌رود)

### ۳.۱ — ۱۵ گویه (لیکرت ۱–۵؛ نرمال‌سازی `100×(Mean−1)/4`؛ گویه‌های نزولی معکوس)

| لایه | کد گویه | کد مورد انتظار در API | جهت | پرسش پیگیری خودکار |
|---|---|---|---|---|
| ظرفیت | `C1` | `questionId:'C1'` | صعودی | — |
| ظرفیت | `C2` | `C2` | صعودی | — |
| ظرفیت | `C3` | `C3` | نزولی | اگر ≥۴: منبع اصلی صدا |
| دسترسی | `A1` | `A1` | صعودی | اگر ≤۲: کدام وسیله/مانع |
| دسترسی | `A2` | `A2` | صعودی | — |
| دسترسی | `A3` | `A3` | صعودی | — |
| استفاده | `U1` | `U1` | صعودی | — |
| استفاده | `U2` | `U2` | صعودی | اگر ≤۲: کدام معبر روشنایی ندارد |
| استفاده | `U3` | `U3` | صعودی | اگر ≤۲: نگهداری/امنیت/امکانات/دسترسی |
| تجربه | `E1` | `E1` | صعودی | اگر ≤۲: عامل و مکان ناامنی |
| تجربه | `E2` | `E2` | صعودی | اگر ≤۲: چرا تعلق کم است |
| تجربه | `E3` | `E3` | صعودی | اگر ≤۲: زمینه بی‌اعتمادی |
| پیامد | `O1` | `O1` | صعودی | اگر ≤۲: مهم‌ترین علت نارضایتی |
| پیامد | `O2` | `O2` | نزولی | اگر ≥۴: شخصی یا محله‌ای |
| پیامد | `O3` | `O3` | صعودی | اگر ≤۲: علت تمایل به جابه‌جایی |

**نگاشت خودکار به شاخص‌ها در کد (`decisionSupportService.ts`):** `E3 → S1` و `E2 → S2` **فقط اگر** مقدار ثبتی برای آن شاخص وجود نداشته باشد (جریان ادراکی جای جریان عینی را نمی‌گیرد).

**آستانه فعال‌سازی حداقل:** برای اینکه مرحله EXPERIENCE و USE پوشش بگیرد باید حداقل پاسخ‌های `E1,E2,E3` و `U1..U3` موجود باشند؛ بدون EXPERIENCE شکاف `G_UE` صفر می‌شود و تیپ تشخیصی K-T-R بی‌اعتبار می‌شود.

### ۳.۲ — شاخص‌های پیمایش‌محور هسته (CLASS D/E — غیرقابل جایگزینی)

`S1` (اعتماد) · `S2` (تعلق) · `S3` (شبکه همکاری) · `C3` (هویت) · `C4` (مشارکت فرهنگی) · `C5` (انتقال هویت) · `P3` (قابلیت استفاده فضا — ممیزی میدانی).

### ۳.۳ — فراداده اجباری پیمایش (بدون آن، داده «معتبر» ثبت نمی‌شود)

- طرح نمونه‌گیری: چارچوب، روش انتخاب، وزن‌دهی پاسخ‌ها، **نرخ پاسخ** (حداکثر مجاز سقوط: ۰٬۶۰ — پیکربندی `survey_response_rate_minimum: 0.60`).
- تاریخ اجرا، نسخه ابزار، ناشناس‌سازی، `respondentGroup`.
- پایایی: α کرونباخ / بازآزمایی؛ روایی: CVI پنل خبرگان (ابزار موجود: `docs/decision-support/cvi-tool.html`, `reliability-cfa-tool.html`).
- **حجم نمونه (بازوهای اجرایی تصویب‌شده):** ۳۱۶ خانوار به‌ازای هر پهنهٔ ۴۰۰ خانواری؛ کف کل: شهر متوسط ۶ پهنه/۶۰۰ خانوار، شهر بزرگ ۱۲ پهنه/۱٬۸۰۰ خانوار، کلانشهر ۲۴ پهنه/۴٬۸۰۰ خانوار؛ برای تفکیک عدالت: جنسیت ۵۰ نفر هر گروه، سن ۳۰، اشتغال ۳۰، مالک/اجاره ۴۰.
- **آستانه‌های اعتبارسنجی ابزار:** CVI ۶–۱۰ خبره، ICC ۳۰ پاسخ‌دهنده، α/CFA ۱۵۰ پاسخ‌دهنده (نسبت ۷:۱)، test-retest با فاصله ۱۴–۲۱ روز، سطح اطمینان ۹۵٪.
- **کنترل کیفیت رکورد:** حذف پاسخ‌دهنده زیر ۱۸ سال، حذف رکورد با >۲۰٪ بی‌پاسخی، علامت‌گذاری Response Set، حذف پاسخ‌های زیر ۳ دقیقه.

---

## بلوک ۴ — داده‌های تفکیکی (زنده‌کنندهٔ بعدهای مکان/گروه/زمان در گلوگاه و عدالت)

| داده | ساختار ورودی | حداقل برای حکم قطعی | بدون آن چه می‌شود |
|---|---|---|---|
| `groupValues` | `{ indicatorCode: { groupName: score0..100 } }` | **حداقل ۲ گروه** با مقدار عددی | `equityMap=[]` → `equityDataStatus='missing'` و در کارت: «بدون داده گروهی — حکم قطعی عدالت ممنوع» |
| `groupSlices` | `[{ group, scores: {code: score}, population? }]` | ≥۲ گروه با میانگین معتبر | بعد «گروه» گلوگاه خالی می‌ماند |
| `subLocationScores` | `{ 'نام زیرمحله': { code: score } }` | **≥۲ زیرمکان** + مرز مصوب زیرمحله‌ها | بعد «مکان» گلوگاه خالی می‌ماند |
| `previousPeriodIndicatorValues` | `{ code: score }` (دوره قبل، هم‌تعریف و هم‌مرز) | حداقل ۱ کد مشترک با دوره جاری | `trend.direction='first_run'` و بعد «زمان» خالی؛ در کارت «نخستین اجرا — خط پایه ثبت شد» |
| گروه‌های عدالت هدف | فهرست مصوب گروه‌های حساس | تعریف مصوب | فیلتر عدالت در تجویز ناقص |
| `population` (و ترجیحاً جمعیت بلوکی) | عدد | > ۰ | فاکتور جمعیت اولویت خنثی می‌شود |

**قواعد عددی تفکیک در کد:** شکاف گروهی/مکانی فقط اگر **اختلاف ≥ ۱۰ واحد امتیاز** باشد گزارش می‌شود؛ روند زمانی با میانگین تغییرات `≤ −3` = «در حال تشدید»، `≥ +3` = «در حال بهبود»؛ همه‌ی اینها فقط با ≥۲ برش/گروه معتبر محاسبه می‌شوند. در موتور کرنل، شکاف عدالت بدون **≥۲ گروه** مقدار `null` با وضعیت `INSUFFICIENT_COVERAGE` می‌گیرد.

---

## بلوک ۵ — چهار جریان شواهد (برای تشخیص علّی و دروازه کفایت)

| جریان | ورودی لازم | در کد فعلی | وضعیت |
|---|---|---|---|
| **عینی/ثبتی** | همه‌ی `indicatorValues` با `evidence_id` | `objective: indicatorValues` | ✅ فعال |
| **مکانی (GIS)** | `aoi.bbox` + `satelliteEvidence` | `spatial['aoi:bbox']=null` + `sat:<feature>` | ⚠️ لایه‌های شبکه معابر، پارک، خدمت، GTFS، مخاطرات، DEM و جمعیت بلوکی به‌صورت «عدد شاخص» خوانده نمی‌شوند |
| **رفتاری** | شواهد استفاده واقعی/تردد/مشارکت ثبت‌شده | فقط `U3` پیمایش | ❌ شکاف اصلی: `S4` (اقدام جمعی) در پیمایش ۱۵ گویه‌ای وجود ندارد، پس جریان رفتاری تقریباً خالی است |
| **ادراکی** | پیمایش ۱۵ گویه + `respondentGroup` | `perceptual['survey:<stage>']` | ✅ با پیمایش فعال می‌شود |

### بستهٔ شواهد ماهواره‌ای (`satelliteEvidence`) — ساختار الزامی
`{ queriedBbox, freshnessSlaHours, collectedAt, latestByFeature[{feature, value, collectedAt, stale}], observedCount, derivedCount, staleCount, decisionImpact: 'evidence_only' }`

**دروازه اعتبار ماهواره‌ای (پیش از هر استفاده):** پوشش AOI ≥ **۹۹٪**؛ کسر پیکسل پاک ≥ **۱۰٪** (زیر آن = هشدار)؛ هم‌ترازی کامل باندها (CRS/ابعاد/تبدیل یکسان)؛ برای تحلیل ناهنجاری زمانی حداقل **۵ مشاهده** و روش median/MAD؛ `valid_fraction ≥ 0.8` برای رستر معتبر. **نقش:** فقط شاهد؛ در رجیستر شواهد این رکوردها همیشه `tier='open_verified'`، `status='evidence_only'` و `scoreEligible=false` هستند و **هرگز** در پوشش ۸۰٪ حساب نمی‌شوند.

### منابع برخط (دروازه `liveSources`) — تفکیک «عددساز» از «شاهد»
| منبع | شناسه manifest | شاخص‌ها | نقش | پیش‌نیاز |
|---|---|---|---|---|
| Open-Meteo Air | `open-meteo-air` | N3 | **score_eligible** | بدون کلید |
| OpenAQ | `openaq` | N3 | **score_eligible** | `OPENAQ_API_KEY` (بدون آن = کمبود داده) |
| OSM POI | `osm-pois` | R3, P4, E2, C1, P5 | score_eligible (همه **proxy**) | بدون کلید |
| OSM Walkability | `osm-walkability` | N1, P2 | score_eligible (**proxy**) | بدون کلید |
| Healthsites | `healthsites` | P4 | score_eligible (**proxy**) | `HEALTHSITES_API_KEY` |
| OSRM | `osrm` | R1, R3 | **score_eligible** | بدون کلید |
| Open-Meteo Climate / World Bank / WHO / GloFAS / FIRMS / Satellite STAC | — | N5, E1, H3, P1, N4, N2/N3 | **evidence_only** | — |

> **نکته حیاتی:** در `/analyze` مقادیر منابع بالا بدون کنترل tier وارد محاسبه می‌شوند؛ اما در `/evidence/assess` شرط `source.tier !== 'proxy'` است، پس **همه‌ی مقادیر مشتق از POI/OSM و Healthsites به‌تنهایی برای عبور از دروازه اعتبار کافی نیستند** و باید با یک منبع درجه‌یک (قرارداد داده، ثبتی یا پیمایش معتبر) تقویت شوند.

---

## بلوک ۶ — شاخص‌های محاسبه‌ای (ورودی نیستند؛ باید محاسبه و نسخه‌دار شوند)

`M-K-H…R` امتیاز ۸ سرمایه (میانگین وزنی) · `M-K-TOTAL` · `M-STAGE-C/A/U/E/O` · `M-Q`, `M-T`, `M-R` · `M-BAND-Q/T/R` (۰–۳۹ بحرانی، ۴۰–۵۹ ضعیف، ۶۰–۷۴ متوسط، ۷۵–۸۹ خوب، ۹۰–۱۰۰ ممتاز) · `M-KTR-TYPE` (A..E) · `D-GAP-CA/AU/UE/EO` · `D-GAP-MAX` (آستانه بحرانی >۱۵، هشدار >۸) · `D-BOTTLENECK-CELL` · `D-BASE-DEFICIT` (ظرفیت < ۳۰ = کمبود پایه) · `D-ADDRESS-COMPLETE` (۵ بعد) · `D-JUSTICE-GROUP/SPATIAL/ADEQUACY` · `D-TREND-DIR/RATE` · `D-EVID-{OBJ,GIS,BEH,PER,CONVERGENCE,CONFLICT,SUFFICIENCY,STATUS}` · `D-FRIC-{COST,SAFE,QUAL,TIME,PHYS,INFO,NORM,TOTAL,GOV}` · `D-HYP-N`, `D-HYP-SUPPORT`, `D-CAUSAL-TEST` · `P-{SEVERITY,POPULATION,LEVERAGE,FEASIBILITY,EQUITY,PRIORITY,PRIORITY-EQ,CAPITAL-BREADTH,COMPLEMENT,OWNER-READY,RESOURCE-READY,AUTHORITY-READY,HARMED-CAPITALS,REJECT-FLAG,DISPLACEMENT-RISK,AFFORD-IMPACT,TARGET-REACH,TRACEABILITY}` · `L-{BASELINE,OUTPUT,OUTCOME,IMPACT,UNINTENDED,FIDELITY,MAINTENANCE,STOP,DECISION,CAP-S/I/F/A/M/G,INDEX,VH,L-*,VL,VC,DYN-RES}`.

**ورودی‌های انسانی لازم برای این لایه (که هنوز در کد تأمین نمی‌شوند):** شناسنامه اقدام (مالک، بودجه، مجوز، زمان، همکاران)، ماتریس اثر نسخه‌دار، خط پایه نسخه‌دار پیش از مداخله، گروه مقایسه/DiD، پایش اثر ناخواسته، کمیته تصمیم و صورت‌جلسه.

---

## بلوک ۷ — فراداده اجباری هر رکورد داده (بدون آن‌ها `score-eligible` نمی‌شود)

هر مشاهده در `/evidence/assess` **باید** همگی این‌ها را داشته باشد تا در پوشش ۸۰٪ شمرده شود:

1. `indicatorCode` موجود در رجیستر ۱۶۴ و با پیشوند `M-CORE-` (کد ۴۰ شاخص هسته).
2. `status = 'validated'` (نه raw/measured تنها).
3. `publicationLevel ∈ {VERIFIED_OPEN_EO, VERIFIED_CONTRACT, VALIDATED}`.
4. `normalizedScore` عددی در بازه ۰–۱۰۰.
5. `quality.score ≥ 0.70` (و در صورت وجود: `spatialCoverage`, `temporalCoverage`, `sourceReliability`, `methodValidity`, `validationScore` در ۰–۱).
6. `source.tier ≠ 'proxy'` و `geographyLevel ∈ {block, neighborhood}` (داده ملی/استانی به‌عنوان benchmark ثبت می‌شود، نه امتیاز محله).
7. `boundaryVersion` برای اتصال به `boundary.version` مصوب.
8. `method.registryVersion` **دقیقاً برابر** نسخه رجیستر (`sha256` از CSV رجیستر + پلن ۱۶۴).
9. `method.name` + `method.formulaVersion` (فرمول رجیستر عیناً اجرا شود، نه ضرایب ابتکاری).
10. `source.{id,name,retrievedAt}` + `evidence_id` و در صورت نبود عدد: `missingReason` + `nextAction` (صف داده مفقود).

**مکمل‌های اجباری:** واحد و دامنه صحیح؛ دوره مرجع و زمان جمع‌آوری؛ کنترل جمع صورت/مخرج؛ عدم‌قطعیت/بازه اطمینان؛ حذف شناسه شخصی و آستانه انتشار ≥۱۰ رکورد در هر سلول (privacy)؛ مجوز استفاده (طبقه B) و ثبت checksum/dataset id.

---

## بلوک ۸ — جدول جامع دروازه‌ها و آستانه‌های عددی (مأخذ: کد)

| دروازه | آستانه | فایل/ثابت |
|---|---|---|
| پوشش شاخص‌های هسته | ≥ **۸۰٪** از ۴۰ شاخص (≥۳۲) | `server/decisionSupportEvidence.ts` → `MIN_CORE_COVERAGE=0.8` |
| پوشش هر سرمایه | ≥ **۶۰٪** (≥۳ از ۵ شاخص) | `MIN_CAPITAL_COVERAGE=0.6` |
| کیفیت هر مشاهده | ≥ **۰٫۷۰** | `MIN_QUALITY_SCORE=0.7` |
| پوشش مراحل زنجیره | هر ۵ مرحله C/A/U/E/O | `chain_stage_*_missing` |
| مرز | `geometry` یا `bbox` + `version` | `confirmed_boundary_missing` |
| کف اجرای پایه | ≥۱ شاخص + هر ۸ سرمایه + ≥۱ گذار C-A-U-E-O | `decisionSupportService.ts` / `bottleneckLocator.ts` |
| پوشش تجمیع کرنل | ≥ **۵۰٪** هر سرمایه، وگرنه `INSUFFICIENT_COVERAGE` | `kernel/engine/calc_engine.py` (`min_coverage=0.5`) |
| سقف سطح اتکا با پوشش | پوشش < **۷۵٪** → حداکثر «محدود» | `kernel/engine/confidence.py` (`assess_aggregate`) |
| سقف تک‌جریانه | مقدار تک‌جریانه = حداکثر «محدود»؛ «همگرا» نیازمند **≥۲ جریان مستقل** | `confidence.py` |
| «آزمون‌شده» | نیازمند پرچم تست/کالیبراسیون شده | `confidence.py` |
| نردبان امتیاز اطمینان | <۰٫۲۵ ناکافی، <۰٫۵۰ محدود، <۰٫۷۰ قابل اتکا، <۰٫۸۵ همگرا، ≥۰٫۸۵ آزمون‌شده | `FACTOR_WEIGHTS` + آستانه‌ها |
| عدالت گروهی | ≥ **۲ گروه**؛ گزارش شکاف فقط اگر ≥ **۱۰** واحد | `calc_engine.equity_gap`, `bottleneckLocator.ts` |
| تفکیک مکانی | ≥ **۲ زیرمکان**؛ معناداری ≥ **۱۰** واحد | `diagnoseWorstLocation` |
| روند زمانی | ≥۱ کد مشترک؛ تشدید اگر میانگین Δ ≤ **−۳** | `diagnoseTemporalTrend` |
| اولویت مداخله | هر ۵ فاکتور (S,P,L,F,E) لازم؛ وگرنه `INSUFFICIENT_COVERAGE` | `calc_engine.priority` |
| کالیبراسیون L/U | اگر `lu_status=PENDING_VALIDATION` → `PENDING_VALIDATION` و **نمره تولید نمی‌شود** | `Engine.standardize` |
| گونه‌بندی — پوشش دامنه | ≥ **۰٫۷۰** | `neighborhood_typology/typology_engine.py`, `config.ts` |
| گونه‌بندی — پوشش محرک | ≥ **۰٫۵۰** | همان |
| اطمینان مرز | ≥ **۰٫۹۰** | `config.yml` → `boundary_confidence_minimum` |
| پیکسل معتبر رستر | ≥ **۰٫۸۰** | `raster_valid_pixel_share_minimum` |
| نرخ پاسخ پیمایش | ≥ **۰٫۶۰** | `survey_response_rate_minimum` |
| شکاف مرجع سال | ≤ **۲** سال | `maximum_reference_year_gap` |
| پایداری برچسب (bootstrap) | ≥ **۰٫۸۰** | `minimum_bootstrap_label_stability` |
| حداقل سلول قابل‌انتشار | ≥ **۱۰** | `minimum_publishable_cell_count` |
| ممنوعیت جایگذاری در نتیجه گواهی‌شده | `allow_imputation_in_certified_result=false` | همان |
| اعتبارسنجی ماهواره | پوشش AOI ≥ **۹۹٪**، کسر پاک ≥ **۱۰٪**، ≥ **۵** مشاهده برای ناهنجاری زمانی | `README.md` + `docs/architecture/adr-005` |
| نوع‌شناسی رسمی | `minimumConfidence 0.6`، `criterionThreshold 0.5`، `minimumCriterionCoverage 0.5`، حداقل ۲ نشانه غیررسمی | `server/typologyOfficialRules.ts` |
| کرانه جغرافیایی | عرض ۲۴–۴۰٫۵ / طول ۴۳–۶۴ | `decisionSupportRouter.ts` |

---

## بلوک ۹ — چک‌لیست حداقلی عملیاتی (چه چیزی باید برای هر محله تأمین شود؟)

### سناریو «الف» — حداقل برای انتشار کارت با اعتبار (هدف اصلی)
1. **نام محله + شهر + استان + `purpose`**.
2. **مرز مصوب** (Polygon یا حداقل bbox) با `version` و `confidence ≥ ۰٫۹۰`.
3. **جمعیت محله** (و ترجیحاً جمعیت بلوکی برای «جمعیت متأثر»).
4. **≥۳۲ شاخص از ۴۰ شاخص هسته** با `normalizedScore` و فراداده کامل — عملاً دست‌یافتنی‌ترین ترکیب: همه‌ی **۱۰ شاخص A** (P2, P4, P5, N1, N2, N3, N4, C1, R1, R3) + **۱۳ شاخص B** با قرارداد داده (H1, H2, H3, H5, S5, E1, E2, E3, P1, C4, G2, G4, R4) + **۹ شاخص از ۱۲ شاخص D** با بازبینی کارشناسی (H4, S4, E4, E5, N5, C2, C5, G1, G3, G5, R2, R5) + **۵ شاخص E** (S1, S2, S3, P3, C3) از پیمایش/ممیزی میدانی.
5. **پوشش هر ۸ سرمایه ≥ ۳ شاخص** — این سخت‌ترین سقف روی انسانی/اجتماعی/فرهنگی/نهادی است چون بیشتر شاخص‌های آن‌ها طبقه B یا E هستند.
6. **پوشش هر ۵ مرحله زنجیره** — مرحله EXPERIENCE فقط با `S2` و `C3` تأمین می‌شود ⇒ **پیمایش اجباری است**.
7. **پیمایش ادراکی**: ۱۵ گویه، نمونهٔ مصوب (۳۱۶ خانوار/پهنه)، نرخ پاسخ ≥۰٫۶۰، α و CVI گزارش‌شده، `respondentGroup`.
8. **تفکیک گروهی** برای شاخص‌های کلیدی (≥۲ گروه)، **تفکیک مکانی** برای زیرمحله‌ها (≥۲ زیرمکان) و **دورهٔ قبل** برای روند.
9. **AOI + بستهٔ شواهد ماهواره‌ای معتبر** (حداقل برای N2) و شواهد مکانی برای جریان GIS.
10. **فراداده کامل هر رکورد** (بلوک ۷) و نسخه‌های فرمول/رجیستر.

### سناریو «ب» — حداقل برای اجرای آزمایشی/تشخیصی (بدون انتشار عدد)
موارد ۱–۳ + حداقل **۱ شاخص در هر ۸ سرمایه** + **حداقل دو شاخص در یک سرمایه روی دو مرحلهٔ پیوستهٔ زنجیره** (مثلاً `P2` در CAPACITY و `P4` در ACCESS). بدون دو مرحلهٔ پیوسته، سرویس با پیام `Measured indicators do not provide any comparable C-A-U-E-O transition.` کل اجرا را رد می‌کند (تأییدشده با اجرای واقعی — پیوست ب). خروجی «کارت موقت» است و صریحاً ناقص‌ها را نام می‌برد: «پیمایش ادراکی دریافت نشد — حکم ادراکی صادر نمی‌شود»، «بدون داده گروهی — حکم قطعی عدالت ممنوع»، «امتیاز Q/T/R تا عبور از دروازه پوشش و کیفیت منتشر نمی‌شود.»، «NDVI/NDWI/NDBI فقط شاهد ثبت شده‌اند؛ تبدیل به درصد پوشش نیازمند کالیبراسیون مستقل است.»

### چه چیزی هرگز جایگزین نمی‌شود
ادعای ادراکی (اعتماد/تعلق/هویت/رضایت) با POI، LLM، تصویر ماهواره‌ای یا داده ملی — ممنوع. عدالت بدون تفکیک — ممنوع. کمبود پایه (ظرفیت < ۳۰) بدون بررسی زیرساخت — ممنوع. علت‌یابی بدون ≥۲ جریان مستقل — حداکثر «فرضیه اولیه».

---

## بلوک ۱۰ — دارایی‌های داده‌ای موجود در همین مخزن (قابل استفاده فوری)
- **مرزها:** `mahalat/*.geojson` (تهران ۳۹۱ محله، کرج)، `iran.pbf` + `public/data/pbf/*` (شبکه معابر/POI ایران).
- **جمعیت و خانوار:** `src/data/portals/population/*`، `server/data/census-unknown.json`، `src/data/portals/macro/blocks-per-subdistrict.json` (بلوک آماری).
- **بنچمارک کلان:** `server/data/lfs-84|96|99.json` (نیروی کار)، `src/data/portals/development/*`، `src/data/portals/statistical/amarrasmi-registry.json`.
- **رجیسترها:** `neighborhood_typology/indicator_registry_419.csv`، `kernel/registries/{registry_419, core_40, online_83, min_nonfield_indicator_set, threshold_registry_v1, weight_registry_v1, sources_23, procedures_25}.json`.
- **پلن اجرایی ۱۶۴ شاخص:** `docs/decision-support/indicator-automation-plan-164.csv` (+ summary) و `server/decisionSupportRegistry164.ts`.
- **ماهواره:** `server/data/satellite-pipeline/jobs/*` (COG تولیدشده)، `server/data/satellite-items.json`، `artifacts/satellite-validation-report.json`.
- **اجرای نمونه (خط پایه رفتار سیستم):** `kernel/pilot/out/mvp2/*` شامل `gate_report_mvp2.json` با تصمیم `CONDITIONAL PASS` و محدودیت‌های اعلام‌شده؛ `server/data/decision-runs.json`.

> **جمع‌بندی یک‌خطی:** برای «نتیجه با حداقل اعتبار موردنیاز» باید **مرز مصوب + جمعیت + ≥۳۲ شاخص هسته با فراداده کامل (پوشش ≥۳ شاخص در هر سرمایه و هر ۵ مرحله زنجیره) + پیمایش ۲۱ شاخصه با نمونهٔ مصوب + تفکیک گروهی/مکانی/زمانی با ≥۲ برش** تأمین شود؛ در غیر این صورت سیستم به‌درستی انتشار عدد را متوقف می‌کند و فقط «پرونده شواهد» می‌دهد.

---

## پیوست الف — نکته اجرایی حیاتی دربارهٔ قالب ورودی رجیستر شواهد

در `POST /api/decision-support/evidence/assess` مقدار `indicatorCode` **باید کد یکتای رجیستر** باشد (`M-CORE-H1` … `M-CORE-R5`) و **نه** کد کوتاه محاسباتی (`H1` … `R5`) — در غیر این صورت سرویس با خطای `Unknown decision-support indicator code` پاسخ می‌دهد (این رفتار با اجرای واقعی سرویس تأیید شد). کد کوتاه فقط در `POST /api/decision-support/analyze` (ورودی `indicatorValues`) و در `groupValues`/`subLocationScores`/`previousPeriodIndicatorValues` معتبر است.

## پیوست ب — اعتبارسنجی تجربی آستانه‌ها (اجرای واقعی کد، قابل بازتولید)

اسکریپت بازتولیدپذیر: `.freebuff/tmp/evidence_gate_probe.ts` (اجرا: `npx tsx .freebuff/tmp/evidence_gate_probe.ts`) و توزیع کلاس‌های اتوماسیون ۴۰ شاخص هسته: `.freebuff/tmp/core_rows_probe.cjs` (اجرا: `node .freebuff/tmp/core_rows_probe.cjs`). نتایج اجرای واقعی روی رجیستر جاری (`sha256:9d2636e5…`, ۱۶۴ ردیف، ۴۰ هسته، ۴۰/۴۰ کد قابل نگاشت به شاخص‌های الگوریتم):

| سناریوی ورودی | نتیجه دروازه |
|---|---|
| ۱۵ شاخص (۱۰ شاخص A + ۵ شاخص پیمایشی/میدانی E) | `publishable=false` · `EVIDENCE_ONLY` · پوشش هسته ۳۷٪ · خطاها: `core_score_coverage_below_0.8` + سرمایه‌های H/E/C/G/R زیر ۶۰٪ |
| کیفیت مشاهده = ۰٫۵۰ | `scoreEligible=false`, پرچم `NOT_SCORE_ELIGIBLE` |
| `source.tier='proxy'` | `scoreEligible=false` |
| `source.geographyLevel='province'` | `scoreEligible=false` |
| **۴۰ شاخص هسته** (با مرز و فراداده کامل) | **`publishable=true` · `COMPLETED` · `publicationLevel=VALIDATED`** · پوشش هسته ۱۰۰٪ · تمام سرمایه‌ها ۱۰۰٪ · بدون خطا |
| **۳۲ شاخص هسته (دقیقاً ۸۰٪)** | **`publishable=true`** · پوشش هسته ۸۰٪ · تمام سرمایه‌ها ۸۰٪ · بدون خطا → آستانه «≥» است، نه «>» |
| بدون مرز/`boundaryVersion` | `publishable=false` با ۹ خطای پوشش + `chain_stage_*_missing` برای **هر ۵ مرحله** + `confirmed_boundary_missing` → نداردِ مرز، همه‌ی رکوردها را از `score-eligible` خارج می‌کند |

### اجرای خط لوله `/analyze` (اسکریپت `.freebuff/tmp/analyze_floor_probe.ts`)

| ورودی | نتیجه واقعی |
|---|---|
| تنها ۱ شاخص (`H1`) | رد: `Insufficient measured coverage for capitals: S, E, P, N, C, G, R` |
| ۱ شاخص در هر ۸ سرمایه (`H1,S1,E1,P1,N1,C1,G1,R1`) | رد: `Measured indicators do not provide any comparable C-A-U-E-O transition.` → **کف اجرا به دو مرحلهٔ پیوسته در یک سرمایه نیاز دارد** |
| همه‌ی ۴۰ شاخص، بدون پیمایش و بدون تفکیک | موفق: `Q=54.2 T=59.1 R=54.1`، تیپ `B`، گلوگاه `E: CAPACITY→ACCESS`، `equityDataStatus=missing`، `trend=first_run`، یادداشت‌ها شامل «پیمایش ادراکی دریافت نشد» و «بدون داده گروهی — حکم قطعی عدالت ممنوع» |
| همان ۴۰ شاخص + پیمایش ۱۵ گویه‌ای | موفق: `surveyEvidence=integrated(15)` و یادداشت «پیمایش ادراکی با ۱۵ پاسخ ادغام شد»؛ `trend` از مخزن اجراها (`stable`) محاسبه شد — یعنی **روند فقط با اجرای دورهٔ قبل معنا دارد** |
