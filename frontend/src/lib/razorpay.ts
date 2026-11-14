/**
 * Minimal, typed access to Razorpay's Checkout.js.
 *
 * The script is loaded on demand (only when someone is about to pay) from
 * Razorpay's own origin, which the site's Content-Security-Policy allows.
 * Only the public key id ever reaches the browser; the secret stays on the API.
 */

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayFailure = { error?: { description?: string; reason?: string } };

export type RazorpayOptions = {
  key: string;
  order_id: string;
  /** Minor units (paise), exactly what the order was created for. */
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color?: string };
  modal?: { ondismiss?: () => void; confirm_close?: boolean };
  /** Order and grouping of payment methods (see lib/machines/payment-options.ts). */
  config?: { display: object };
  /** Seconds after which Razorpay closes the window by itself. */
  timeout?: number;
  /** Redirect mode: Razorpay POSTs the signed result to callback_url instead of calling handler. */
  redirect?: boolean;
  callback_url?: string;
  handler: (response: RazorpaySuccess) => void;
};

export type RazorpayInstance = {
  open: () => void;
  on: (event: "payment.failed", callback: (response: RazorpayFailure) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<boolean> | null = null;

/** Resolves true once `window.Razorpay` is usable; false if the script could not load. */
export function loadRazorpay(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.async = true;
    script.onload = () => resolve(!!window.Razorpay);
    script.onerror = () => {
      script.remove();
      loading = null; // allow a retry after a network failure
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return loading;
}
