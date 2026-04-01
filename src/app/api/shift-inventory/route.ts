import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { ShiftInventory } from '@/models';
import { ApiResponses, requireRole } from '@/lib/api-middleware';
import { getShiftDateKey } from '@/lib/shift';
import { resolveEffectiveShiftCode } from '@/lib/shift-stock';

// GET /api/shift-inventory?dateKey=YYYY-MM-DD&shiftCode=S1
async function getShiftInventory(request: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const dateKey = searchParams.get('dateKey') || getShiftDateKey();
    const shiftCode = await resolveEffectiveShiftCode(dateKey);

    const items = await ShiftInventory.find({ dateKey, shiftCode })
      .populate('itemId', 'name price category')
      .lean();

    const validItems = items.filter((item) => item.itemId);

    return ApiResponses.success({ dateKey, shiftCode, items: validItems });
  } catch (error) {
    console.error('Get shift inventory error:', error);
    return ApiResponses.serverError('Failed to fetch shift inventory');
  }
}

export const GET = requireRole(['admin', 'staff'])(getShiftInventory);
