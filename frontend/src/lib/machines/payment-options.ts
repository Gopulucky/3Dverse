/**
 * Pure helpers for how the payment window is set up and how the checkout hold
 * is shown. No React, DOM or network here (see README.md in this folder).
 */

/**
 * UPI first, then cards, netbanking and wallets: most Indian customers pay by
 * UPI and rarely by card. Methods still have to be enabled in the Razorpay
 * dashboard to appear. UPI Collect is being retired by Razorpay, so the UPI block
 * is left to Razorpay's own intent/QR handling. A fresh object per call.
 */
export function upiFirstDisplay() {
  return {
    blocks: {
      upi_block: { name: "Pay by UPI", instruments: [{ method: "upi" }] },
      other_block: {
        name: "Cards, netbanking and wallets",
        instruments: [{ method: "card" }, { method: "netbanking" }, { method: "wallet" }],
      },
    },
    sequence: ["block.upi_block", "block.other_block"],
    preferences: { show_default_blocks: false },
  };
}

/**
 * On a phone the customer often leaves the browser for a UPI app, and the page's
 * JavaScript callback may never run. Redirect mode has Razorpay post the signed
 * result to our server instead, which survives that.
 */
export function usesRedirectFlow(userAgent: string): boolean {
  return /Android|iPhone|iPad|iPod|Mobi/i.test(userAgent || "");
}

/** Whole seconds until an ISO time, never negative and never NaN. */
export function holdSecondsLeft(expiresAt: string, now: number): number {
  const end = Date.parse(expiresAt);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - now) / 1000));
}

export function formatCountdown(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** Razorpay's `timeout` option: at least a minute to finish, never longer than the hold. 0 = cannot pay. */
export function checkoutTimeout(secondsLeft: number): number {
  if (secondsLeft <= 0) return 0;
  return Math.min(900, Math.max(60, secondsLeft));
}
