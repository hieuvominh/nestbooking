import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { Booking, InventoryItem, Order, Transaction } from '@/models';
import { validatePublicBookingAccess } from '@/lib/jwt';
import { ApiResponses } from '@/lib/api-middleware';
import { normalizeVndAmount } from '@/lib/currency';

interface OrderParams {
  params: Promise<{ bookingId: string }>;
}

const PUBLIC_ODD_HOUR_ITEM_CLIENT_ID = '__ODD_HOUR__';
const PUBLIC_ODD_HOUR_SKU = 'ODD_HOUR_PUBLIC';

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

    const booking = await Booking.findById(bookingId).populate('deskId', 'hourlyRate label');
    if (!booking) {
      return ApiResponses.notFound('Booking not found');
    }
    if ((booking as any).status === 'cancelled' || (booking as any).status === 'completed') {
      return ApiResponses.unauthorized('Booking has ended');
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
    const booking = await Booking.findById(bookingId).populate('deskId', 'hourlyRate label');
    if (!booking) {
      return ApiResponses.notFound('Booking not found');
    }

    if ((booking as any).status === 'cancelled' || (booking as any).status === 'completed') {
      return ApiResponses.unauthorized('Booking has ended');
    }

    if ((booking as any).status !== 'checked-in') {
      return ApiResponses.badRequest('Must be checked in to place orders');
    }

    // Process order items and check inventory
    const orderItems = [];
    let totalAmount = 0;
    let serviceExtensionHours = 0;

    // First pass: Validate all items and check availability
    for (const item of items) {
      const { itemId, sku, quantity } = item;
      const actualItemId = itemId || sku; // Support both field names

      if (actualItemId === PUBLIC_ODD_HOUR_ITEM_CLIENT_ID) {
        const normalizedQty = Math.floor(Number(quantity));
        if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
          return ApiResponses.badRequest('Số lượng giờ lẻ không hợp lệ');
        }

        const deskHourlyRate = normalizeVndAmount(Number((booking as any)?.deskId?.hourlyRate || 0));
        if (deskHourlyRate <= 0) {
          return ApiResponses.badRequest('Không xác định được giá giờ lẻ của bàn hiện tại');
        }

        const oddHourInventoryItem = await InventoryItem.findOneAndUpdate(
          { sku: PUBLIC_ODD_HOUR_SKU },
          {
            $setOnInsert: {
              sku: PUBLIC_ODD_HOUR_SKU,
              name: 'Giờ lẻ',
              description: 'Gia hạn theo giờ lẻ, không bao gồm nước',
              category: 'combo',
              price: deskHourlyRate,
              quantity: 999999,
              lowStockThreshold: 0,
              unit: 'giờ',
              isActive: true,
              type: 'item',
              pricePerPerson: false,
              duration: 1,
              includedItems: [],
            },
          },
          { new: true, upsert: true }
        );

        const normalizedPrice = deskHourlyRate;
        const subtotal = normalizedPrice * normalizedQty;

        orderItems.push({
          itemId: oddHourInventoryItem._id,
          name: 'Giờ lẻ',
          price: normalizedPrice,
          quantity: normalizedQty,
          subtotal,
        });

        totalAmount += subtotal;
        serviceExtensionHours += normalizedQty;
        continue;
      }

      if (!mongoose.Types.ObjectId.isValid(actualItemId)) {
        return ApiResponses.badRequest(`Invalid item ID: ${actualItemId}`);
      }

      const normalizedQty = Math.floor(Number(quantity));
      if (!Number.isFinite(normalizedQty) || normalizedQty <= 0) {
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

      // Public rule: meeting-room combo (pricePerPerson=true) is not supported in public ordering
      if (inventoryItem.category === 'combo' && inventoryItem.pricePerPerson) {
        return ApiResponses.badRequest(`Combo theo đầu người chưa hỗ trợ trên trang khách: ${inventoryItem.name}`);
      }

      // Add to order items (no stock check — staff will verify when delivering)
      const normalizedPrice = normalizeVndAmount(inventoryItem.price);
      const subtotal = normalizedPrice * normalizedQty;
      orderItems.push({
        itemId: inventoryItem._id,
        name: inventoryItem.name,
        price: normalizedPrice,
        quantity: normalizedQty,
        subtotal
      });

      totalAmount += subtotal;

      if (
        inventoryItem.category === 'combo' &&
        !inventoryItem.pricePerPerson &&
        Number(inventoryItem.duration || 0) > 0
      ) {
        serviceExtensionHours += Number(inventoryItem.duration) * normalizedQty;
      }
    }

    let serviceExtensionAppliedAt: Date | undefined;
    if (serviceExtensionHours > 0) {
      const nowUtc = new Date();
      const currentEnd = new Date(booking.endTime);
      const baseTime = currentEnd > nowUtc ? currentEnd : nowUtc;
      booking.endTime = new Date(
        baseTime.getTime() + serviceExtensionHours * 60 * 60 * 1000,
      );
      await booking.save();
      serviceExtensionAppliedAt = new Date();
    }

    // Create order (shift stock will be deducted when staff marks as delivered)
    const order = new Order({
      bookingId,
      items: orderItems,
      total: totalAmount,
      notes,
      serviceExtensionHours,
      serviceExtensionAppliedAt,
    });

    await order.save();

    // Create transaction record (orders are paid separately)
    await Transaction.create({
      type: 'income',
      amount: totalAmount,
      source: 'order',
      description: `Đơn gọi thêm từ khách (booking ${bookingId})`,
      referenceId: order._id,
      referenceModel: 'Order'
    });

    // Populate items for response
    await order.populate('items.itemId', 'name price imageUrl');

    return ApiResponses.created(
      {
        order,
        booking: {
          endTime: booking.endTime,
        },
      },
      'Order placed successfully'
    );

  } catch (error) {
    console.error('Place order error:', error);
    if (error instanceof Error) {
      return ApiResponses.badRequest(error.message);
    }
    return ApiResponses.serverError();
  }
}
