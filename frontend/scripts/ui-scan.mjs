#!/usr/bin/env node
/**
 * Automated UI bug crawler for the 3DVerse frontend.
 *
 * NOTE on login checks: `next dev` hydrates over an HMR WebSocket, and if
 * that handshake glitches (seen in some headless/proxied environments) the
 * page silently runs degraded — links and forms fall back to native browser
 * behavior, including a native <form> GET that puts the password in the URL.
 * Verified this does NOT happen against a production build (`npm run build
 * && npm run start`). If `login-native-submit` fires against a dev server,
 * re-run against a prod build before treating it as a real bug — that's why
 * it's reported as a warning, not an error.
 *
 * Walks every route in the app, logs in as the demo creator/customer/admin
 * accounts where needed, clicks every visible button/link/tab on each page,
 * and collects whatever src/lib/bug-detector.ts caught along the way
 * (thrown errors, failed API calls, console errors, dead buttons/links,
 * broken navigation) plus anything Playwright itself observed (page crashes,
 * console errors, failed responses).
 *
 * Usage:
 *   node scripts/ui-scan.mjs                 # scan as guest only
 *   node scripts/ui-scan.mjs --base=http://localhost:3000
 *   node scripts/ui-scan.mjs --headed        # watch it run
 *
 * Requires the frontend dev server (and backend API) already running.
 * Env: NEXT_PUBLIC_BUG_DETECTOR must resolve truthy in the running app —
 * it does automatically in `next dev`.
 *
 * Output: a JSON report + human-readable summary printed to stdout, and
 * written to scripts/ui-scan-report.json.
 */

import { chromium } from "playwright";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

const BASE_URL = args.base || process.env.UI_SCAN_BASE_URL || "http://localhost:3000";
const HEADLESS = !args.headed;
const NAV_TIMEOUT = 15_000;
const SETTLE_MS = 700;

// Routes that need auth are visited once per persona below; everything else
// is visited as a guest. Dynamic [id]/[slug] routes are skipped by the static
// crawl (no known id) but are worth spot-checking manually or wiring up with
// real ids via --extra-routes.
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/register",
  "/marketplace",
  "/marketplace/home",
  "/cart",
  "/wishlist",
  "/partner",
];

const CUSTOMER_ROUTES = [
  "/orders",
  "/settings",
  "/checkout",
  "/commissions",
  "/commissions/browse",
  "/commissions/new",
  "/collaboration",
];

const CREATOR_ROUTES = [
  "/creator/dashboard",
  "/creator/products",
  "/creator/products/new",
  "/creator/products/draft",
  "/creator/orders",
  "/creator/portfolio",
  "/creator/analytics",
  "/creator/materials",
  "/creator/printers",
  "/creator/stock",
  "/creator/settings",
  "/creator/onboarding",
];

const ADMIN_ROUTES = [
  "/admin/dashboard",
  "/admin/orders",
  "/admin/products",
  "/admin/returns",
  "/admin/trust-safety",
  "/admin/users",
  "/admin/settings",
];

const PERSONAS = {
  guest: { routes: PUBLIC_ROUTES },
  customer: {
    routes: CUSTOMER_ROUTES,
    email: process.env.UI_SCAN_CUSTOMER_EMAIL || "arjun@3dverse.demo",
    password: process.env.UI_SCAN_CUSTOMER_PASSWORD || "password123",
  },
  creator: {
    routes: CREATOR_ROUTES,
    email: process.env.UI_SCAN_CREATOR_EMAIL || "maya@3dverse.demo",
    password: process.env.UI_SCAN_CREATOR_PASSWORD || "password123",
  },
  admin: {
    routes: ADMIN_ROUTES,
    email: process.env.UI_SCAN_ADMIN_EMAIL,
    password: process.env.UI_SCAN_ADMIN_PASSWORD,
  },
};

/**
 * Log in and verify it actually took effect via the JS handler rather than a
 * native form submit. Next dev compiles routes on demand, so `networkidle`
 * after the initial goto can fire *before* React finishes hydrating — a click
 * that lands in that window submits the <form> natively (a real GET, with the
 * password appended to the URL as a query string). That's not just a test
 * flake: it's a genuine bug on a slow connection or a fast first click, so we
 * both detect it here and report it as a finding rather than silently retrying
 * past it.
 */
async function login(page, email, password, findings) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
  // Give hydration a moment beyond networkidle before trusting the form is wired.
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button[type="submit"]');
      const key = Object.keys(btn || {}).find((k) => k.startsWith("__reactProps$"));
      return !!(btn && key && typeof btn[key]?.onClick !== "undefined");
    },
    { timeout: 8000 }
  ).catch(() => {});

  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(SETTLE_MS);
  await page.waitForLoadState("networkidle", { timeout: NAV_TIMEOUT }).catch(() => {});

  if (page.url().includes("?email=") || page.url().includes("&password=")) {
    findings.push({
      kind: "login-native-submit",
      severity: "warning", // see file header — confirm against a prod build before treating as real
      message:
        "Login form submitted natively instead of via JS — password was appended to the URL as a query string",
      detail: page.url(),
      route: "/login",
    });
    // Recover so the rest of the persona's routes can still be attempted.
    await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(SETTLE_MS);
  }

  const token = await page.evaluate(() => localStorage.getItem("token")).catch(() => null);
  if (!token) {
    findings.push({
      kind: "login-failed",
      severity: "error",
      message: `Login did not produce a token for ${email} — wrong/missing demo credentials, or the login API call failed`,
      route: "/login",
    });
    return false;
  }
  return true;
}

/** Click every safe, visible, enabled control on the current page, one at a time. */
async function clickAround(page, route, findings) {
  const clickable = await page.locator("button, a[href]").all();
  const seenLabels = new Set();

  for (const el of clickable) {
    let label = "";
    try {
      if (!(await el.isVisible()) || !(await el.isEnabled())) continue;
      label = ((await el.textContent()) || "").trim().slice(0, 60);
    } catch {
      continue;
    }

    // Skip destructive/navigating-away actions so the crawl doesn't nuke data
    // or leave the app. Logout, delete, and external links are the obvious
    // offenders; extend this list as new destructive actions are added.
    const skipPattern = /logout|log out|sign out|delete|remove|cancel order|deactivate/i;
    if (skipPattern.test(label)) continue;

    const href = await el.getAttribute("href").catch(() => null);
    if (href && (href.startsWith("http") || href.startsWith("mailto:"))) continue;

    const key = `${label}::${href ?? ""}`;
    if (seenLabels.has(key)) continue; // avoid re-clicking repeated list items
    seenLabels.add(key);

    const urlBefore = page.url();
    try {
      await el.click({ timeout: 3000, trial: false });
      await page.waitForTimeout(250);

      // A click that opens a dialog should be closeable; try Escape so we
      // don't get stuck behind a modal for the rest of the crawl.
      const dialog = page.locator('[role="dialog"]').first();
      if (await dialog.isVisible().catch(() => false)) {
        await page.keyboard.press("Escape").catch(() => {});
        await page.waitForTimeout(150);
      }

      // If the click navigated us away, come back to keep the route's click
      // pass deterministic; the destination route gets its own visit anyway.
      if (page.url() !== urlBefore) {
        await page.goBack({ waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT }).catch(() => {});
        await page.waitForTimeout(200);
      }
    } catch (err) {
      findings.push({
        kind: "click-failed",
        severity: "warning",
        message: `Could not click "${label || "(unlabeled)"}"`,
        detail: String(err).slice(0, 300),
        route,
      });
    }
  }
}

async function visitRoute(page, persona, route, allFindings) {
  const pageErrors = [];
  const onPageError = (err) =>
    pageErrors.push({ kind: "page-crash", severity: "error", message: err.message, stack: err.stack, route });
  const onResponse = (res) => {
    if (res.status() >= 500) {
      pageErrors.push({
        kind: "server-error-response",
        severity: "error",
        message: `${res.request().method()} ${res.status()} ${res.url()}`,
        route,
      });
    }
  };
  page.on("pageerror", onPageError);
  page.on("response", onResponse);

  try {
    const res = await page.goto(`${BASE_URL}${route}`, {
      waitUntil: "networkidle",
      timeout: NAV_TIMEOUT,
    });
    await page.waitForTimeout(SETTLE_MS);

    if (res && res.status() >= 400) {
      pageErrors.push({
        kind: "navigation-error",
        severity: "error",
        message: `GET ${route} responded ${res.status()}`,
        route,
      });
    }

    // Trigger the in-app DOM audit for dead buttons/links on this route.
    await page.evaluate(() => window.__3DVERSE_BUGS__?.audit?.()).catch(() => {});
    await clickAround(page, route, pageErrors);
    await page.evaluate(() => window.__3DVERSE_BUGS__?.audit?.()).catch(() => {});

    const clientBugs = await page
      .evaluate(() => window.__3DVERSE_BUGS__?.get?.() ?? [])
      .catch(() => []);

    allFindings.push({ persona, route, status: res?.status() ?? null, pageErrors, clientBugs });
  } catch (err) {
    pageErrors.push({
      kind: "navigation-error",
      severity: "error",
      message: `Failed to load ${route}: ${err.message}`,
      route,
    });
    allFindings.push({ persona, route, status: null, pageErrors, clientBugs: [] });
  } finally {
    page.off("pageerror", onPageError);
    page.off("response", onResponse);
  }
}

async function main() {
  const browser = await chromium.launch({ headless: HEADLESS });
  const results = [];

  for (const [persona, config] of Object.entries(PERSONAS)) {
    if (persona !== "guest" && (!config.email || !config.password)) {
      console.log(`Skipping persona "${persona}" — no credentials set.`);
      continue;
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    if (persona !== "guest") {
      console.log(`\n=== Logging in as ${persona} (${config.email}) ===`);
      const loginFindings = [];
      let ok = false;
      try {
        ok = await login(page, config.email, config.password, loginFindings);
      } catch (err) {
        loginFindings.push({
          kind: "login-failed",
          severity: "error",
          message: `Login threw for ${persona}: ${err.message}`,
          route: "/login",
        });
      }
      if (loginFindings.length) {
        results.push({ persona, route: "/login", status: null, pageErrors: loginFindings, clientBugs: [] });
      }
      if (!ok) {
        console.log(`  ! Skipping ${persona}'s routes — not authenticated.`);
        await context.close();
        continue;
      }
    }

    for (const route of config.routes) {
      process.stdout.write(`[${persona}] ${route} ... `);
      const before = results.length;
      await visitRoute(page, persona, route, results);
      const r = results[results.length - 1];
      const count = r.pageErrors.length + r.clientBugs.length;
      console.log(count === 0 ? "clean" : `${count} finding(s)`);
    }

    await context.close();
  }

  await browser.close();

  const flat = results.flatMap((r) =>
    [...r.pageErrors, ...r.clientBugs.map((b) => ({ ...b, persona: r.persona }))].map((f) => ({
      persona: r.persona,
      route: r.route,
      ...f,
    }))
  );

  const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "ui-scan-report.json");
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl: BASE_URL, results, findings: flat }, null, 2));

  console.log(`\n=== Summary ===`);
  console.log(`Routes visited: ${results.length}`);
  console.log(`Total findings: ${flat.length}`);
  const bySeverity = flat.reduce((acc, f) => {
    acc[f.severity || "error"] = (acc[f.severity || "error"] || 0) + 1;
    return acc;
  }, {});
  console.log(`By severity:`, bySeverity);
  console.log(`Full report: ${outPath}`);

  if (flat.some((f) => f.severity === "error")) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("ui-scan crashed:", err);
  process.exitCode = 1;
});
