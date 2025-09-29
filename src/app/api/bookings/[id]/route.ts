import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { addMinutes } from 'date-fns';
import connectDB from '@/lib/mongodb';
import { Booking, Desk, Transaction } from '@/models';
import { generatePublicBookingUrl } from '@/lib/jwt';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

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
      notes
    } = body;

    const booking = await Booking.findById(id);
    if (!booking) {
      return ApiResponses.notFound('Booking not found');
    }

    // Validate status transitions
    const validStatuses = ['pending', 'confirmed', 'checked-in', 'completed', 'cancelled'];
    if (status && !validStatuses.includes(status)) {
      return ApiResponses.badRequest('Invalid booking status');
    }

    // Don't allow changes to completed or cancelled bookings
    if (booking.status === 'completed' || booking.status === 'cancelled') {
      return ApiResponses.badRequest('Cannot modify completed or cancelled bookings');
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

      if (newStartTime < new Date() && booking.status === 'pending') {
        return ApiResponses.badRequest('Booking cannot be in the past');
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
    if (recalculateAmount) {
      const desk = await Desk.findById(deskId || booking.deskId);
      const start = updateData.startTime || booking.startTime;
      const end = updateData.endTime || booking.endTime;
      const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      updateData.totalAmount = Math.ceil(durationHours * desk!.hourlyRate);
    }

    // Handle other updates
    if (customer) updateData.customer = customer;
    if (status) updateData.status = status;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (notes !== undefined) updateData.notes = notes;

    // Handle check-in
    if (status === 'checked-in' && booking.status !== 'checked-in') {
      updateData.checkedInAt = new Date();
    }

    // Update public token if times changed
    if (startTime || endTime) {
      const bufferMinutes = parseInt(process.env.PUBLIC_BOOKING_BUFFER_MINUTES || '30');
      const tokenExpiry = addMinutes(updateData.endTime || booking.endTime, bufferMinutes);
      const publicUrl = generatePublicBookingUrl(id, tokenExpiry);
      updateData.publicToken = publicUrl.split('?t=')[1];
    }

    const updatedBooking = await Booking.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('deskId', 'label location hourlyRate');

    // Update transaction if amount changed
    if (recalculateAmount) {
      await Transaction.findOneAndUpdate(
        { referenceId: id, referenceModel: 'Booking' },
        { amount: updateData.totalAmount },
        { new: true }
      );
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
    await booking.save();

    // Handle refund transaction if payment was made
    if (booking.paymentStatus === 'paid') {
      const refundTransaction = new Transaction({
        type: 'expense',
        amount: booking.totalAmount,
        source: 'booking',
        description: `Refund for cancelled booking - ${booking.customer.name}`,
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