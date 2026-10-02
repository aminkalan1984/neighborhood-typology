// ============================================================
// Kernel Router (فاز سه: اتصال Express)
// ------------------------------------------------------------
// مسیر /api/kernel — لایهٔ API محصول روی سرویس Python هسته.
// قواعد:
//   * kernel = مرجع رسمی محاسبات؛ اینجا هیچ عددی محاسبه نمی‌شود.
//   * انتشار عدد فقط پس از عبور از Publish Gate.
//   * هیچ fallback عددی یا دادهٔ ساختگی وجود ندارد.
// ============================================================
import { Router } from 'express';
import {
  kernelClient, KernelServiceError,
} from './kernelClient';
import {
  loadPilotArtifacts, compareWithPilot, loadPilotBoundary,
} from './kernelShadow';
import {
  buildKernelRecordBatch, fullMappingTable, mappingSummary,
  type TsMeasurementInput,
} from './indicatorMapping';
import {
  type KernelRunResult,
  collectAbstentions,
  gateAllowsNumericPublishing,
} from './kernelTypes';

export function buildKernelRouter(): Router {
  const router = Router();

  // --- health / connectivity -------------------------------------------------
  router.get('/health', async (_req, res) => {
    try {
      const { status, payload } = await kernelClient.health();
      res.status(status).json({
        ok: true,
        service: 'express-kernel-router',
        kernel: payload,
      });
    } catch (e) {
      res.status(503).json({
        ok: false,
        service: 'express-kernel-router',
        error: e instanceof KernelServiceError
          ? { code: e.code, message: e.message }
          : { code: 'SOURCE_UNAVAILABLE', message: `kernel service unreachable: ${(e as Error).message}` },
      });
    }
  });

  // --- pilot artifacts (real MVP-2 outputs) + shadow comparison ----------------
  router.get('/pilot', async (_req, res) => {
    const art = loadPilotArtifacts();
    if (!art.available) {
      return res.status(404).json({ error: { code: 'ARTIFACT_MISSING', message: 'MVP-2 pilot artifacts not found — run kernel/pilot/mvp2_pilot_run.py' } });
    }
    return res.json({
      gate_decision: art.gate_report?.D_gate_decision,
      gate_conditions: art.gate_report?.D_conditions ?? [],
      known_limitations: art.gate_report?.C_known_limitations ?? [],
      machine_checks: (art.gate_report as any)?.B_evidence?.machine_checks ?? null,
      versioning_proof: (art.gate_report as any)?.B_evidence?.versioning_proof ?? null,
      test_suites: (art.gate_report as any)?.B_evidence?.test_suites ?? null,
      neighborhood_result: art.neighborhood_result,
      coverage: art.coverage,
      artifact_dir: art.artifactDir,
    });
  });

  // --- registries catalog ------------------------------------------------------
  router.get('/registries', async (_req, res) => {
    try {
      const payload = await kernelClient.registries();
      res.json(payload);
    } catch (e) {
      handleKernelFailure(res, e);
    }
  });

  // --- live calculation run (kernel pipeline) + shadow comparison ---------------
  router.post('/calculation-runs', async (req, res) => {
    const dataVersion = typeof req.body?.data_version === 'string' ? req.body.data_version.trim() : '';
    if (!dataVersion) {
      return res.status(422).json({ error: { code: 'INVALID_INPUT', message: 'data_version الزامی است' } });
    }
    try {
      const run = await kernelClient.calculationRun({
        data_version: dataVersion,
        use_pilot_records: req.body?.use_pilot_records !== false,
        records: req.body?.records,
        neighborhood: req.body?.neighborhood,
        weight_override: req.body?.weight_override,
      });
      const shadow = compareWithPilot(run);
      return res.json({
        run_id: run.run_id,
        fingerprint: run.fingerprint,
        calculation_version_id: run.calc_run.calculation_version_id,
        reproducibility_key: run.reproducibility_key,
        publish_gate: run.publish_gate,
        can_publish_numeric_scores: gateAllowsNumericPublishing(run),
        shadow_comparison: shadow,
        abstentions: collectAbstentions(run),
        result: run,
      });
    } catch (e) {
      return handleKernelFailure(res, e);
    }
  });

  // --- drilldown: run → value provenance chain ---------------------------------
  router.get('/calculation-runs/:runId/drilldown/:valueId', async (req, res) => {
    try {
      const { status, payload } = await kernelClient.drilldown(req.params.runId, req.params.valueId);
      if (status !== 200) {
        return res.status(status === 404 ? 404 : 502).json(payload);
      }
      return res.json(payload);
    } catch (e) {
      return handleKernelFailure(res, e);
    }
  });

  // --- GIS boundary (append-only, provenance-guarded) ---------------------------
  router.get('/gis/boundaries/:neighborhoodId', async (req, res) => {
    const id = req.params.neighborhoodId;
    try {
      const boundary = await kernelClient.boundary(id);
      return res.json(boundary);
    } catch (e) {
      // fall back to the on-disk pilot boundary metadata (same data, still not fabricated)
      const local = loadPilotBoundary(id);
      if (local) return res.json(local);
      return handleKernelFailure(res, e);
    }
  });

  // --- indicator mapping (فاز یک) — TS core_40 → kernel registry_419 ------------
  router.get('/mapping', (_req, res) => {
    return res.json({ summary: mappingSummary(), rows: fullMappingTable() });
  });

  // --- analyze: decisionSupport-style payload → kernel records → full run -------
  // This is the Phase-1/2 bridge: the legacy numeric payload shape is translated
  // into provenance-aware kernel records; ALL computation happens in the kernel.
  router.post('/analyze', async (req, res) => {
    const payload = req.body ?? {};
    const values = (payload.indicatorValues ?? {}) as Record<string, unknown>;
    if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).length === 0) {
      return res.status(422).json({ error: { code: 'INVALID_INPUT', message: 'indicatorValues must be a non-empty object of TS indicator codes' } });
    }
    const groupValues = (payload.groupValues ?? {}) as Record<string, Record<string, unknown>>;
    const dataVersion = typeof payload.data_version === 'string' && payload.data_version.trim()
      ? payload.data_version.trim() : `ts-analyze-${new Date().toISOString().slice(0, 10)}`;

    const batch = buildKernelRecordBatch(values, groupValues, {
      source_name: 'decision-support analyze adapter',
      api: '/api/kernel/analyze',
    });
    if (batch.invalid.length > 0) {
      return res.status(422).json({ error: { code: 'INVALID_INPUT', message: `indicator ${batch.invalid[0]} must be a finite number (kernel never coerces missing to 0)` } });
    }
    const records = batch.records;
    const mappings = batch.mappings;
    const unmapped = batch.unmapped.length;

    if (records.length === 0) {
      return res.status(422).json({
        error: { code: 'INSUFFICIENT_COVERAGE', message: 'هیچ شاخصی قابل نگاشت به رجیستر kernel نبود — داده وارد محاسبه نمی‌شود', mappings },
      });
    }

    try {
      const run = await kernelClient.calculationRun({
        data_version: dataVersion,
        use_pilot_records: false,
        records,
        neighborhood: payload.neighborhood,
      });
      return res.json({
        run_id: run.run_id,
        fingerprint: run.fingerprint,
        calculation_version_id: run.calc_run.calculation_version_id,
        publish_gate: run.publish_gate,
        can_publish_numeric_scores: gateAllowsNumericPublishing(run),
        abstentions: collectAbstentions(run),
        mappings,
        unmapped_count: unmapped,
        result: run,
      });
    } catch (e) {
      return handleKernelFailure(res, e);
    }
  });

  // --- publish gate summary (fast, no calculation) ------------------------------
  router.get('/gate', async (_req, res) => {
    const art = loadPilotArtifacts();
    return res.json({
      pilot_gate_decision: art.gate_report?.D_gate_decision ?? null,
      pilot_conditions: art.gate_report?.D_conditions ?? [],
      rule: 'انتشار عدد محله فقط پس از: کالیبراسیون W/T + دادهٔ U/E/O + مرز رسمی',
      kernel_reference: 'kernel = مرجع رسمی محاسبات (فاز صفر، تصمیم معماری)',
    });
  });

  return router;
}

// ---------- helpers ----------
function handleKernelFailure(res: import('express').Response, e: unknown): void {
  if (e instanceof KernelServiceError) {
    res.status(e.status >= 500 ? 502 : e.status).json({
      error: { code: e.code, message: e.message, detail: e.detail },
    });
    return;
  }
  res.status(503).json({
    error: { code: 'SOURCE_UNAVAILABLE', message: `kernel service unavailable: ${(e as Error).message}` },
  });
}

// re-export for tests
export { kernelClient };
export type { KernelRunResult };
