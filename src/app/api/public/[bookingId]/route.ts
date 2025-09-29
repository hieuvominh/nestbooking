import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { Booking } from '@/models';
import { validatePublicBookingAccess } from '@/lib/jwt';
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
      .populate('deskId', 'label location')
      .lean();

    if (!booking) {
      return ApiResponses.notFound('Booking not found');
    }

    // Don't expose sensitive information
    const publicBookingData = {
      id: (booking as any)._id,
      desk: (booking as any).deskId,
      customer: {
        name: (booking as any).customer.name,
        // Don't expose email/phone for privacy
      },
      startTime: (booking as any).startTime,
      endTime: (booking as any).endTime,
      status: (booking as any).status,
      totalAmount: (booking as any).totalAmount,
      checkedInAt: (booking as any).checkedInAt,
      notes: (booking as any).notes,
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

    // Validate check-in conditions
    if (booking.status !== 'confirmed') {
      return ApiResponses.badRequest('Booking must be confirmed to check in');
    }

    const now = new Date();
    const startTime = new Date(booking.startTime);
    const endTime = new Date(booking.endTime);

    // Allow check-in 15 minutes before start time
    const earlyCheckInTime = new Date(startTime.getTime() - 15 * 60 * 1000);

    if (now < earlyCheckInTime) {
      return ApiResponses.badRequest('Check-in is not available yet');
    }

    if (now > endTime) {
      return ApiResponses.badRequest('Booking has expired');
    }

    // Update booking status
    booking.status = 'checked-in';
    booking.checkedInAt = now;
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