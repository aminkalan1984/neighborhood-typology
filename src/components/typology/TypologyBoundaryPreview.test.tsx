import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectBoundaryGeometry } from './TypologyBoundaryPreview';

const square = {
  type: 'Polygon',
  coordinates: [[
    [51, 35],
    [51.01, 35],
    [51.01, 35.01],
    [51, 35.01],
    [51, 35],
  ]],
};

test('inspects a closed Polygon and computes bounds', () => {
  const result = inspectBoundaryGeometry(square);
  assert.equal(result.type, 'Polygon');
  assert.equal(result.positions, 5);
  assert.equal(result.warnings.length, 0);
  assert.deepEqual(result.bounds, { minLon: 51, maxLon: 51.01, minLat: 35, maxLat: 35.01 });
});

test('reports an open ring and unsupported geometry', () => {
  const open = { type: 'Polygon', coordinates: [[[51, 35], [51.01, 35], [51.01, 35.01], [51, 35.01]]] };
  assert.ok(inspectBoundaryGeometry(open).warnings.some((warning) => warning.includes('بسته نیست')));
  assert.equal(inspectBoundaryGeometry({ type: 'Point', coordinates: [51, 35] }).type, null);
});

test('accepts a one-feature FeatureCollection', () => {
  const result = inspectBoundaryGeometry({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: square }] });
  assert.equal(result.type, 'Polygon');
  assert.equal(result.warnings.length, 0);
});
