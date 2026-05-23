import "server-only";

export function eurToCents(eur: number): number {
  if (eur < 0) throw new Error("eurToCents: negative amounts not allowed");
  return Math.round(Math.round(eur * 1000) / 10);
}

export function centsToEur(cents: number): number {
  return cents / 100;
}

export function formatEur(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function applyFeePct(
  amountCents: number,
  feeBps: number,
): { fee: number; net: number } {
  const fee = Math.round((amountCents * feeBps) / 10000);
  return { fee, net: amountCents - fee };
}
