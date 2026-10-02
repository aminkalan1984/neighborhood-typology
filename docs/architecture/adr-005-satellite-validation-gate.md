# ADR-005: Pre-ML satellite validation gate

## Status

Accepted

## Context

Satellite outputs are consumed by multiple application modules and will later feed intelligent models. A COG being readable is not enough: cloud/QA coverage, AOI clipping, band alignment, and temporal spikes must be visible before publication.

## Decision

Make validation an explicit, deterministic gate with four dimensions:

1. QA mask counts and clear-pixel coverage.
2. AOI coverage of the output bounds (minimum 99%).
3. Co-registration of CRS, shape, and affine transform across bands.
4. Robust temporal anomaly review using median/MAD; fewer than five observations is `not_applicable`.

The Rasterio worker emits the first three dimensions for every processing job. The TypeScript validation module exposes the same contracts and applies the temporal check to observation series. CI runs both contract tests and offline synthetic Rasterio fixtures, then archives a JSON report.

## Rationale

- Deterministic QA is auditable and does not hide missing data as zero.
- Synthetic fixtures keep CI independent of provider availability and credentials.
- Median/MAD is robust to one-off acquisition spikes and does not require a trained model.
- A failed gate prevents a job from becoming `ready`; a warning remains visible for reviewer action.

## Trade-offs

- A 99% bbox threshold does not prove polygon-level coverage near complex boundaries.
- Temporal anomalies are review signals, not automatic deletion rules.
- CI fixtures cannot replace periodic real-provider validation.

## Revisit triggers

- Introduce polygon intersection or cloud-probability products.
- Add a temporal cube store with at least five validated observations per AOI.
- Replace local worker execution with a distributed processing queue.
