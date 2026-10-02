# کاتالوگ جامع اتصالات و منابع دادهٔ افزودنی — «تصمیم‌یار جامع محله»

> **نسخه:** ۱٫۰ · **تاریخ:** ۱۴۰۵/۰۷/۱۰
> **مبنا:** بازخوانی کامل کد و رجیسترهای اجرایی — `server/sources/{types,manifests,connectors,runtime,router}.ts`، `src/algorithm/{sources,indicatorSourceRegistry,realDataConnectors,liveExtract}.ts`، `server/decisionSupportRouter.ts`، `server/decisionSupportEvidence.ts`، `server/satelliteStac.ts` + `server/satellitePipeline.ts`، `server/externalDataProxy.ts`، `kernel/registries/{sources_23,online_83,source_inventory,min_nonfield_indicator_set,core_40,registry_419}.json`، و اسناد `docs/decision-support/required-input-dataset-fa.md` و `docs/decision-support/data-and-indicator-requirements.md`.
> **هدف:** تعیین و مستندسازی **فهرست کامل اتصالات و منابع داده‌ای که باید افزوده و یکپارچه شوند** تا «تصمیم‌یار جامع محله» از ۹ شاخص امتیازده فعلی به پوشش عملیاتی ۴۰ شاخص هسته (و سپس ۱۶۴ شاخص رجیستر و ۴۱۹ شاخص گونه‌بندی) برسد.
> **قاعدهٔ حاکم (غیرقابل‌مذاکره):** دادهٔ مفقود هرگز صفر نمی‌شود؛ دادهٔ ساختگی ممنوع؛ ادعای ادراکی (اعتماد/تعلق/هویت) با POI، ماهواره، LLM یا دادهٔ ملی جایگزین نمی‌شود؛ دادهٔ ملی/استانی فقط بنچمارک است، نه امتیاز محله.

---

## بخش ۰ — خلاصهٔ اجرایی

| سنجه | وضعیت فعلی | هدف این کاتالوگ |
|---|---|---|
| منیفست‌های اعلان‌شدهٔ منبع | **۱۲** | ۴۰+ |
| شاخص‌های هستهٔ دارای تغذیهٔ **امتیازده** (`score_eligible`) | **۹ از ۴۰** (E2, P2, P4, P5, N1, N3, C1, R1, R3) | ۳۵ از ۴۰ (انواع A/B/D) |
| شاخص‌های هستهٔ دارای تغذیهٔ **شاهد** (`evidence_only`) | ۷ (H3, P1, E1, G2, N2, N4, N5) | ۳۵ |
| شاخص‌های هستهٔ **بدون هیچ اتصال** | **۲۴** | ~۵ (فقط پیمایش/ممیزی: S1, S2, S3, P3, C3) |
| جریان‌های شواهد فعال | ۲ از ۴ (عینی ✅، ادراکی ✅، مکانی ⚠️، **رفتاری ❌**) | ۴ از ۴ |
| منبع در اطلس داخلی (`source_inventory.json`) | ۱۰۶ ردیف / ۴۵ منبع یکتا | — |
| منبع اعلان‌شده از میان آن اطلس | **۱۱ از ۴۵** | ادغام تدریجی |

**نتیجهٔ کلیدی:** بیشترین شکاف، نه در سنجش از دور (که زیرساخت STAC + COG آن ساخته شده)، بلکه در **سه جا** است:
۱. **دادهٔ ثبتی/قراردادی ایران** برای ۱۳ شاخص طبقهٔ B (H1,H2,H3,H5,S5,E1,E2,E3,P1,C4,G2,G4,R4).
۲. **جریان رفتاری** (کارت بلیت، تردد، تراکنش تجمیعی، ۱۳۷، رویداد) که امروز تقریباً خالی است و `S4`/`G1`/`C2`/`R4` را زمین می‌زند.
۳. **استخراج امتیاز از EO** (N2 پوشش گیاهی، N4 مخاطره، N5 تاب‌آوری) — داده‌اش موجود است ولی امروز فقط `evidence_only` ثبت می‌شود.

---

## بخش ۱ — وضعیت موجود: چه چیزی همین امروز وصل است

### ۱٫۱ معماری اتصال (این معماری را دست‌نخورده نگه دارید)

افزودن منبع جدید = **افزودن یک منیفست اعلانی** (+ در صورت نیاز یک `transform`)، بدون دست‌زدن به route، کش، retry یا UI:

```
SourceManifest (اعلانی)  →  Connector (transport)  →  SourceRuntime
                                                     ├─ کش دو‌لایه (fresh / stale)
                                                     ├─ Circuit Breaker (closed/open/half-open)
                                                     └─ Provenance (license, attribution, cache, latency, provider)
```

**Transportهای پشتیبانی‌شده:** `http-json` · `overpass` · `stac` · `s3-parquet` · `gee` · `ogc` · `file` · `survey`
**نقش‌ها:** `score_eligible` (مجاز به ورود به امتیاز) · `evidence_only` (فقط دفتر شواهد)
**کلاس‌های خودکارسازی:** `A_PUBLIC_AUTOMATIC` · `B_PUBLIC_SEMI_AUTOMATIC` · `C_OPERATOR_ENTERED` · `D_CONTRACT_ONLY`
**سطح خروجی مجاز:** `PROVISIONAL_PUBLIC` · `REQUIRES_REVIEW` · `INTERNAL_ONLY`

### ۱٫۲ منیفست‌های فعال (۱۲)

| # | شناسه منیفست | عنوان | Transport | شاخص‌های تغذیه‌شده | نقش | کلید لازم |
|---|---|---|---|---|---|---|
| ۱ | `open-meteo-air` | Open-Meteo کیفیت هوا | http-json | N3 | **score** | — |
| ۲ | `open-meteo-climate` | Open-Meteo آرشیو اقلیمی | http-json | N5 | evidence | — |
| ۳ | `worldbank` | بانک جهانی (WDI) | http-json | E1, H3, P1, N3 | evidence | — |
| ۴ | `who-gho` | WHO GHO | http-json | P4, G2 | evidence | — |
| ۵ | `osm-pois` | OSM POI (Overpass) | overpass | R3, P4, E2, C1, P5 | **score (proxy)** | — |
| ۶ | `osm-walkability` | OSM پیاده‌مداری | overpass | N1, P2 | **score (proxy)** | — |
| ۷ | `healthsites` | Healthsites.io | http-json | P4 | **score (proxy)** | `HEALTHSITES_API_KEY` |
| ۸ | `satellite-stac` | Copernicus / Earth-Search STAC | stac | N2, N3 | evidence | — |
| ۹ | `openaq` | OpenAQ v3 | http-json | N3 | **score** | `OPENAQ_API_KEY` |
| ۱۰ | `firms` | NASA FIRMS | http-json | N4 | evidence | `FIRMS_MAP_KEY` (اختیاری) |
| ۱۱ | `osrm` | OSRM زمان سفر | http-json | R1, R3 | **score** | — |
| ۱۲ | `glofas-flood` | GloFAS / Open-Meteo Flood | http-json | N5 | evidence | — |

### ۱٫۳ رجیسترهای موازی که باید هم‌گام بمانند

| رجیستر | حجم | نقش |
|---|---|---|
| `SOURCE_REGISTRY` (`src/algorithm/sources.ts`) | ۳۳ منبع | allow-list عمومی (منابع خارج از آن رد می‌شوند) |
| `INDICATOR_SOURCE_REGISTRY` | ۴۰ شاخص | منبع اصلی/جایگزین هر شاخص الگوریتم |
| `sources_23.json` | ۲۳ خانواده | اطلس منابع EO/زمینی |
| `online_83.json` | ۸۳ سنجه | سنجه‌های عملیاتی برخط |
| `source_inventory.json` | ۱۰۶ ردیف / ۴۵ منبع یکتا | فهرست یکپارچهٔ دسترسی |
| `min_nonfield_indicator_set.json` | ۲۵۱ شاخص | شاخص‌های بی‌نیاز از کار میدانی، در ۳ لایه |
| `core_40.json` / `registry_419.json` | ۴۰ / ۴۱۹ | هستهٔ تصمیم‌یار و رجیستر مادر گونه‌بندی |

> `validateManifests()` هر منیفست را با `SOURCE_REGISTRY` و `INDICATOR_SOURCE_REGISTRY` اعتبارسنجی می‌کند. اگر منبع جدیدی به منیفست اضافه شود و `registryId` آن در allow-list نباشد، ساخت با خطا متوقف می‌شود. **ترتیب صحیح افزودن:** allow-list → رجیستر شاخص → منیفست → کانکتور → تست.

### ۱٫۴ کلیدهای محیطی امروز

`OPENAQ_API_KEY` · `HEALTHSITES_API_KEY` · `FIRMS_MAP_KEY` · `SATELLITE_S3_SECRET_ACCESS_KEY` / `_SESSION_TOKEN` · `SATELLITE_REDIS_URL` · `KERNEL_SERVICE_URL|PORT|TIMEOUT_MS` · `SOURCE_CACHE_DIR` · `SCI_PORT` · `ARA_ANTHROPIC_API_KEY` · `GEMINI_API_KEY` · `VITE_API_BASE_URL` · `TRUST_PROXY_HOPS`

---

## بخش ۲ — نقشهٔ شکاف: ۴۰ شاخص هسته → دادهٔ لازم → منبع پیشنهادی

راهنمای ستون «وضعیت»: ✅ امتیازده · 🟡 فقط شاهد · ❌ بدون اتصال

| کد | سرمایه | مرحله | کلاس | وضعیت | دادهٔ لازم (تعریف رجیستر) | منبع افزودنی پیشنهادی |
|---|---|---|---|---|---|---|
| H1 | انسانی | CAPACITY | B | ❌ | سواد/تحصیلات ۲۵+ | سرشماری SCI (خرد) · IPUMS · آمارنامه استانی |
| H2 | انسانی | CAPACITY | B | ❌ | مهارت حرفه‌ای | سازمان فنی‌وحرفه‌ای (ثبت‌نام) · پیمایش |
| H3 | انسانی | OUTCOME | B | 🟡 | اشتغال پایدار | تأمین اجتماعی (بیمه‌شدگان) · LFS SCI |
| H4 | انسانی | CAPACITY | D | ❌ | تناسب شغل↔مهارت | LFS + بازبینی خبره |
| H5 | انسانی | OUTCOME | B | ❌ | مشارکت آموزشی | آموزش‌وپرورش (ثبت‌نام) · مراکز آموزش عالی |
| S1 | اجتماعی | CAPACITY | E | ❌ | اعتماد | **فقط پیمایش** |
| S2 | اجتماعی | EXPERIENCE | E | ❌ | تعلق | **فقط پیمایش** |
| S3 | اجتماعی | CAPACITY | E | ❌ | شبکهٔ همکاری | **فقط پیمایش** |
| S4 | اجتماعی | USE | D | ❌ | اقدام جمعی | پروندهٔ پروژه/۱۳۷ + پیمایش + **شواهد رفتاری** |
| S5 | اجتماعی | OUTCOME | B | ❌ | حل مسئلهٔ مشارکتی | سامانهٔ ۱۳۷/شورایاری + پروندهٔ پروژه |
| E1 | اقتصادی | CAPACITY | B | 🟡 | درآمد خانوار | طرح هزینه–درآمد SCI (خرد) · مالیات بر درآمد تجمیعی |
| E2 | اقتصادی | CAPACITY | B | ✅ (proxy) | تراکم شغلی | اتاق اصناف/پروانهٔ کسب · OSM POI |
| E3 | اقتصادی | OUTCOME | B | ❌ | ماندگاری کسب‌وکار | اصناف (سن بنگاه) · مالیات/بیمهٔ کارکنان |
| E4 | اقتصادی | ACCESS | D | ❌ | هزینهٔ مسکن/درآمد | مرکز آمار (اجاره‌بها) · پلتفرم‌های ملک (بازار) |
| E5 | اقتصادی | OUTCOME | D | ❌ | ارزش ماندهٔ محله | حساب‌های منطقه‌ای بانک مرکزی · بنگاه |
| P1 | کالبدی | CAPACITY | B | 🟡 | پایداری ابنیه | پروانهٔ ساختمان شهرداری · BHRC/آیین‌نامه ۲۸۰۰ · پایگاه ملی ساختمان |
| P2 | کالبدی | CAPACITY | A | ✅ | پیوستگی معابر | OSM/OSMnx (موجود) + Valhalla/GraphHopper |
| P3 | کالبدی | USE | E | ❌ | کیفیت فضای عمومی | **فقط ممیزی میدانی** (+ عکس خیابان) |
| P4 | کالبدی | ACCESS | A | ✅ (proxy) | پوشش خدمات | OSM + Healthsites (موجود) + وزارت بهداشت |
| P5 | کالبدی | ACCESS | A | ✅ (proxy) | حمل‌ونقل عمومی | **GTFS** شهرداری‌ها · OSM · Neshan |
| N1 | طبیعی | ACCESS | A | ✅ (proxy) | دسترسی سبزنما | OSM (موجود) + ESA WorldCover + Dynamic World |
| N2 | طبیعی | CAPACITY | A | 🟡 | NDVI فصل رشد | Sentinel-2 L2A (خط لولهٔ COG موجود) → ارتقا به امتیاز |
| N3 | طبیعی | OUTCOME | A | ✅ | PM2.5 | Open-Meteo + OpenAQ (موجود) + سامانهٔ پایش DOE ایران |
| N4 | طبیعی | CAPACITY | A | 🟡 | پهنهٔ مخاطره | DEM GLO-30 · JRC Flood · GEM لرزه · GSW · ComCat |
| N5 | طبیعی | OUTCOME | D | 🟡 | تاب‌آوری اقلیمی | ERA5-Land · CHIRPS · SPEI · NASA POWER |
| C1 | فرهنگی | CAPACITY | A | ✅ (proxy) | دارایی فرهنگی | Wikidata + OSM (موجود) + وزارت ارشاد |
| C2 | فرهنگی | USE | D | ❌ | فعال‌بودن دارایی | تقویم/بلیت رویداد · فرهنگ‌سراها |
| C3 | فرهنگی | EXPERIENCE | E | ❌ | هویت | **فقط پیمایش** |
| C4 | فرهنگی | USE | B | ❌ | مشارکت فرهنگی | ثبت‌نام/بلیت فرهنگی · خانهٔ فرهنگ |
| C5 | فرهنگی | OUTCOME | D | ❌ | انتقال هویت | برنامهٔ آموزشی + پیمایش نسل جوان |
| G1 | نهادی | USE | D | ❌ | مشارکت در تصمیم | صورت‌جلسه/مصوبات شهرداری · شورایاری |
| G2 | نهادی | ACCESS | B | 🟡 | پاسخگویی | **۱۳۷ / ۱۸۸۸ / CRM** (SLA) |
| G3 | نهادی | USE | D | ❌ | هماهنگی نهادی | ارزیابی خبرگان · توافق‌نامه‌ها |
| G4 | نهادی | CAPACITY | B | ❌ | تکمیل پروژه | سامانهٔ پروژه/بودجهٔ شهرداری و استانداری |
| G5 | نهادی | OUTCOME | D | ❌ | استفاده از ارزیابی | گزارش‌های پیشین · دیوان محاسبات |
| R1 | شبکه‌ای | ACCESS | A | ✅ | زمان سفر | OSRM (موجود) + Neshan isochrone |
| R2 | شبکه‌ای | ACCESS | D | ❌ | فرصت شغلی در شعاع | اصناف + OSM + LFS |
| R3 | شبکه‌ای | ACCESS | A | ✅ | زمان تا آموزش | OSRM + OSM (موجود) + وزارت آموزش‌وپرورش |
| R4 | شبکه‌ای | OUTCOME | B | ❌ | اتصال اقتصادی | تراکنش تجمیعی بنگاه (DCAP/شاپرک) |
| R5 | شبکه‌ای | CAPACITY | D | ❌ | پوشش × کیفیت × استفادهٔ اینترنت | Ookla Open Data · M-Lab NDT · سازمان تنظیم مقررات (CRA) |

**خوانش جدول:** ۹ شاخص امتیازده فعلی همه از نوع موقت/پروکسی‌اند (جز N3 و R1/R3). برای عبور از دروازهٔ اعتبار (`MIN_CORE_COVERAGE=0.8`، `MIN_QUALITY_SCORE=0.7`، `tier ≠ proxy`) حداقل **۳۲ شاخص** با `source.tier` غیرپروکسی و `geographyLevel ∈ {block, neighborhood}` لازم است — یعنی **قرارداد دادهٔ رسمی اجتناب‌ناپذیر است**.

---

## بخش ۳ — کاتالوگ منابع افزودنی

راهنمای اولویت: **P0** = بدون آن دروازهٔ شاخص‌های طبقهٔ A کامل نمی‌شود · **P1** = لازم برای شاخص‌های B/D · **P2** = تقویت/بنچمارک/راهبردی.

### ۳٫۱ سنجش از دور و رستر — پایهٔ خانوادهٔ «مکانی»

> همهٔ این‌ها از مسیر موجود **STAC → پنجرهٔ AOI با Rasterio → COG + ایندکس (NDVI/NDWI/NDBI/NDMI/NBR) → دروازهٔ اعتبار** قابل افزودن‌اند. برای پوشش‌های سنگین/دم‌محور، transport `gee` در معماری پیش‌بینی شده است.

| منبع | تولیدکننده | دسترسی | تفکیک | شاخص هدف | اولویت | نکتهٔ یکپارچه‌سازی |
|---|---|---|---|---|---|---|
| Sentinel-2 MSI L2A | ESA/Copernicus | CDSE / STAC / GEE | ۱۰–۲۰ م | N2 (NDVI)، N1 | **P0** | هم‌اکنون به‌عنوان `satellite-stac` متادیتا وصل است؛ فقط مرحلهٔ «امتیاز» باقی است |
| Sentinel-1 GRD (VV/VH) | ESA/Copernicus | CDSE / GEE | ۱۰ م | رطوبت/فرونشست، شاهد | P1 | در خط لولهٔ COG پشتیبانی شده |
| Sentinel-2 HLS / Landsat C2 L2 | NASA/USGS | STAC / EarthExplorer | ۳۰ م | سری بلندمدت پوشش گیاهی | P1 | `SATELLITE_HLS_STAC_URL` در کد پیش‌بینی شده |
| Dynamic World V1 | Google/WRI | GEE | ۱۰ م | کاربری/کاربری تغییر (N1,P2) | **P0** | احتمال کلاس ≥۰٫۶ لازم است (QA اجباری) |
| ESA WorldCover 2021 v200 | ESA | COG / GEE | ۱۰ م | پوشش سبز، اراضی بایر | **P0** | COG آمادهٔ دانلود؛ ورود مستقیم به خط لوله |
| GHSL Built-up Surface/Volume/Population/DoU | JRC | دانلود / GEE | ۱۰۰ م | تراکم ساخت، ارتفاع، جمعیت بلوکی | **P0** | جایگزین/تقویت‌کنندهٔ جمعیت بلوکی |
| WorldPop (جمعیت و ساختار سنی–جنسی) | Univ. Southampton | GeoTIFF / STAC / GEE | ۱۰۰ م | P1، «جمعیت متأثر»، تفکیک مکانی | **P0** | برای «جمعیت متأثر» در اولویت مداخله |
| Copernicus DEM GLO-30 | Copernicus/ESA | COG / OpenTopography / GEE | ۳۰ م | N4 (شیب/ارتفاع) | **P0** | COG است؛ سریع |
| JRC Global Surface Water v1.4 | JRC | COG / GEE | ۳۰ م | N4/N5 (آب سطحی) | P1 | — |
| JRC Global River Flood Hazard v2.1 | Copernicus EMS/JRC | CEMS / GEE | ~۱۰۰ م | N4 (پهنهٔ سیل) | **P0** | مکمل `glofas-flood` (که دبی است، نه پهنه) |
| GEM Global Seismic Hazard Map | GEM Foundation | Zenodo / OpenQuake | ~۱۰ ک م | N4 (لرزه) | **P0** | مجوز باید بازبینی شود |
| USGS ComCat Earthquake Catalog | USGS | REST/GeoJSON | نقطه‌ای | N4 (رویداد) | P1 | سری زمانی رویداد |
| Hansen Global Forest Change | UMD / GFW | GeoTIFF / GEE | ۳۰ م | N1/N5 | P2 | برای ایران اهمیت کمتر از خشک‌سالی |
| CHIRPS v2/v3 بارش | UCSB CHC / USGS | GeoTIFF / GEE | ۵ ک م | N5 | P1 | مکمل ERA5 |
| ERA5-Land | ECMWF/C3S | CDS / GEE | ۹ ک م | N5 | **P0** | پایهٔ محاسبهٔ SPEI |
| NASA POWER | NASA LaRC | REST/CSV | نقطه‌ای | N5 (دما/بارش/تابش) | P1 | سبک و بی‌کلید |
| Sentinel-5P TROPOMI (NO₂/SO₂/CO/AI) | ESA/Copernicus | CDSE / GEE | ۳٫۵–۷ ک م | N3 (مکمل) | P1 | جای ایستگاه زمینی را نمی‌گیرد |
| VIIRS Black Marble (نور شبانه) | NASA/NOAA | Earthdata/LAADS | ۵۰۰ م | E2/E5/R4 (پروکسی فعالیت) | P1 | پروکسی — نباید به‌جای دادهٔ بنگاهی بیاید |
| EDGAR Global Emissions | JRC/IEA | NetCDF | ۰٫۱° | N3 (شاهد) | P2 | بنچمارک |
| SoilGrids 250m v2 | ISRIC | WebDAV/WCS/REST | ۲۵۰ م | N4/N5 (خاک) | P2 | REST ممکن است موقتاً قطع باشد |
| Overture Maps (Buildings/Places) | Overture | Parquet روی S3 | ساختمان | P1/P4 (پایهٔ ساختمان) | P1 | transport `s3-parquet` در معماری موجود است |
| Google Open Buildings 2.5D | Google | GEE / CSV | ساختمان | P1، تراکم | P1 | دقت در ایران خوب اما نیازمند اعتبارسنجی |
| Microsoft Building Footprints | Microsoft | GeoJSON by country | ساختمان | P1 | P1 | سبک، بی‌کلید |

### ۳٫۲ مکانی، شبکه و حمل‌ونقل

| منبع | دسترسی | شاخص هدف | اولویت | نکته |
|---|---|---|---|---|
| OpenStreetMap (Overpass/PBF) | overpass / file | P2,P4,P5,N1,C1,E2,R3 | ✅ موجود | گسترش به لایه‌های `landuse`، `railway`، `public_transport`، `healthcare`، `amenity=place_of_worship` |
| OSRM مسیریابی | http-json | R1,R3 | ✅ موجود | افزودن **isochrone** (نه فقط مسیر نقطه‌به‌نقطه) |
| Valhalla / GraphHopper (self-host) | http-json | R1,R2,R3,P5 | **P0** | امکان isochrone دقیق چندحالته روی PBF موجود (`iran.pbf`) |
| **GTFS شهری (اتوبوس/مترو/BRT)** | file (zip GTFS) | **P5** | **P0** | تهران/مشهد/اصفهان/شیراز/تبریز: دریافت مرزی از شهرداری‌ها؛ در نبود آن، `osm-pois` پروکسی است |
| GTFS Realtime / GTFS-Flex | http-json | P5 (کیفیت) | P2 | افزوده‌شدنی به‌عنوان شاهد |
| Mobility Database / Transitland | http-json | کشف GTFS | P1 | فهرست جهانی فیدها؛ برای ایران فعلاً پوشش ناقص |
| OpenTripPlanner | http-json | P5,R1,R3 | P1 | analysis چندحالته با GTFS+OSM |
| Neshan Maps Platform (ایران) | http-json | R1,R2,R3,P5 + ژئوکد فارسی | **P0** | ژئوکد معکوس/جست‌وجوی فارسی، مسیریابی با ترافیک، distance matrix؛ برای نشانی محله حیاتی |
| Nominatim (self-host) | http-json | ژئوکد | P1 | `NOMINATIM` در allow-list هست |
| geoBoundaries / OCHA COD-AB | http-json / file | مرز اداری (تطبیق پهنه) | **P0** | تطبیق `gazetteer.json` با مرزهای رسمی |
| World Bank Official Boundaries | file | مرز | P2 | بنچمارک |

### ۳٫۳ کیفیت هوا، آب و محیط‌زیست

| منبع | دسترسی | شاخص هدف | اولویت | نکته |
|---|---|---|---|---|
| Open-Meteo Air Quality | http-json | N3 | ✅ موجود | — |
| OpenAQ v3 | http-json | N3 | ✅ موجود | نیازمند `OPENAQ_API_KEY` |
| **سامانهٔ پایش کیفی هوای کشور (aqms.doe.ir)** | http-json / scrape قانونی | N3 | **P0** | دادهٔ رسمی ایستگاه‌های سازمان حفاظت محیط‌زیست — درجه‌یک برای دروازهٔ اعتبار |
| **شرکت کنترل کیفیت هوای تهران (air.tehran.ir)** | API/scrape | N3 | **P0** | ایستگاه‌های شهری؛ بالاترین تفکیک مکانی در تهران |
| AQICN / WAQI | http-json (token) | N3 (مکمل) | P1 | تجمیع‌کنندهٔ ایستگاه‌ها؛ مجوز بازبینی شود |
| Sentinel-5P TROPOMI | GEE/STAC | N3 (شاهد) | P1 | برای روزهای بدون ایستگاه |
| JRC Global Surface Water | COG | N4/N5 | P1 | — |
| سازمان زمین‌شناسی ایران (GSI) | فایل/WMS | N4 | P1 | `GEOLOGY` در allow-list؛ لایه‌های مخاطره |
| سازمان هواشناسی (IRIMO) | قرارداد داده | N5 | P1 | دادهٔ ایستگاهی رسمی |

### ۳٫۴ مخاطرات و تاب‌آوری

| منبع | دسترسی | شاخص هدف | اولویت | نکته |
|---|---|---|---|---|
| GloFAS / Open-Meteo Flood | http-json | N5 | ✅ موجود | — |
| NASA FIRMS | http-json | N4 | ✅ موجود | — |
| GDACS | http-json (RSS/API) | N4 (شاهد رویداد) | P1 | هشدار جهانی چندمخاطره‌ای |
| WFP ADAM | http-json | N4 (شاهد) | P2 | — |
| EM-DAT | قرارداد/دانلود | N4 | P2 | تاریخی؛ برای کالیبراسیون |
| IIEES / مرکز تحقیقات ساختمان (BHRC) | قرارداد | N4، P1 | P1 | پهنه‌بندی لرزه‌ای ایران + آیین‌نامهٔ ۲۸۰۰ |

### ۳٫۵ منابع رسمی و ثبتی ایران — کلید عبور از دروازهٔ اعتبار (طبقهٔ B)

> این‌ها «باز» نیستند؛ افزودنشان **قرارداد داده + توافق سطح انتشار** می‌خواهد. معماری `D_CONTRACT_ONLY` و `VERIFIED_AFTER_CONTRACT` برای همین طراحی شده است. مسیر فنی: ورود به‌صورت `file`/`http-json` با `auth` نوع `bearer`/`header` و `allowedOutput: INTERNAL_ONLY` یا `REQUIRES_REVIEW`.

| نهاد | دادهٔ کلیدی | شاخص هدف | اولویت |
|---|---|---|---|
| **مرکز آمار ایران (SCI)** | سرشماری نفوس‌ومسکن (بلوک آماری)، طرح هزینه–درآمد خانوار، طرح نیروی کار (LFS)، آمارنامهٔ استانی، سالنامهٔ آماری شهر | H1, H3, E1, E4, P1 | **P0** |
| سازمان تأمین اجتماعی | بیمه‌شدگان، اشتغال رسمی به تفکیک محل کار | H3, R4 | **P0** |
| سازمان امور مالیاتی | مالیات عملکرد تجمیعی، تعداد مؤدی فعال به تفکیک کد پستی | E3, R4 | P1 |
| اتاق اصناف / سامانهٔ ایرانیان اصناف | پروانهٔ کسب، سن بنگاه، نوع فعالیت | E2, E3, R2 | **P0** |
| شهرداری (کلان‌شهرها) | **۱۳۷/۱۸۸۸**، پروانهٔ ساخت، عوارض، سامانهٔ پروژه و بودجه، آرشیو محله | P1, S4, S5, G1, G2, G4 | **P0** |
| وزارت آموزش‌وپرورش | مدارس، ثبت‌نام، فضای آموزشی | H5, R3 | **P0** |
| وزارت بهداشت | خانهٔ بهداشت/مرکز سلامت، جمعیت تحت پوشش | P4 | **P0** |
| وزارت فرهنگ و ارشاد / فرهنگ‌سراها | دارایی فرهنگی، برنامه‌ها، ثبت‌نام | C1, C2, C4, C5 | P1 |
| سازمان فنی‌وحرفه‌ای | دوره‌ها و ثبت‌نام‌ها | H2, H5 | P1 |
| بازیافت/پسماند شهرداری | شاخص‌های بهداشت محیط | N3 (مکمل) | P2 |
| سازمان تنظیم مقررات (CRA) + اپراتورها | پوشش، کیفیت، ترافیک | R5 | P1 |
| بورس/کدال/بانک مرکزی | حساب‌های منطقه‌ای، تسهیلات به تفکیک استان | E5, R4 | P2 |
| وزارت راه و شهرسازی / سامانهٔ املاک و اسکان | موجودی مسکن، اجاره‌بها | E4, P1 | P1 |
| دیوان محاسبات / سازمان برنامه‌وبودجه | تخصیص و عملکرد بودجهٔ استانی | G4, G5 | P2 |
| قوهٔ قضائیه / سامانهٔ ثنا | پرونده‌ها (سطح تجمیعی) | S5, G2 | P2 (حساسیت بالا) |

### ۳٫۶ دادهٔ باز ایران و دروازه‌های متمرکز

| منبع | نوع | کاربرد | اولویت |
|---|---|---|---|
| `data.tehran.ir` (سامانهٔ اطلاعات آماری شهر تهران) | پورتال/دانلود | آمار شهری تهران، جمعیت، کاربری | **P0** |
| `iranopendata.org` | پورتال | داده‌های پالایش‌شدهٔ ملی | P1 |
| `api.ir` | بازارگاه API دولتی | استعلام‌های رسمی | P2 |
| فهرست `APIs-made-in-Iran` | فهرست مرجع | کشف سرویس‌های ایرانی (دسته‌های نقشه/حمل‌ونقل/حاکمیتی) | P1 |
| `catalog.data.gov.ir` / درگاه ملی دادهٔ باز | پورتال | مجموعه‌داده‌های دولتی | P1 |
| HDX – OSM Building/Roads Export for Iran | دانلود | ساختمان/معابر (پایهٔ P1/P2) | P1 |

### ۳٫۷ نهادهای بین‌المللی (بنچمارک — `evidence_only`)

| منبع | شاخص هدف | نقش | اولویت |
|---|---|---|---|
| World Bank WDI | E1, H3, P1, N3 | بنچمارک ملی | ✅ موجود |
| WHO GHO | P4, G2 | بنچمارک | ✅ موجود |
| UNICEF / JMP (آب و بهداشت) | P4 | بنچمارک | P2 |
| UNESCO UIS | H5 | بنچمارک | P2 |
| IPUMS International | H1, E1 | **ریزدادهٔ سرشماری ایران** | P1 |
| UN-Habitat Urban Data / UDB | P/N/C | بنچمارک شهری | P2 |
| ITU DataHub | R5 | بنچمارک | P2 |
| GBD / IHME | N3 | بار بیماری | P2 |
| ACLED | S/G (شاهد تنش) | شاهد | P2 |
| DHS / MICS | H, S, N | پیمایش بین‌المللی | P2 |

### ۳٫۸ اینترنت، فناوری و شبکه

| منبع | دسترسی | شاخص هدف | اولویت |
|---|---|---|---|
| Ookla Open Data (Speedtest) | دانلود Parquet/CSV | R5 | **P0** |
| M-Lab NDT | BigQuery/API | R5 (کیفیت) | P1 |
| OpenCelliD | دانلود CSV | R5 (پوشش دکل) | P1 |
| زیرساخت فیبر شهرداری/مخابرات | قرارداد | R5 | P2 |

### ۳٫۹ دارایی فرهنگی، رویداد و جریان‌های رفتاری (بحرانی‌ترین شکاف)

| منبع | دسترسی | شاخص هدف | اولویت | نکته |
|---|---|---|---|---|
| Wikidata / Wikimedia APIs | SPARQL/REST | C1 (دارایی ثبت‌شده) | **P0** | بی‌کلید، نسخه‌دار، قابل ردیابی |
| OSM `historic`/`tourism`/`amenity` | overpass | C1 | P1 | مکمل Wikidata |
| تقویم رویداد شهری/فرهنگ‌سرا | قرارداد | C2, C4, C5 | P1 | تنها منبع واقعی «دارایی فعال» |
| **کارت بلیت حمل‌ونقل عمومی (تجمیعی)** | قرارداد | P5 (استفاده)، جریان رفتاری | P1 | تفکیک‌شده در سطح ایستگاه/محله، تجمیع ≥۱۰ رکورد |
| **تراکنش تجمیعی POS (شاپرک/DCAP)** | قرارداد | R4, E5 | P1 | برای «شدت اتصال اقتصادی» |
| سامانهٔ ۱۳۷ (شکایات) | قرارداد | G2, S4, S5 | **P0** | هم پاسخگویی و هم «اقدام جمعی» |
| دادهٔ تردد/شمارش ترافیک شهرداری | قرارداد | P2, P5 | P2 | — |
| Meta Data for Good / HRSL | قرارداد/دانلود | جمعیت پیکسل‌محور | P2 | مکمل WorldPop |

---

## بخش ۴ — روش فنی افزودن منبع (دستور کار ۶ مرحله‌ای)

### گام ۱ — افزودن شناسهٔ منبع به allow-list
در `src/algorithm/sources.ts` یک رکورد به `SOURCE_REGISTRY` اضافه کنید (id، name، url، access، formats، category). بدون این گام، `validateManifests()` خطا می‌دهد.

### گام ۲ — گره‌زدن به رجیستر شاخص
در `src/algorithm/indicatorSourceRegistry.ts` برای شاخص هدف، منبع جدید را به `alternativeSources` یا `primarySource` اضافه کنید.

### گام ۳ — نوشتن منیفست اعلانی (نمونهٔ واقعی)

```ts
{
  id: 'dynamic-world',
  title: 'Dynamic World V1 — کاربری/پوشش زمین',
  registryId: 'DYNAMIC_WORLD',
  transport: 'gee',                       // یا stac | http-json | s3-parquet
  endpoint: 'GOOGLE/DYNAMICWORLD/V1',
  auth: { scheme: 'none' },
  spatial: 'polygon',
  temporal: { cadence: 'monthly', ttlMs: 30 * 24 * 3600e3, historical: true },
  license: { name: 'CC-BY-4.0', attribution: 'Google / WRI', commercial: true },
  feeds: [
    { variable: 'tree_cover_fraction', indicatorCode: 'N1', unit: '0..1',
      scoring: { best: 0.6, worst: 0.05, weight: 1 } },
    { variable: 'built_fraction', unit: '0..1' },   // شاهد: بدون scoring
  ],
  role: 'score_eligible',
  quality: { minReliability: 4, gates: ['polygon_within_aoi', 'valid_pixel_share>=0.8'], neverZeroFills: true },
  automationClass: 'A_PUBLIC_AUTOMATIC',
  allowedOutput: 'PROVISIONAL_PUBLIC',
  fallbacks: ['esa-worldcover'],
}
```

### گام ۴ — کانکتور و transform
اگر transport موجود پاسخ می‌دهد، فقط `transform` بنویسید. صفات الزامی هر متغیر: `value` عددی یا `null`، `unit`، `observedAt`، `indicatorCode`، و در نبود مقدار **`missingReason` + `nextAction`** (هرگز صفر).

### گام ۵ — تست دروازه‌ها (Definition of Done)
1. `validateManifests()` بدون خطا/هشدار.
2. اجرای واقعی روی یک محلهٔ دارای مرز مصوب (تهران/کرج از `mahalat/`).
3. کنترل QA مخصوص transport: `valid_fraction ≥ 0.8`، پوشش AOI ≥ ۹۹٪، کسر پیکسل پاک ≥ ۱۰٪ (EO).
4. ثبت `provenance` با مجوز/انتساب/زمان/تأخیر/وضعیت کش.
5. بررسی اینکه منبع در `/evidence/assess` با `tier ≠ proxy` و `geographyLevel ∈ {block, neighborhood}` ثبت شده باشد.
6. تست افت شبکه: مدار باید `open` شود و خروجی `data_gap` بدهد، نه صفر.

### گام ۶ — ثبت در رجیسترها
`kernel/registries/source_inventory.json` / `sources_23.json` / `online_83.json` هم‌گام شوند تا رجیسترهای موازی واگرا نشوند (الزام معماری موجود).

---

## بخش ۵ — نقشهٔ راه اولویت‌دار

### فاز ۰ — «تکمیل ۱۰ شاخص طبقهٔ A» (بیشترین بازده، کمترین مانع)
`GTFS شهری` · `Neshan (ژئوکد/isochrone)` · `DEM GLO-30 + JRC Flood + GEM + GSW` · `ارتقای Sentinel-2 از شاهد به امتیاز (N2)` · `WorldPop/GHSL جمعیت بلوکی` · `Wikidata برای C1` · `aqms.doe.ir + air.tehran.ir`
**معیار پذیرش:** ۱۰ شاخص A با `tier ≠ proxy` و `geographyLevel = neighborhood`.

### فاز ۱ — «قرارداد داده برای ۱۳ شاخص طبقهٔ B»
SCI (خرد) · تأمین اجتماعی · اصناف · آموزش‌وپرورش · بهداشت · شهرداری (۱۳۷ + پروانه + پروژه/بودجه)
**معیار پذیرش:** ۱۳ شاخص B با `publicationLevel = VERIFIED_CONTRACT`.

### فاز ۲ — «جریان رفتاری» (بزرگ‌ترین شکاف مفهومی)
کارت بلیت · POS تجمیعی · ۱۳۷ · تقویم رویداد · تردد
**معیار پذیرش:** پر شدن جریان `behavioral` و ارتقای سطح اتکا از «محدود» به «هم‌گرا» (نیازمند ≥۲ جریان مستقل).

### فاز ۳ — «۱۲ شاخص طبقهٔ D»
ترکیب منابع بالا + بازبینی خبره و کالیبراسیون L/U (پیش‌شرط انتشار عدد).

### فاز ۴ — «گسترش به ۴۱۹ شاخص گونه‌بندی»
فعال‌سازی ۸۳ سنجهٔ برخط و ۲۵۱ شاخص بی‌نیاز از کار میدانی از طریق همان الگوی منیفست.

---

## بخش ۶ — ملاحظات حقوقی، امنیتی و کیفیت

| موضوع | قاعده |
|---|---|
| مجوز | هر منیفست باید `license.{name, attribution, commercial}` داشته باشد؛ منابع `NC` فقط با `allowedOutput: REQUIRES_REVIEW` |
| حریم خصوصی | ممنوعیت شناسهٔ شخصی؛ آستانهٔ انتشار ≥۱۰ رکورد در هر سلول؛ تجمیع پیش از ورود |
| دادهٔ ملی در برابر محله | `geographyLevel` باید `block` یا `neighborhood` باشد؛ دادهٔ استانی/ملی فقط `benchmark` |
| پروکسی | مقدار `proxy: true` هرگز به‌تنهایی از دروازهٔ اعتبار عبور نمی‌کند |
| صداقت داده | `missingReason` + `nextAction` اجباری؛ `neverZeroFills: true` |
| نسخه‌بندی | `method.registryVersion` باید دقیقاً برابر نسخهٔ رجیستر باشد |
| شبکهٔ ناپایدار | مدارشکن + کش کهنه (`staleTtlMs`) + برچسب `provider: live/fallback/local` |
| ذخیره‌سازی آرتیفکت‌ها | برای COG/GeoTIFF و کش سنگین، ذخیره‌سازی سازگار S3 با خروجی رایگان مناسب است (برای map tiles و رستر، Cloudflare R2 با S3 API و boto3 برای workerهای Rasterio) |

---

## بخش ۷ — کلیدها و متغیرهای محیطی افزودنی

| منبع | متغیر محیطی | الزامی؟ |
|---|---|---|
| OpenAQ | `OPENAQ_API_KEY` | ✅ برای N3 ایستگاهی |
| Healthsites | `HEALTHSITES_API_KEY` | ✅ |
| NASA FIRMS | `FIRMS_MAP_KEY` | اختیاری (پنجرهٔ bbox) |
| AQICN/WAQI | `WAQI_TOKEN` | اختیاری |
| Neshan | `NESHAN_API_KEY` | ✅ برای ژئوکد/مسیریابی فارسی |
| M-Lab | `MLAB_BQ_PROJECT` | اختیاری |
| ذخیره‌سازی COG | `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET` | اختیاری (فعلاً محلی) |
| GEE | `GEE_SERVICE_ACCOUNT_JSON` | اختیاری (transport `gee`) |
| هوش مصنوعی (حکیم/بازبینی) | `ARA_ANTHROPIC_API_KEY`, `GEMINI_API_KEY` | اختیاری |

---

## بخش ۸ — جمع‌بندی: فهرست کوتاه «آنچه باید افزوده شود»

**پایهٔ مکانی/شهری (P0):** GTFS شهری · Neshan · Valhalla/GraphHopper · Overture/MS Buildings · GHSL · WorldPop · DEM GLO-30 · JRC Flood · GEM · JRC GSW
**ماهواره‌ای (P0–P1):** ارتقای Sentinel-2 به امتیاز · Dynamic World · ESA WorldCover · Sentinel-1 · Landsat/HLS · CHIRPS · ERA5-Land
**کیفیت هوا (P0):** aqms.doe.ir · air.tehran.ir (+ موجود: Open-Meteo/OpenAQ)
**قراردادی ایران (P0):** SCI (خرد) · تأمین اجتماعی · اصناف · آموزش‌وپرورش · بهداشت · شهرداری (۱۳۷/پروانه/پروژه/بودجه)
**فرهنگی (P0–P1):** Wikidata · تقویم رویداد · فرهنگ‌سراها
**رفتاری (P1):** کارت بلیت · POS تجمیعی · ۱۳۷ · تردد
**اینترنت (P0–P1):** Ookla · M-Lab · OpenCelliD · CRA
**بنچمارک (P2):** UN-Habitat · ITU · JMP · UIS · IPUMS · GBD · ACLED

> **یک جمله:** با افزودن **۱۰ منبع P0** (GTFS، Neshan، چهار منبع EO مخاطره/ارتفاع، WorldPop/GHSL، Wikidata، و دو منبع رسمی هوا) می‌توان ۱۰ شاخص طبقهٔ A را از «پروکسی/شاهد» به «امتیاز معتبر» رساند؛ و برای عبور کامل از دروازهٔ ۸۰٪، **قرارداد دادهٔ ۶ نهاد ایرانی** (آمار، تأمین اجتماعی، اصناف، آموزش، بهداشت، شهرداری) اجتناب‌ناپذیر است — این تنها مسیری است که `tier ≠ proxy` و `geographyLevel = neighborhood` را هم‌زمان برآورده می‌کند.
