export type SupportedCurrency = "USD" | "KHR";

export function normalizeCurrency(currency?: string): SupportedCurrency {
  return currency === "USD" ? "USD" : "KHR";
}

export function formatCurrency(amount: number, currency?: string) {
  if (normalizeCurrency(currency) === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(amount)} ៛`;
}
