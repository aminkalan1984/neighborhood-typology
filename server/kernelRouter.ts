// ============================================================
// Kernel Router (pure Gateway, فاز سه: اتصال Express)
// ------------------------------------------------------------
// مسیر /api/kernel — لایهٔ API محصول که یک دروازهٔ ضخیم
// (gateway) بدون محاسبه است. هر متد به سرویس Python هسته
// (kernel/service/kernel_service.py) پراکسی می‌شود و هیچ
// عدد محاسبه، نگاشت، مقایسه سایه یا fallback داده‌ای ایجاد
// نمی‌کند.
//
// قرارداد:
//   * kernel = مرجع رسمی محاسبات؛ اینجا هیچ بارگذاری
//     محاسبه‌ای انجام نمی‌شود.
//   * انتشار عدد فقط پس از عبور از Publish Gate.
//   * هیچ fallback عددی یا دادهٔ ساختگی وجود ندارد.
// ============================================================

import { Router } from 'express';
import {
  kernelClient,
  KernelServiceError,
  type KernelClient,
} from './kernelClient';
import { collectAbstentions } from './kernelTypes';

export function buildKernelRouter(): Router {
  const router = Router();

  // --- health / connectivity ----------------------------------
  router.get('/health', async (_req, res) => {
    try {
      const { status, payload } = await kernelClient.health();
      res.status(status).json({
        ok: status === 200,
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

  // --- registries catalog -------------------------------------
  router.get('/registries', async (_req, res) => {
    try {
      const payload = await kernelClient.registries();
      res.json(payload);
    } catch (e) {
      handleKernelFailure(res, e);
    }
  });

  // --- live calculation run (kernel pipeline) -------------------
  router.post('/calculation-runs', async (req, res) => {
    const dataVersion = typeof req.body?.data_version === 'string' ? req.body.data_version.trim() : '';
    if (!dataVersion) {
      return res.status(422).json({
        error: { code: 'INVALID_INPUT', message: 'data_version الزامی است' },
      });
    }
    try {
      const run = await kernelClient.calculationRun({
        data_version: dataVersion,
        use_pilot_records: req.body?.use_pilot_records !== false,
        records: req.body?.records,
        neighborhood: req.body?.neighborhood,
        weight_override: req.body?.weight_override,
      });
      return res.json({
        run_id: run.run_id,
        fingerprint: run.fingerprint,
        calculation_version_id: run.calc_run.calculation_version_id,
        reproducibility_key: run.reproducibility_key,
        publish_gate: run.publish_gate,
        can_publish_numeric_scores: run.publish_gate.can_publish_numeric_scores,
        abstentions: collectAbstentions(run),
        result: run,
      });
    } catch (e) {
      return handleKernelFailure(res, e);
    }
  });

  // --- drilldown: run -> value provenance chain -----------------
  router.get(
    '/calculation-runs/:runId/drilldown/:valueId',
    async (req, res) => {
      try {
        const { status, payload } = await kernelClient.drilldown(
          req.params.runId,
          req.params.valueId,
        );
        if (status !== 200) {
          return res.status(status === 404 ? 404 : 502).json(payload);
        }
        return res.json(payload);
      } catch (e) {
        return handleKernelFailure(res, e);
      }
    },
  );

  // --- GIS boundary (append-only, provenance-guarded) ----------
  router.get('/gis/boundaries/:neighborhoodId', async (req, res) => {
    const id = req.params.neighborhoodId;
    try {
      const boundary = await kernelClient.boundary(id);
      return res.json(boundary);
    } catch (e) {
      return handleKernelFailure(res, e);
    }
  });

  // --- analysis run (decision-support adapted payload -> kernel records).
  //     Fast, read-only, no fabrication. A raw indicator value may enter the
  //     kernel only as a fully-provenanced Observation (§9/§10/§57 of the
  //     kernel contract); payloads that carry no provenance are answered with
  //     an explicit coverage report — never with an invented number.
  router.post('/analyze', async (req, res) => {
    const payload = (req.body ?? {}) as Record<string, unknown>;
    const dataVersion =
      typeof payload.data_version === 'string' && payload.data_version.trim()
        ? payload.data_version.trim()
        : `ts-analyze-${new Date().toISOString().slice(0, 10)}`;

    // Path 1 — canonical observations (provenance-carrying): forward verbatim.
    const observations = Array.isArray(payload.observations)
      ? (payload.observations as unknown[])
      : null;
    if (observations && observations.length > 0) {
      try {
        const run = await kernelClient.decisionSupportRun({
          data_version: dataVersion,
          observations,
          neighborhood: payload.neighborhood,
          boundary: payload.boundary,
          equity_inputs: payload.equity_inputs,
          risk_inputs: payload.risk_inputs,
          vulnerability_inputs: payload.vulnerability_inputs,
          intervention_candidates: payload.intervention_candidates,
          portfolio_constraints: payload.portfolio_constraints,
          causal_evidence: payload.causal_evidence,
        });
        const gate = (run.publication_gate ?? {}) as Record<string, unknown>;
        return res.json({
          run_id: run.run_id,
          fingerprint: run.fingerprint,
          publication_gate: run.publication_gate,
          can_publish_numeric_scores: gate.can_publish_numeric_scores === true,
          decision_withheld: gate.decision_withheld === true,
          engine: run.engine,
          result: run,
        });
      } catch (e) {
        return handleKernelFailure(res, e);
      }
    }

    // Path 2 — raw indicatorValues without provenance. §7.5: an indicator that
    // has no explicit, documented, versioned mapping into the master registry
    // never enters calculation. Report the coverage gap honestly.
    const values = payload.indicatorValues;
    if (
      values &&
      typeof values === 'object' &&
      !Array.isArray(values) &&
      Object.keys(values).length > 0
    ) {
      const entries = Object.entries(values as Record<string, unknown>);
      const invalid = entries.filter(
        ([, v]) => typeof v !== 'number' || !Number.isFinite(v),
      );
      if (invalid.length > 0) {
        return res.status(422).json({
          error: {
            code: 'INVALID_INPUT',
            message:
              'indicatorValues must map indicator codes to finite numbers',
          },
        });
      }
      const mappings = entries.map(([tsCode]) => ({
        ts_code: tsCode,
        kernel_code: null as string | null,
      }));
      return res.status(422).json({
        error: {
          code: 'INSUFFICIENT_COVERAGE',
          message:
            'کدهای این درخواست نگاشت مستند و نسخه‌دار به رجیستر مادر ندارند؛ عدد ساخته نمی‌شود (§۷٫۵). برای محاسبهٔ معتبر، مشاهدات با منبع/وضعیت (observations) بفرستید.',
        },
        unmapped_count: mappings.length,
        mappings,
        note_fa:
          'هر مقدار باید به‌صورت مشاهدهٔ مستند (observation) با وضعیت، جریان شواهد و منبع وارد شود؛ هیچ عدد بدون منبع پذیرفته نمی‌شود.',
      });
    }

    return res.status(422).json({
      error: {
        code: 'INVALID_INPUT',
        message:
          'either a non-empty observations[] list or indicatorValues{} is required',
      },
    });
  });

  // --- publish gate summary (fast, no calculation) --------------
  router.get('/gate', async (_req, res) => {
    res.json({
      pilot_gate_decision: null,
      pilot_conditions: [],
      rule:
        'انتشار عدد محله فقط پس از: کالیبراسیون W/T + داده U/E/O + مرز رسمی',
      kernel_reference:
        'kernel = مرجع رسمی محاسبات (فاز صفر، تصمیم معماری)',
    });
  });

  return router;
}

// ---------- helpers ----------
function handleKernelFailure(
  res: import('express').Response,
  e: unknown,
): void {
  if (e instanceof KernelServiceError) {
    res.status(e.status >= 500 ? 502 : e.status).json({
      error: { code: e.code, message: e.message, detail: e.detail },
    });
    return;
  }
  res.status(503).json({
    error: {
      code: 'SOURCE_UNAVAILABLE',
      message: `kernel service unavailable: ${(e as Error).message}`,
    },
  });
}
