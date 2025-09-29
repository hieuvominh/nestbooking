import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { InventoryItem } from '@/models';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

// GET /api/inventory - Get all inventory items
async function getInventory(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
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
    return ApiResponses.serverError();
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
      category,
      price,
      quantity,
      lowStockThreshold,
      unit,
      imageUrl
    } = body;

    if (!sku || !name || !category || price === undefined) {
      return ApiResponses.badRequest('SKU, name, category, and price are required');
    }

    // Check if SKU already exists
    const existingItem = await InventoryItem.findOne({ sku: sku.toUpperCase() });
    if (existingItem) {
      return ApiResponses.conflict('SKU already exists');
    }

    const item = new InventoryItem({
      sku: sku.toUpperCase(),
      name,
      description,
      category,
      price,
      quantity: quantity || 0,
      lowStockThreshold: lowStockThreshold || 5,
      unit: unit || 'pcs',
      imageUrl
    });

    await item.save();

    return ApiResponses.created(item, 'Inventory item created successfully');
  } catch (error) {
    console.error('Create inventory item error:', error);
    return ApiResponses.serverError();
  }
}

export const GET = requireRole(['admin', 'staff'])(getInventory);
export const POST = requireRole(['admin', 'staff'])(createInventoryItem);