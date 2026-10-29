/** Formats the recorded amount; never converts or relabels another currency. */
export function formatMoney(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency, currencyDisplay: currency === "USD" ? "code" : "symbol",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount);
}
