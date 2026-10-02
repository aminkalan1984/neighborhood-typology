// ============================================================
// Kernel Shadow Mode (فاز صفر — اجرای سایه)
// ------------------------------------------------------------
// بارگذاری خروجی‌های واقعی پایلوت MVP-2 (که خودِ kernel تولید کرده)
// برای مقایسه با پاسخ زندهٔ سرویس. هیچ عددی اینجا ساخته نمی‌شود —
// فقط artifact های امضاشدهٔ kernel خوانده می‌شوند.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { KernelRunResult, KernelBoundary } from './kernelTypes';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KROOT = path.resolve(__dirname, '..', 'kernel');
const MVP2 = path.join(KROOT, 'pilot', 'out', 'mvp2');

export interface PilotArtifacts {
  neighborhood_result: KernelRunResult | null;
  gate_report: Record<string, unknown> | null;
  coverage: { data_coverage?: Record<string, unknown>; evidence_coverage?: Record<string, unknown> } | null;
  available: boolean;
  artifactDir: string;
}

function readJson<T>(p: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '')) as T;
  } catch {
    return null;
  }
}

/** artifacts واقعی پایلوت MVP-2 — منبع مقایسه در shadow mode */
export function loadPilotArtifacts(): PilotArtifacts {
  const neighborhood_result = readJson<KernelRunResult>(path.join(MVP2, 'neighborhood_result.json'));
  const gate_report = readJson<Record<string, unknown>>(path.join(MVP2, 'gate_report_mvp2.json'));
  const coverage = readJson<PilotArtifacts['coverage']>(path.join(MVP2, 'coverage_summaries.json'));
  return {
    neighborhood_result,
    gate_report,
    coverage,
    available: neighborhood_result !== null && gate_report !== null,
    artifactDir: MVP2,
  };
}

/** مرز پایلوت از متادیتای واقعی (بدون جعل هندسه) */
export function loadPilotBoundary(neighborhoodId: string): KernelBoundary | null {
  const meta = readJson<Record<string, any>>(path.join(KROOT, 'pilot', 'pilot_boundary_meta.json'));
  const dcs = readJson<{ neighborhood?: Record<string, any> }>(path.join(KROOT, 'pilot', 'out', 'data_coverage_summary.json'));
  if (!meta || !dcs?.neighborhood) return null;
  const neigh = dcs.neighborhood;
  if (neighborhoodId !== neigh.id && neighborhoodId !== 'IR-THR-D6') return null;
  return {
    neighborhood_id: neigh.id,
    name_fa: meta.name_fa,
    name_en: meta.name_en,
    version_id: neigh.boundary_version ?? 'v1',
    is_official: false,
    is_proxy: true,
    proxy_reason: 'مرز رسمی شهرداری = ACCESS_REQUIRED؛ مرز فعلی OSM relation است (پروکسی برچسب‌دار)',
    metric_crs: meta.metric_crs,
    area_km2: meta.area_km2,
    centroid: meta.centroid ?? null,
    geometry_hash: neigh.boundary_hash,
    provenance: {
      provider: meta.provider, license: meta.license, url_api: meta.url,
      params: meta.params, raw_hash: meta.raw_hash,
      timestamp_acquired: meta.timestamp_acquired, osm_tags: meta.osm_tags,
    },
    geometry_geojson: meta.geojson ?? null,
    append_only: true,
  };
}

export interface ShadowComparison {
  matched: boolean;
  fields: Array<{ field: string; pilot: unknown; live: unknown; equal: boolean }>;
  note: string;
}

/**
 * مقایسهٔ shadow mode: فینگرپرینت و کلید بازتولیدپذیری پاسخ زندهٔ سرویس
 * باید با artifact پایلوت یکی باشد (همان دادهٔ ورودی + همان نسخه‌ها).
 */
export function compareWithPilot(live: KernelRunResult): ShadowComparison {
  const pilot = loadPilotArtifacts().neighborhood_result;
  if (!pilot) {
    return { matched: false, fields: [], note: 'pilot artifacts missing — shadow comparison unavailable' };
  }
  const fields = [
    { field: 'fingerprint', pilot: pilot.fingerprint, live: live.fingerprint, equal: pilot.fingerprint === live.fingerprint },
    { field: 'calculation_version_id', pilot: pilot.calc_run?.calculation_version_id, live: live.calc_run?.calculation_version_id, equal: pilot.calc_run?.calculation_version_id === live.calc_run?.calculation_version_id },
    { field: 'data_version', pilot: pilot.reproducibility_key?.data_version, live: live.reproducibility_key?.data_version, equal: pilot.reproducibility_key?.data_version === live.reproducibility_key?.data_version },
    { field: 'weight_set', pilot: pilot.reproducibility_key?.weight_set, live: live.reproducibility_key?.weight_set, equal: pilot.reproducibility_key?.weight_set === live.reproducibility_key?.weight_set },
    { field: 'threshold_set', pilot: pilot.reproducibility_key?.threshold_set, live: live.reproducibility_key?.threshold_set, equal: pilot.reproducibility_key?.threshold_set === live.reproducibility_key?.threshold_set },
  ];
  return {
    matched: fields.every((f) => f.equal),
    fields,
    note: 'shadow mode: خروجی زندهٔ سرویس باید با artifact پایلوت بایت‌یکسان باشد (بازتولیدپذیری)',
  };
}
