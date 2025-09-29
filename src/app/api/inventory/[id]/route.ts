import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { InventoryItem } from '@/models';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

interface InventoryParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/inventory/[id] - Update inventory item or adjust stock
async function updateInventoryItem(request: AuthenticatedRequest, { params }: InventoryParams) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid inventory item ID');
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      price,
      lowStockThreshold,
      unit,
      imageUrl,
      isActive,
      stockAdjustment,
      adjustmentType
    } = body;

    const item = await InventoryItem.findById(id);
    if (!item) {
      return ApiResponses.notFound('Inventory item not found');
    }

    // Handle stock adjustments
    if (stockAdjustment !== undefined) {
      if (adjustmentType === 'add') {
        item.quantity += stockAdjustment;
      } else if (adjustmentType === 'subtract') {
        item.quantity = Math.max(0, item.quantity - stockAdjustment);
      } else if (adjustmentType === 'set') {
        item.quantity = Math.max(0, stockAdjustment);
      }
    }

    // Handle other updates
    if (name) item.name = name;
    if (description !== undefined) item.description = description;
    if (category) item.category = category;
    if (price !== undefined) item.price = price;
    if (lowStockThreshold !== undefined) item.lowStockThreshold = lowStockThreshold;
    if (unit) item.unit = unit;
    if (imageUrl !== undefined) item.imageUrl = imageUrl;
    if (isActive !== undefined) item.isActive = isActive;

    await item.save();

    const itemWithStatus = {
      ...item.toObject(),
      isLowStock: item.quantity <= item.lowStockThreshold
    };

    return ApiResponses.success(itemWithStatus, 'Inventory item updated successfully');

  } catch (error) {
    console.error('Update inventory item error:', error);
    return ApiResponses.serverError();
  }
}

export const PATCH = requireRole(['admin', 'staff'])(updateInventoryItem);