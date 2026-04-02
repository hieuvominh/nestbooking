import { NextRequest } from 'next/server';
import { addMinutes } from 'date-fns';
import connectDB from '@/lib/mongodb';
import { Booking, Desk, Transaction, InventoryItem, Voucher } from '@/models';
import { generatePublicBookingUrl } from '@/lib/jwt';
import { ensureComboOrderForPaidBooking, validateComboOrderForPaidBooking } from '@/lib/combo-order';
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
  deskLabel?: string;
  customerName?: string;
  subtotal: number;
  discountApplied: number;
  finalTotal: number;
  voucherCode?: string;
  voucherType?: string;
}) {
  const {
    deskLabel,
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

  return `Thanh toán đặt chỗ ${deskLabel || ''} - ${customerName || 'Khách hàng'} | Tạm tính: ${formatVnd(subtotal)} | Giảm: ${formatVnd(discountApplied)} | Thành tiền: ${formatVnd(finalTotal)}${voucherText}`;
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

// GET /api/bookings - Get all bookings
async function getBookings(request: AuthenticatedRequest) {
  try {
    await connectDB();

    // Auto-cancel no-show confirmed bookings and auto-complete active bookings.
    // This keeps the booking statuses up-to-date without relying on a worker.
    // NOTE: We use UTC for MongoDB comparisons (startTime/endTime stored as UTC)
    // but preserve Vietnam time for logging/timestamps
    try {
      const nowVietnam = getNowInVietnam();
      // Convert back to UTC for MongoDB queries (subtract 7 hours from the offset value)
      const now = new Date(nowVietnam.getTime() - 7 * 60 * 60 * 1000);
      
      const parsedNoShow = parseInt(
        process.env.BOOKING_NO_SHOW_MINUTES || '30',
        10
      );
      const noShowMinutes = Number.isFinite(parsedNoShow) ? parsedNoShow : 30;
      const noShowCutoff = new Date(now.getTime() - noShowMinutes * 60 * 1000);

      // Normalize legacy pending bookings into the new 4-status flow.
      await Booking.updateMany(
        { status: "pending", endTime: { $lt: now } },
        { $set: { status: "completed", completedAt: now } }
      );
      await Booking.updateMany(
        { status: "pending", startTime: { $lte: now }, endTime: { $gte: now } },
        { $set: { status: "checked-in", checkedInAt: now } }
      );
      await Booking.updateMany(
        { status: "pending", startTime: { $gt: now } },
        { $set: { status: "confirmed" } }
      );

      await Booking.updateMany(
        {
          status: "confirmed",
          startTime: { $lt: noShowCutoff },
        },
        { $set: { status: "cancelled" } }
      );

      await Booking.updateMany(
        {
          endTime: { $lt: now },
          status: "checked-in",
        },
        { $set: { status: "completed", completedAt: now } }
      );
    } catch (err) {
      // Non-fatal — if updating statuses fails we still want to return bookings
      console.error("Failed to auto-complete bookings:", err);
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const deskId = searchParams.get('deskId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    // Build query
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (deskId) {
      query.deskId = deskId;
    }
    if (startDate && endDate) {
      query.$or = [
        {
          startTime: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        },
        {
          endTime: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      ];
    }

    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('deskId', 'label location')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Booking.countDocuments(query)
    ]);

    return ApiResponses.success({
      bookings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    return ApiResponses.serverError();
  }
}

// POST /api/bookings - Create new booking
async function createBooking(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const {
      deskId,
      customer,
      startTime,
      endTime,
      notes,
      status,
      paymentStatus,
      totalAmount,
      subtotalAmount,
      discountPercent,
      discountAmount,
      promoCode,
      voucherCode,
      checkedInAt,
      comboId,
      guestCount,
      comboQuantity
    } = body;

    // Validate required fields
    if (!deskId || !customer || !startTime || !endTime) {
      return ApiResponses.badRequest('Missing required fields');
    }

    const customerName = customer.name?.trim();

    // Clean up customer object - remove undefined values
    const cleanCustomer: any = {
      name: customerName || "Khách Hàng"
    };
    if (customer.email && customer.email.trim()) {
      cleanCustomer.email = customer.email.trim();
    }
    if (customer.phone && customer.phone.trim()) {
      cleanCustomer.phone = customer.phone.trim();
    }

    const start = new Date(startTime);

    let combo: any = null;
    if (comboId) {
      combo = await InventoryItem.findById(comboId)
        .select('name price pricePerPerson duration')
        .lean();
      if (!combo) {
        return ApiResponses.badRequest('Combo không tồn tại');
      }
    }

    const comboGuests = typeof guestCount === 'number' && guestCount >= 1 ? Math.floor(guestCount) : 1;
    const comboQty = typeof comboQuantity === 'number' && comboQuantity >= 1 ? Math.floor(comboQuantity) : 1;
    const isSharedComboBooking = Boolean(combo && !combo.pricePerPerson && comboQty > 1);

    let end = new Date(endTime);
    if (combo && Number(combo.duration || 0) > 0) {
      end = new Date(
        start.getTime() + Number(combo.duration) * 60 * 60 * 1000,
      );
    }

    // Validate dates
    if (start >= end) {
      return ApiResponses.badRequest('End time must be after start time');
    }

    // NOTE: removed strict server-side rejection of past bookings here
    // The previous behavior returned a 400 when start < now for non-checked-in
    // bookings. That validation has been removed to allow creating bookings
    // with past start times from the client. If you still want to prevent
    // past bookings in some cases, implement that check in the client or
    // re-introduce conditional validation here.

    // Check if desk exists and is available
    const desk = await Desk.findById(deskId);
    if (!desk) {
      return ApiResponses.notFound('Desk not found');
    }

    if (desk.status === 'maintenance') {
      return ApiResponses.badRequest('Desk is under maintenance');
    }

    // Check for double booking
    const conflictingBooking = await Booking.findOne({
      deskId,
      status: { $nin: ['cancelled', 'completed'] },
      $or: [
        {
          startTime: { $lt: end },
          endTime: { $gt: start }
        }
      ]
    });

    if (conflictingBooking) {
      return ApiResponses.conflict('Desk is already booked for this time period');
    }

    // Calculate subtotal amount (combo price OR desk rate x duration)
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const calculatedSubtotal = combo
      ? normalizeVndAmount(combo.price) * (combo.pricePerPerson ? comboGuests : comboQty)
      : Math.ceil(durationHours * desk.hourlyRate);
    const normalizedSubtotalAmount =
      typeof subtotalAmount === 'number' && subtotalAmount >= 0
        ? normalizeVndAmount(subtotalAmount)
        : normalizeVndAmount(calculatedSubtotal);

    let normalizedTotalAmount =
      typeof totalAmount === 'number' && totalAmount >= 0
        ? normalizeVndAmount(totalAmount)
        : normalizedSubtotalAmount;

    let normalizedDiscountAmount =
      typeof discountAmount === 'number' && discountAmount >= 0
        ? normalizeVndAmount(discountAmount)
        : 0;

    let normalizedDiscountPercent =
      typeof discountPercent === 'number' && discountPercent >= 0
        ? discountPercent
        : 0;

    let resolvedPromoCode = promoCode && String(promoCode).trim() ? String(promoCode).trim() : undefined;
    let appliedVoucher: any = undefined;

    const normalizedVoucherCode = voucherCode && String(voucherCode).trim()
      ? String(voucherCode).trim().toUpperCase()
      : undefined;

    if (normalizedVoucherCode) {
      const voucherDoc: any = await (Voucher as any)
        .findOne({ code: normalizedVoucherCode })
        .lean();
      if (!voucherDoc) {
        return ApiResponses.badRequest('Voucher không tồn tại');
      }

      const voucherCalc = calculateVoucherDiscount(voucherDoc, {
        subtotal: normalizedSubtotalAmount,
        isComboBooking: Boolean(comboId),
        comboPricePerPerson: Boolean(combo?.pricePerPerson),
        guestCount: comboGuests,
      });

      if (!voucherCalc.valid) {
        return ApiResponses.badRequest(voucherCalc.reason || 'Voucher không hợp lệ');
      }

      normalizedDiscountAmount = normalizeVndAmount(voucherCalc.discountApplied);
      normalizedDiscountPercent = 0;
      normalizedTotalAmount = normalizeVndAmount(voucherCalc.finalTotal);
      resolvedPromoCode = voucherDoc.code;
      appliedVoucher = {
        voucherId: voucherDoc._id,
        code: voucherDoc.code,
        type: voucherDoc.type,
        value: voucherDoc.value,
        discountApplied: normalizedDiscountAmount,
        appliedAt: new Date(), // Store UTC timestamp
      };
    } else {
      // Legacy manual discount path (no voucher)
      const manualDiscountRaw =
        normalizedDiscountAmount > 0
          ? normalizedDiscountAmount
          : normalizedDiscountPercent > 0
            ? normalizeVndAmount((normalizedSubtotalAmount * normalizedDiscountPercent) / 100)
            : 0;
      normalizedDiscountAmount = Math.min(manualDiscountRaw, normalizedSubtotalAmount);
      normalizedTotalAmount = Math.max(0, normalizedSubtotalAmount - normalizedDiscountAmount);
    }
    // Auto-status: if startTime is now or past (in Vietnam time), mark as checked-in
    // Note: Convert getNowInVietnam() to UTC for correct comparison with DB startTime
    const nowUtc = new Date(getNowInVietnam().getTime() - 7 * 60 * 60 * 1000);
    const resolvedStatus =
      status || (start <= nowUtc ? 'checked-in' : 'confirmed');
    const resolvedPaymentStatus =
      resolvedStatus === "checked-in"
        ? "paid"
        : paymentStatus || "pending";

    if (resolvedPaymentStatus === 'paid' && comboId) {
      try {
        await validateComboOrderForPaidBooking({
          comboId: String(comboId),
          guestCount: comboGuests,
          comboQuantity: comboQty,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Combo processing failed';
        return ApiResponses.badRequest(msg);
      }
    }

    // Create booking with provided or default values
    const bookingData: any = {
      deskId,
      customer: cleanCustomer,
      startTime: start,
      endTime: end,
      totalAmount: normalizedTotalAmount,
      subtotalAmount: normalizedSubtotalAmount,
      discountPercent: normalizedDiscountPercent > 0 ? normalizedDiscountPercent : undefined,
      discountAmount: normalizedDiscountAmount > 0 ? normalizedDiscountAmount : undefined,
      promoCode: resolvedPromoCode,
      appliedVoucher,
      status: resolvedStatus,
      paymentStatus: resolvedPaymentStatus,
      notes
    };

    // Persist combo selection if provided
    if (comboId) {
      bookingData.comboId = comboId;
      bookingData.isComboBooking = true;
      bookingData.isSharedComboBooking = isSharedComboBooking;
      if (combo?.pricePerPerson) {
        bookingData.guestCount = comboGuests;
      } else {
        bookingData.comboQuantity = comboQty;
      }
    }

    // Note: Store UTC timestamps in DB for consistency
    if (checkedInAt) {
      bookingData.checkedInAt = new Date(checkedInAt);
    } else if (resolvedStatus === 'checked-in') {
      bookingData.checkedInAt = new Date(); // Store UTC timestamp
    }

    // Create booking
    const booking = new Booking(bookingData);

    await booking.save();

    // If booking is paid and uses a combo, create combo order + deduct shift stock
    if (resolvedPaymentStatus === 'paid' && comboId) {
      try {
        await ensureComboOrderForPaidBooking({
          bookingId: booking._id.toString(),
          comboId: String(comboId),
          guestCount: bookingData.guestCount ?? 1,
          comboQuantity: bookingData.comboQuantity ?? 1,
        });
      } catch (err) {
        // rollback booking so we don't keep a reserved table
        try {
          await Booking.findByIdAndDelete(booking._id);
        } catch (cleanupErr) {
          console.error('Failed to rollback booking after combo error:', cleanupErr);
        }
        const msg = err instanceof Error ? err.message : 'Combo processing failed';
        return ApiResponses.badRequest(msg);
      }
    }

    // If bookingData included comboId but the currently compiled Booking model
    // doesn't have that path (hot-reload mismatch), ensure the comboId is
    // persisted by running an update with strict: false. This writes the raw
    // field to Mongo so the billing page can read it even before a full
    // server restart.
    if (bookingData.comboId) {
      try {
        const fallbackSetData: any = {
          comboId: bookingData.comboId,
          isComboBooking: true,
          isSharedComboBooking: bookingData.isSharedComboBooking,
        };
        if (bookingData.guestCount) fallbackSetData.guestCount = bookingData.guestCount;
        if (bookingData.comboQuantity) fallbackSetData.comboQuantity = bookingData.comboQuantity;

        await Booking.findByIdAndUpdate(
          booking._id,
          { $set: fallbackSetData },
          { strict: false }
        );
        // reload booking document
        await booking.reload?.();
      } catch (err) {
        // ignore - we'll still attempt to return whatever was saved
        console.error('Failed to upsert comboId via fallback update:', err);
      }
    }

    // Generate public token (expires after booking end + buffer)
    const bufferMinutes = parseInt(process.env.PUBLIC_BOOKING_BUFFER_MINUTES || '30');
    const tokenExpiry = addMinutes(end, bufferMinutes);
    const publicUrl = generatePublicBookingUrl(booking._id.toString(), tokenExpiry);

    // Update booking with public token
    booking.publicToken = publicUrl.split('?t=')[1];
    await ensurePublicShortCode(booking);
    await booking.save();

    // Create transaction record
      const audit = {
        subtotal: normalizedSubtotalAmount,
        discountApplied: normalizedDiscountAmount,
        finalTotal: normalizedTotalAmount,
        voucherCode: appliedVoucher?.code,
        voucherType: appliedVoucher?.type,
      };
      const transaction = new Transaction({
      type: 'income',
      amount: normalizedTotalAmount,
      source: 'booking',
      description: buildBookingIncomeDescription({
        deskLabel: desk.label,
        customerName: cleanCustomer.name || 'Khách hàng',
        subtotal: audit.subtotal,
        discountApplied: audit.discountApplied,
        finalTotal: audit.finalTotal,
        voucherCode: audit.voucherCode,
        voucherType: audit.voucherType,
      }),
      referenceId: booking._id,
      referenceModel: 'Booking',
      createdBy: request.user.userId
    });
    if (resolvedPaymentStatus === 'paid') {
      await transaction.save();
    }

    // Try to populate desk and combo info. Some runtimes may have an older
    // compiled Booking model that doesn't include `comboId` which causes
    // Mongoose to throw. Handle that gracefully and fallback to manual lookup.
    let bookingForResponse: any = booking;
    try {
      await booking.populate([
        { path: 'deskId', select: 'label location hourlyRate' },
        { path: 'comboId', select: 'name price duration pricePerPerson' },
      ]);
      bookingForResponse = booking;
    } catch (err) {
      // If populate fails (eg. comboId not in compiled schema), populate desk
      // and try a manual lookup for comboId so the client still gets combo info.
      try {
        await booking.populate({ path: 'deskId', select: 'label location hourlyRate' });
      } catch (inner) {
        // ignore - we'll still return the booking document
      }

      if (booking.comboId) {
        try {
          const combo = await InventoryItem.findById(booking.comboId).select('name price duration pricePerPerson').lean();
          bookingForResponse = booking.toObject ? booking.toObject() : booking;
          bookingForResponse.comboId = combo;
        } catch (innerErr) {
          console.error('Failed to fetch combo fallback:', innerErr);
        }
      }
    }

    return ApiResponses.created({ booking: bookingForResponse, publicUrl }, 'Booking created successfully');

  } catch (error) {
    console.error('Create booking error:', error);
    // Log the full error details for debugging
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Return the actual error message in development
      return ApiResponses.serverError(error.message);
    }
    return ApiResponses.serverError();
  }
}

export const GET = requireRole(['admin', 'staff'])(getBookings);
export const POST = requireRole(['admin', 'staff'])(createBooking);
