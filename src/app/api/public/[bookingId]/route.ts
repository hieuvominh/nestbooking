import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { Booking } from '@/models';
import { validatePublicBookingAccess } from '@/lib/jwt';
import { getNowInVietnam } from '@/lib/vietnam-time';
import { ApiResponses } from '@/lib/api-middleware';

interface PublicBookingParams {
  params: Promise<{ bookingId: string }>;
}

// GET /api/public/[bookingId] - Get booking details for public access
export async function GET(request: NextRequest, { params }: PublicBookingParams) {
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

    const booking = await Booking.findById(bookingId)
      .populate('deskId', 'label location hourlyRate')
      .populate('comboId', 'name pricePerPerson duration')
      .lean();

    if (!booking) {
      return ApiResponses.notFound('Booking not found');
    }

    if ((booking as any).status === 'cancelled' || (booking as any).status === 'completed') {
      return ApiResponses.unauthorized('Booking has ended');
    }

    const bookingAny = booking as any;
    const combo = bookingAny.comboId as any;
    const isMeetingRoomBooking = Boolean(
      bookingAny.isComboBooking && combo && combo.pricePerPerson
    );

    // Don't expose sensitive information
    const publicBookingData = {
      id: bookingAny._id,
      desk: bookingAny.deskId,
      customer: {
        name: bookingAny.customer.name || 'Khách hàng',
        // Don't expose email/phone for privacy
      },
      startTime: bookingAny.startTime,
      endTime: bookingAny.endTime,
      status: bookingAny.status,
      totalAmount: bookingAny.totalAmount,
      checkedInAt: bookingAny.checkedInAt,
      checkInTime: bookingAny.checkedInAt,
      notes: bookingAny.notes,
      isMeetingRoomBooking,
      isSharedComboBooking: Boolean(bookingAny.isSharedComboBooking),
    };

    return ApiResponses.success(publicBookingData);

  } catch (error) {
    console.error('Get public booking error:', error);
    return ApiResponses.serverError();
  }
}

// PATCH /api/public/[bookingId] - Check in to booking
export async function PATCH(request: NextRequest, { params }: PublicBookingParams) {
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
    const { action } = body;

    if (action !== 'check-in') {
      return ApiResponses.badRequest('Invalid action');
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return ApiResponses.notFound('Booking not found');
    }

    if ((booking as any).status === 'cancelled' || (booking as any).status === 'completed') {
      return ApiResponses.unauthorized('Booking has ended');
    }

    // Validate check-in conditions (using Vietnam time)
    if (booking.status !== 'confirmed') {
      return ApiResponses.badRequest('Booking must be confirmed to check in');
    }

    // Convert getNowInVietnam() to UTC for correct comparison with DB times (startTime/endTime stored in UTC)
    const nowUtc = new Date(getNowInVietnam().getTime() - 7 * 60 * 60 * 1000);
    const startTime = new Date(booking.startTime);
    const endTime = new Date(booking.endTime);

    // Allow check-in 15 minutes before start time
    const earlyCheckInTime = new Date(startTime.getTime() - 15 * 60 * 1000);

    if (nowUtc < earlyCheckInTime) {
      return ApiResponses.badRequest('Check-in is not available yet');
    }

    if (nowUtc > endTime) {
      return ApiResponses.badRequest('Booking has expired');
    }

    // Update booking status
    booking.status = 'checked-in';
    booking.checkedInAt = new Date(); // Store UTC timestamp
    await booking.save();

    return ApiResponses.success({
      message: 'Successfully checked in',
      checkedInAt: booking.checkedInAt
    });

  } catch (error) {
    console.error('Public booking check-in error:', error);
    return ApiResponses.serverError();
  }
}