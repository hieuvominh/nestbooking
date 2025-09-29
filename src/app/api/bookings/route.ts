import { NextRequest } from 'next/server';
import { addMinutes } from 'date-fns';
import connectDB from '@/lib/mongodb';
import { Booking, Desk, Transaction } from '@/models';
import { generatePublicBookingUrl } from '@/lib/jwt';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

// GET /api/bookings - Get all bookings
async function getBookings(request: AuthenticatedRequest) {
  try {
    await connectDB();

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
      notes
    } = body;

    // Validate required fields
    if (!deskId || !customer || !startTime || !endTime) {
      return ApiResponses.badRequest('Missing required fields');
    }

    if (!customer.name || !customer.email || !customer.phone) {
      return ApiResponses.badRequest('Complete customer information is required');
    }

    const start = new Date(startTime);
    const end = new Date(endTime);

    // Validate dates
    if (start >= end) {
      return ApiResponses.badRequest('End time must be after start time');
    }

    if (start < new Date()) {
      return ApiResponses.badRequest('Booking cannot be in the past');
    }

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

    // Calculate total amount
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    const totalAmount = Math.ceil(durationHours * desk.hourlyRate);

    // Create booking
    const booking = new Booking({
      deskId,
      customer,
      startTime: start,
      endTime: end,
      totalAmount,
      notes
    });

    await booking.save();

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
      amount: totalAmount,
      source: 'booking',
      description: `Booking for desk ${desk.label} - ${customer.name}`,
      referenceId: booking._id,
      referenceModel: 'Booking',
      createdBy: request.user.userId
    });
    await transaction.save();

    // Populate desk info for response
    await booking.populate('deskId', 'label location');

    return ApiResponses.created({
      booking,
      publicUrl
    }, 'Booking created successfully');

  } catch (error) {
    console.error('Create booking error:', error);
    return ApiResponses.serverError();
  }
}

export const GET = requireRole(['admin', 'staff'])(getBookings);
export const POST = requireRole(['admin', 'staff'])(createBooking);