export function formatCurrency(amount: number | null | undefined) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "0 VNĐ";
  // Show without decimals for VNĐ and use Vietnamese locale grouping
  return Number(amount).toLocaleString("vi-VN") + " VNĐ";
}

export default formatCurrency;
