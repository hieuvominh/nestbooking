import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { InventoryItem } from '@/models';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

// GET /api/inventory - Get all inventory items
async function getInventory(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    let category = searchParams.get('category');
    // normalize common client category values
    if (category === 'supplies') category = 'office-supplies';
    if (category === 'drinks') category = 'beverage';
    if (category === 'snacks') category = 'merchandise';
    const lowStock = searchParams.get('lowStock') === 'true';
    const sortBy = searchParams.get('sortBy') || 'name';
    const order = searchParams.get('order') === 'desc' ? -1 : 1;

    // Build query
    const query: any = {};
    if (category && category !== 'all') {
      query.category = category;
    }

    const items = await InventoryItem.find(query)
      .sort({ [sortBy]: order })
      .lean();

    // Filter for low stock if requested
    let filteredItems = items;
    if (lowStock) {
      filteredItems = items.filter((item: any) => item.quantity <= item.lowStockThreshold);
    }

    // Add low stock indicator
    const itemsWithStatus = filteredItems.map((item: any) => ({
      ...item,
      isLowStock: item.quantity <= item.lowStockThreshold
    }));

    return ApiResponses.success(itemsWithStatus);
  } catch (error) {
    console.error('Get inventory error:', error);
    return ApiResponses.serverError(error instanceof Error ? error.message : 'Internal server error', error);
  }
}

// POST /api/inventory - Create new inventory item
async function createInventoryItem(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      sku,
      name,
      description,
      category: rawCategory,
      price,
      quantity,
      lowStockThreshold,
      unit,
      imageUrl
    } = body;
    // normalize category values coming from clients
    const category = rawCategory === 'supplies' ? 'office-supplies' : rawCategory === 'drinks' ? 'beverage' : rawCategory === 'snacks' ? 'merchandise' : rawCategory;
    const { includedItems } = body;

    if (!sku || !name || !category || price === undefined) {
      return ApiResponses.badRequest('SKU, name, category, and price are required');
    }

    // Check if SKU already exists
    const existingItem = await InventoryItem.findOne({ sku: sku.toUpperCase() });
    if (existingItem) {
      return ApiResponses.conflict('SKU already exists');
    }

    // validate includedItems for combo
    let validatedIncludedItems: any[] = [];
    if (category === 'combo' && Array.isArray(includedItems) && includedItems.length > 0) {
      const mongoose = (await import('mongoose')).default;
      // collect ids
      const ids = includedItems.map((it: any) => it.item).filter(Boolean);
      // check format
      for (const id of ids) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return ApiResponses.badRequest('Invalid included item id: ' + id);
        }
      }
      // fetch items
      const components = await InventoryItem.find({ _id: { $in: ids } }).lean();
      // ensure none are combo type
      const comboFound = components.find((c: any) => c.type === 'combo' || c.category === 'combo');
      if (comboFound) {
        return ApiResponses.badRequest('Included items cannot be combo items');
      }
      // map validated
      validatedIncludedItems = includedItems.map((it: any) => ({ item: it.item, quantity: it.quantity || 1 }));
    }

    const itemData: any = {
      sku: sku.toUpperCase(),
      name,
      description,
      category,
      price,
      quantity: quantity || 0,
      lowStockThreshold: lowStockThreshold || 5,
      unit: unit || 'pcs',
      imageUrl,
      type: category === 'combo' ? 'combo' : 'item',
      includedItems: validatedIncludedItems,
    };
    const item = new InventoryItem(itemData);

    await item.save();

    return ApiResponses.created(item, 'Inventory item created successfully');
  } catch (error) {
    console.error('Create inventory item error:', error);
    return ApiResponses.serverError(error instanceof Error ? error.message : 'Internal server error', error);
  }
}

export const GET = requireRole(['admin', 'staff'])(getInventory);
export const POST = requireRole(['admin', 'staff'])(createInventoryItem);