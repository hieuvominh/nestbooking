import { NextRequest } from 'next/server';
import { addMinutes } from 'date-fns';
import connectDB from '@/lib/mongodb';
import { Booking, Desk, Transaction, InventoryItem } from '@/models';
import { generatePublicBookingUrl } from '@/lib/jwt';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

// GET /api/bookings - Get all bookings
async function getBookings(request: AuthenticatedRequest) {
  try {
    await connectDB();

    // Auto-complete bookings whose end time has passed.
    // Any booking that ended in the past and is not already completed or cancelled
    // will be marked as 'completed'. This keeps the booking statuses up-to-date
    // without relying on a separate background worker.
    try {
      await Booking.updateMany(
        {
          endTime: { $lt: new Date() },
          status: { $nin: ["cancelled", "completed"] },
        },
        { $set: { status: "completed" } }
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
      checkedInAt,
      comboId
    } = body;

    // Validate required fields
    if (!deskId || !customer || !startTime || !endTime) {
      return ApiResponses.badRequest('Missing required fields');
    }

    if (!customer.name) {
      return ApiResponses.badRequest('Customer name is required');
    }

    // Clean up customer object - remove undefined values
    const cleanCustomer: any = {
      name: customer.name.trim()
    };
    if (customer.email && customer.email.trim()) {
      cleanCustomer.email = customer.email.trim();
    }
    if (customer.phone && customer.phone.trim()) {
      cleanCustomer.phone = customer.phone.trim();
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

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

    // Calculate total amount (use provided value or calculate from desk rate)
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const calculatedAmount = Math.ceil(durationHours * desk.hourlyRate);
    const finalTotalAmount = totalAmount || calculatedAmount;

    // Create booking with provided or default values
    const bookingData: any = {
      deskId,
      customer: cleanCustomer,
      startTime: start,
      endTime: end,
      totalAmount: finalTotalAmount,
      status: status || 'confirmed',
      paymentStatus: paymentStatus || 'pending',
      notes
    };

    // Persist combo selection if provided
    if (comboId) {
      bookingData.comboId = comboId;
      bookingData.isComboBooking = true;
    }

    // Add checkedInAt if provided (for immediate check-ins)
    if (checkedInAt) {
      bookingData.checkedInAt = new Date(checkedInAt);
    }

    // Create booking
    const booking = new Booking(bookingData);

    await booking.save();

    // If bookingData included comboId but the currently compiled Booking model
    // doesn't have that path (hot-reload mismatch), ensure the comboId is
    // persisted by running an update with strict: false. This writes the raw
    // field to Mongo so the billing page can read it even before a full
    // server restart.
    if (bookingData.comboId) {
      try {
        await Booking.findByIdAndUpdate(
          booking._id,
          { $set: { comboId: bookingData.comboId, isComboBooking: true } },
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
    await booking.save();

    // Create transaction record
    const transaction = new Transaction({
      type: 'income',
      amount: finalTotalAmount,
      source: 'booking',
      description: `Booking for desk ${desk.label} - ${cleanCustomer.name}`,
      referenceId: booking._id,
      referenceModel: 'Booking',
      createdBy: request.user.userId
    });
    await transaction.save();

    // Try to populate desk and combo info. Some runtimes may have an older
    // compiled Booking model that doesn't include `comboId` which causes
    // Mongoose to throw. Handle that gracefully and fallback to manual lookup.
    let bookingForResponse: any = booking;
    try {
      await booking.populate([
        { path: 'deskId', select: 'label location hourlyRate' },
        { path: 'comboId', select: 'name price duration' },
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
          const combo = await InventoryItem.findById(booking.comboId).select('name price duration').lean();
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