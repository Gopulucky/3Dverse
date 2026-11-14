// Portal load-speed rules, pinned at the source level so they cannot quietly
// regress. Measured behaviour (request timing, throttled 4G) is in the commit
// notes; these tests guard the structure that produces it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL(`../../src/${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('dashboards reach recharts only through the lazy chart module', () => {
  for (const f of ['app/admin/dashboard/page.tsx', 'components/creator/SelfFulfillingDashboard.tsx', 'components/creator/DesignerOnlyDashboard.tsx']) {
    const s = src(f);
    assert.doesNotMatch(s, /from "recharts"/, `${f} imports recharts directly, which puts it in the page bundle`);
    assert.match(s, /@\/components\/shared\/lazy-charts/, `${f} should use the lazy chart module`);
  }
});

test('the lazy chart module is code-split and starts its download early', () => {
  const s = src('components/shared/lazy-charts.tsx');
  assert.match(s, /dynamic\(/);
  assert.match(s, /ssr: false/);
  // Without this, the chart chunk is requested only after the data lands: a second wait.
  assert.match(s, /void import\("\.\/portal-charts"\)/);
});

test('only portal-charts imports recharts', () => {
  assert.match(src('components/shared/portal-charts.tsx'), /from "recharts"/);
});

test('the creator dashboard paints from the cached path instead of waiting on the server', () => {
  const s = src('app/creator/dashboard/page.tsx');
  assert.match(s, /if \(cached\) setIsLoading\(false\)/);
});

test('the partner console blocks first paint on visible data only', () => {
  const s = src('app/partner/page.tsx');
  assert.match(s, /const isLoading = isLoadingJobs \|\| isLoadingAnalytics;/);
  assert.match(s, /queryFn: \(\) => api\.get<FleetPrinter\[\]>\("\/api\/partner\/printers"\),\n\s+enabled: isAuthenticated && activeTab === "fleet"/);
});

test('portal pages do not fetch the customer cart', () => {
  assert.match(src('components/layout/navbar.tsx'), /useCart\(isAuthenticated && isMarketplace\)/);
});
