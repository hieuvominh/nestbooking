import { ShiftInventory } from '@/models';
import { getShiftCode, getShiftDateKey, isWithinShift } from '@/lib/shift';

export interface ShiftSaleItem {
  itemId: string;
  quantity: number;
}

export async function applyShiftSale(items: ShiftSaleItem[]) {
  const shiftCode = getShiftCode();
  const resolvedShift = shiftCode || 'S1';
  const dateKey = getShiftDateKey();

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    if (!item.itemId || qty <= 0) continue;

    let existing = await ShiftInventory.findOne({
      dateKey,
      shiftCode: resolvedShift,
      itemId: item.itemId,
      reconciledAt: { $exists: false },
    });
    if (!existing) {
      const anyRecord = await ShiftInventory.findOne({
        dateKey,
        shiftCode: resolvedShift,
        itemId: item.itemId,
      }).lean();
      if (anyRecord?.reconciledAt) {
        if (isWithinShift(resolvedShift)) {
          // If still within shift hours, allow selling even if reconciled earlier
          existing = await ShiftInventory.findOne({
            dateKey,
            shiftCode: resolvedShift,
            itemId: item.itemId,
          });
        } else {
          throw new Error('Ca đã kết thúc, không thể bán');
        }
      } else {
        throw new Error('Chưa cấp hàng cho ca');
      }
    }
    const remaining =
      existing.openingQty + existing.receivedQty - existing.soldQty;
    if (remaining < qty) {
      throw new Error(`Không đủ hàng trong ca (còn ${remaining})`);
    }
    existing.soldQty += qty;
    await existing.save();
  }
}

export async function rollbackShiftSale(
  items: ShiftSaleItem[],
  soldAt: Date = new Date()
) {
  const shiftCode = getShiftCode(soldAt);
  const resolvedShift = shiftCode || "S1";
  const dateKey = getShiftDateKey(soldAt);

  for (const item of items) {
    const qty = Number(item.quantity || 0);
    if (!item.itemId || qty <= 0) continue;

    const existing = await ShiftInventory.findOne({
      dateKey,
      shiftCode: resolvedShift,
      itemId: item.itemId,
    });
    if (!existing) continue;

    existing.soldQty = Math.max(0, existing.soldQty - qty);
    await existing.save();
  }
}
