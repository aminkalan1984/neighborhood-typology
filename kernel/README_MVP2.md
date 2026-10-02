# Neighborhood Intelligence Kernel — v2 (MVP-2)

Iran Neighborhood «سنجش/تشخیص/تجویز/یادگیری» platform kernel. Reference methodology: `algo.txt` +
atlas JSON. Real pilot: **منطقه ۶ شهر تهران (Tehran District 6, OSM R6729037)**.

## MVP-2 scope (this version)
Adds the Calculation Engine run layer on top of the MVP-0/MVP-1 kernel:
- `engine/calc_run.py` — 16-stage run orchestrator; per-indicator weights READ from W-v1;
  FLAG-2 standardization-eligibility guard; coverage-gated capital / C-A-U-E-O / Q-T-R
  aggregation (missing EXCLUDED from denominator, never zeroed); deterministic CalculationRun +
  sha256 fingerprint; append-only CalculationVersion mechanism.
- `engine/confidence.py` — multi-factor Evidence Confidence Engine; levels ناکافی/محدود/قابل اتکا/همگرا/آزمون‌شده.
- `engine/bottleneck.py` — AI-independent, rule-based Bottleneck Engine (base-deficiency-first, abstention gate).
- `engine/tests/test_calc_run.py` (22), `test_confidence.py` (12), `test_bottleneck.py` (13).
- `pilot/mvp2_pilot_run.py`, `pilot/gate_mvp2.py`; outputs under `pilot/out/mvp2/`.

## Reproducibility key (every published value)
Data(`pilot-D6-2026-09-02`) + Methodology(`algo.txt-2026`) + Indicator(`registry-419-v1`) +
Weight(`W-v1`) + Threshold(`T-v1`) + Calculation(`CALC-v0.2`).
Pilot run fingerprint: `sha256:efa6a5e96f8885e5f2fe76daf60940e8b6fe73becc48bf89a36f9f6465970e2b` · calc_version_id: `CALC-v0.2+88c105ec1aeb`.

## Test status (run `python3 <test_file>`)
formulas 18/18 · calc_run 22/22 · confidence 12/12 · bottleneck 13/13 · ingestion 27/27 · gis 18/18 = 110/110.

## MVP-2 gate: CONDITIONAL PASS
Engine correctness proven via contract fixtures + determinism + executed versioning; the REAL
pilot honestly abstains (6 PROXY values -> PENDING_VALIDATION standardized scores; capitals/
C-A-U-E-O/Q-T-R -> INSUFFICIENT_COVERAGE/WAITING_FOR_DATA) because L/U + weights are uncalibrated
and no U/E/O survey data exists. NO fabricated numbers. See `pilot/out/mvp2/gate_report_mvp2.json`.

## Integrity invariants enforced
missing != 0 · Q/T/R separate · formulas/weights/thresholds read from registry · proxy labelled ·
bottleneck AI-independent · every value carries full provenance/drill-down · deterministic + reproducible.
