import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { addMinutes } from 'date-fns';
import connectDB from '@/lib/mongodb';
import { Booking } from '@/models';
import { generatePublicBookingUrl } from '@/lib/jwt';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

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

// POST /api/bookings/[id]/generate-token - Generate public token for booking
async function generateToken(request: AuthenticatedRequest, { params }: BookingParams) {
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

    // Only generate tokens for valid bookings (not completed/cancelled)
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      return ApiResponses.badRequest('Cannot generate tokens for completed/cancelled bookings');
    }

    // Generate token that expires 30 minutes after booking end time or 24 hours from now, whichever is later
    const bufferMinutes = parseInt(process.env.PUBLIC_BOOKING_BUFFER_MINUTES || '30');
    const bookingEndWithBuffer = addMinutes(new Date(booking.endTime), bufferMinutes);
    const twentyFourHoursFromNow = addMinutes(new Date(), 24 * 60); // 24 hours from now
    
    // Use the later of the two times to ensure token doesn't immediately expire
    const tokenExpiry = bookingEndWithBuffer > twentyFourHoursFromNow ? bookingEndWithBuffer : twentyFourHoursFromNow;
    
    // Generate the public URL with token
    const publicUrl = generatePublicBookingUrl(id, tokenExpiry);
    
    // Extract just the token part
    const token = publicUrl.split('?t=')[1];
    
    // Update the booking with the new token
    booking.publicToken = token;
    await ensurePublicShortCode(booking);
    await booking.save();

    return ApiResponses.success({
      publicToken: token,
      publicUrl: publicUrl,
      publicShortCode: booking.publicShortCode,
      expiresAt: tokenExpiry,
    }, 'Public token generated successfully');

  } catch (error) {
    console.error('Generate token error:', error);
    return ApiResponses.serverError();
  }
}

export const POST = requireRole(['admin', 'staff'])(generateToken);
