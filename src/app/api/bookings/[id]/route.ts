import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { addMinutes } from 'date-fns';
import connectDB from '@/lib/mongodb';
import { Booking, Desk, InventoryItem, Transaction, Voucher } from '@/models';
import { generatePublicBookingUrl } from '@/lib/jwt';
import { ensureComboOrderForPaidBooking } from '@/lib/combo-order';
import { normalizeVndAmount } from '@/lib/currency';
import { calculateVoucherDiscount } from '@/lib/voucher';
import { getNowInVietnam } from '@/lib/vietnam-time';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

function formatVnd(amount: number) {
  return `${normalizeVndAmount(amount).toLocaleString('vi-VN')}đ`;
}

function getVoucherTypeLabel(type?: string) {
  switch (type) {
    case 'fixed_amount':
      return 'Giảm tiền cố định';
    case 'percent':
      return 'Giảm phần trăm';
    case 'combo_price_override':
      return 'Đặt giá combo cố định';
    case 'per_person_price_override':
      return 'Đặt giá combo theo đầu người';
    default:
      return undefined;
  }
}

function buildBookingIncomeDescription(params: {
  customerName?: string;
  subtotal: number;
  discountApplied: number;
  finalTotal: number;
  voucherCode?: string;
  voucherType?: string;
}) {
  const {
    customerName,
    subtotal,
    discountApplied,
    finalTotal,
    voucherCode,
    voucherType,
  } = params;

  const voucherLabel = getVoucherTypeLabel(voucherType);
  const voucherText = voucherCode
    ? ` | Voucher: ${voucherCode}${voucherLabel ? ` (${voucherLabel})` : ''}`
    : '';

  return `Thanh toán đặt chỗ - ${customerName || 'Khách hàng'} | Tạm tính: ${formatVnd(subtotal)} | Giảm: ${formatVnd(discountApplied)} | Thành tiền: ${formatVnd(finalTotal)}${voucherText}`;
}

function buildBookingRefundDescription(params: {
  customerName?: string;
  subtotal: number;
  discountApplied: number;
  refundTotal: number;
  voucherCode?: string;
  voucherType?: string;
}) {
  const {
    customerName,
    subtotal,
    discountApplied,
    refundTotal,
    voucherCode,
    voucherType,
  } = params;

  const voucherLabel = getVoucherTypeLabel(voucherType);
  const voucherText = voucherCode
    ? ` | Voucher: ${voucherCode}${voucherLabel ? ` (${voucherLabel})` : ''}`
    : '';

  return `Hoàn tiền đặt chỗ - ${customerName || 'Khách hàng'} | Tạm tính: ${formatVnd(subtotal)} | Giảm: ${formatVnd(discountApplied)} | Hoàn tiền: ${formatVnd(refundTotal)}${voucherText}`;
}

async function ensurePublicShortCode(booking: any) {
  if (booking.publicShortCode) return;
  const maxAttempts = 6;
  for (let i = 0; i < maxAttempts; i += 1) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    const exists = await Booking.findOne({ publicShortCode: code }).lean();
    if (!exists) {
      booking.publicShortCode = code;
      return;
    }
  }
}

interface BookingParams {
  params: Promise<{ id: string }>;
}

// GET /api/bookings/[id] - Get single booking
async function getBooking(request: AuthenticatedRequest, { params }: BookingParams) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid booking ID');
    }

    // Use document here so we can backfill short code if missing
    const bookingDoc = await Booking.findById(id);
    if (!bookingDoc) {
      return ApiResponses.notFound('Booking not found');
    }

    if (bookingDoc.status !== 'cancelled' && !bookingDoc.publicShortCode) {
      await ensurePublicShortCode(bookingDoc);
      await bookingDoc.save();
    }

    if (bookingDoc.status !== 'cancelled' && !bookingDoc.publicToken) {
      const bufferMinutes = parseInt(process.env.PUBLIC_BOOKING_BUFFER_MINUTES || '30');
      const tokenExpiry = addMinutes(bookingDoc.endTime, bufferMinutes);
      const publicUrl = generatePublicBookingUrl(String(bookingDoc._id), tokenExpiry);
      bookingDoc.publicToken = publicUrl.split('?t=')[1];
      await bookingDoc.save();
    }

    const booking = await Booking.findById(id)
      .populate('deskId', 'label location hourlyRate')
      .lean();

    if (!booking) {
      return ApiResponses.notFound('Booking not found');
    }

    return ApiResponses.success(booking);
  } catch (error) {
    console.error('Get booking error:', error);
    return ApiResponses.serverError();
  }
}

// PATCH /api/bookings/[id] - Update booking
async function updateBooking(request: AuthenticatedRequest, { params }: BookingParams) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid booking ID');
    }

    const body = await request.json();
    const {
      deskId,
      customer,
      startTime,
      endTime,
      status,
      paymentStatus,
      notes,
      totalAmount,
      subtotalAmount,
      discountPercent,
      discountAmount,
      promoCode,
      voucherCode,
      clearVoucher,
    } = body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return ApiResponses.notFound('Booking not found');
    }

    // Validate status transitions
    const validStatuses = ['confirmed', 'checked-in', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return ApiResponses.badRequest('Invalid booking status');
    }

    // Don't allow changes to completed or cancelled bookings
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return ApiResponses.badRequest('Cannot modify completed or cancelled bookings');
    }

    if (booking.paymentStatus !== 'pending' && (voucherCode !== undefined || clearVoucher === true)) {
      return ApiResponses.badRequest('Đơn đã thanh toán/hoàn tiền, không thể chỉnh voucher');
    }

    let updateData: any = {};
    let recalculateAmount = false;

    // Handle time changes
    if (startTime || endTime) {
      const newStartTime = startTime ? new Date(startTime) : booking.startTime;
      const newEndTime = endTime ? new Date(endTime) : booking.endTime;

      if (newStartTime >= newEndTime) {
        return ApiResponses.badRequest('End time must be after start time');
      }

      // Check for conflicts if changing times
      if (startTime || endTime) {
        const conflictingBooking = await Booking.findOne({
          _id: { $ne: id },
          deskId: deskId || booking.deskId,
          status: { $nin: ['cancelled', 'completed'] },
          $or: [
            {
              startTime: { $lt: newEndTime },
              endTime: { $gt: newStartTime }
            }
          ]
        });

        if (conflictingBooking) {
          return ApiResponses.conflict('Time slot conflicts with another booking');
        }
      }

      updateData.startTime = newStartTime;
      updateData.endTime = newEndTime;
      recalculateAmount = true;
    }

    // Handle desk change
    if (deskId && deskId !== booking.deskId.toString()) {
      const desk = await Desk.findById(deskId);
      if (!desk) {
        return ApiResponses.notFound('New desk not found');
      }

      if (desk.status === 'maintenance') {
        return ApiResponses.badRequest('Cannot move booking to desk under maintenance');
      }

      updateData.deskId = deskId;
      recalculateAmount = true;
    }

    // Recalculate amount if needed
    if (recalculateAmount && !(typeof totalAmount === 'number' && totalAmount >= 0)) {
      const desk = await Desk.findById(deskId || booking.deskId);
      const start = updateData.startTime || booking.startTime;
      const end = updateData.endTime || booking.endTime;
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      updateData.totalAmount = Math.ceil(durationHours * desk!.hourlyRate);
      updateData.subtotalAmount = updateData.totalAmount;
    }

    // Handle other updates
    if (customer) {
      const customerName = customer?.name?.trim();
      const cleanCustomer: any = {
        name: customerName || 'Khách Hàng',
      };
      if (customer.email && customer.email.trim()) {
        cleanCustomer.email = customer.email.trim();
      }
      if (customer.phone && customer.phone.trim()) {
        cleanCustomer.phone = customer.phone.trim();
      }
      updateData.customer = cleanCustomer;
    }
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (notes !== undefined) updateData.notes = notes;
    if (typeof totalAmount === 'number' && totalAmount >= 0) {
      updateData.totalAmount = totalAmount;
    }
    if (typeof subtotalAmount === 'number' && subtotalAmount >= 0) {
      updateData.subtotalAmount = subtotalAmount;
    }
    if (typeof discountPercent === 'number' && discountPercent >= 0) {
      updateData.discountPercent = discountPercent;
    }
    if (typeof discountAmount === 'number' && discountAmount >= 0) {
      updateData.discountAmount = discountAmount;
    }
    if (promoCode !== undefined) {
      updateData.promoCode = promoCode && String(promoCode).trim()
        ? String(promoCode).trim()
        : undefined;
    }

    const hasManualDiscountInput =
      (typeof discountAmount === 'number' && discountAmount > 0) ||
      (typeof discountPercent === 'number' && discountPercent > 0);

    if (booking.appliedVoucher && hasManualDiscountInput) {
      return ApiResponses.badRequest('Không thể dùng giảm tay khi đã áp voucher');
    }

    if (clearVoucher === true) {
      const recoveredSubtotal =
        typeof updateData.subtotalAmount === 'number'
          ? normalizeVndAmount(updateData.subtotalAmount)
          : normalizeVndAmount(booking.subtotalAmount ?? booking.totalAmount);
      updateData.appliedVoucher = undefined;
      updateData.promoCode = undefined;
      updateData.discountPercent = 0;
      updateData.discountAmount = 0;
      updateData.subtotalAmount = recoveredSubtotal;
      updateData.totalAmount = recoveredSubtotal;
    }

    const normalizedVoucherCode = voucherCode && String(voucherCode).trim()
      ? String(voucherCode).trim().toUpperCase()
      : undefined;

    if (normalizedVoucherCode) {
      if (hasManualDiscountInput) {
        return ApiResponses.badRequest('Không thể cộng dồn voucher với giảm tay');
      }

      const voucher = await Voucher.findOne({ code: normalizedVoucherCode }).lean();
      if (!voucher) {
        return ApiResponses.badRequest('Voucher không tồn tại');
      }

      const combo = booking.comboId
        ? await InventoryItem.findById(booking.comboId).select('pricePerPerson').lean()
        : null;
      const baseSubtotal =
        typeof updateData.subtotalAmount === 'number'
          ? normalizeVndAmount(updateData.subtotalAmount)
          : normalizeVndAmount(booking.subtotalAmount ?? booking.totalAmount);

      const voucherCalc = calculateVoucherDiscount(voucher as any, {
        subtotal: baseSubtotal,
        isComboBooking: Boolean(booking.comboId || booking.isComboBooking),
        comboPricePerPerson: Boolean((combo as any)?.pricePerPerson),
        guestCount: booking.guestCount,
      });

      if (!voucherCalc.valid) {
        return ApiResponses.badRequest(voucherCalc.reason || 'Voucher không hợp lệ');
      }

      updateData.appliedVoucher = {
        voucherId: voucher._id,
        code: voucher.code,
        type: voucher.type,
        value: voucher.value,
        discountApplied: normalizeVndAmount(voucherCalc.discountApplied),
        appliedAt: getNowInVietnam(),
      };
      updateData.subtotalAmount = baseSubtotal;
      updateData.discountPercent = 0;
      updateData.discountAmount = normalizeVndAmount(voucherCalc.discountApplied);
      updateData.promoCode = voucher.code;
      updateData.totalAmount = normalizeVndAmount(voucherCalc.finalTotal);
    }

    // Handle check-in
    if (status === 'checked-in' && booking.status !== 'checked-in') {
      updateData.checkedInAt = new Date(); // Store UTC timestamp
    }
    if (status === 'completed' && booking.status !== 'completed') {
      updateData.completedAt = new Date(); // Store UTC timestamp
    }


    // Update public token if times changed
    if (startTime || endTime) {
      const bufferMinutes = parseInt(process.env.PUBLIC_BOOKING_BUFFER_MINUTES || '30');
      const tokenExpiry = addMinutes(updateData.endTime || booking.endTime, bufferMinutes);
      const publicUrl = generatePublicBookingUrl(id, tokenExpiry);
      updateData.publicToken = publicUrl.split('?t=')[1];
    }

    // If payment is transitioning to paid and booking has combo, process combo order first
    const isPayingNow =
      booking.paymentStatus !== 'paid' &&
      (updateData.paymentStatus === 'paid' || paymentStatus === 'paid');

    if (isPayingNow && booking.comboId) {
      try {
        await ensureComboOrderForPaidBooking({
          bookingId: booking._id.toString(),
          comboId: String(booking.comboId),
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Combo processing failed';
        return ApiResponses.badRequest(msg);
      }
    }

    const previousPaymentStatus = booking.paymentStatus;

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('deskId', 'label location hourlyRate');

    // Update or create transaction if booking is paid
    if (updateData.paymentStatus === 'paid' || updatedBooking?.paymentStatus === 'paid') {
      const amountToUse =
        typeof updateData.totalAmount === 'number'
          ? updateData.totalAmount
          : updatedBooking.totalAmount;
      const subtotalToUse =
        typeof updateData.subtotalAmount === 'number'
          ? normalizeVndAmount(updateData.subtotalAmount)
          : normalizeVndAmount(updatedBooking.subtotalAmount ?? updatedBooking.totalAmount);
      const discountToUse =
        typeof updateData.discountAmount === 'number'
          ? normalizeVndAmount(updateData.discountAmount)
          : normalizeVndAmount(updatedBooking.discountAmount ?? 0);
      const voucherAudit = updateData.appliedVoucher || updatedBooking.appliedVoucher;
      const audit = {
        subtotal: subtotalToUse,
        discountApplied: discountToUse,
        finalTotal: normalizeVndAmount(amountToUse),
        voucherCode: voucherAudit?.code,
        voucherType: voucherAudit?.type,
      };
      const existing = await Transaction.findOne({
        referenceId: id,
        referenceModel: 'Booking',
        type: 'income'
      });
      if (existing) {
        existing.amount = amountToUse;
        existing.description = buildBookingIncomeDescription({
          customerName: updatedBooking.customer?.name || 'Khách hàng',
          subtotal: audit.subtotal,
          discountApplied: audit.discountApplied,
          finalTotal: audit.finalTotal,
          voucherCode: audit.voucherCode,
          voucherType: audit.voucherType,
        });
        await existing.save();
      } else {
        await Transaction.create({
          type: 'income',
          amount: amountToUse,
          source: 'booking',
          description: buildBookingIncomeDescription({
            customerName: updatedBooking.customer?.name || 'Khách hàng',
            subtotal: audit.subtotal,
            discountApplied: audit.discountApplied,
            finalTotal: audit.finalTotal,
            voucherCode: audit.voucherCode,
            voucherType: audit.voucherType,
          }),
          referenceId: updatedBooking._id,
          referenceModel: 'Booking',
          createdBy: request.user.userId
        });
      }
    }

    // Create refund expense transaction when payment transitions from paid -> refunded
    if (previousPaymentStatus === 'paid' && updatedBooking?.paymentStatus === 'refunded') {
      const refundAmount = normalizeVndAmount(updatedBooking.totalAmount ?? 0);
      const refundVoucherAudit = updatedBooking.appliedVoucher;
      const refundAudit = {
        subtotal: normalizeVndAmount(updatedBooking.subtotalAmount ?? updatedBooking.totalAmount ?? 0),
        discountApplied: normalizeVndAmount(updatedBooking.discountAmount ?? 0),
        finalTotal: refundAmount,
        voucherCode: refundVoucherAudit?.code,
        voucherType: refundVoucherAudit?.type,
      };

      const existingRefund = await Transaction.findOne({
        referenceId: id,
        referenceModel: 'Booking',
        type: 'expense',
        source: 'booking',
        description: { $regex: '^Refund booking payment' },
      });

      if (!existingRefund) {
        await Transaction.create({
          type: 'expense',
          amount: refundAmount,
          source: 'booking',
          description: buildBookingRefundDescription({
            customerName: updatedBooking.customer?.name || 'Khách hàng',
            subtotal: refundAudit.subtotal,
            discountApplied: refundAudit.discountApplied,
            refundTotal: refundAudit.finalTotal,
            voucherCode: refundAudit.voucherCode,
            voucherType: refundAudit.voucherType,
          }),
          referenceId: updatedBooking._id,
          referenceModel: 'Booking',
          createdBy: request.user.userId,
        });
      }
    }

    return ApiResponses.success(updatedBooking, 'Booking updated successfully');

  } catch (error) {
    console.error('Update booking error:', error);
    return ApiResponses.serverError();
  }
}

// DELETE /api/bookings/[id] - Cancel booking
async function cancelBooking(request: AuthenticatedRequest, { params }: BookingParams) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid booking ID');
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return ApiResponses.notFound('Booking not found');
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return ApiResponses.badRequest('Booking is already completed or cancelled');
    }

    // Update booking status to cancelled
    booking.status = 'cancelled';
    booking.publicToken = undefined;
    booking.publicShortCode = undefined;
    await booking.save();

    // Handle refund transaction if payment was made
    if (booking.paymentStatus === 'paid') {
      const refundTransaction = new Transaction({
        type: 'expense',
        amount: booking.totalAmount,
        source: 'booking',
        description: `Hoàn tiền huỷ đặt chỗ - ${booking.customer.name}`,
        referenceId: booking._id,
        referenceModel: 'Booking',
        createdBy: request.user.userId
      });
      await refundTransaction.save();

      booking.paymentStatus = 'refunded';
      await booking.save();
    }

    return ApiResponses.success(booking, 'Booking cancelled successfully');

  } catch (error) {
    console.error('Cancel booking error:', error);
    return ApiResponses.serverError();
  }
}

export const GET = requireRole(['admin', 'staff'])(getBooking);
export const PATCH = requireRole(['admin', 'staff'])(updateBooking);
export const DELETE = requireRole(['admin', 'staff'])(cancelBooking);
