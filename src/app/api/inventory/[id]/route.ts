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
      category: rawCategory,
      price,
      lowStockThreshold,
      unit,
      imageUrl,
      isActive,
      stockAdjustment,
      adjustmentType
    } = body;
    const { duration } = body;
    const { includedItems } = body;
    // normalize category values coming from clients
    const category = rawCategory === 'supplies' ? 'office-supplies' : rawCategory === 'drinks' ? 'beverage' : rawCategory === 'snacks' ? 'merchandise' : rawCategory;

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
    if (category) {
      item.type = category === 'combo' ? 'combo' : 'item';
    }
    if (includedItems !== undefined) {
      // only accept includedItems for combo
      if (item.type === 'combo' || category === 'combo') {
        // validate ids and ensure none of the components are combo items
        const mongoose = (await import('mongoose')).default;
        const ids = Array.isArray(includedItems) ? includedItems.map((it: any) => it.item).filter(Boolean) : [];
        for (const id of ids) {
          if (!mongoose.Types.ObjectId.isValid(id)) {
            return ApiResponses.badRequest('Invalid included item id: ' + id);
          }
        }
        const components = await InventoryItem.find({ _id: { $in: ids } }).lean();
        const comboFound = components.find((c: any) => c.type === 'combo' || c.category === 'combo');
        if (comboFound) {
          return ApiResponses.badRequest('Included items cannot be combo items');
        }
        item.includedItems = Array.isArray(includedItems)
          ? includedItems.map((it: any) => ({ item: it.item, quantity: it.quantity || 1 }))
          : [];
      }
      // allow updating duration for combos
      if (duration !== undefined) {
        const parsed = Number(duration);
        if (!Number.isFinite(parsed) || parsed < 0) {
          return ApiResponses.badRequest('Invalid duration value');
        }
        item.duration = parsed;
      }
    }

    await item.save();

    const itemWithStatus = {
      ...item.toObject(),
      isLowStock: item.quantity <= item.lowStockThreshold
    };

    return ApiResponses.success(itemWithStatus, 'Inventory item updated successfully');

  } catch (error) {
    console.error('Update inventory item error:', error);
    return ApiResponses.serverError(error instanceof Error ? error.message : 'Internal server error', error);
  }
}

export const PATCH = requireRole(['admin', 'staff'])(updateInventoryItem);

// DELETE /api/inventory/[id] - Delete an inventory item
async function deleteInventoryItem(request: AuthenticatedRequest, { params }: InventoryParams) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid inventory item ID');
    }

    const deleted = await InventoryItem.findByIdAndDelete(id);
    if (!deleted) {
      return ApiResponses.notFound('Inventory item not found');
    }

    return ApiResponses.success(null, 'Inventory item deleted successfully');
  } catch (error) {
    console.error('Delete inventory item error:', error);
    return ApiResponses.serverError(error instanceof Error ? error.message : 'Internal server error', error);
  }
}

export const DELETE = requireRole(['admin'])(deleteInventoryItem);

// GET /api/inventory/[id] - Get single inventory item
async function getInventoryItem(request: AuthenticatedRequest, { params }: InventoryParams) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid inventory item ID');
    }

    const item = await InventoryItem.findById(id).lean();
    if (!item) {
      return ApiResponses.notFound('Inventory item not found');
    }

    const itemWithStatus = {
      ...item,
      isLowStock: item.quantity <= item.lowStockThreshold
    };

    return ApiResponses.success(itemWithStatus);
  } catch (error) {
    console.error('Get inventory item error:', error);
    return ApiResponses.serverError(error instanceof Error ? error.message : 'Internal server error', error);
  }
}

export const GET = requireRole(['admin', 'staff'])(getInventoryItem);