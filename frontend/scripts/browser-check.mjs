import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const port = process.env.TEST_PORT || '3100';
const base = `http://127.0.0.1:${port}`;
// Keep support fixtures independent of an operator's real payment destination.
for (const supportUrl of ['', 'https://payments.example.test/support?currency=INR']) {
  const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', port], {
    stdio: 'inherit', windowsHide: true,
    env: { ...process.env, SUPPORT_PAYMENT_URL: supportUrl },
  });
  try {
    const deadline = Date.now() + 60_000;
    while (true) {
      if (server.exitCode !== null) throw new Error('Frontend server exited before tests');
      try { if ((await fetch(`${base}/login`, {signal:AbortSignal.timeout(2000)})).ok) break; } catch { /* wait for startup */ }
      if (Date.now() > deadline) throw new Error('Frontend did not start within 60 seconds');
      await delay(500);
    }
    const scripts = supportUrl ? ['support-smoke'] : ['marketplace-smoke', 'customer-options-smoke', 'auth-smoke', 'partner-smoke', 'support-smoke'];
    for (const script of scripts) {
      const test = spawn(process.execPath, [`scripts/${script}.mjs`, base, ...(script === 'support-smoke' ? [supportUrl] : [])], {
        stdio: 'inherit', windowsHide: true,
        env: {...process.env, BROWSER_CHANNEL:process.env.BROWSER_CHANNEL || 'chromium'},
      });
      const [code] = await once(test, 'exit');
      if (code !== 0) throw new Error(`${script} failed with exit code ${code}`);
    }
  } finally {
    if (server.exitCode === null && server.signalCode === null) {
      const exited = once(server, 'exit');
      server.kill();
      await exited;
    }
  }
}
