import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SERVER_DIR, '..');
const PLAN_PATH = path.join(PROJECT_ROOT, 'docs', 'decision-support', 'indicator-automation-plan-164.csv');

export interface DecisionIndicator164 {
  code: string;
  engine: string;
  family: string;
  name: string;
  definition: string;
  formula: string;
  unit: string;
  direction: string;
  algorithmRole: string;
  requiredInputs: string;
  sourceMethod: string;
  cadence: string;
  spatialLevel: string;
  equityBreakdown: string;
  scaleThreshold: string;
  focusLevel: string;
  extractionStatus: string;
  qualityControl: string;
  outputDecision: string;
  automationClass: string;
  allowedOutput: string;
  proposedSources: string;
  implementationMethod: string;
  proposedQualityControl: string;
  currentGap: string;
  phase: string;
  usableWithoutFieldSurvey: string;
  isCore: boolean;
  legacyCode: string | null;
  capitalKey: string | null;
}

export interface DecisionSupportRegistry164 {
  rows: DecisionIndicator164[];
  version: string;
  sourcePath: string;
  planPath: string | null;
}

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (quoted) throw new Error('Unterminated quoted field in decision-support registry');
  if (field.length > 0 || row.length > 0) {
    row.push(field.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows.filter((candidate) => candidate.some((value) => value.trim().length > 0));
}

function csvObjects(filePath: string): Array<Record<string, string>> {
  const rows = parseCsvRows(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
  const headers = rows.shift();
  if (!headers) throw new Error(`CSV is empty: ${filePath}`);
  return rows.map((values, rowIndex) => {
    if (values.length !== headers.length) throw new Error(`CSV row ${rowIndex + 2} has ${values.length} fields; expected ${headers.length}`);
    return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
  });
}

function findSourcePath(root = PROJECT_ROOT): string {
  const candidates = fs.readdirSync(root)
    .filter((file) => file.toLowerCase().endsWith('.csv') && file.includes('164'))
    .filter((file) => file !== path.basename(PLAN_PATH));
  const exact = candidates.find((file) => file.includes('رجیستر')) ?? candidates[0];
  if (!exact) throw new Error('The 164-indicator neighborhood decision-support registry was not found.');
  return path.join(root, exact);
}

function planByCode(planPath: string): Map<string, Record<string, string>> {
  if (!fs.existsSync(planPath)) return new Map();
  return new Map(csvObjects(planPath).map((row) => [row['کد یکتا'], row]));
}

export function loadDecisionSupportRegistry164(options: { sourcePath?: string; planPath?: string } = {}): DecisionSupportRegistry164 {
  const sourcePath = options.sourcePath ?? findSourcePath();
  const planPath = options.planPath ?? PLAN_PATH;
  const raw = fs.readFileSync(sourcePath, 'utf8').replace(/^\uFEFF/, '');
  const sourceRows = csvObjects(sourcePath);
  const planned = planByCode(planPath);
  const rows = sourceRows.map((source): DecisionIndicator164 => {
    const plan = planned.get(source['کد یکتا']) ?? {};
    const code = source['کد یکتا'];
    const coreMatch = /^M-CORE-([HSEPNCGR])(\d)$/.exec(code);
    return {
      code,
      engine: source['موتور'],
      family: source['خانواده'],
      name: source['نام شاخص'],
      definition: source['تعریف عملیاتی'],
      formula: source['فرمول/منطق'],
      unit: source['واحد'],
      direction: source['جهت مطلوب'],
      algorithmRole: source['نقش در الگوریتم'],
      requiredInputs: source['ورودی‌های لازم'],
      sourceMethod: source['روش/منبع'],
      cadence: source['تناوب'],
      spatialLevel: source['سطح مکانی'],
      equityBreakdown: source['تفکیک عدالت'],
      scaleThreshold: source['مقیاس/آستانه'],
      focusLevel: source['سطح تمرکز'],
      extractionStatus: source['وضعیت استخراج'],
      qualityControl: source['کنترل کیفیت'],
      outputDecision: source['خروجی/تصمیم'],
      automationClass: plan['کلاس اتوماسیون'] || 'UNCLASSIFIED',
      allowedOutput: plan['سطح خروجی مجاز'] || 'REVIEW_REQUIRED',
      proposedSources: plan['منابع پیشنهادی عملیاتی'] || source['روش/منبع'],
      implementationMethod: plan['روش پیاده‌سازی پیشنهادی'] || source['فرمول/منطق'],
      proposedQualityControl: plan['کنترل کیفیت و شرط پذیرش'] || source['کنترل کیفیت'],
      currentGap: plan['شکاف فعلی برنامه'] || '',
      phase: plan['فاز پیشنهادی'] || 'P3',
      usableWithoutFieldSurvey: plan['قابل استفاده بدون پیمایش حضوری'] || 'جزئی/مشروط',
      isCore: Boolean(coreMatch),
      legacyCode: coreMatch ? `${coreMatch[1]}${coreMatch[2]}` : null,
      capitalKey: coreMatch ? coreMatch[1] : null,
    };
  });
  const codes = new Set(rows.map((row) => row.code));
  const coreCount = rows.filter((row) => row.isCore).length;
  if (rows.length !== 164 || codes.size !== 164 || coreCount !== 40) {
    throw new Error(`Decision-support registry invariant failed: rows=${rows.length}, unique=${codes.size}, core=${coreCount}`);
  }
  const planRaw = fs.existsSync(planPath) ? fs.readFileSync(planPath) : Buffer.alloc(0);
  const version = `sha256:${crypto.createHash('sha256').update(raw).update(planRaw).digest('hex')}`;
  return { rows, version, sourcePath, planPath: fs.existsSync(planPath) ? planPath : null };
}

export function summarizeDecisionSupportRegistry(registry: DecisionSupportRegistry164): Record<string, unknown> {
  const countBy = (key: keyof Pick<DecisionIndicator164, 'engine' | 'automationClass' | 'allowedOutput' | 'phase' | 'usableWithoutFieldSurvey'>) =>
    Object.fromEntries([...new Set(registry.rows.map((row) => row[key]))].sort().map((value) => [value, registry.rows.filter((row) => row[key] === value).length]));
  return {
    version: registry.version,
    source_file: path.basename(registry.sourcePath),
    plan_file: registry.planPath ? path.relative(PROJECT_ROOT, registry.planPath).replace(/\\/g, '/') : null,
    indicator_count: registry.rows.length,
    core_indicator_count: registry.rows.filter((row) => row.isCore).length,
    by_engine: countBy('engine'),
    by_automation_class: countBy('automationClass'),
    by_allowed_output: countBy('allowedOutput'),
    by_phase: countBy('phase'),
    without_field_survey: countBy('usableWithoutFieldSurvey'),
  };
}
