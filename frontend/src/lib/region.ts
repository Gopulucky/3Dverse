import { formatMoney } from "./currency";

/**
 * Where the shopper is, and what that changes.
 *
 * It changes only how a price is *shown*: shoppers abroad see an approximate
 * amount in their own currency. Every order is still charged in INR, and the
 * rupee amount is always shown beside the approximation, so nobody is surprised
 * at checkout. (Charging in other currencies needs the payment provider's
 * international payments switched on; until then this is display only.)
 */
export interface Country { code: string; name: string; currency: string }

export const DEFAULT_COUNTRY = "IN";

export const COUNTRIES: Country[] = [
  { code: "IN", name: "India", currency: "INR" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "SG", name: "Singapore", currency: "SGD" },
  { code: "AE", name: "United Arab Emirates", currency: "AED" },
  { code: "NZ", name: "New Zealand", currency: "NZD" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "NL", name: "Netherlands", currency: "EUR" },
  { code: "IE", name: "Ireland", currency: "EUR" },
  { code: "ES", name: "Spain", currency: "EUR" },
  { code: "IT", name: "Italy", currency: "EUR" },
];

/**
 * Rupees per one unit of each currency. INDICATIVE ONLY, for the "about" figure
 * shown to shoppers abroad; update from time to time. The charged amount is
 * always the rupee price, so a stale rate can make the approximation a little
 * off but can never change what anyone pays.
 */
export const INR_PER_UNIT: Record<string, number> = {
  USD: 88, EUR: 102, GBP: 117, AUD: 57, CAD: 63, SGD: 68, AED: 24, NZD: 52,
};

/** A stored or typed value is only trusted if it is one of the countries we list. */
export function readCountry(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const code = value.trim().toUpperCase();
  return COUNTRIES.some((country) => country.code === code) ? code : undefined;
}

export function countryLabel(code?: string | null): string {
  const upper = (code ?? "").trim().toUpperCase();
  return COUNTRIES.find((country) => country.code === upper)?.name ?? upper;
}

/** Listed countries use their own currency; anywhere else is shown in US dollars. */
export function currencyForCountry(code?: string | null): string {
  if (!code || !code.trim()) return "INR";
  const upper = code.trim().toUpperCase();
  return COUNTRIES.find((country) => country.code === upper)?.currency ?? "USD";
}

export function convertFromInr(amountInr: number, currency: string): number {
  const rate = INR_PER_UNIT[currency];
  if (!rate || !Number.isFinite(amountInr)) return amountInr;
  return Math.round((amountInr / rate) * 100) / 100;
}

export interface PriceView {
  /** What to show as the price. */
  main: string;
  /** The rupee amount actually charged, present only when `main` is an approximation. */
  charged?: string;
}

export function displayPrice(amount: number, productCurrency: string | undefined, country: string): PriceView {
  const currency = productCurrency || "INR";
  const local = currencyForCountry(country);
  // Only rupee prices are converted; a listing priced in another currency is shown as it is.
  if (currency !== "INR" || local === "INR") return { main: formatMoney(amount, currency) };
  const approx = new Intl.NumberFormat("en", {
    style: "currency", currency: local, currencyDisplay: "symbol", minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(convertFromInr(amount, local));
  return { main: `≈ ${approx}`, charged: formatMoney(amount, "INR") };
}
