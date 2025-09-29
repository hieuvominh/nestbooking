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

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('t');

    if (!token) {
      return ApiResponses.unauthorized('Access token required');
    }

    // Validate token and booking access
    if (!validatePublicBookingAccess(bookingId, token)) {
      return ApiResponses.unauthorized('Invalid or expired access token');
    }

    const body = await request.json();
    const { items, notes } = body;

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

    // Use transaction to ensure atomic inventory updates
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (const item of items) {
        const { itemId, quantity } = item;

        if (!mongoose.Types.ObjectId.isValid(itemId)) {
          throw new Error(`Invalid item ID: ${itemId}`);
        }

        if (!quantity || quantity <= 0) {
          throw new Error(`Invalid quantity for item: ${itemId}`);
        }

        // Find inventory item and check availability
        const inventoryItem = await InventoryItem.findById(itemId).session(session);
        if (!inventoryItem) {
          throw new Error(`Item not found: ${itemId}`);
        }

        if (!inventoryItem.isActive) {
          throw new Error(`Item is not available: ${inventoryItem.name}`);
        }

        if (inventoryItem.quantity < quantity) {
          throw new Error(`Insufficient stock for ${inventoryItem.name}. Available: ${inventoryItem.quantity}`);
        }

        // Update inventory (decrement stock)
        inventoryItem.quantity -= quantity;
        await inventoryItem.save({ session });

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

      // Create order
      const order = new Order({
        bookingId,
        items: orderItems,
        total: totalAmount,
        notes
      });

      await order.save({ session });

      // Create transaction record
      const transaction = new Transaction({
        type: 'income',
        amount: totalAmount,
        source: 'order',
        description: `Order from booking ${bookingId}`,
        referenceId: order._id,
        referenceModel: 'Order'
      });

      await transaction.save({ session });

      await session.commitTransaction();

      // Populate items for response
      await order.populate('items.itemId', 'name price imageUrl');

      return ApiResponses.created(order, 'Order placed successfully');

    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }

  } catch (error) {
    console.error('Place order error:', error);
    if (error instanceof Error) {
      return ApiResponses.badRequest(error.message);
    }
    return ApiResponses.serverError();
  }
}