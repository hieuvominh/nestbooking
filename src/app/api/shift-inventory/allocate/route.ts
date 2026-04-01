import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { InventoryItem, ShiftInventory } from '@/models';
import { ApiResponses, requireRole } from '@/lib/api-middleware';
import { getShiftDateKey } from '@/lib/shift';
import { resolveEffectiveShiftCode } from '@/lib/shift-stock';

interface AllocateItem {
  itemId: string;
  qty: number;
}

// POST /api/shift-inventory/allocate
async function allocateToShift(request: NextRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const items: AllocateItem[] = body.items || [];
    const dateKey = body.dateKey || getShiftDateKey();
    const shiftCode = await resolveEffectiveShiftCode(dateKey);

    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponses.badRequest('Missing items');
    }

    for (const item of items) {
      const qty = Number(item.qty || 0);
      if (!item.itemId || qty <= 0) continue;

      const inventory = await InventoryItem.findById(item.itemId);
      if (!inventory) {
        return ApiResponses.badRequest('Item not found');
      }
      if (inventory.quantity < qty) {
        return ApiResponses.badRequest(
          `Insufficient stock for ${inventory.name}`
        );
      }

      // Decrement main inventory
      inventory.quantity -= qty;
      await inventory.save();

      // Upsert shift inventory
      const existing = await ShiftInventory.findOne({
        dateKey,
        shiftCode,
        itemId: item.itemId,
      });
      if (existing) {
        existing.receivedQty += qty;
        await existing.save();
      } else {
        await ShiftInventory.create({
          dateKey,
          shiftCode,
          itemId: item.itemId,
          openingQty: qty,
          receivedQty: 0,
          soldQty: 0,
        });
      }
    }

    return ApiResponses.success({ ok: true });
  } catch (error) {
    console.error('Allocate shift inventory error:', error);
    return ApiResponses.serverError('Failed to allocate to shift');
  }
}

export const POST = requireRole(['admin'])(allocateToShift);
