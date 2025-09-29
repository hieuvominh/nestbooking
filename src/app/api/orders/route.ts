import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Order } from '@/models';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

// GET /api/orders - Get all orders
async function getOrders(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const bookingId = searchParams.get('bookingId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (bookingId) {
      query.bookingId = bookingId;
    }

    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('bookingId', 'customer deskId startTime endTime')
        .populate('items.itemId', 'name price category')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(query)
    ]);

    return ApiResponses.success({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return ApiResponses.serverError('Failed to fetch orders');
  }
}

// POST /api/orders - Create new order
async function createOrder(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { bookingId, items, notes } = body;

    if (!bookingId || !items || !Array.isArray(items) || items.length === 0) {
      return ApiResponses.badRequest('Missing required fields: bookingId and items');
    }

    // Calculate total
    const total = items.reduce((sum: number, item: any) => sum + item.subtotal, 0);

    const order = new Order({
      bookingId,
      items,
      total,
      status: 'pending',
      notes,
      orderedAt: new Date()
    });

    await order.save();

    // Populate the order before returning
    await order.populate('bookingId', 'customer deskId startTime endTime');
    await order.populate('items.itemId', 'name price category');

    return ApiResponses.created(order);
  } catch (error) {
    console.error('Error creating order:', error);
    return ApiResponses.serverError('Failed to create order');
  }
}

export const GET = withAuth(requireRole(['admin', 'staff'])(getOrders));
export const POST = withAuth(requireRole(['admin', 'staff'])(createOrder));