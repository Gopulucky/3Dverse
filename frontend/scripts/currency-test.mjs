import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';

// Compile the real standalone TypeScript helper in memory; no test dependencies.
const path = new URL('../src/lib/currency.ts', import.meta.url);
const source = existsSync(path) ? readFileSync(path, 'utf8') : 'export const formatMoney = (amount) => `$${amount.toFixed(2)}`;';
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { formatMoney } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`);
assert.equal(formatMoney(123456.5), '₹1,23,456.50');
assert.equal(formatMoney(12, 'USD'), 'USD\u00a012.00');
assert.equal(formatMoney(0, 'INR'), '₹0.00');
console.log('Currency checks passed: Indian grouping, INR default, explicit USD, zero.');
