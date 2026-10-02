import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = fs.readdirSync(root).map((name) => path.join(root, name)).find((candidate) => candidate.endsWith('رجیستر_164.csv'));
if (!sourcePath) throw new Error('The 164-indicator registry CSV was not found.');

const outputDirectory = path.join(root, 'docs', 'decision-support');
const outputPath = path.join(outputDirectory, 'indicator-automation-plan-164.csv');
const summaryPath = path.join(outputDirectory, 'indicator-automation-plan-164.summary.json');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift();
  return rows.filter((candidate) => candidate.some(Boolean)).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function csvValue(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

const SOURCE_URLS = {
  sci: 'https://www.amar.org.ir/',
  osm: 'https://download.geofabrik.de/asia/iran.html',
  overpass: 'https://overpass-api.de/',
  worldpop: 'https://hub.worldpop.org/',
  ghsl: 'https://human-settlement.emergency.copernicus.eu/',
  cdse: 'https://dataspace.copernicus.eu/',
  earthSearch: 'https://earth-search.aws.element84.com/v1',
  cams: 'https://ads.atmosphere.copernicus.eu/',
  openaq: 'https://openaq.org/',
  jrcWater: 'https://global-surface-water.appspot.com/',
  era5: 'https://cds.climate.copernicus.eu/',
  chirps: 'https://www.chc.ucsb.edu/data/chirps',
  nasaFirms: 'https://firms.modaps.eosdis.nasa.gov/',
  viirs: 'https://eogdata.mines.edu/products/vnl/',
  wikidata: 'https://query.wikidata.org/',
  mlab: 'https://www.measurementlab.net/data/',
  ookla: 'https://github.com/teamookla/ookla-open-data',
  opencellid: 'https://opencellid.org/',
};

const COMMON = {
  publicQa: 'مرز محله تأییدشده؛ پوشش مکانی و زمانی ثبت‌شده؛ checksum و license؛ کنترل واحد/دامنه؛ عدم تبدیل missing به صفر؛ مقایسه با حداقل یک منبع مستقل.',
  restrictedQa: 'قرارداد تبادل داده و مبنای قانونی؛ حذف شناسه شخصی؛ کنترل جمع صورت/مخرج؛ تطبیق با آمار منتشره؛ نسخه، زمان مرجع، پوشش و evidence_id.',
  satelliteQa: 'Sentinel-2 L2A؛ ماسک SCL/ابر و سایه؛ پوشش AOI حداقل ۹۹٪؛ هم‌مرجعی باندها؛ valid-pixel کافی؛ ترکیب فصلی هم‌سن؛ کنترل ناهنجاری زمانی و provenance کامل COG/STAC.',
  derivedQa: 'فقط ورودی validated؛ formula_version و registry_version ثابت؛ پوشش وزنی گزارش شود؛ missing بازنرمال‌سازی پنهان نشود؛ آزمون مرجع و تحلیل حساسیت.',
  hybridQa: 'مولفه‌های عینی، مکانی، رفتاری و ادراکی جدا بمانند؛ حداقل پوشش مصوب؛ تعارض شواهد و عدم‌قطعیت نمایش داده شود؛ تأیید بازبین برای خروجی رسمی.',
  surveyQa: 'جانشین‌سازی با POI، مدل زبانی یا تصویر ماهواره‌ای ممنوع؛ فقط ابزار استاندارد، نمونه‌گیری، وزن‌دهی، ناشناس‌سازی و آزمون پایایی/روایی.',
};

const corePlans = {
  'M-CORE-H1': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'ریز‌داده/جداول بلوکی سرشماری مرکز آمار؛ در نبود دسترسی فقط برآورد کوچک‌ناحیه‌ای برچسب‌دار با WorldPop/GHSL', 'صورت و مخرج جمعیت ۲۵+ در بلوک‌ها؛ spatial join به مرز محله؛ محاسبه دقیق درصد و تفکیک جنس/سن.', COMMON.restrictedQa, 'P1'],
  'M-CORE-H2': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'ثبت دوره و گواهینامه سازمان فنی‌وحرفه‌ای، دانشگاه علمی‌کاربردی و مراکز مجاز؛ جمعیت سن کار SCI', 'Deduplicate افراد/گواهینامه‌ها؛ تعریف نسخه‌دار مهارت قابل عرضه؛ نسبت به جمعیت سن کار در همان سال.', COMMON.restrictedQa, 'P2'],
  'M-CORE-H3': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'تأمین اجتماعی/بیمه، وزارت کار و طرح نیروی کار؛ جمعیت فعال SCI', 'شاغل بیمه‌شده یا دارای تداوم مصوب در صورت؛ جمعیت فعال هم‌سال در مخرج؛ کنترل اشتغال چندگانه.', COMMON.restrictedQa, 'P2'],
  'M-CORE-H4': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'پیوند امن سوابق مهارت فنی‌وحرفه‌ای با طبقه‌بندی شغلی وزارت کار/تأمین اجتماعی؛ در فقدان پیوند، داده مفقود', 'نگاشت ISCO/طبقه‌بندی ملی شغل به taxonomy مهارت؛ محاسبه فقط پس از تأیید ماتریس انطباق و پوشش پیوند.', COMMON.hybridQa, 'P3'],
  'M-CORE-H5': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'ثبت‌نام و اتمام دوره مراکز آموزشی، فنی‌وحرفه‌ای و سامانه‌های آموزش عمومی؛ جمعیت ۱۵+ SCI', 'افراد یکتا با مشارکت معتبر در پنجره ۱۲ماهه تقسیم بر جمعیت ۱۵+؛ دوره‌های تکراری فقط یک‌بار.', COMMON.restrictedQa, 'P2'],
  'M-CORE-S1': ['E_SURVEY_OR_FIELD', 'SURVEY_ONLY', 'پیمایش استاندارد محله', 'اجرای عین فرمول لیکرت رجیستر؛ داده آنلاین نمی‌تواند اعتماد همسایگی را اندازه‌گیری معتبر کند.', COMMON.surveyQa, 'P3'],
  'M-CORE-S2': ['E_SURVEY_OR_FIELD', 'SURVEY_ONLY', 'پیمایش استاندارد محله', 'اجرای عین فرمول لیکرت رجیستر؛ شاخص‌های جابه‌جایی یا ماندگاری فقط شاهد مکمل‌اند.', COMMON.surveyQa, 'P3'],
  'M-CORE-S3': ['E_SURVEY_OR_FIELD', 'SURVEY_ONLY', 'پیمایش شبکه همکاری ساکنان', 'نسبت پاسخگویان دارای همکاری متقابل؛ تراکم NGO/مسجد/رویداد جانشین این سازه نیست.', COMMON.surveyQa, 'P3'],
  'M-CORE-S4': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'ثبت مشارکت پروژه‌ها، صورت‌جلسات، سامانه داوطلبی و شکایات/پیشنهادها؛ پیمایش برای مشارکت غیررسمی', 'افراد یکتای مشارکت‌کننده در حل مسئله بر جمعیت واجد؛ NLP فقط استخراج نام رویداد/مدرک، نه ساخت مقدار.', COMMON.hybridQa, 'P2'],
  'M-CORE-S5': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'پرونده پروژه و مسئله، سامانه ۱۳۷/۱۸۸۸ و دفتر تسهیل‌گری', 'تعریف مسئله یکتا، وضعیت حل و نقش مشارکتی؛ مسائل لغوشده یا ادغام‌شده جدا ثبت شوند.', COMMON.restrictedQa, 'P1'],
  'M-CORE-E1': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'هزینه‌درآمد خانوار/سرشماری SCI و داده مالی تجمیعی مجاز؛ مدل کوچک‌ناحیه‌ای فقط با کالیبراسیون', 'درآمد معادل با مقیاس OECD یا مقیاس مصوب؛ میانه وزنی محله تقسیم بر میانه هم‌سال شهر.', COMMON.restrictedQa, 'P2'],
  'M-CORE-E2': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'شناسه صنفی/مجوز کسب، مالیات تجمیعی، بیمه کارگاه و GIS؛ OSM فقط کنترل پوشش', 'شغل فعال یکتا در AOI تقسیم بر جمعیت فعال ×۱۰۰۰؛ محل دفتر صوری و واحد غیرفعال حذف شود.', COMMON.restrictedQa, 'P1'],
  'M-CORE-E3': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'تاریخ شروع/پایان مجوز اصناف، مالیات و بیمه کارگاه', 'کسب‌وکار فعال با عمر بیش از ۳۶ ماه تقسیم بر کل فعال؛ cohort و تغییر شناسه حقوقی مدیریت شود.', COMMON.restrictedQa, 'P2'],
  'M-CORE-E4': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'هزینه‌درآمد خانوار SCI + داده معاملات/اجاره رسمی یا feed دارای مجوز؛ استخراج آگهی فقط با مجوز و شرایط استفاده', 'میانه اجاره و هزینه مسکن مدل هدانیک محله تقسیم بر درآمد قابل تصرف هم‌سال؛ بازه اطمینان گزارش شود.', COMMON.hybridQa, 'P2'],
  'M-CORE-E5': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'حساب محلی، تراکنش/خرید بنگاه تجمیعی، مالیات و اشتغال؛ داده بنگاه با محرمانگی', 'ارزش افزوده/اشتغال باقی‌مانده در AOI نسبت به کل ارزش ایجادشده؛ تعریف زنجیره ارزش و نشتی اقتصادی تصویب شود.', COMMON.hybridQa, 'P3'],
  'M-CORE-P1': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'پایگاه ساختمان/پلاک و سال ساخت شهرداری، سرشماری مسکن؛ Sentinel-1/2 و footprint فقط شاهد مکمل', 'طبقه‌بندی پایداری طبق آیین‌نامه مصوب؛ مساحت یا تعداد بنای ناپایدار بر کل؛ confidence مدل تصویری جدا.', COMMON.restrictedQa, 'P2'],
  'M-CORE-P2': ['A_PUBLIC_AUTOMATIC', 'PROVISIONAL_PUBLIC', `OSM PBF محلی ایران، شبکه رسمی معابر و محدودیت عبور؛ ${SOURCE_URLS.osm}`, 'ساخت گراف جهت‌دار؛ snap و پاک‌سازی؛ طول اجزای متصل به شبکه اصلی تقسیم بر کل طول قابل عبور؛ جزایر و cul-de-sac طبق تعریف نسخه‌دار.', COMMON.publicQa, 'P0'],
  'M-CORE-P3': ['E_SURVEY_OR_FIELD', 'FIELD_AUDIT_ONLY', 'ممیزی مشاهده‌ای استاندارد؛ تصویر خیابانی دارای مجوز فقط برای پیش‌غربالگری', 'چک‌لیست ۰–۲ با نمونه‌گیری نقاط؛ مدل بینایی رایانه‌ای نمی‌تواند امنیت، نگهداری و قابلیت استفاده را بدون پروتکل جایگزین کند.', COMMON.surveyQa, 'P3'],
  'M-CORE-P4': ['A_PUBLIC_AUTOMATIC', 'PROVISIONAL_PUBLIC', `OSM/Overture و ثبت رسمی خدمات + OSM PBF؛ WorldPop/GHSL برای توزیع جمعیت؛ ${SOURCE_URLS.osm}; ${SOURCE_URLS.worldpop}; ${SOURCE_URLS.ghsl}`, 'مبدأهای جمعیت بلوکی/شبکه‌ای؛ shortest-path پیاده تا خدمت فعال؛ جمعیت در آستانه مصوب تقسیم بر کل؛ ظرفیت خدمت جداگانه.', COMMON.publicQa, 'P0'],
  'M-CORE-P5': ['A_PUBLIC_AUTOMATIC', 'PROVISIONAL_PUBLIC', 'GTFS/برنامه رسمی حمل‌ونقل، OSM مسیر/ایستگاه، شبکه پیاده و جمعیت بلوکی؛ بدون برنامه فعال مقدار verified صادر نشود', 'پوشش پیاده تا ایستگاه + فراوانی/ساعات سرویس + دسترس‌پذیری؛ جمعیت‌وزن‌دار و تفکیک زمان اوج/غیراوج.', COMMON.publicQa, 'P1'],
  'M-CORE-N1': ['A_PUBLIC_AUTOMATIC', 'PROVISIONAL_PUBLIC', `پارک و فضای سبز عمومی رسمی/OSM، شبکه پیاده و WorldPop/GHSL؛ ${SOURCE_URLS.osm}; ${SOURCE_URLS.worldpop}`, 'فضای سبز عمومی قابل ورود و فعال؛ زمان شبکه‌ای پیاده تا ورودی؛ پوشش جمعیت در آستانه مصوب.', COMMON.publicQa, 'P0'],
  'M-CORE-N2': ['A_PUBLIC_AUTOMATIC', 'VERIFIED_OPEN_EO', `Sentinel-2 L2A از CDSE/Earth Search، ESA WorldCover/Dynamic World؛ ${SOURCE_URLS.cdse}; ${SOURCE_URLS.earthSearch}`, 'ترکیب فصلی cloud-free؛ NDVI=(B8−B4)/(B8+B4)؛ حذف آب با MNDWI و سطح مصنوعی با NDBI؛ مساحت کلاس سبز معتبر/مساحت خشکی ×۱۰۰.', COMMON.satelliteQa, 'P0'],
  'M-CORE-N3': ['A_PUBLIC_AUTOMATIC', 'PROVISIONAL_PUBLIC', `ایستگاه رسمی محیط‌زیست/OpenAQ + CAMS؛ Sentinel-5P فقط شاهد NO2 و نه PM2.5؛ ${SOURCE_URLS.openaq}; ${SOURCE_URLS.cams}`, 'همجوشی ایستگاه و مدل با cross-validation؛ PM2.5 سالانه جمعیت‌وزن‌دار؛ تبدیل معکوس با حدود مصوب، نه ۱۰۰−PM2.5 خام.', 'حداقل تعداد روز معتبر؛ بایاس ایستگاه/مدل؛ رزولوشن مکانی؛ عدم ادعای محله‌ای برای داده بسیار درشت؛ provenance و uncertainty.', 'P1'],
  'M-CORE-N4': ['A_PUBLIC_AUTOMATIC', 'PROVISIONAL_PUBLIC', `پهنه سیل/زلزله/رانش/حریق رسمی + Copernicus DEM، JRC water و NASA FIRMS؛ جمعیت WorldPop/GHSL؛ ${SOURCE_URLS.jrcWater}; ${SOURCE_URLS.nasaFirms}`, 'تقاطع جمعیت/ساختمان با hazard layers سناریو و دوره بازگشت مشخص؛ مواجهه هر خطر جدا و ترکیب فقط با وزن مصوب.', COMMON.publicQa, 'P1'],
  'M-CORE-N5': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', `ERA5-Land، CHIRPS/GPM، LST Landsat/MODIS، JRC GSW و داده ظرفیت پاسخ مدیریت بحران؛ ${SOURCE_URLS.era5}; ${SOURCE_URLS.chirps}; ${SOURCE_URLS.jrcWater}`, 'زیرشاخص گرما، آب‌گرفتگی، خشکسالی و ظرفیت پاسخ جداگانه؛ استانداردسازی اقلیمی ۱۰+ ساله؛ تابع ترکیب نسخه‌دار.', COMMON.hybridQa, 'P2'],
  'M-CORE-C1': ['A_PUBLIC_AUTOMATIC', 'PROVISIONAL_PUBLIC', `ثبت رسمی میراث/فرهنگ + Wikidata/OSM؛ ${SOURCE_URLS.wikidata}; ${SOURCE_URLS.osm}`, 'Deduplicate مکان‌ها؛ وضعیت ثبت و فعالیت جدا؛ تعداد دارایی فعال/ثبت‌شده بر جمعیت ×۱۰۰۰.', COMMON.publicQa, 'P1'],
  'M-CORE-C2': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'تقویم رسمی رویداد، بلیت/ثبت‌نام، برنامه مراکز، وب‌سایت و شبکه اجتماعی رسمی با مجوز', 'NLP برای استخراج تاریخ/مکان/برنامه؛ دارایی با فعالیت معتبر در پنجره زمانی تقسیم بر کل؛ بازبینی نمونه‌ای انسانی.', COMMON.hybridQa, 'P2'],
  'M-CORE-C3': ['E_SURVEY_OR_FIELD', 'SURVEY_ONLY', 'پیمایش هویت محله‌ای', 'میانگین لیکرت طبق رجیستر؛ نام تاریخی یا تراکم میراث جانشین احساس هویت نیست.', COMMON.surveyQa, 'P3'],
  'M-CORE-C4': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'ثبت‌نام/بلیت و حضور فعالیت‌های فرهنگی + جمعیت واجد SCI', 'شرکت‌کننده یکتا در پنجره زمانی تقسیم بر جمعیت واجد؛ بازدید آنلاین و حضوری جدا.', COMMON.restrictedQa, 'P2'],
  'M-CORE-C5': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'ثبت برنامه‌های محلی با سن شرکت‌کننده، مدارس/کانون‌ها و آرشیو روایت؛ پیمایش در صورت فقدان ثبت', 'جوانان یکتای مشارکت‌کننده تقسیم بر جوانان واجد؛ کیفیت و نقش مشارکت با rubric و نمونه‌بینی.', COMMON.hybridQa, 'P3'],
  'M-CORE-G1': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'صورت‌جلسه، سامانه مشورت عمومی، رأی/نظر ثبت‌شده و فهرست ذی‌نفعان', 'NLP فقط استخراج مدرک؛ فرایند «مشارکت واقعی» با قواعد حق رأی/اثر بر تصمیم و بازبینی انسانی.', COMMON.hybridQa, 'P2'],
  'M-CORE-G2': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'سامانه ۱۳۷/۱۸۸۸، CRM شهرداری و SLA خدمت', 'درخواست واجد یکتا؛ حل قطعی در SLA تقسیم بر کل واجد؛ reopen و duplicate مدیریت شود.', COMMON.restrictedQa, 'P1'],
  'M-CORE-G3': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'توافق‌نامه‌ها، پروژه‌های مشترک، صورت‌جلسه و گردش‌کار بین‌سازمانی', 'گراف سازمانی با تراکم/مرکزیت/تداوم همکاری؛ لبه فقط با مدرک عملی؛ وزن و تفسیر با تصویب متخصص.', COMMON.hybridQa, 'P3'],
  'M-CORE-G4': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'سامانه کنترل پروژه، بودجه و قراردادها', 'پروژه تکمیل‌شده هم‌زمان و هم‌بودجه تقسیم بر مصوب واجد؛ تغییر دامنه و تعلیق جدا.', COMMON.restrictedQa, 'P1'],
  'M-CORE-G5': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'گزارش ارزیابی، مصوبه اصلاحی، lesson learned و نسخه پروژه', 'پیوند صریح ارزیابی قبلی به تصمیم/طراحی جدید؛ NLP پیشنهاد پیوند می‌دهد و بازبین تأیید می‌کند.', COMMON.hybridQa, 'P2'],
  'M-CORE-R1': ['A_PUBLIC_AUTOMATIC', 'PROVISIONAL_PUBLIC', `OSM PBF/شبکه رسمی، مراکز اصلی و در صورت دسترسی GTFS؛ ${SOURCE_URLS.osm}`, 'زمان سفر شبکه‌ای چندحالته از سلول‌های جمعیت؛ میانه جمعیت‌وزن‌دار؛ ساعت و mode ثابت.', COMMON.publicQa, 'P0'],
  'M-CORE-R2': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'ثبت فرصت شغلی وزارت کار/کاریابی و feed مجاز آگهی‌ها + شبکه سفر', 'فرصت فعال deduplicate شده در isochrone زمانی برای هر مبدأ؛ وزن مهارت/ظرفیت؛ داده آگهی بدون مجوز ممنوع.', COMMON.hybridQa, 'P2'],
  'M-CORE-R3': ['A_PUBLIC_AUTOMATIC', 'PROVISIONAL_PUBLIC', `ثبت رسمی مراکز آموزش/دانش + OSM و شبکه سفر؛ ${SOURCE_URLS.osm}`, 'مرکز فعال و متناسب با سطح؛ زمان شبکه‌ای از جمعیت؛ میانه و پوشش آستانه‌ای هم‌زمان گزارش شود.', COMMON.publicQa, 'P0'],
  'M-CORE-R4': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'تراکنش و زنجیره تأمین تجمیعی بنگاه، مالیات/فاکتور و همکاری قراردادی', 'تعامل اقتصادی بیرون‌محله‌ای تقسیم بر کل تعامل؛ محرمانگی، حداقل n و حذف مقادیر قابل شناسایی.', COMMON.restrictedQa, 'P3'],
  'M-CORE-R5': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', `رگولاتوری/اپراتور + Ookla Open Data، M-Lab و OpenCellID؛ ${SOURCE_URLS.ookla}; ${SOURCE_URLS.mlab}; ${SOURCE_URLS.opencellid}`, 'پوشش، سرعت، latency و پایداری مکانی؛ «استفاده مؤثر» فقط از داده اپراتوری تجمیعی یا پیمایش و نباید از پوشش استنباط شود.', COMMON.hybridQa, 'P2'],
};

const familyPlans = {
  'پیمایش ادراکی ۱۵‌گویه': ['E_SURVEY_OR_FIELD', 'SURVEY_ONLY', 'پیمایش ادراکی استاندارد ۱۵‌گویه', 'محاسبه عین فرمول رجیستر؛ داده عینی فقط برای مقایسه ادراک-واقعیت نگهداری شود.', COMMON.surveyQa, 'P3'],
  'امتیازهای سرمایه': ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'MeasurementRecordهای معتبر شاخص‌های همان سرمایه و وزن‌های نسخه‌دار', 'میانگین وزنی بدون جایگزینی missing؛ score، coverage، confidence و contribution هر شاخص جدا.', COMMON.derivedQa, 'P0'],
  'زنجیره C-A-U-E-O': ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'شاخص‌های معتبر نگاشت‌شده به مرحله و سلول سرمایه×مکان×گروه×زمان', 'میانگین وزنی هر سلول؛ مرحله بدون داده null بماند؛ پوشش مرحله گزارش شود.', COMMON.derivedQa, 'P0'],
  'باند مدیریتی': ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'Q/T/R معتبر و thresholds نسخه‌دار', 'طبقه‌بندی قطعی؛ در confidence پایین برچسب provisional.', COMMON.derivedQa, 'P0'],
  'تیپ‌شناسی K–T–R': ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'K/T/R معتبر و قواعد تصمیم نسخه‌گذاری‌شده', 'Rule engine قابل بازپخش؛ stability با Monte Carlo/حساسیت.', COMMON.derivedQa, 'P1'],
  'شکاف تبدیل': ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'سلول‌های معتبر C/A/U/E/O', 'تفاضل فقط برای دو مرحله موجود؛ confidence شکاف تابع حداقل confidence دو طرف.', COMMON.derivedQa, 'P0'],
  'گلوگاه': ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'شکاف‌ها، سلول‌ها و ابعاد نشانی مسئله', 'argmax/min با tie handling؛ نشانی ناقص مانع حکم قطعی شود.', COMMON.derivedQa, 'P0'],
  'عدالت': ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'مقادیر تفکیک‌شده گروهی/بلوک و پوشش هر گروه', 'بهترین−بدترین با حداقل حجم/پوشش؛ suppression برای گروه کوچک؛ نقشه شکاف مکانی.', COMMON.derivedQa, 'P1'],
  'روند': ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'سری زمانی هم‌تعریف و هم‌مرز با حداقل تعداد نقاط', 'Theil-Sen/رگرسیون مقاوم؛ شکست روش/مرز به‌عنوان discontinuity؛ بازه اطمینان.', COMMON.derivedQa, 'P1'],
  'کفایت شواهد': ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'Evidence registry، الزامات هر شاخص، استقلال منبع و وضعیت QA', 'پوشش عینی/GIS/رفتاری/ادراکی، همگرایی، تعارض و کفایت؛ مجوز محاسبه از gate.', COMMON.derivedQa, 'P0'],
  'اصطکاک‌های تبدیل': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'شواهد عینی، مکانی، رفتاری و ادراکی مستقل برای هر friction', 'مولفه‌ها جدا؛ تابع H فقط پس از حداقل پوشش و کالیبراسیون؛ LLM صرفاً توضیح و بازیابی سند.', COMMON.hybridQa, 'P2'],
  'فرضیه علّی': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'دفتر فرضیه، DAG، شواهد مستقل و طراحی ارزیابی', 'ثبت فرضیه‌های رقیب؛ سه‌سوسازی؛ ارتقا از initial به convergent/tested فقط با قواعد شواهد.', COMMON.hybridQa, 'P2'],
  'اولویت': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'شکاف/ریسک، جمعیت متاثر، ماتریس اثر، آمادگی اجرا و عدالت', 'هر مولفه با provenance؛ ضرب هندسی با کف/epsilon مصوب؛ عدم صفرشدن مصنوعی؛ تحلیل حساسیت.', COMMON.hybridQa, 'P2'],
  'سبد مداخله': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'impact matrix نسخه‌دار، causal graph، پوشش گروه هدف و وابستگی اقدامات', 'محاسبه breadth/reach قطعی؛ complementarity نیازمند مدل علّی و تصویب بازبین.', COMMON.hybridQa, 'P2'],
  'آمادگی اجرا': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'شناسنامه اقدام، بودجه، مسئول، مجوز، زمان و همکاران', 'ممیزی فیلدهای اجباری و مدارک؛ نسبت کامل‌شده/موردنیاز؛ مدرک منقضی نامعتبر.', COMMON.restrictedQa, 'P1'],
  'فیلتر عدم‌آسیب': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'impact assessment پیشینی/پسینی و safeguard registry', 'تعداد سرمایه آسیب‌دیده و breach بحرانی؛ rule engine و تأیید انسانی برای رد.', COMMON.hybridQa, 'P2'],
  'حفاظت': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'اجاره/قیمت/تصرف، ثبت خانوار هدف و فشار بازار با دسترسی قانونی', 'مدل displacement/affordability با خط پایه و گروه مقایسه؛ بازه عدم‌قطعیت و کنترل محرمانگی.', COMMON.hybridQa, 'P2'],
  'شناسنامه اقدام': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'پیوند مسئله→فرضیه→اقدام→مالک→بودجه→خروجی→پیامد', 'ممیزی trace fields و شناسه‌های خارجی؛ عدم انتشار اقدام بدون traceability کافی.', COMMON.restrictedQa, 'P1'],
  'ارزیابی مداخله': ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'baseline، کنترل پروژه، خروجی، پیامد، گروه مقایسه و رخدادهای ناخواسته', 'پیش/پس و DiD در صورت امکان؛ fidelity، maintenance و stop rules؛ تصمیم نهایی نیازمند کمیته.', COMMON.restrictedQa, 'P2'],
  'قابلیت‌های S-I-F-A-M-G': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'audit log، تصمیم‌ها، بازخوردها، adaptations و memory registry', 'بخش‌های قابل شمارش خودکار؛ rubricهای تفسیری با دو ارزیاب و توافق بین‌ارزیاب.', COMMON.hybridQa, 'P3'],
  'یادگیری به تفکیک سرمایه': ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'S/I/F/A/M/G معتبر برای هر سرمایه', 'تابع H نسخه‌دار و gate؛ پوشش هر مولفه؛ بدون داده کافی null.', COMMON.derivedQa, 'P3'],
  'پویایی': ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'سری زمانی adaptation، تغییر زمینه، مسائل جدید/حل‌شده و Q/T/R', 'نرخ‌ها در واحد زمان ثابت؛ Vc=0 به‌صورت حالت ویژه؛ robust slope و rule response نسخه‌دار.', COMMON.derivedQa, 'P3'],
  'شاخص حفاظتی': ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'پنل خانوار/ثبت سکونت، مشاهده رفتاری مجاز و اجزای IRI', 'SI و IRI با داده محرمانه تجمیعی؛ GI از تصویر ماهواره‌ای/تشخیص جنسیت چهره استخراج نشود و فقط پروتکل رفتاری اخلاقی مجاز است.', COMMON.hybridQa, 'P3'],
};

function currentGap(row) {
  if (row['خانواده'] === 'پیمایش ادراکی ۱۵‌گویه') return 'فرم پیمایش وجود دارد اما داده ادراکی نباید با proxy عینی پر شود.';
  if (row['کد یکتا'].startsWith('M-CORE-')) return 'صفحه فعلی کد کوتاه ۴۰ شاخص را می‌پذیرد، اما connector فعلی بسیاری از مقادیر را از POI/متغیر ملی با ضرایب ابتکاری می‌سازد و فرمول رجیستر را اجرا نمی‌کند.';
  if (row['خانواده'] === 'امتیازهای سرمایه') return 'محاسبه میانگین ساده موجود است؛ وزن نسخه‌دار، coverage و uncertainty در تصمیم‌یار اعمال نمی‌شود.';
  if (row['خانواده'] === 'زنجیره C-A-U-E-O') return 'محاسبه مرحله‌ای موجود است، اما سلول پنج‌بعدی، پوشش و missingness کامل نیست.';
  if (['باند مدیریتی', 'شکاف تبدیل', 'گلوگاه'].includes(row['خانواده'])) return 'منطق پایه موجود است؛ gate شواهد، uncertainty و آدرس پنج‌بعدی معتبر باید افزوده شود.';
  if (row['خانواده'] === 'کفایت شواهد') return 'Evidence registry غنی در موتور گونه‌شناسی وجود دارد، ولی تصمیم‌یار هنوز از Record<string,number> استفاده می‌کند.';
  if (row['خانواده'] === 'اصطکاک‌های تبدیل' || row['خانواده'] === 'فرضیه علّی') return 'تشخیص فعلی heuristic است و چهار جریان شواهد در سرویس عملاً تفکیک و امتیازدهی نشده‌اند.';
  if (['اولویت', 'سبد مداخله', 'آمادگی اجرا', 'فیلتر عدم‌آسیب', 'حفاظت', 'شناسنامه اقدام'].includes(row['خانواده'])) return 'خروجی پیشنهادی وجود دارد، اما ورودی‌های واقعی مالک/هزینه/عدالت/آسیب و workflow تصویب کامل نیست.';
  if (row['موتور'] === 'یادگیری') return 'اجزای UI/حافظه اولیه وجود دارد؛ چرخه مداخله، baseline نسخه‌دار و ارزیابی اثر پایدار هنوز یکپارچه نیست.';
  return 'نیازمند اتصال به Evidence Registry و اجرای فرمول نسخه‌دار است.';
}

function rowPlan(row) {
  const explicit = corePlans[row['کد یکتا']];
  const base = explicit ?? familyPlans[row['خانواده']];
  if (!base) {
    return ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', row['روش/منبع'], row['فرمول/منطق'], COMMON.hybridQa, 'P3'];
  }
  if (row['کد یکتا'] === 'M-Q') return ['C_DERIVED_DETERMINISTIC', 'COMPUTE_AFTER_UPSTREAM_QA', 'A/U/E/O معتبر و وزن‌های مصوب', 'Q=weighted_mean(A,U,E,O) همراه coverage/confidence.', COMMON.derivedQa, 'P0'];
  if (row['کد یکتا'] === 'M-T' || row['کد یکتا'] === 'M-R') return ['D_HYBRID_REVIEW', 'PROVISIONAL_THEN_REVIEW', 'مولفه‌های رجیستر و تابع H کالیبره‌شده', 'تا تصویب و کالیبراسیون تابع H، خروجی exploratory؛ پس از آن محاسبه قطعی نسخه‌دار.', COMMON.hybridQa, 'P2'];
  if (row['کد یکتا'] === 'P-POPULATION') return ['A_PUBLIC_AUTOMATIC', 'PROVISIONAL_PUBLIC', `WorldPop/GHSL یا جمعیت بلوکی SCI + هندسه محدوده اثر؛ ${SOURCE_URLS.worldpop}; ${SOURCE_URLS.ghsl}`, 'تقاطع جمعیت با محدوده متاثر؛ count و درصد واجد؛ dasymetric allocation فقط با برچسب روش.', COMMON.publicQa, 'P1'];
  if (row['کد یکتا'] === 'P-TARGET-REACH') return ['B_RESTRICTED_AUTOMATIC', 'VERIFIED_AFTER_CONTRACT', 'ثبت خدمت و فهرست واجدان + GIS', 'افراد/خانوار یکتای دریافت‌کننده بر واجدان؛ suppression و کنترل double counting.', COMMON.restrictedQa, 'P2'];
  if (row['کد یکتا'] === 'L-GI') return ['E_SURVEY_OR_FIELD', 'BEHAVIORAL_OBSERVATION_ONLY', 'شمارش رفتاری نمونه‌ای با پروتکل اخلاقی و ناشناس؛ داده ماهواره‌ای یا تشخیص جنسیت چهره ممنوع', 'نسبت حضور ثبت‌شده در چند زمان/فصل؛ جنسیت ادراک‌شده محدودیت جدی دارد و باید روش تصویب شود.', COMMON.surveyQa, 'P3'];
  if (row['کد یکتا'] === 'L-DECISION') return ['D_HYBRID_REVIEW', 'HUMAN_DECISION_REQUIRED', 'اثر، عدالت، آسیب و امکان اجرا + صورت‌جلسه کمیته', 'Rule engine گزینه پیشنهادی می‌دهد؛ تصمیم نهایی و دلیل توسط مرجع مجاز ثبت می‌شود.', COMMON.hybridQa, 'P3'];
  return base;
}

const registry = parseCsv(fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, ''));
if (registry.length !== 164) throw new Error(`Expected 164 registry rows, found ${registry.length}.`);

const outputHeaders = [
  'کد یکتا', 'موتور', 'خانواده', 'نام شاخص', 'فرمول/منطق رجیستر', 'روش/منبع رجیستر', 'تناوب رجیستر', 'سطح مکانی رجیستر',
  'کلاس اتوماسیون', 'سطح خروجی مجاز', 'منابع پیشنهادی عملیاتی', 'روش پیاده‌سازی پیشنهادی', 'کنترل کیفیت و شرط پذیرش',
  'شکاف فعلی برنامه', 'فاز پیشنهادی', 'قابل استفاده بدون پیمایش حضوری',
];

const outputRows = registry.map((row) => {
  const [automationClass, allowedOutput, sources, method, qa, phase] = rowPlan(row);
  const nonSurvey = automationClass === 'E_SURVEY_OR_FIELD' ? 'خیر' : automationClass === 'D_HYBRID_REVIEW' ? 'جزئی/مشروط' : 'بله';
  return {
    'کد یکتا': row['کد یکتا'],
    موتور: row['موتور'],
    خانواده: row['خانواده'],
    'نام شاخص': row['نام شاخص'],
    'فرمول/منطق رجیستر': row['فرمول/منطق'],
    'روش/منبع رجیستر': row['روش/منبع'],
    'تناوب رجیستر': row['تناوب'],
    'سطح مکانی رجیستر': row['سطح مکانی'],
    'کلاس اتوماسیون': automationClass,
    'سطح خروجی مجاز': allowedOutput,
    'منابع پیشنهادی عملیاتی': sources,
    'روش پیاده‌سازی پیشنهادی': method,
    'کنترل کیفیت و شرط پذیرش': qa,
    'شکاف فعلی برنامه': currentGap(row),
    'فاز پیشنهادی': phase,
    'قابل استفاده بدون پیمایش حضوری': nonSurvey,
  };
});

const csv = [outputHeaders.join(','), ...outputRows.map((row) => outputHeaders.map((header) => csvValue(row[header])).join(','))].join('\r\n');
fs.mkdirSync(outputDirectory, { recursive: true });
fs.writeFileSync(outputPath, `\uFEFF${csv}\r\n`, 'utf8');

const countBy = (key) => Object.fromEntries(Object.entries(outputRows.reduce((accumulator, row) => {
  const value = row[key];
  accumulator[value] = (accumulator[value] ?? 0) + 1;
  return accumulator;
}, {})).sort((left, right) => right[1] - left[1]));

const summary = {
  generated_at: new Date().toISOString(),
  source_file: path.basename(sourcePath),
  row_count: outputRows.length,
  by_engine: countBy('موتور'),
  by_automation_class: countBy('کلاس اتوماسیون'),
  by_allowed_output: countBy('سطح خروجی مجاز'),
  by_phase: countBy('فاز پیشنهادی'),
  without_field_survey: countBy('قابل استفاده بدون پیمایش حضوری'),
  invariants: [
    'Missing data is never converted to zero.',
    'Perceptual constructs are never replaced by POI, satellite, LLM, or national-level proxies.',
    'Scores are computed only from validated measurements with registry and formula versions.',
    'Public proxies remain provisional until calibrated against authoritative neighborhood data.',
  ],
};
fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
