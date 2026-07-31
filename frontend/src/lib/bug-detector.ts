/**
 * Runtime bug detector for the 3DVerse frontend.
 *
 * Installs a set of global listeners that capture anything that goes wrong in
 * the browser — thrown errors, rejected promises, console.error output, failed
 * API calls, broken images — plus a DOM audit that flags interactive controls
 * that look dead (buttons with no handler, links pointing nowhere).
 *
 * Everything is collected into an in-memory ring buffer that is exposed on
 * `window.__3DVERSE_BUGS__` so the Playwright crawler in scripts/ui-scan can
 * read it, and rendered by <BugOverlay /> during development.
 *
 * This module is inert unless enabled — see `isDetectorEnabled()`.
 */

export type BugSeverity = "error" | "warning" | "info";

export type BugKind =
  | "uncaught-error"
  | "unhandled-rejection"
  | "console-error"
  | "console-warning"
  | "react-error"
  | "api-error"
  | "network-failure"
  | "slow-request"
  | "resource-error"
  | "dead-control"
  | "broken-link"
  | "navigation-error";

export interface BugRecord {
  id: string;
  kind: BugKind;
  severity: BugSeverity;
  message: string;
  /** Where in the app it happened (pathname at capture time). */
  route: string;
  /** Stack trace, request URL, or element selector — kind dependent. */
  detail?: string;
  stack?: string;
  /** Times this exact fingerprint has been seen. */
  count: number;
  firstSeen: number;
  lastSeen: number;
}

const MAX_RECORDS = 500;
const SLOW_REQUEST_MS = 5000;

let installed = false;
const records = new Map<string, BugRecord>();
const listeners = new Set<(bugs: BugRecord[]) => void>();

/**
 * The detector runs in development by default, and in any environment where
 * NEXT_PUBLIC_BUG_DETECTOR=1 (so it can be turned on against a preview deploy
 * or by the automated crawler without a rebuild).
 */
export function isDetectorEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_BUG_DETECTOR === "1") return true;
  if (process.env.NEXT_PUBLIC_BUG_DETECTOR === "0") return false;
  return process.env.NODE_ENV === "development";
}

function currentRoute(): string {
  if (typeof window === "undefined") return "unknown";
  return window.location.pathname + window.location.search;
}

/** Collapse volatile bits (ids, uuids, timestamps) so repeats dedupe cleanly. */
function fingerprint(kind: string, message: string, route: string): string {
  const normalized = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<uuid>")
    .replace(/\b\d{3,}\b/g, "<n>")
    .slice(0, 200);
  return `${kind}::${route.split("?")[0]}::${normalized}`;
}

function notify() {
  const snapshot = getBugs();
  listeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      /* a broken listener must not break the detector */
    }
  });
}

export function reportBug(input: {
  kind: BugKind;
  severity?: BugSeverity;
  message: string;
  detail?: string;
  stack?: string;
  route?: string;
}): void {
  if (typeof window === "undefined") return;

  const route = input.route ?? currentRoute();
  const severity =
    input.severity ?? (input.kind === "console-warning" ? "warning" : "error");
  const id = fingerprint(input.kind, input.message, route);
  const now = Date.now();

  const existing = records.get(id);
  if (existing) {
    existing.count += 1;
    existing.lastSeen = now;
  } else {
    if (records.size >= MAX_RECORDS) {
      const oldest = records.keys().next().value;
      if (oldest) records.delete(oldest);
    }
    records.set(id, {
      id,
      kind: input.kind,
      severity,
      message: input.message.slice(0, 500),
      detail: input.detail?.slice(0, 1000),
      stack: input.stack?.slice(0, 4000),
      route,
      count: 1,
      firstSeen: now,
      lastSeen: now,
    });
  }

  notify();
}

export function getBugs(): BugRecord[] {
  return Array.from(records.values()).sort((a, b) => b.lastSeen - a.lastSeen);
}

export function clearBugs(): void {
  records.clear();
  notify();
}

export function subscribeToBugs(fn: (bugs: BugRecord[]) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function describeError(value: unknown): { message: string; stack?: string } {
  if (value instanceof Error) {
    return { message: `${value.name}: ${value.message}`, stack: value.stack };
  }
  if (typeof value === "string") return { message: value };
  try {
    return { message: JSON.stringify(value) };
  } catch {
    return { message: String(value) };
  }
}

/** Best-effort CSS path for an element, used to point at dead controls. */
function selectorFor(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  let depth = 0;
  while (node && depth < 4) {
    let part = node.tagName.toLowerCase();
    if (node.id) {
      part += `#${node.id}`;
      parts.unshift(part);
      break;
    }
    const cls = (node.getAttribute("class") || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .join(".");
    if (cls) part += `.${cls}`;
    parts.unshift(part);
    node = node.parentElement;
    depth += 1;
  }
  return parts.join(" > ");
}

function labelFor(el: Element): string {
  const text = (el.textContent || "").trim().replace(/\s+/g, " ");
  if (text) return text.slice(0, 60);
  const aria = el.getAttribute("aria-label") || el.getAttribute("title");
  if (aria) return aria.slice(0, 60);
  return "(no label)";
}

// ---------------------------------------------------------------------------
// Capture: uncaught errors and rejections
// ---------------------------------------------------------------------------

function installErrorHandlers() {
  window.addEventListener("error", (event) => {
    // Resource load failures (img, script, link) surface here with a target
    // but no `error` object.
    const target = event.target as HTMLElement | null;
    if (target && target !== (window as unknown as HTMLElement) && target.tagName) {
      const tag = target.tagName.toLowerCase();
      if (tag === "img" || tag === "script" || tag === "link" || tag === "source") {
        const src =
          target.getAttribute("src") || target.getAttribute("href") || "(no src)";
        reportBug({
          kind: "resource-error",
          severity: tag === "img" ? "warning" : "error",
          message: `Failed to load <${tag}>`,
          detail: src,
        });
        return;
      }
    }

    const { message, stack } = describeError(event.error ?? event.message);
    reportBug({
      kind: "uncaught-error",
      message,
      stack,
      detail: event.filename
        ? `${event.filename}:${event.lineno}:${event.colno}`
        : undefined,
    });
  }, true);

  window.addEventListener("unhandledrejection", (event) => {
    const { message, stack } = describeError(event.reason);
    reportBug({ kind: "unhandled-rejection", message, stack });
  });
}

// ---------------------------------------------------------------------------
// Capture: console.error / console.warn (React logs render errors here)
// ---------------------------------------------------------------------------

/** React/Next noise that is not actionable as a bug. */
const CONSOLE_IGNORE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /was preloaded using link preload but not used/i,
];

function installConsoleHooks() {
  (["error", "warn"] as const).forEach((level) => {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      try {
        const text = args
          .map((a) => describeError(a).message)
          .join(" ")
          .trim();
        if (!text || CONSOLE_IGNORE.some((re) => re.test(text))) return;

        const errorArg = args.find((a) => a instanceof Error) as Error | undefined;
        // React funnels component render/lifecycle failures through console.error.
        const isReact =
          /Each child in a list|validateDOMNesting|Cannot update a component|hydration|Warning: /i.test(
            text
          );
        reportBug({
          kind: isReact ? "react-error" : level === "error" ? "console-error" : "console-warning",
          severity: level === "error" ? "error" : "warning",
          message: text,
          stack: errorArg?.stack,
        });
      } catch {
        /* never let instrumentation throw inside console */
      }
    };
  });
}

// ---------------------------------------------------------------------------
// Capture: failed / slow API calls
// ---------------------------------------------------------------------------

function installFetchHook() {
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const [input, init] = args;
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const started = performance.now();

    try {
      const response = await originalFetch(...args);
      const elapsed = performance.now() - started;

      if (!response.ok) {
        // Read the body from a clone so the caller still gets an unread stream.
        let detail = response.statusText;
        try {
          const text = await response.clone().text();
          if (text) detail = text.slice(0, 300);
        } catch {
          /* body already consumed or opaque */
        }
        reportBug({
          kind: "api-error",
          // 401/403/404 on a page you are allowed to see is a real bug; on a
          // login attempt it is expected. Severity stays a warning for 4xx.
          severity: response.status >= 500 ? "error" : "warning",
          message: `${method} ${response.status} ${url}`,
          detail,
        });
      } else if (elapsed > SLOW_REQUEST_MS) {
        reportBug({
          kind: "slow-request",
          severity: "warning",
          message: `${method} took ${Math.round(elapsed)}ms — ${url}`,
        });
      }

      return response;
    } catch (err) {
      const { message, stack } = describeError(err);
      reportBug({
        kind: "network-failure",
        message: `${method} ${url} — request failed`,
        detail: message,
        stack,
      });
      throw err;
    }
  };
}

// ---------------------------------------------------------------------------
// Audit: interactive controls that appear to do nothing
// ---------------------------------------------------------------------------

/**
 * A button is suspicious when it has no React onClick handler, is not a submit
 * button inside a form, and is not wrapped in a link. Those buttons render fine
 * and click fine — they just silently do nothing, which is exactly the class of
 * bug that never throws and never shows up in logs.
 */
function auditDeadControls() {
  const REACT_PROPS_KEY = "__reactProps$";

  function hasReactHandler(el: Element): boolean {
    for (const key in el) {
      if (!key.startsWith(REACT_PROPS_KEY)) continue;
      const props = (el as unknown as Record<string, unknown>)[key] as
        | Record<string, unknown>
        | undefined;
      if (!props) continue;
      if (
        typeof props.onClick === "function" ||
        typeof props.onMouseDown === "function" ||
        typeof props.onPointerDown === "function" ||
        typeof props.onSubmit === "function"
      ) {
        return true;
      }
    }
    return false;
  }

  document.querySelectorAll("button").forEach((btn) => {
    if (btn.disabled) return;
    // Radix and other headless libs attach behaviour via these attributes.
    if (btn.hasAttribute("data-state") || btn.hasAttribute("aria-haspopup")) return;
    if (btn.type === "submit" && btn.closest("form")) return;
    if (btn.closest("a[href]")) return;
    if (hasReactHandler(btn)) return;
    if (btn.getAttribute("onclick")) return;

    reportBug({
      kind: "dead-control",
      severity: "warning",
      message: `Button "${labelFor(btn)}" has no click handler`,
      detail: selectorFor(btn),
    });
  });

  document.querySelectorAll("a").forEach((link) => {
    const href = link.getAttribute("href");
    if (href === null) {
      if (hasReactHandler(link)) return;
      reportBug({
        kind: "broken-link",
        severity: "warning",
        message: `Link "${labelFor(link)}" has no href`,
        detail: selectorFor(link),
      });
    } else if (href === "#" || href === "" || href.trim() === "javascript:void(0)") {
      if (hasReactHandler(link)) return;
      reportBug({
        kind: "broken-link",
        severity: "warning",
        message: `Link "${labelFor(link)}" points to "${href}"`,
        detail: selectorFor(link),
      });
    }
  });
}

/** Run the DOM audit once the current route has settled. */
export function auditCurrentPage(): void {
  if (!isDetectorEnabled()) return;
  try {
    auditDeadControls();
  } catch (err) {
    // An audit failure is a detector bug, not an app bug — log, don't record.
    console.debug("[bug-detector] audit failed", err);
  }
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

export function installBugDetector(): void {
  if (installed || !isDetectorEnabled()) return;
  installed = true;

  installErrorHandlers();
  installConsoleHooks();
  installFetchHook();

  // Expose for the Playwright crawler and for manual poking in DevTools.
  (window as unknown as Record<string, unknown>).__3DVERSE_BUGS__ = {
    get: getBugs,
    clear: clearBugs,
    audit: auditCurrentPage,
    report: reportBug,
  };
}
