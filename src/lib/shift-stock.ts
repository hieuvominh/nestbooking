import { ShiftInventory } from '@/models';
import { getShiftCode, getShiftDateKey, isWithinShift } from '@/lib/shift';

export type LegacyShiftCode = 'S1' | 'S2' | 'S3';

const SHIFT_PRIORITY: LegacyShiftCode[] = ['S1', 'S2', 'S3'];

// Single-shift mode compatibility: if historical data for the selected date was
// already written under legacy shift codes, keep using that unresolved shift
// until data is closed or migrated.
export async function resolveEffectiveShiftCode(
  dateKey: string,
): Promise<LegacyShiftCode> {
  const unresolvedCodes = (await ShiftInventory.distinct('shiftCode', {
    dateKey,
    reconciledAt: { $exists: false },
  })) as LegacyShiftCode[];

  for (const code of SHIFT_PRIORITY) {
    if (unresolvedCodes.includes(code)) {
      return code;
    }
  }

  const existingCodes = (await ShiftInventory.distinct('shiftCode', {
    dateKey,
  })) as LegacyShiftCode[];

  for (const code of SHIFT_PRIORITY) {
    if (existingCodes.includes(code)) {
      return code;
    }
  }

  return 'S1';
}

export interface ShiftSaleItem {
  itemId: string;
  quantity: number;
}

export async function validateShiftSale(items: ShiftSaleItem[]) {
  const dateKey = getShiftDateKey();
  const resolvedShift = await resolveEffectiveShiftCode(dateKey);

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
        if (isWithinShift('S1')) {
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
  }
}

export async function applyShiftSale(items: ShiftSaleItem[]) {
  const dateKey = getShiftDateKey();
  const resolvedShift = await resolveEffectiveShiftCode(dateKey);

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
        if (isWithinShift('S1')) {
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
  const dateKey = getShiftDateKey(soldAt);
  const resolvedShift = await resolveEffectiveShiftCode(dateKey);

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
