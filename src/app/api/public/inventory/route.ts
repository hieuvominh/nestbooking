import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { InventoryItem } from '@/models';
import { ApiResponses } from '@/lib/api-middleware';

const PUBLIC_ODD_HOUR_SKU = 'ODD_HOUR_PUBLIC';

// GET /api/public/inventory - Get available inventory items for ordering
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Build query for available items (show all active items, even if out of stock)
    const query: any = {
      isActive: true,
      sku: { $ne: PUBLIC_ODD_HOUR_SKU },
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    const items = await InventoryItem.find(query)
      .select('name description price category quantity unit imageUrl type pricePerPerson duration')
      .sort({ category: 1, name: 1 })
      .lean();

    // Public ordering rule:
    // - Keep normal items
    // - Keep combo for public room only
    // - Hide meeting-room combo (pricePerPerson=true)
    const filteredItems = items.filter((item: any) => {
      if (item.category !== 'combo') return true;
      return !item.pricePerPerson;
    });

    // Group by category for easier frontend handling
    const itemsByCategory = filteredItems.reduce((acc: any, item: any) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push({
        id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        quantity: item.quantity,
        unit: item.unit,
        imageUrl: item.imageUrl,
        type: item.type,
        pricePerPerson: Boolean(item.pricePerPerson),
        duration: item.duration,
      });
      return acc;
    }, {});

    return ApiResponses.success({
      itemsByCategory,
      allItems: filteredItems.map((item: any) => ({
        id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        imageUrl: item.imageUrl,
        type: item.type,
        pricePerPerson: Boolean(item.pricePerPerson),
        duration: item.duration,
      }))
    });

  } catch (error) {
    console.error('Get public inventory error:', error);
    return ApiResponses.serverError();
  }
}