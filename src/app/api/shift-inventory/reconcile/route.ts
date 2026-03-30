import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { InventoryItem, ShiftInventory } from '@/models';
import { ApiResponses, requireRole } from '@/lib/api-middleware';
import { getShiftCode, getShiftDateKey } from '@/lib/shift';

interface ReconcileItem {
  itemId: string;
  actualQty: number;
}

// POST /api/shift-inventory/reconcile
async function reconcileShift(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const items: ReconcileItem[] = body.items || [];
    const dateKey = body.dateKey || getShiftDateKey();
    const shiftCode = body.shiftCode || getShiftCode() || 'S1';

    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponses.badRequest('Missing items');
    }

    for (const item of items) {
      const actualQty = Number(item.actualQty);
      if (!item.itemId || Number.isNaN(actualQty) || actualQty < 0) continue;

      const shift = await ShiftInventory.findOne({
        dateKey,
        shiftCode,
        itemId: item.itemId,
      });
      if (!shift) {
        return ApiResponses.badRequest('Shift inventory not found');
      }

      if (shift.reconciledAt) {
        return ApiResponses.badRequest('Ca này đã được kết, không thể kết lại');
      }

      const expectedQty = shift.openingQty + shift.receivedQty - shift.soldQty;
      const prevActual = shift.actualQty ?? 0;
      const deltaReturn = actualQty - prevActual;

      const inventory = await InventoryItem.findById(item.itemId);
      if (!inventory) {
        return ApiResponses.badRequest('Item not found');
      }
      inventory.quantity += deltaReturn;
      await inventory.save();

      shift.actualQty = actualQty;
      shift.variance = actualQty - expectedQty;
      shift.reconciledAt = new Date();
      await shift.save();
    }

    return ApiResponses.success({ ok: true });
  } catch (error) {
    console.error('Reconcile shift error:', error);
    return ApiResponses.serverError('Failed to reconcile shift');
  }
}

export const POST = requireRole(['admin', 'staff'])(reconcileShift);
