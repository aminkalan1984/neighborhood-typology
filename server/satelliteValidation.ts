/** Deterministic, model-independent validation used before any ML consumer. */

export type SatelliteValidationStatus = 'passed' | 'warning' | 'failed' | 'not_applicable';

export interface SatelliteValidationCheck {
  name: string;
  status: SatelliteValidationStatus;
  message: string;
  metrics?: Record<string, number | string | boolean>;
}

export interface SatelliteValidationMatrix {
  valid: boolean;
  checks: SatelliteValidationCheck[];
  errors: string[];
  warnings: string[];
  generated_at: string;
}

export type SatelliteBbox = [number, number, number, number];

export interface SatelliteGridDescriptor {
  id: string;
  crs: string | null;
  width: number;
  height: number;
  transform: number[];
}

export interface SatelliteQaSummary {
  total_pixels: number;
  valid_pixels: number;
  clear_pixels?: number;
  invalid_class_counts?: Record<string, number>;
}

export interface TemporalObservation {
  timestamp: string;
  value: number | null;
}

export interface TemporalAnomaly {
  timestamp: string;
  value: number;
  robust_z: number;
  baseline: number;
}

export interface TemporalAnomalyReport {
  status: 'stable' | 'anomaly' | 'insufficient_data';
  observations: number;
  baseline: number | null;
  mad: number | null;
  threshold: number;
  anomalies: TemporalAnomaly[];
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function area(bounds: SatelliteBbox): number {
  return Math.max(0, bounds[2] - bounds[0]) * Math.max(0, bounds[3] - bounds[1]);
}

function intersection(a: SatelliteBbox, b: SatelliteBbox): SatelliteBbox | null {
  const result: SatelliteBbox = [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
  return result[0] < result[2] && result[1] < result[3] ? result : null;
}

export function validateAoiCoverage(aoi: SatelliteBbox, outputBounds: SatelliteBbox, minimumFraction = 0.99): SatelliteValidationCheck {
  const aoiArea = area(aoi);
  const overlap = intersection(aoi, outputBounds);
  const overlapArea = overlap ? area(overlap) : 0;
  const fraction = aoiArea > 0 ? overlapArea / aoiArea : 0;
  const status: SatelliteValidationStatus = fraction >= minimumFraction ? 'passed' : fraction > 0 ? 'warning' : 'failed';
  return {
    name: 'aoi-coverage',
    status,
    message: status === 'passed' ? 'Output bounds cover the requested AOI.' : status === 'warning' ? 'Output intersects only part of the requested AOI.' : 'Output does not intersect the requested AOI.',
    metrics: { aoi_area: aoiArea, overlap_area: overlapArea, coverage_fraction: Number(fraction.toFixed(6)), minimum_fraction: minimumFraction },
  };
}

export function validateQaMask(summary: SatelliteQaSummary): SatelliteValidationCheck {
  const total = finite(summary.total_pixels) ? summary.total_pixels : 0;
  const valid = finite(summary.valid_pixels) ? summary.valid_pixels : 0;
  const clear = finite(summary.clear_pixels) ? summary.clear_pixels : valid;
  const validFraction = total > 0 ? valid / total : 0;
  const clearFraction = total > 0 ? clear / total : 0;
  const countsOutOfRange = total <= 0 || valid < 0 || clear < 0 || valid > total || clear > total;
  const status: SatelliteValidationStatus = countsOutOfRange || valid <= 0 ? 'failed' : clearFraction < 0.1 ? 'warning' : 'passed';
  return {
    name: 'qa-mask',
    status,
    message: status === 'failed' ? (countsOutOfRange ? 'QA pixel counts are outside the valid range.' : 'QA mask contains no valid pixels.') : status === 'warning' ? 'QA mask leaves less than 10% clear coverage.' : 'QA mask and valid-pixel coverage are usable.',
    metrics: { total_pixels: total, valid_pixels: valid, valid_fraction: Number(validFraction.toFixed(6)), clear_pixels: clear, clear_fraction: Number(clearFraction.toFixed(6)), invalid_class_count: Object.values(summary.invalid_class_counts ?? {}).reduce((sum, value) => sum + (finite(value) ? value : 0), 0), counts_in_range: !countsOutOfRange },
  };
}

export function validateCoRegistration(grids: SatelliteGridDescriptor[], tolerance = 1e-6): SatelliteValidationCheck {
  if (grids.length < 2) return { name: 'co-registration', status: 'not_applicable', message: 'At least two grids are required for co-registration comparison.', metrics: { grid_count: grids.length } };
  const reference = grids[0];
  const mismatches = grids.slice(1).filter((grid) => grid.crs !== reference.crs || grid.width !== reference.width || grid.height !== reference.height || grid.transform.length !== reference.transform.length || grid.transform.some((value, index) => Math.abs(value - reference.transform[index]) > tolerance));
  const status: SatelliteValidationStatus = mismatches.length === 0 ? 'passed' : 'failed';
  return {
    name: 'co-registration',
    status,
    message: status === 'passed' ? 'All raster outputs share one CRS, shape, and affine transform.' : 'Raster outputs are not co-registered on the same grid.',
    metrics: { grid_count: grids.length, mismatch_count: mismatches.length, tolerance },
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Robust temporal baseline using median/MAD; deterministic and resistant to one-off spikes. */
export function detectTemporalAnomalies(observations: TemporalObservation[], options: { threshold?: number; minimumObservations?: number; minimumAbsoluteDeviation?: number } = {}): TemporalAnomalyReport {
  const threshold = options.threshold ?? 3.5;
  const minimumObservations = options.minimumObservations ?? 5;
  const minimumAbsoluteDeviation = options.minimumAbsoluteDeviation ?? 0.05;
  const usable = observations
    .map((observation) => ({ ...observation, time: Date.parse(observation.timestamp) }))
    .filter((observation): observation is TemporalObservation & { time: number; value: number } => Number.isFinite(observation.time) && finite(observation.value))
    .sort((a, b) => a.time - b.time);
  if (usable.length < minimumObservations) return { status: 'insufficient_data', observations: usable.length, baseline: null, mad: null, threshold, anomalies: [] };
  const baseline = median(usable.map((observation) => observation.value));
  const mad = median(usable.map((observation) => Math.abs(observation.value - baseline)));
  const anomalies = usable.flatMap((observation) => {
    const difference = observation.value - baseline;
    // If MAD is zero, the baseline is constant; any material deviation is an outlier.
    const robustZ = mad > 1e-9 ? (0.67448975 * difference) / mad : Math.abs(difference) >= minimumAbsoluteDeviation ? Math.sign(difference) * (threshold + 1) : 0;
    return Math.abs(robustZ) >= threshold ? [{ timestamp: observation.timestamp, value: observation.value, robust_z: Number(robustZ.toFixed(4)), baseline: Number(baseline.toFixed(6)) }] : [];
  });
  return { status: anomalies.length > 0 ? 'anomaly' : 'stable', observations: usable.length, baseline: Number(baseline.toFixed(6)), mad: Number(mad.toFixed(6)), threshold, anomalies };
}

export function buildSatelliteValidationMatrix(input: {
  aoi: SatelliteBbox;
  output_bounds: SatelliteBbox;
  qa: SatelliteQaSummary;
  grids: SatelliteGridDescriptor[];
  temporal?: TemporalObservation[];
  generated_at?: string;
}): SatelliteValidationMatrix {
  const checks: SatelliteValidationCheck[] = [validateAoiCoverage(input.aoi, input.output_bounds), validateQaMask(input.qa), validateCoRegistration(input.grids)];
  if (input.temporal) {
    const report = detectTemporalAnomalies(input.temporal);
    checks.push({ name: 'temporal-anomaly', status: report.status === 'anomaly' ? 'warning' : report.status === 'insufficient_data' ? 'not_applicable' : 'passed', message: report.status === 'anomaly' ? 'Temporal outliers were detected and require review.' : report.status === 'insufficient_data' ? 'Not enough observations for a temporal baseline.' : 'No robust temporal outlier was detected.', metrics: { observations: report.observations, anomalies: report.anomalies.length, threshold: report.threshold } });
  } else {
    checks.push({ name: 'temporal-anomaly', status: 'not_applicable', message: 'No temporal observation series was supplied.' });
  }
  const errors = checks.filter((check) => check.status === 'failed').map((check) => check.message);
  const warnings = checks.filter((check) => check.status === 'warning').map((check) => check.message);
  return { valid: errors.length === 0, checks, errors, warnings, generated_at: input.generated_at ?? new Date().toISOString() };
}
