/** Formats the recorded amount; never converts or relabels another currency. */
export function formatMoney(amount: number, currency = "INR"): string {
  // "₹249", not "₹249.00"; paise are shown in full when there are any.
  const digits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency, currencyDisplay: currency === "USD" ? "code" : "symbol",
    minimumFractionDigits: digits, maximumFractionDigits: digits,
  }).format(amount);
}
