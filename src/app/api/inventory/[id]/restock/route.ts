import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { InventoryItem, Transaction } from '@/models';
import { withAuth, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

interface RestockParams {
  params: Promise<{ id: string }>;
}

// POST /api/inventory/[id]/restock - Record a restock purchase and update stock
async function restockInventoryItem(request: AuthenticatedRequest, context?: RestockParams) {
  try {
    await connectDB();
    const { id } = await context!.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid inventory item ID');
    }

    const body = await request.json();
    const { quantity, totalCost, note } = body;

    if (!quantity || quantity <= 0) {
      return ApiResponses.badRequest('Quantity must be greater than 0');
    }
    if (!totalCost || totalCost <= 0) {
      return ApiResponses.badRequest('Total cost must be greater than 0');
    }

    const item = await InventoryItem.findById(id);
    if (!item) {
      return ApiResponses.notFound('Inventory item not found');
    }

    // Increase stock
    item.quantity += quantity;
    await item.save();

    // Record the expense transaction
    const description = note
      ? `Nhập hàng: ${item.name} x${quantity} — ${note}`
      : `Nhập hàng: ${item.name} x${quantity}`;

    const transaction = await Transaction.create({
      type: 'expense',
      source: 'inventory',
      amount: totalCost,
      description,
      referenceId: item._id,
      referenceModel: 'InventoryItem',
      category: 'Nhập hàng',
      date: new Date(),
      createdBy: request.user.userId,
    });

    return ApiResponses.created({
      item: { _id: item._id, name: item.name, quantity: item.quantity },
      transaction,
    }, 'Nhập hàng thành công');
  } catch (error) {
    console.error('Error restocking inventory item:', error);
    return ApiResponses.serverError('Failed to restock inventory item', error);
  }
}

export const POST = withAuth(restockInventoryItem);
