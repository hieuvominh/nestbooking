import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { InventoryItem } from '@/models';
import { ApiResponses } from '@/lib/api-middleware';

// GET /api/public/inventory - Get available inventory items for ordering
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    // Build query for available items
    const query: any = {
      isActive: true,
      quantity: { $gt: 0 }
    };

    if (category && category !== 'all') {
      query.category = category;
    }

    const items = await InventoryItem.find(query)
      .select('name description price category quantity unit imageUrl')
      .sort({ category: 1, name: 1 })
      .lean();

    // Group by category for easier frontend handling
    const itemsByCategory = items.reduce((acc: any, item: any) => {
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
        imageUrl: item.imageUrl
      });
      return acc;
    }, {});

    return ApiResponses.success({
      itemsByCategory,
      allItems: items.map((item: any) => ({
        id: item._id,
        name: item.name,
        description: item.description,
        price: item.price,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        imageUrl: item.imageUrl
      }))
    });

  } catch (error) {
    console.error('Get public inventory error:', error);
    return ApiResponses.serverError();
  }
}