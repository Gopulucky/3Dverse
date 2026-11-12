import test from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const { productImage, productThumb, thumbOf } = await loadTs('src/lib/marketplace.ts');

const media = (url, extra = {}) => ({ media_url: url, media_type: 'image', ...extra });

test('cards use the small copy when there is one', () => {
  const product = { media: [media('/big.png', { is_primary: true, thumb_url: '/small.webp' })] };
  assert.equal(productThumb(product), '/small.webp');
  assert.equal(productImage(product), '/big.png', 'the full-size image is still available for the product page');
});

test('images uploaded before thumbnails existed fall back to the original', () => {
  assert.equal(productThumb({ media: [media('/old.png', { is_primary: true })] }), '/old.png');
  assert.equal(productThumb({ media: [media('/old.png', { thumb_url: null })] }), '/old.png');
});

test('the same image is chosen for the thumb and the original', () => {
  const product = { media: [media('/first.png', { thumb_url: '/first.webp' }), media('/main.png', { is_primary: true, thumb_url: '/main.webp' })] };
  assert.equal(productImage(product), '/main.png');
  assert.equal(productThumb(product), '/main.webp');
});

test('videos are never used as a card image', () => {
  const product = { media: [{ media_url: '/clip.mp4', media_type: 'video', is_primary: true }, media('/photo.png', { thumb_url: '/photo.webp' })] };
  assert.equal(productThumb(product), '/photo.webp');
  assert.equal(productThumb({ media: [{ media_url: '/clip.mp4', media_type: 'video' }] }), undefined);
  assert.equal(productThumb({}), undefined);
});

test('thumbOf picks the small copy of a single media entry', () => {
  assert.equal(thumbOf(media('/a.png', { thumb_url: '/a.webp' })), '/a.webp');
  assert.equal(thumbOf(media('/a.png')), '/a.png');
  assert.equal(thumbOf(undefined), undefined);
});
