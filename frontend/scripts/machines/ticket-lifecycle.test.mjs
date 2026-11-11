import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from '../load-ts.mjs';

const m = await loadTs('src/lib/ticket-lifecycle.ts');

function backendStatuses() {
  const py = readFileSync(new URL('../../../backend/app/models/collaboration.py', import.meta.url), 'utf8');
  const body = py.match(/class TicketStatus\(str, enum\.Enum\):([\s\S]*?)\n\n/)[1];
  return [...body.matchAll(/=\s*"(\w+)"/g)].map((x) => x[1]);
}

test('every backend ticket status has a label, a group and a tone', () => {
  const statuses = backendStatuses();
  assert.ok(statuses.length >= 9, statuses.join());
  for (const s of statuses) {
    assert.ok(m.TICKET_LABEL[s], `label for ${s}`);
    assert.ok(['action', 'progress', 'closed', 'hidden'].includes(m.inboxGroup(s)), `group for ${s}`);
    assert.ok(['success', 'warning', 'in-progress', 'neutral'].includes(m.ticketTone(s)), `tone for ${s}`);
  }
});

test('human labels', () => {
  assert.equal(m.TICKET_LABEL.paid, 'Waiting for design');
  assert.equal(m.TICKET_LABEL.design_submitted, 'Design received');
  assert.equal(m.TICKET_LABEL.sample_printing, 'Printing sample');
  assert.equal(m.TICKET_LABEL.certified, 'Quote sent');
  assert.equal(m.TICKET_LABEL.rejected, 'Declined');
  assert.equal(m.ticketLabel('something_new'), 'something new');
  assert.equal(m.ticketLabel(undefined), 'Unknown');
});

test('inbox groups', () => {
  for (const s of ['paid', 'design_submitted', 'sample_printing']) assert.equal(m.inboxGroup(s), 'action');
  for (const s of ['certified', 'negotiating']) assert.equal(m.inboxGroup(s), 'progress');
  for (const s of ['agreed', 'rejected', 'expired']) assert.equal(m.inboxGroup(s), 'closed');
  assert.equal(m.inboxGroup('pending_payment'), 'hidden');
  assert.equal(m.inboxGroup('nonsense'), 'hidden');
});

test('next action per status', () => {
  assert.equal(m.nextAction('paid'), 'wait');
  assert.equal(m.nextAction('design_submitted'), 'accept');
  assert.equal(m.nextAction('sample_printing'), 'quote');
  for (const s of ['certified', 'negotiating', 'agreed', 'rejected', 'expired', 'pending_payment']) assert.equal(m.nextAction(s), null);
});

test('tones', () => {
  assert.equal(m.ticketTone('agreed'), 'success');
  assert.equal(m.ticketTone('pending_payment'), 'warning');
  assert.equal(m.ticketTone('design_submitted'), 'in-progress');
  assert.equal(m.ticketTone('rejected'), 'neutral');
});
