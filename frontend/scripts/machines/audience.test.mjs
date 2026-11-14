import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadTs } from '../load-ts.mjs';

const a = await loadTs('src/lib/audience.ts');
const ids = { responseId: 'response_abc12345', anonId: 'visitor_abc12345' };
const form = (changes = {}) => ({ ...a.EMPTY_FORM, ...changes });

test('the choices match the backend schema exactly', () => {
  const schema = readFileSync(new URL('../../../backend/app/schemas/audience.py', import.meta.url), 'utf8');
  const literal = (name) => [...schema.match(new RegExp(`${name} = Literal\\[([^\\]]+)\\]`))[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
  const values = (options) => options.map((option) => option.value);
  assert.deepEqual(values(a.ROLES), literal('Role'));
  assert.deepEqual(values(a.USES), literal('Use'));
  assert.deepEqual(values(a.OCCASIONS), literal('Occasion'));
  assert.deepEqual(values(a.PRINTERS), literal('Printer'));
  assert.deepEqual(values(a.PERSONALISE), literal('Personalise'));
  assert.deepEqual(values(a.BOUGHT_WHERE), literal('BoughtWhere'));
  assert.deepEqual(values(a.SPEND_BANDS), literal('SpendBand'));
});

test('every choice has a label', () => {
  for (const group of [a.ROLES, a.USES, a.OCCASIONS, a.PRINTERS, a.PERSONALISE, a.BOUGHT_WHERE, a.SPEND_BANDS]) {
    for (const option of group) assert.ok(option.label.length > 1, option.value);
  }
  assert.equal(a.labelOf(a.ROLES, 'parent'), a.ROLES.find((o) => o.value === 'parent').label);
  assert.equal(a.labelOf(a.ROLES, 'unknown_value'), 'unknown_value');
});

test('at most two uses can be picked and a tap on a picked one removes it', () => {
  assert.deepEqual(a.toggleUse([], 'gifts'), ['gifts']);
  assert.deepEqual(a.toggleUse(['gifts'], 'hobby'), ['gifts', 'hobby']);
  assert.deepEqual(a.toggleUse(['gifts', 'hobby'], 'home_decor'), ['gifts', 'hobby']);
  assert.deepEqual(a.toggleUse(['gifts', 'hobby'], 'gifts'), ['hobby']);
});

test('occasions are only asked after gifts; spend only after a past purchase', () => {
  assert.equal(a.showOccasions(form({ uses: ['gifts'] })), true);
  assert.equal(a.showOccasions(form({ uses: ['hobby'] })), false);
  for (const place of ['marketplace', 'etsy_instagram', 'local_shop']) assert.equal(a.asksSpend(form({ boughtWhere: place })), true);
  for (const place of ['', 'made_it', 'never']) assert.equal(a.asksSpend(form({ boughtWhere: place })), false);
});

test('each save sends everything answered so far, and nothing that was left blank', () => {
  assert.deepEqual(a.answersPayload(form(), 1, ids), { response_id: ids.responseId, anon_id: ids.anonId, step: 1 });
  const full = form({ role: 'parent', city: '  New   Delhi ', uses: ['gifts'], occasions: ['birthday'], ownsPrinter: 'no', personalise: 'always',
    boughtWhere: 'local_shop', spendBand: '500_1500', missing: '  nothing  local ' });
  assert.deepEqual(a.answersPayload(full, 3, ids), {
    response_id: ids.responseId, anon_id: ids.anonId, step: 3, role: 'parent', city: 'New Delhi', uses: ['gifts'], occasions: ['birthday'],
    owns_printer: 'no', personalise: 'always', bought_where: 'local_shop', spend_band: '500_1500', missing: 'nothing local' });
});

test('answers that no longer apply are not sent', () => {
  const payload = a.answersPayload(form({ uses: ['hobby'], occasions: ['birthday'], boughtWhere: 'never', spendBand: 'under_500' }), 3, ids);
  assert.equal('occasions' in payload, false);
  assert.equal('spend_band' in payload, false);
});

test('without a visitor id the payload simply omits it', () => {
  assert.equal('anon_id' in a.answersPayload(form(), 1, { responseId: ids.responseId }), false);
});

test('contact details are sent only on the last step, with consent', () => {
  const contact = form({ email: ' Asha@Example.COM ', whatsapp: '+91 98765-43210', chatOk: true, consent: true });
  assert.equal('email' in a.answersPayload(contact, 3, ids), false);
  assert.deepEqual(a.answersPayload(contact, 4, ids), { response_id: ids.responseId, anon_id: ids.anonId, step: 4,
    email: 'asha@example.com', whatsapp: '9876543210', chat_ok: true, consent: true });
});

test('typed contact details are never sent unless the consent box is ticked', () => {
  const typed = form({ role: 'parent', email: 'asha@example.com', whatsapp: '9876543210', chatOk: true, consent: false });
  const payload = a.answersPayload(typed, 4, ids);
  for (const key of ['email', 'whatsapp', 'chat_ok', 'consent']) assert.equal(key in payload, false, key);
  assert.equal(payload.role, 'parent');
});

test('only an email and consent are required; WhatsApp must be an Indian mobile if given', () => {
  assert.deepEqual(a.validateContact(form()), { email: 'Enter your email address.', consent: 'Tick the box so we can contact you.' });
  assert.deepEqual(a.validateContact(form({ email: 'not-an-email', consent: true })), { email: 'Enter a valid email address.' });
  assert.deepEqual(a.validateContact(form({ email: 'a@b.co', consent: true })), {});
  assert.deepEqual(a.validateContact(form({ email: 'a@b.co', consent: true, whatsapp: '12345' })), { whatsapp: 'Enter a 10-digit Indian mobile number, or leave this blank.' });
  assert.deepEqual(a.validateContact(form({ email: 'a@b.co', consent: true, whatsapp: '+91 98765 43210' })), {});
});

test('a step with no answers is not worth saving', () => {
  assert.equal(a.stepHasAnswers(form(), 1), false);
  assert.equal(a.stepHasAnswers(form({ role: 'student' }), 1), true);
  assert.equal(a.stepHasAnswers(form({ role: 'student' }), 2), false);
  assert.equal(a.stepHasAnswers(form({ ownsPrinter: 'yes' }), 2), true);
  assert.equal(a.stepHasAnswers(form({ missing: 'x' }), 3), true);
});

test('the CSV protects spreadsheets from formulas and joins lists', () => {
  const row = { created_at: '2026-11-14T10:00:00', step_reached: 4, role: 'parent', city: '=cmd()', uses: ['gifts', 'hobby'], occasions: [],
    owns_printer: 'no', personalise: null, bought_where: null, spend_band: null, missing: 'too, "pricey"', email: 'a@b.co', whatsapp: null, chat_ok: true };
  const [header, line] = a.audienceCsv([row]).split('\r\n');
  assert.match(header, /^created_at,step_reached,role,city,uses,/);
  assert.ok(line.includes(`"'=cmd()"`));
  assert.ok(line.includes('gifts; hobby'));
  assert.ok(line.includes('"too, ""pricey"""'));
  assert.ok(line.endsWith('yes'));
});
