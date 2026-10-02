// ============================================================
// مخزن ماندگار تصمیم‌یار — اجراها، حافظه زنده، آزمایش‌ها، ردیابی مداخله
// فاز ۵ و ۷ نقشه راه: حلقه یادگیری با ماندگاری روی دیسک
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  CapitalKey, DecisionCard, DecisionRunSummary,
  EvaluationPlan, InterventionCandidate, LivingMemoryEntry,
  QualityTriad, QualityTriadTrend,
} from '../src/algorithm/types';
import {
  createLivingMemory, addEntry, getActiveRules, supersedeRule,
  formatMemoryRules, type LivingMemoryStore,
} from '../src/algorithm/livingMemory';
import { computeLearningScore, type LearningLevel, classifyLearningLevel } from '../src/algorithm/learningEngine';
import {
  createExperiment, decideOutcome, experimentToMemory,
  PROTECTIVE_INDICATORS, type Experiment,
} from '../src/algorithm/experimentCycle';
import { interventionTracker, type InterventionRecord } from '../src/algorithm/interventionTracker';

const DATA_DIR = path.join(process.cwd(), 'server', 'data');
const RUNS_FILE = path.join(DATA_DIR, 'decision-runs.json');
const MEMORY_FILE = path.join(DATA_DIR, 'decision-living-memory.json');
const EXPERIMENTS_FILE = path.join(DATA_DIR, 'decision-experiments.json');
const INTERVENTIONS_FILE = path.join(DATA_DIR, 'decision-interventions.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadJson<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')) as T;
  } catch {
    return fallback;
  }
}

/**
 * نوشتن اتمیک با نام موقت یکتا.
 *
 * نام ثابت «${file}.tmp» باعث می‌شد دو نویسندهٔ همزمان (چند فرایند تست یا دو
 * نمونهٔ سرور) روی یک فایل موقت تصادم کنند؛ نتیجه، rename ناموفق و خواندن
 * ناقص/خالی از مخزن بود که به خطاهای کاذبی مثل INSUFFICIENT_COVERAGE می‌انجامید.
 */
function saveJson(file: string, value: unknown): void {
  ensureDir();
  const tmp = `${file}.tmp-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { force: true });
  }
}

export interface StoredRun {
  runId: string;
  neighborhoodName: string;
  createdAt: string;
  status: 'running' | 'completed' | 'failed';
  requestSummary: { purpose: string; measuredIndicators: string[]; groupValues: boolean; surveyIntegrated: boolean };
  card: DecisionCard | null;
  errorMessage?: string;
}

export class DecisionRunStore {
  private runs: StoredRun[];
  private memory: LivingMemoryStore;
  private experiments: Experiment[];

  constructor() {
    this.runs = loadJson<StoredRun[]>(RUNS_FILE, []);
    const savedMemory = loadJson<{ entries: LivingMemoryEntry[] }>(MEMORY_FILE, { entries: [] });
    this.memory = { entries: savedMemory.entries };
    this.experiments = loadJson<Experiment[]>(EXPERIMENTS_FILE, []);
    // رکوردهای مداخله به tracker درون‌حافظه‌ای منتقل می‌شوند
    const savedInterventions = loadJson<InterventionRecord[]>(INTERVENTIONS_FILE, []);
    for (const record of savedInterventions) {
      (interventionTracker as unknown as { records: Map<string, InterventionRecord> }).records.set(record.id, record);
    }
  }

  // ─── اجراها ─────────────────────────────────────────────────
  createRun(neighborhoodName: string, purpose: string, measuredIndicators: string[], groupValues: boolean, surveyIntegrated: boolean): string {
    const runId = `run-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    this.runs.push({
      runId,
      neighborhoodName,
      createdAt: new Date().toISOString(),
      status: 'running',
      requestSummary: { purpose, measuredIndicators, groupValues, surveyIntegrated },
      card: null,
    });
    saveJson(RUNS_FILE, this.runs);
    return runId;
  }

  completeRun(runId: string, card: DecisionCard): void {
    const run = this.runs.find(r => r.runId === runId);
    if (!run) return;
    run.status = 'completed';
    run.card = card;
    saveJson(RUNS_FILE, this.runs);
  }

  failRun(runId: string, message: string): void {
    const run = this.runs.find(r => r.runId === runId);
    if (!run) return;
    run.status = 'failed';
    run.errorMessage = message;
    saveJson(RUNS_FILE, this.runs);
  }

  getRun(runId: string): StoredRun | null {
    return this.runs.find(r => r.runId === runId) ?? null;
  }

  listRuns(neighborhoodName?: string): DecisionRunSummary[] {
    return this.runs
      .filter(r => !neighborhoodName || r.neighborhoodName === neighborhoodName)
      .filter(r => r.status === 'completed' && r.card)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(r => ({
        runId: r.runId,
        neighborhoodName: r.neighborhoodName,
        createdAt: r.createdAt,
        status: r.status,
        qualityVerdict: r.card!.qualityVerdict,
        diagnosticType: r.card!.diagnosticType,
        bottleneck: r.card!.bottleneck,
        measuredIndicatorCount: r.requestSummary.measuredIndicators.length,
      }));
  }

  /** روند Q/T/R: مقایسه با آخرین اجرای کامل‌شده قبلی همین محله */
  computeTrend(neighborhoodName: string, current: QualityTriad, currentRunId?: string): QualityTriadTrend {
    const previous = this.runs
      .filter(r => r.neighborhoodName === neighborhoodName && r.status === 'completed' && r.card && r.runId !== currentRunId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    if (!previous?.card) {
      return { direction: 'first_run', deltaQ: 0, deltaT: 0, deltaR: 0 };
    }
    const prev = previous.card.qualityVerdict;
    const deltaQ = Math.round((current.Q - prev.Q) * 10) / 10;
    const deltaT = Math.round((current.T - prev.T) * 10) / 10;
    const deltaR = Math.round((current.R - prev.R) * 10) / 10;
    const direction: QualityTriadTrend['direction'] =
      deltaQ + deltaT + deltaR > 1.5 ? 'up' : deltaQ + deltaT + deltaR < -1.5 ? 'down' : 'stable';
    return { direction, deltaQ, deltaT, deltaR, comparedToRunId: previous.runId, comparedToDate: previous.createdAt };
  }

  // ─── حافظه زنده ─────────────────────────────────────────────
  addMemoryEntry(entry: Omit<LivingMemoryEntry, 'id' | 'dateRecorded' | 'applicationCount'>): LivingMemoryEntry {
    const stored = addEntry(this.memory, entry);
    saveJson(MEMORY_FILE, { entries: this.memory.entries });
    return stored;
  }

  getMemoryEntries(capitalKey?: CapitalKey): LivingMemoryEntry[] {
    return capitalKey
      ? this.memory.entries.filter(e => e.capitalKey === capitalKey)
      : [...this.memory.entries];
  }

  getActiveMemoryRules(): LivingMemoryEntry[] {
    return getActiveRules(this.memory);
  }

  supersedeMemoryRule(oldId: string, newRule: string): boolean {
    const before = this.memory.entries.length;
    supersedeRule(this.memory, oldId, newRule);
    if (this.memory.entries.length === before) return false;
    saveJson(MEMORY_FILE, { entries: this.memory.entries });
    return true;
  }

  deleteMemoryEntry(id: string): boolean {
    const before = this.memory.entries.length;
    this.memory.entries = this.memory.entries.filter(e => e.id !== id);
    if (this.memory.entries.length === before) return false;
    saveJson(MEMORY_FILE, { entries: this.memory.entries });
    return true;
  }

  formatMemory(): string {
    return formatMemoryRules(this.memory);
  }

  /** یادگیری از یک اجرای کامل: ثبت خودکار قاعده در حافظه زنده + دروازه S-I-F-A-M */
  learnFromRun(runId: string, capabilities?: {
    sensing: number; interpretation: number; feedback: number; adaptation: number; memory: number;
  }): {
    entry: LivingMemoryEntry;
    learningGate: ReturnType<typeof computeLearningScore> | null;
  } {
    const run = this.getRun(runId);
    if (!run?.card) throw new Error('Run not found or not completed');
    const card = run.card;
    const entry = this.addMemoryEntry({
      capitalKey: card.bottleneck.capital,
      trigger: `تحلیل محله ${card.neighborhoodName}`,
      outcome: 'success',
      rule: `${run.requestSummary.measuredIndicators.length} شاخص | Q=${card.qualityVerdict.Q} | T=${card.qualityVerdict.T} | R=${card.qualityVerdict.R} | تیپ ${card.diagnosticType} | گلوگاه ${card.bottleneck.capital}`,
      evidence: card.finalStatement,
    });
    let learningGate: ReturnType<typeof computeLearningScore> | null = null;
    if (capabilities) {
      learningGate = computeLearningScore(card.bottleneck.capital, capabilities);
    }
    return { entry, learningGate };
  }

  computeLearningLevel(adaptiveDecisions: number, totalDecisions: number, ruleChanges: number): LearningLevel {
    return classifyLearningLevel(adaptiveDecisions, totalDecisions, ruleChanges);
  }

  // ─── چرخه آزمایش ────────────────────────────────────────────
  createExperiment(hypothesis: string, capitalKey: CapitalKey, baseline: Record<string, number>): Experiment {
    const exp = createExperiment(hypothesis, capitalKey, baseline);
    this.experiments.push(exp);
    saveJson(EXPERIMENTS_FILE, this.experiments);
    return exp;
  }

  getExperiments(): Experiment[] {
    return [...this.experiments];
  }

  completeExperiment(id: string, outcomes: Record<string, number>, impacts?: Record<string, number>): Experiment | null {
    const exp = this.experiments.find(e => e.id === id);
    if (!exp) return null;
    exp.status = 'completed';
    exp.outcomes = outcomes;
    exp.impacts = impacts;
    exp.completedAt = new Date().toISOString();
    const decided = decideOutcome(exp);
    Object.assign(exp, decided);
    saveJson(EXPERIMENTS_FILE, this.experiments);
    // انتقال به حافظه زنده — بستن حلقه یادگیری
    const memoryEntry = experimentToMemory(exp);
    if (memoryEntry) this.addMemoryEntry(memoryEntry);
    return exp;
  }

  getProtectiveIndicators() {
    return PROTECTIVE_INDICATORS;
  }

  // ─── ردیابی مداخله ──────────────────────────────────────────
  createInterventionRecord(candidate: InterventionCandidate, plan: EvaluationPlan): InterventionRecord {
    const record = interventionTracker.createRecord(candidate, plan);
    saveJson(INTERVENTIONS_FILE, interventionTracker.getAllRecords());
    return record;
  }

  updateIntervention(id: string, status: InterventionRecord['status'], description: string): InterventionRecord | null {
    interventionTracker.updateStatus(id, status, description);
    saveJson(INTERVENTIONS_FILE, interventionTracker.getAllRecords());
    return interventionTracker.getAllRecords().find(r => r.id === id) ?? null;
  }

  updateInterventionMetrics(id: string, metrics: Parameters<typeof interventionTracker.updateMetrics>[1]): InterventionRecord | null {
    interventionTracker.updateMetrics(id, metrics);
    saveJson(INTERVENTIONS_FILE, interventionTracker.getAllRecords());
    return interventionTracker.getAllRecords().find(r => r.id === id) ?? null;
  }

  getInterventionReport(id: string) {
    return interventionTracker.getReport(id);
  }

  listInterventions(): InterventionRecord[] {
    return interventionTracker.getAllRecords();
  }
}

// ─── سینگلتون سرور ───────────────────────────────────────────
let storeSingleton: DecisionRunStore | null = null;

export function getDecisionRunStore(): DecisionRunStore {
  if (!storeSingleton) storeSingleton = new DecisionRunStore();
  return storeSingleton;
}
