// ============================================================
// حافظه زنده — ذخیره قواعد استخراج‌شده از مداخلات
// ============================================================
import type { CapitalKey, FrictionType, LivingMemoryEntry } from './types';

export interface LivingMemoryStore {
  entries: LivingMemoryEntry[];
}

export function createLivingMemory(): LivingMemoryStore {
  return { entries: [] };
}

export function addEntry(
  store: LivingMemoryStore,
  entry: Omit<LivingMemoryEntry, 'id' | 'dateRecorded' | 'applicationCount'>,
): LivingMemoryEntry {
  const newEntry: LivingMemoryEntry = {
    ...entry,
    id: `LM-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    dateRecorded: new Date().toISOString(),
    applicationCount: 0,
  };
  store.entries.push(newEntry);
  return newEntry;
}

export function queryByCapital(store: LivingMemoryStore, capitalKey: CapitalKey): LivingMemoryEntry[] {
  return store.entries.filter(e => e.capitalKey === capitalKey && !e.supersededBy);
}

export function getActiveRules(store: LivingMemoryStore): LivingMemoryEntry[] {
  return store.entries.filter(e => !e.supersededBy);
}

export function supersedeRule(store: LivingMemoryStore, oldId: string, newRule: string): void {
  const old = store.entries.find(e => e.id === oldId);
  if (!old) return;
  old.supersededBy = 'superseded';
  addEntry(store, {
    capitalKey: old.capitalKey,
    trigger: `جایگزین قاعده ${oldId}`,
    outcome: old.outcome,
    rule: newRule,
    evidence: `جایگزینی قاعده قبلی: ${old.rule}`,
    dateLastApplied: undefined,
  });
}

export function formatMemoryRules(store: LivingMemoryStore): string {
  return getActiveRules(store)
    .map((e, i) => `${i + 1}. [${e.capitalKey}] ${e.rule} (اثر: ${e.outcome}, ثبت: ${e.dateRecorded.slice(0, 10)})`)
    .join('\n');
}
