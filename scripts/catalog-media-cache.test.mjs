import assert from 'node:assert/strict';
import test from 'node:test';
import { catalogVariantKey, DEFAULT_COVER_WIDTH, parseVariantWidths, publicMediaUrl, resolveVariantPlan, sourceVersion } from './catalog-media-cache.mjs';

test('default plan creates four responsive widths with a 640px canonical cover', () => {
  assert.deepEqual(resolveVariantPlan(), { widths: [160, 320, 640, 960], defaultWidth: DEFAULT_COVER_WIDTH });
});

test('width parsing is sorted, deduplicated and keeps the requested default', () => {
  assert.deepEqual(resolveVariantPlan({ widths: '960,320,320', defaultWidth: '640' }), {
    widths: [320, 640, 960],
    defaultWidth: 640,
  });
  assert.deepEqual(parseVariantWidths('640,160'), [160, 640]);
});

test('content version and object keys are deterministic and immutable', () => {
  const version = sourceVersion(Buffer.from('same-source'));
  assert.equal(version, sourceVersion(Buffer.from('same-source')));
  assert.notEqual(version, sourceVersion(Buffer.from('changed-source')));
  assert.equal(catalogVariantKey('product/1', version, 320), `catalog/products/product_1/${version}/cover-320.webp`);
  assert.equal(publicMediaUrl('https://img.hbbtzn.com/', catalogVariantKey('p1', version, 640)), `https://img.hbbtzn.com/catalog/products/p1/${version}/cover-640.webp`);
});

test('unsafe widths and versions fail closed', () => {
  assert.throws(() => parseVariantWidths('0,640'), /Invalid catalog image width/);
  assert.throws(() => catalogVariantKey('p1', 'not-a-version', 640), /version is invalid/);
});
