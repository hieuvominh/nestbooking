import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { Booking, InventoryItem, Order, Transaction } from '@/models';
import { validatePublicBookingAccess } from '@/lib/jwt';
import { ApiResponses } from '@/lib/api-middleware';

interface OrderParams {
  params: Promise<{ bookingId: string }>;
}

// GET /api/public/[bookingId]/orders - Get orders for booking
export async function GET(request: NextRequest, { params }: OrderParams) {
  try {
    await connectDB();
    const { bookingId } = await params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return ApiResponses.badRequest('Invalid booking ID');
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('t');

    if (!token) {
      return ApiResponses.unauthorized('Access token required');
    }

    // Validate token and booking access
    if (!validatePublicBookingAccess(bookingId, token)) {
      return ApiResponses.unauthorized('Invalid or expired access token');
    }

    const orders = await Order.find({ bookingId })
      .populate('items.itemId', 'name price imageUrl')
      .sort({ createdAt: -1 })
      .lean();

    return ApiResponses.success(orders);

  } catch (error) {
    console.error('Get public orders error:', error);
    return ApiResponses.serverError();
  }
}

// POST /api/public/[bookingId]/orders - Place new order
export async function POST(request: NextRequest, { params }: OrderParams) {
  try {
    await connectDB();
    const { bookingId } = await params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return ApiResponses.badRequest('Invalid booking ID');
    }

    const body = await request.json();
    const { items, notes, token: bodyToken } = body;

    // Get token from query params or request body
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('t') || bodyToken;

    if (!token) {
      return ApiResponses.unauthorized('Access token required');
    }

    // Validate token and booking access
    if (!validatePublicBookingAccess(bookingId, token)) {
      return ApiResponses.unauthorized('Invalid or expired access token');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return ApiResponses.badRequest('Order must contain at least one item');
    }

    // Validate booking exists and is checked in
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return ApiResponses.notFound('Booking not found');
    }

    if (booking.status !== 'checked-in') {
      return ApiResponses.badRequest('Must be checked in to place orders');
    }

    // Process order items and check inventory
    const orderItems = [];
    let totalAmount = 0;

    // First pass: Validate all items and check availability
    for (const item of items) {
      const { itemId, sku, quantity } = item;
      const actualItemId = itemId || sku; // Support both field names

      if (!mongoose.Types.ObjectId.isValid(actualItemId)) {
        return ApiResponses.badRequest(`Invalid item ID: ${actualItemId}`);
      }

      if (!quantity || quantity <= 0) {
        return ApiResponses.badRequest(`Invalid quantity for item: ${actualItemId}`);
      }

      // Find inventory item and check availability
      const inventoryItem = await InventoryItem.findById(actualItemId);
      if (!inventoryItem) {
        return ApiResponses.badRequest(`Item not found: ${actualItemId}`);
      }

      if (!inventoryItem.isActive) {
        return ApiResponses.badRequest(`Item is not available: ${inventoryItem.name}`);
      }

      if (inventoryItem.quantity < quantity) {
        return ApiResponses.badRequest(`Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity}`);
      }

      // Add to order items
      const subtotal = inventoryItem.price * quantity;
      orderItems.push({
        itemId: inventoryItem._id,
        name: inventoryItem.name,
        price: inventoryItem.price,
        quantity,
        subtotal
      });

      totalAmount += subtotal;
    }

    // Second pass: Update inventory quantities
    for (const orderItem of orderItems) {
      await InventoryItem.findByIdAndUpdate(
        orderItem.itemId,
        { $inc: { quantity: -orderItem.quantity } }
      );
    }

    // Create order
    const order = new Order({
      bookingId,
      items: orderItems,
      total: totalAmount,
      notes
    });

    await order.save();

    // Create transaction record
    const transaction = new Transaction({
      type: 'income',
      amount: totalAmount,
      source: 'order',
      description: `Order from booking ${bookingId}`,
      referenceId: order._id,
      referenceModel: 'Order'
    });

    await transaction.save();

    // Populate items for response
    await order.populate('items.itemId', 'name price imageUrl');

    return ApiResponses.created(order, 'Order placed successfully');

  } catch (error) {
    console.error('Place order error:', error);
    if (error instanceof Error) {
      return ApiResponses.badRequest(error.message);
    }
    return ApiResponses.serverError();
  }
}