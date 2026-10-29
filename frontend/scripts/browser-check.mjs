import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const port = process.env.TEST_PORT || '3100';
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], {
  stdio: 'inherit', windowsHide: true,
});
try {
  const deadline = Date.now() + 60_000;
  while (true) {
    if (server.exitCode !== null) throw new Error('Frontend server exited before tests');
    try { if ((await fetch(`${base}/login`, {signal:AbortSignal.timeout(2000)})).ok) break; } catch { /* wait for startup */ }
    if (Date.now() > deadline) throw new Error('Frontend did not start within 60 seconds');
    await delay(500);
  }
  for (const script of ['marketplace-smoke', 'customer-options-smoke', 'auth-smoke', 'partner-smoke']) {
    const test = spawn(process.execPath, [`scripts/${script}.mjs`, base], {
      stdio: 'inherit', windowsHide: true,
      env: {...process.env, BROWSER_CHANNEL:process.env.BROWSER_CHANNEL || 'chromium'},
    });
    const [code] = await once(test, 'exit');
    if (code !== 0) throw new Error(`${script} failed with exit code ${code}`);
  }
} finally {
  server.kill();
}
