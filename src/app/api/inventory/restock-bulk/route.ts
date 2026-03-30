import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { InventoryItem, Transaction } from '@/models';
import { withAuth, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

interface RestockEntry {
  id: string;
  quantity: number;
  cost: number;
  note?: string;
}

// POST /api/inventory/restock-bulk - Restock multiple items, create one grouped transaction
async function restockBulk(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { items, note }: { items: RestockEntry[]; note?: string } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return ApiResponses.badRequest('No items provided');
    }

    // Validate all IDs first
    for (const entry of items) {
      if (!mongoose.Types.ObjectId.isValid(entry.id)) {
        return ApiResponses.badRequest(`Invalid item ID: ${entry.id}`);
      }
      if (!entry.quantity || entry.quantity <= 0) {
        return ApiResponses.badRequest('Quantity must be greater than 0');
      }
      if (!entry.cost || entry.cost <= 0) {
        return ApiResponses.badRequest('Cost must be greater than 0');
      }
    }

    // Load all items at once
    const ids = items.map((e) => e.id);
    const dbItems = await InventoryItem.find({ _id: { $in: ids } });
    const itemMap = Object.fromEntries(dbItems.map((i: any) => [i._id.toString(), i]));

    // Update stock for each item
    const updatedItems: { name: string; quantity: number; cost: number }[] = [];
    for (const entry of items) {
      const item = itemMap[entry.id];
      if (!item) continue;
      item.quantity += entry.quantity;
      await item.save();
      updatedItems.push({ name: item.name, quantity: entry.quantity, cost: entry.cost });
    }

    // Build one combined description — encode cost per item with ~ separator
    const itemList = updatedItems.map((i) => `${i.name} x${i.quantity}~${i.cost}`).join(', ');
    const description = note
      ? `Nhập hàng: ${itemList} — ${note}`
      : `Nhập hàng: ${itemList}`;

    const totalCost = items.reduce((sum, e) => sum + e.cost, 0);

    const transaction = await Transaction.create({
      type: 'expense',
      source: 'inventory',
      amount: totalCost,
      description,
      category: 'Nhập hàng',
      date: new Date(),
      createdBy: request.user.userId,
    });

    return ApiResponses.created({ updatedItems, transaction }, 'Nhập hàng thành công');
  } catch (error) {
    console.error('Error bulk restocking:', error);
    return ApiResponses.serverError('Failed to restock items', error);
  }
}

export const POST = withAuth(restockBulk);
