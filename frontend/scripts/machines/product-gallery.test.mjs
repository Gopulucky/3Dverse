import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const { buildGallery } = await loadTs('src/lib/product-gallery.ts');
const { startingPrice, defaultFormat } = await loadTs('src/lib/marketplace.ts');

const image = (id, extra = {}) => ({ id, media_url: `/img/${id}.png`, media_type: 'image', ...extra });

test('the 3D model is the first slide, then the uploaded images', () => {
  const items = buildGallery({ media: [image(1), image(2)] }, '/m/preview.glb');
  assert.deepEqual(items.map((item) => item.kind), ['model', 'image', 'image']);
  assert.equal(items[0].url, '/m/preview.glb');
});

test('without a 3D preview the gallery starts with the images', () => {
  const items = buildGallery({ media: [image(1)] }, null);
  assert.deepEqual(items.map((item) => item.kind), ['image']);
});

test('the primary image leads the other images', () => {
  const items = buildGallery({ media: [image(1), image(2, { is_primary: true }), image(3)] }, null);
  assert.deepEqual(items.map((item) => item.key), ['media-2', 'media-1', 'media-3']);
});

test('each image keeps a full-size url and a small thumb that falls back to it', () => {
  const [withThumb, withoutThumb] = buildGallery({ media: [image(1, { thumb_url: '/img/1.webp' }), image(2)] }, null);
  assert.equal(withThumb.url, '/img/1.png');
  assert.equal(withThumb.thumb, '/img/1.webp');
  assert.equal(withoutThumb.thumb, '/img/2.png');
});

test('an image carries the creator\'s caption, trimmed, and none when it is blank', () => {
  const items = buildGallery({ media: [image(1, { caption: '  Front view in PETG ' }), image(2, { caption: '   ' }), image(3)] }, null);
  assert.equal(items[0].caption, 'Front view in PETG');
  assert.equal(items[1].caption, undefined);
  assert.equal(items[2].caption, undefined);
});

test('videos are shown as their own slide, never as an image', () => {
  const items = buildGallery({ media: [{ id: 9, media_url: '/clip.mp4', media_type: 'video' }, image(1)] }, null);
  assert.deepEqual(items.map((item) => item.kind), ['image', 'video']);
  assert.equal(items[1].thumb, undefined);
});

test('a video is recognised from its file name when the type is missing', () => {
  const items = buildGallery({ media: [{ id: 4, media_url: '/clip.webm?sig=1' }] }, null);
  assert.equal(items[0].kind, 'video');
});

test('no media and no model gives an empty gallery', () => {
  assert.deepEqual(buildGallery({}, null), []);
  assert.deepEqual(buildGallery({ media: [] }, ''), []);
});

const both = { is_mode_2_active: true, digital_download_enabled: true, is_mode_3_active: true, price: 199, base_print_price: 499 };

test('the starting price is the cheapest format that can be bought', () => {
  assert.equal(startingPrice(both), 199);
  assert.equal(startingPrice({ ...both, price: 999 }), 499);
});

test('an unpriced print is ignored when working out the starting price', () => {
  assert.equal(startingPrice({ ...both, base_print_price: 0 }), 199);
  assert.equal(startingPrice({ is_mode_3_active: true, base_print_price: 0 }), undefined);
  assert.equal(startingPrice({}), undefined);
});

test('a single offered format is chosen for the customer, two are not', () => {
  assert.equal(defaultFormat({ is_mode_2_active: true, digital_download_enabled: true, price: 100 }), 'digital');
  assert.equal(defaultFormat({ is_mode_3_active: true, base_print_price: 300 }), 'physical');
  assert.equal(defaultFormat(both), '');
  assert.equal(defaultFormat({}), '');
});
