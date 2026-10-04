// ============================================================
// Kernel Gateway tests — live, through /api/kernel/*
// ------------------------------------------------------------
// These tests boot the Express gateway in-process (exactly the
// router mounted by server/index.ts) and talk to the Python
// kernel service. They pin the HTTP-facing behavior:
//   * abstention is explicit — a blocked number is never a number
//   * no input without documented provenance ever becomes a number
//   * drill-down, boundaries, gate and fingerprint contracts
// Run:  npm run test:kernel
// ============================================================
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test, { after } from 'node:test';
import express from 'express';
import { buildKernelRouter } from './kernelRouter';
import { stopKernelService } from './kernelClient';
import { isNumericStatus, numericOrNull } from './kernelTypes';

const REQUEST_TIMEOUT_MS = 45_000;
const TEST_TIMEOUT_MS = 60_000;

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api/kernel', buildKernelRouter());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const stop = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections?.();
      server.close(() => resolve());
      setTimeout(resolve, 2_000).unref?.();
    });
  return {
    server,
    stop,
    base: `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/kernel`,
  };
}

function get(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
}

function postJson(url: string, body: unknown): Promise<Response> {
  return get(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// The service is launched on demand by kernelClient and owned by this process;
// close it so the test run exits cleanly (no-op when one was already running).
after(async () => {
  await stopKernelService();
});

test('contract: a non-numeric status never carries a number (never zeroed)', () => {
  assert.equal(numericOrNull('MISSING', 5), null);
  assert.equal(numericOrNull('WAITING_FOR_DATA', 0), null);
  assert.equal(numericOrNull('PROXY', 42), 42);
  assert.equal(isNumericStatus('INSUFFICIENT_COVERAGE'), false);
  assert.equal(isNumericStatus('OBSERVED'), true);
});

test('health endpoint reaches the live kernel service', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const res = await get(`${api.base}/health`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    ok: boolean;
    kernel: { engine: { stages: string[] }; service: string };
  };
  assert.equal(body.ok, true);
  assert.equal(body.kernel.engine.stages.length, 16);
});

test('registries catalog is served', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const res = await get(`${api.base}/registries`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as { registries: Record<string, unknown> };
  assert.ok(body.registries.indicator_version, 'registries catalog present');
});

test('live calculation run: gate blocks numeric publishing and abstains explicitly', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const res = await postJson(`${api.base}/calculation-runs`, {
    data_version: 'pilot-D6-2026-09-02',
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    run_id: string;
    fingerprint: string;
    publish_gate: { can_publish_numeric_scores: boolean; reasons: string[] };
    abstentions: { field: string; status: string; reason: string | null; unblocks: string }[];
    result: unknown;
  };
  assert.match(body.fingerprint, /^sha256:/);
  assert.equal(body.publish_gate.can_publish_numeric_scores, false);
  assert.ok(body.publish_gate.reasons.length >= 2, 'gate cites W and T calibration');
  assert.ok(Array.isArray(body.abstentions));
  assert.ok(body.abstentions.length > 0, 'pilot run abstains on uncalibrated indicators');
  for (const a of body.abstentions) {
    assert.ok(a.field && a.status, 'abstention names the field and status');
  }
});

test('drilldown endpoint serves the 10-level provenance chain', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const runRes = await postJson(`${api.base}/calculation-runs`, {
    data_version: 'pilot-D6-2026-09-02',
  });
  const run = (await runRes.json()) as {
    run_id: string;
    result: { drilldown_index: Record<string, unknown> };
  };
  const firstValue = Object.keys(run.result.drilldown_index ?? {})[0];
  assert.ok(firstValue, 'run carries a drilldown index');

  const dd = await get(
    `${api.base}/calculation-runs/${encodeURIComponent(run.run_id)}/drilldown/${encodeURIComponent(firstValue)}`,
  );
  assert.equal(dd.status, 200);
  const body = (await dd.json()) as { chain_levels: string[]; drilldown: unknown };
  assert.equal(body.chain_levels.length, 10);
  assert.ok(body.drilldown, 'drilldown payload present');
});

test('drilldown rejects an unknown value id with 404', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const runRes = await postJson(`${api.base}/calculation-runs`, {
    data_version: 'pilot-D6-2026-09-02',
  });
  const run = (await runRes.json()) as { run_id: string };

  const missing = await get(
    `${api.base}/calculation-runs/${encodeURIComponent(run.run_id)}/drilldown/${encodeURIComponent('VAL-NOPE')}`,
  );
  assert.equal(missing.status, 404);
});

test('boundary endpoint serves a labeled proxy with provenance', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const res = await get(`${api.base}/gis/boundaries/IR-THR-D6`);
  assert.equal(res.status, 200);
  const b = (await res.json()) as {
    is_proxy: boolean;
    is_official: boolean;
    provenance: Record<string, unknown>;
  };
  assert.equal(b.is_proxy, true);
  assert.equal(b.is_official, false);
  assert.ok(Object.keys(b.provenance).length > 0, 'boundary without provenance is rejected');
});

test('unknown boundary returns SOURCE_UNAVAILABLE, never a fabricated boundary', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const unknown = await get(`${api.base}/gis/boundaries/UNKNOWN-XYZ`);
  assert.equal(unknown.status, 404);
  const ue = (await unknown.json()) as { error: { code: string } };
  assert.equal(ue.error.code, 'SOURCE_UNAVAILABLE');
});

test('weight override changes the fingerprint and re-runs deterministically', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const mk = async (weightOverride?: Record<string, number>) => {
    const r = await postJson(`${api.base}/calculation-runs`, {
      data_version: 'pilot-D6-2026-09-02',
      ...(weightOverride ? { weight_override: weightOverride } : {}),
    });
    assert.equal(r.status, 200);
    return (await r.json()) as { fingerprint: string; calculation_version_id: string };
  };

  const base = await mk();
  const mod = await mk({ 'PHY-003': 7.0 });
  assert.notEqual(mod.fingerprint, base.fingerprint);
  assert.notEqual(mod.calculation_version_id, base.calculation_version_id);

  const again = await mk();
  assert.equal(again.fingerprint, base.fingerprint);
});

test('analyze: canonical observations pass through, numbers stay withheld', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const res = await postJson(`${api.base}/analyze`, {
    data_version: 'analyze-smoke',
    observations: [
      {
        indicator_code: 'PHY-003',
        raw_value: 50.0,
        unit: 'درصد جمعیت در آستانه؛ دقیقه/متر (کمکی)',
        status: 'PROXY',
        proxy: true,
        proxy_definition: 'd',
        proxy_reason: 'r',
        evidence_stream: ['spatial'],
        source_id: 'SRC-1',
        reference_period: '2026',
      },
    ],
  });
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    run_id: string;
    fingerprint: string;
    can_publish_numeric_scores: boolean;
    decision_withheld: boolean;
    publication_gate: { can_publish_numeric_scores: boolean; what_would_unblock?: unknown };
    engine: { entry_point: string };
    result: { standardized_values: unknown[] };
  };
  assert.match(body.fingerprint, /^sha256:/);
  assert.equal(body.publication_gate.can_publish_numeric_scores, false);
  assert.equal(body.decision_withheld, true);
  assert.equal(body.can_publish_numeric_scores, false);
  assert.equal(body.engine.entry_point, 'kernel.engine.pipeline.run_decision_support');
  assert.ok(Array.isArray(body.result.standardized_values));
});

test('analyze: raw indicatorValues without provenance is refused with a coverage report', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const res = await postJson(`${api.base}/analyze`, {
    data_version: 'analyze-smoke',
    indicatorValues: { H1: 72, S2: 64, P1: 58 },
  });
  assert.equal(res.status, 422);
  const body = (await res.json()) as {
    error: { code: string; message: string };
    unmapped_count: number;
    mappings: Array<{ ts_code: string; kernel_code: string | null }>;
    note_fa: string;
  };
  assert.equal(body.error.code, 'INSUFFICIENT_COVERAGE');
  assert.equal(body.unmapped_count, 3);
  assert.ok(body.mappings.every((m) => m.kernel_code === null));
  assert.ok(body.note_fa.length > 0, 'the refusal explains what is needed');
});

test('analyze rejects empty/invalid payloads without fabricating', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const empty = await postJson(`${api.base}/analyze`, {});
  assert.equal(empty.status, 422);
  const ee = (await empty.json()) as { error: { code: string } };
  assert.equal(ee.error.code, 'INVALID_INPUT');

  const bad = await postJson(`${api.base}/analyze`, { indicatorValues: { H1: 'abc' } });
  assert.equal(bad.status, 422);
  const be = (await bad.json()) as { error: { code: string } };
  assert.equal(be.error.code, 'INVALID_INPUT');

  const badObservation = await postJson(`${api.base}/analyze`, {
    observations: [{ indicator_code: 'PHY-003', raw_value: 0, status: 'MISSING', evidence_stream: ['spatial'] }],
  });
  assert.equal(badObservation.status, 422, 'missing != zero is enforced by the kernel');
});

test('gate endpoint returns the publication rule without computation', { timeout: TEST_TIMEOUT_MS }, async (context) => {
  const api = await startServer();
  context.after(() => api.stop());

  const res = await get(`${api.base}/gate`);
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    pilot_gate_decision: string | null;
    pilot_conditions: string[];
    rule: string;
    kernel_reference: string;
  };
  assert.equal(body.pilot_gate_decision, null);
  assert.ok(body.rule.length > 0);
  assert.ok(body.kernel_reference.length > 0);
});
