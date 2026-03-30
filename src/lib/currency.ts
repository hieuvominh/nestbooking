export function normalizeVndAmount(amount: number | null | undefined) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return 0;
  const value = Number(amount);
  if (!Number.isFinite(value)) return 0;
  // If user stored prices like 12.99 (thousands), scale to VND
  if (!Number.isInteger(value) && Math.abs(value) < 1000) {
    return Math.round(value * 1000);
  }
  return Math.round(value);
}

export function formatCurrency(amount: number | null | undefined) {
  const normalized = normalizeVndAmount(amount);
  // Show without decimals for VND and use Vietnamese locale grouping
  return Number(normalized).toLocaleString("vi-VN") + " VN\u0110";
}

export default formatCurrency;
