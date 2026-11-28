import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from '../load-ts.mjs';

const { includedRows, printRows } = await loadTs('src/lib/product-details.ts');
const rows = (list) => Object.fromEntries(list.map((row) => [row.label, row.value]));

const version = { is_latest: true, file_format: 'STL', file_size: 1_258_291, printability_report: { status: 'pass', volume_mm3: 357300, dimensions: { x: 44, y: 35.4, z: 9 } } };

test('what the buyer gets lists only facts the listing has', () => {
  assert.deepEqual(rows(includedRows({ versions: [version], license_type: 'Personal Use' }, ['digital'])), {
    'File': 'STL, 1.2 MB', 'Size': '44 × 35 × 9 mm', 'Volume': '357.3 cm³', 'Printability check': 'Passed',
    'Licence': 'Personal Use', 'Delivery': 'Download after payment',
  });
  assert.deepEqual(includedRows({ versions: [] }, []), []);
});

test('delivery follows the formats on sale, and a failed check is not dressed up', () => {
  assert.equal(rows(includedRows({}, ['physical'])).Delivery, 'Printed and shipped');
  assert.equal(rows(includedRows({}, ['digital', 'physical'])).Delivery, 'Download after payment, or printed and shipped');
  const warned = { versions: [{ ...version, file_size: 900, printability_report: { status: 'warning' } }] };
  assert.deepEqual(rows(includedRows(warned, [])), { 'File': 'STL, 1 KB', 'Printability check': 'Passed with warnings' });
});

test('print settings come only from what was saved, in either stored shape', () => {
  assert.deepEqual(rows(printRows({ recommended_materials: ['PLA', 'PETG'], layer_height: 0.2, supports_required: false, infill_percentage: 15, raft_brim_required: true })), {
    'Material': 'PLA, PETG', 'Layer height': '0.2 mm', 'Supports': 'Not required', 'Infill': '15%', 'Raft or brim': 'Needed',
  });
  assert.deepEqual(rows(printRows({ layer_height: '0.2mm', infill: '15%', supports: 'none' })), { 'Layer height': '0.2 mm', 'Supports': 'Not required', 'Infill': '15%' });
  assert.deepEqual(rows(printRows({ supports: 'touching the bed only' })), { 'Supports': 'Touching the bed only' });
  for (const nothing of [undefined, null, {}, { layer_height: 0, recommended_materials: [] }]) assert.deepEqual(printRows(nothing), []);
});
