import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Order } from '@/models';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

// GET /api/orders/[id] - Get order by ID
async function getOrder(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();

    const { id } = await params;
    const order = await Order.findById(id)
      .populate('bookingId', 'customer deskId startTime endTime')
      .populate('items.itemId', 'name price category');

    if (!order) {
      return ApiResponses.notFound('Order not found');
    }

    return ApiResponses.success(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    return ApiResponses.serverError('Failed to fetch order');
  }
}

// PUT /api/orders/[id] - Update order
async function updateOrder(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();

    const { id } = await params;
    const body = await request.json();
    const { status, notes, deliveredAt } = body;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (deliveredAt !== undefined) updateData.deliveredAt = deliveredAt;

    // If status is being changed to 'delivered', set deliveredAt
    if (status === 'delivered' && !deliveredAt) {
      updateData.deliveredAt = new Date();
    }

    const order = await Order.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('bookingId', 'customer deskId startTime endTime')
      .populate('items.itemId', 'name price category');

    if (!order) {
      return ApiResponses.notFound('Order not found');
    }

    return ApiResponses.success(order);
  } catch (error) {
    console.error('Error updating order:', error);
    return ApiResponses.serverError('Failed to update order');
  }
}

// DELETE /api/orders/[id] - Delete order
async function deleteOrder(request: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();

    const { id } = await params;
    const order = await Order.findById(id);

    if (!order) {
      return ApiResponses.notFound('Order not found');
    }

    // Only allow deletion of pending or cancelled orders
    if (!['pending', 'cancelled'].includes(order.status)) {
      return ApiResponses.badRequest('Cannot delete order with status: ' + order.status);
    }

    await Order.findByIdAndDelete(id);

    return ApiResponses.success({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    return ApiResponses.serverError('Failed to delete order');
  }
}

export const GET = withAuth(requireRole(['admin', 'staff'])(getOrder));
export const PUT = withAuth(requireRole(['admin', 'staff'])(updateOrder));
export const DELETE = withAuth(requireRole(['admin'])(deleteOrder));