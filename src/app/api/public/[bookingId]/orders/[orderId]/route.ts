import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { Booking, Order, Transaction } from '@/models';
import { validatePublicBookingAccess } from '@/lib/jwt';
import { ApiResponses } from '@/lib/api-middleware';
import { rollbackShiftSale } from '@/lib/shift-stock';

interface OrderParams {
  params: Promise<{ bookingId: string; orderId: string }>;
}

// PATCH /api/public/[bookingId]/orders/[orderId] - Cancel a pending order
export async function PATCH(request: NextRequest, { params }: OrderParams) {
  try {
    await connectDB();
    const { bookingId, orderId } = await params;

    if (!mongoose.Types.ObjectId.isValid(bookingId)) {
      return ApiResponses.badRequest('Invalid booking ID');
    }
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return ApiResponses.badRequest('Invalid order ID');
    }

    const { searchParams } = new URL(request.url);
    const token = searchParams.get('t');

    if (!token) {
      return ApiResponses.unauthorized('Access token required');
    }

    if (!validatePublicBookingAccess(bookingId, token)) {
      return ApiResponses.unauthorized('Invalid or expired access token');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return ApiResponses.notFound('Booking not found');
    }
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return ApiResponses.unauthorized('Booking has ended');
    }

    const order = await Order.findOne({ _id: orderId, bookingId });
    if (!order) {
      return ApiResponses.notFound('Order not found');
    }

    if (order.status !== 'pending') {
      return ApiResponses.badRequest('Only pending orders can be cancelled');
    }

    if (order.serviceExtensionAppliedAt || Number(order.serviceExtensionHours || 0) > 0) {
      return ApiResponses.badRequest('Không thể hủy đơn đã áp dụng thêm giờ');
    }

    order.status = 'cancelled';
    await order.save();

    // Rollback shift stock (best effort)
    try {
      await rollbackShiftSale(
        order.items.map((item) => ({
          itemId: String(item.itemId),
          quantity: Number(item.quantity || 0),
        })),
        order.createdAt
      );
    } catch (err) {
      console.warn('Rollback shift sale failed:', err);
    }

    // Remove related transaction (best effort)
    try {
      await Transaction.deleteMany({
        referenceId: order._id,
        referenceModel: 'Order',
      });
    } catch (err) {
      console.warn('Delete transaction failed:', err);
    }

    return ApiResponses.success(order, 'Order cancelled');
  } catch (error) {
    console.error('Cancel public order error:', error);
    return ApiResponses.serverError();
  }
}
