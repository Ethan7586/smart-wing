import assert from 'node:assert/strict';
import test from 'node:test';
import { parseServerTiming, percentile, scoreStorefrontPerformance } from './storefront-performance-score.mjs';

test('calculates the p95 from a finite sample set', () => {
  assert.equal(percentile([10, 40, 20, 30]), 40);
  assert.equal(percentile([Number.NaN]), null);
});

test('parses a named Server-Timing duration', () => {
  assert.equal(parseServerTiming('db;dur=4.2, catalog;dur=12.5', 'catalog'), 12.5);
  assert.equal(parseServerTiming(null, 'catalog'), null);
});

test('requires both transport and real-browser evidence for a 95-point pass', () => {
  const transport = {
    document: { allOk: true, p95Ms: 800 },
    catalogMirror: { allOk: true, cacheable: true, validJson: true, p95Ms: 600 },
    catalogApi: { allOk: true, cacheHit: true, p95Ms: 500, serverP95Ms: 20 },
    liveness: { allOk: true, probe: 'liveness', p95Ms: 200 },
  };
  assert.equal(scoreStorefrontPerformance(transport).score, 70);
  const score = scoreStorefrontPerformance({ ...transport, browser: { lcpMs: 1_800, inpMs: 120, cls: 0.02, errorRate: 0 } });
  assert.deepEqual(score, { score: 100, target: 95, passed: true, notes: [] });
});
