import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { InventoryItem, Transaction } from '@/models';
import { ApiResponses, AuthenticatedRequest, requireRole } from '@/lib/api-middleware';

interface AdjustmentParams {
  params: Promise<{ id: string }>;
}

// POST /api/inventory/[id]/adjustment - Reconcile stock and optionally record a cost correction
async function adjustInventoryItem(request: AuthenticatedRequest, context: AdjustmentParams) {
  try {
    await connectDB();

    const { id } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid inventory item ID');
    }

    const body = await request.json();
    const actualQuantity = Number(body.actualQuantity);
    const costDelta = body.costDelta === undefined || body.costDelta === null || body.costDelta === ''
      ? 0
      : Number(body.costDelta);
    const note = typeof body.note === 'string' ? body.note.trim() : '';

    if (!Number.isFinite(actualQuantity) || actualQuantity < 0) {
      return ApiResponses.badRequest('Actual quantity must be greater than or equal to 0');
    }

    if (!Number.isFinite(costDelta)) {
      return ApiResponses.badRequest('Cost delta must be a valid number');
    }

    const item = await InventoryItem.findById(id);
    if (!item) {
      return ApiResponses.notFound('Inventory item not found');
    }

    const previousQuantity = item.quantity;
    item.quantity = actualQuantity;
    await item.save();

    let transaction = null;
    if (costDelta !== 0) {
      const amount = Math.abs(costDelta);
      const quantitySummary = `${previousQuantity} -> ${actualQuantity}`;
      const costSummary = costDelta > 0 ? `+${costDelta}` : `${costDelta}`;
      const description = note
        ? `Điều chỉnh nhập hàng: ${item.name} | tồn kho ${quantitySummary} | chi phí ${costSummary} — ${note}`
        : `Điều chỉnh nhập hàng: ${item.name} | tồn kho ${quantitySummary} | chi phí ${costSummary}`;

      transaction = await Transaction.create({
        type: costDelta > 0 ? 'expense' : 'income',
        source: 'inventory',
        amount,
        description,
        category: 'Điều chỉnh nhập hàng',
        date: new Date(),
        referenceId: item._id,
        referenceModel: 'InventoryItem',
        createdBy: request.user.userId,
      });
    }

    return ApiResponses.success(
      {
        item: {
          _id: item._id,
          name: item.name,
          previousQuantity,
          quantity: item.quantity,
        },
        transaction,
      },
      'Điều chỉnh tồn kho thành công',
    );
  } catch (error) {
    console.error('Adjust inventory item error:', error);
    return ApiResponses.serverError('Failed to adjust inventory item', error);
  }
}

export const POST = requireRole(['admin', 'staff'])(adjustInventoryItem);