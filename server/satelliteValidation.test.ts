import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSatelliteValidationMatrix, detectTemporalAnomalies, validateAoiCoverage, validateCoRegistration, validateQaMask } from './satelliteValidation';

const grid = (id: string, transform = [10, 0, 500000, 0, -10, 4000000, 0, 0, 1]) => ({ id, crs: 'EPSG:32639', width: 256, height: 256, transform });

test('validates complete AOI coverage and rejects uncovered output', () => {
  assert.equal(validateAoiCoverage([50, 35, 51, 36], [50, 35, 51, 36]).status, 'passed');
  assert.equal(validateAoiCoverage([50, 35, 51, 36], [52, 35, 53, 36]).status, 'failed');
});

test('validates QA coverage and distinguishes low-clear warning from empty failure', () => {
  assert.equal(validateQaMask({ total_pixels: 100, valid_pixels: 90, clear_pixels: 90 }).status, 'passed');
  assert.equal(validateQaMask({ total_pixels: 100, valid_pixels: 5, clear_pixels: 5 }).status, 'warning');
  assert.equal(validateQaMask({ total_pixels: 100, valid_pixels: 0, clear_pixels: 0 }).status, 'failed');
  assert.equal(validateQaMask({ total_pixels: 100, valid_pixels: 101, clear_pixels: 100 }).status, 'failed');
});

test('detects co-registration drift in affine transform', () => {
  assert.equal(validateCoRegistration([grid('red'), grid('nir')]).status, 'passed');
  assert.equal(validateCoRegistration([grid('red'), grid('nir', [10, 0, 500001, 0, -10, 4000000, 0, 0, 1])]).status, 'failed');
});

test('detects robust temporal spikes without treating missing data as zero', () => {
  const report = detectTemporalAnomalies([
    { timestamp: '2026-01-01T00:00:00Z', value: 0.42 },
    { timestamp: '2026-02-01T00:00:00Z', value: 0.43 },
    { timestamp: '2026-03-01T00:00:00Z', value: 0.41 },
    { timestamp: '2026-04-01T00:00:00Z', value: 0.44 },
    { timestamp: '2026-05-01T00:00:00Z', value: 0.43 },
    { timestamp: '2026-06-01T00:00:00Z', value: 0.05 },
    { timestamp: '2026-07-01T00:00:00Z', value: null },
  ]);
  assert.equal(report.status, 'anomaly');
  assert.equal(report.anomalies[0].timestamp, '2026-06-01T00:00:00Z');
  assert.equal(detectTemporalAnomalies([{ timestamp: '2026-01-01T00:00:00Z', value: 0.4 }]).status, 'insufficient_data');
});

test('detects temporal spikes when the baseline has zero MAD', () => {
  const report = detectTemporalAnomalies([
    { timestamp: '2026-01-01T00:00:00Z', value: 0.4 },
    { timestamp: '2026-02-01T00:00:00Z', value: 0.4 },
    { timestamp: '2026-03-01T00:00:00Z', value: 0.4 },
    { timestamp: '2026-04-01T00:00:00Z', value: 0.4 },
    { timestamp: '2026-05-01T00:00:00Z', value: 0.4 },
    { timestamp: '2026-06-01T00:00:00Z', value: 0.9 },
  ]);
  assert.equal(report.status, 'anomaly');
  assert.equal(report.anomalies.length, 1);
});

test('builds a matrix that passes deterministic checks while surfacing temporal review', () => {
  const matrix = buildSatelliteValidationMatrix({
    aoi: [50, 35, 51, 36],
    output_bounds: [50, 35, 51, 36],
    qa: { total_pixels: 100, valid_pixels: 95, clear_pixels: 95 },
    grids: [grid('red'), grid('nir')],
    temporal: [
      { timestamp: '2026-01-01T00:00:00Z', value: 0.4 },
      { timestamp: '2026-02-01T00:00:00Z', value: 0.4 },
      { timestamp: '2026-03-01T00:00:00Z', value: 0.41 },
      { timestamp: '2026-04-01T00:00:00Z', value: 0.39 },
      { timestamp: '2026-05-01T00:00:00Z', value: 0.4 },
      { timestamp: '2026-06-01T00:00:00Z', value: 0.4 },
    ],
    generated_at: '2026-08-26T00:00:00Z',
  });
  assert.equal(matrix.valid, true);
  assert.equal(matrix.checks.length, 4);
  assert.ok(matrix.checks.some((check) => check.name === 'temporal-anomaly' && check.status === 'passed'));
});
