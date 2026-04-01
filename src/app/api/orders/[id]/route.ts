import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Booking, InventoryItem, Order } from '@/models';
import { applyShiftSale } from '@/lib/shift-stock';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';
import { getNowInVietnam } from '@/lib/vietnam-time';

const PUBLIC_ODD_HOUR_SKU = 'ODD_HOUR_PUBLIC';

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

    // Fetch current order to check previous status
    const currentOrder = await Order.findById(id);
    if (!currentOrder) {
      return ApiResponses.notFound('Order not found');
    }

    const previousStatus = currentOrder.status;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes;
    if (deliveredAt !== undefined) updateData.deliveredAt = deliveredAt;

    // If status is being changed to 'delivered', set deliveredAt
    if (status === 'delivered' && !deliveredAt) {
      updateData.deliveredAt = new Date(); // Store UTC timestamp
    }

    // Apply shift stock when marking as delivered (only if not already delivered)
    if (status === 'delivered' && previousStatus !== 'delivered') {
      try {
        // Combo order generated at booking-payment step already applied shift stock
        // for included components. Skip re-applying to avoid double deduction.
        if (!currentOrder.isComboOrder) {
          const itemIds = currentOrder.items
            .map((item: any) => String(item.itemId || ''))
            .filter(Boolean);

          const inventoryDocs = await InventoryItem.find({
            _id: { $in: itemIds },
          })
            .select('category type sku duration pricePerPerson')
            .lean();

          const inventoryMap = new Map(
            inventoryDocs.map((doc: any) => [String(doc._id), doc])
          );

          const shiftSaleItems = currentOrder.items
            .map((item: any) => {
              const itemId = String(item.itemId || '');
              const inv: any = inventoryMap.get(itemId);
              if (!inv) {
                // Inventory row may be deleted/legacy. Skip to avoid blocking completion.
                return null;
              }

              const isServiceLike =
                inv.category === 'combo' ||
                inv.type === 'combo' ||
                inv.sku === PUBLIC_ODD_HOUR_SKU;

              if (isServiceLike) return null;

              return {
                itemId,
                quantity: Number(item.quantity || 0),
              };
            })
            .filter(Boolean) as Array<{ itemId: string; quantity: number }>;

          if (shiftSaleItems.length > 0) {
            await applyShiftSale(shiftSaleItems);
          }

          // Extend booking end time for duration-based public service combos
          // (e.g., combo public room 4h, odd-hour item 1h)
          const extensionHours = currentOrder.items.reduce((sum: number, item: any) => {
            const inv: any = inventoryMap.get(String(item.itemId || ''));
            if (!inv) return sum;

            const duration = Number(inv.duration || 0);
            const quantity = Number(item.quantity || 0);
            const isDurationServiceCombo =
              inv.category === 'combo' &&
              duration > 0 &&
              !inv.pricePerPerson;

            if (!isDurationServiceCombo || quantity <= 0) return sum;

            return sum + duration * quantity;
          }, 0);

          if (extensionHours > 0) {
            const booking = await Booking.findById(currentOrder.bookingId);
            if (booking && booking.status !== 'cancelled' && booking.status !== 'completed') {
              // Convert getNowInVietnam() to UTC for correct comparison with DB endTime
              const nowUtc = new Date(getNowInVietnam().getTime() - 7 * 60 * 60 * 1000);
              const currentEnd = new Date(booking.endTime);
              const baseTime = currentEnd > nowUtc ? currentEnd : nowUtc;
              booking.endTime = new Date(baseTime.getTime() + extensionHours * 60 * 60 * 1000);
              await booking.save();
            }
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Lỗi kho ca';
        return ApiResponses.badRequest(msg);
      }
    }

    // Block cancelling a delivered order (stock already deducted)
    if (status === 'cancelled' && previousStatus === 'delivered') {
      return ApiResponses.badRequest('Không thể hủy đơn đã giao');
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