import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';

const path = new URL('../src/lib/support.ts', import.meta.url);
const source = existsSync(path) ? readFileSync(path, 'utf8') : 'export const getSupportPaymentUrl = () => undefined;';
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { getSupportPaymentUrl } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);

for (const input of [undefined, '', '  ', '/pay', 'not a url', 'http://example.test/pay', 'javascript:alert(1)', 'https://user:password@example.test/pay', 'https://user@example.test/pay']) {
  assert.equal(getSupportPaymentUrl(input), null, `Must reject ${String(input)}`);
}
assert.equal(getSupportPaymentUrl('https://example.test/support?currency=INR&reference=3dverse'), 'https://example.test/support?currency=INR&reference=3dverse');
assert.equal(getSupportPaymentUrl('  https://example.test/support  '), 'https://example.test/support');
console.log('PASS support destination validation: absent, unsafe and valid HTTPS configuration');
