import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { Desk, Booking } from '@/models';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

interface DeskParams {
  params: Promise<{ id: string }>;
}

// GET /api/desks/[id] - Get single desk
async function getDesk(request: AuthenticatedRequest, { params }: DeskParams) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid desk ID');
    }

    const desk = await Desk.findById(id).lean();
    if (!desk) {
      return ApiResponses.notFound('Desk not found');
    }

    return ApiResponses.success(desk);
  } catch (error) {
    console.error('Get desk error:', error);
    return ApiResponses.serverError();
  }
}

// PATCH /api/desks/[id] - Update desk
async function updateDesk(request: AuthenticatedRequest, { params }: DeskParams) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid desk ID');
    }

    const body = await request.json();
    const { label, status, location, description, hourlyRate } = body;

    // Validate status if provided
    const validStatuses = ['available', 'reserved', 'occupied', 'maintenance'];
    if (status && !validStatuses.includes(status)) {
      return ApiResponses.badRequest('Invalid desk status');
    }

    // Validate hourlyRate if provided
    if (hourlyRate && (isNaN(hourlyRate) || hourlyRate < 0)) {
      return ApiResponses.badRequest('Hourly rate must be a positive number');
    }

    // Check if label is being changed and already exists
    if (label) {
      const existingDesk = await Desk.findOne({ 
        label, 
        _id: { $ne: id } 
      });
      if (existingDesk) {
        return ApiResponses.conflict('Desk with this label already exists');
      }
    }

    // If changing to maintenance, check for active bookings
    if (status === 'maintenance') {
      const now = new Date();
      const activeBooking = await Booking.findOne({
        deskId: id,
        startTime: { $lte: now },
        endTime: { $gte: now },
        status: { $in: ['confirmed', 'checked-in'] }
      });

      if (activeBooking) {
        return ApiResponses.conflict('Cannot set desk to maintenance - there is an active booking');
      }
    }

    const updateData: any = {};
    if (label) updateData.label = label;
    if (status) updateData.status = status;
    if (location !== undefined) updateData.location = location;
    if (description !== undefined) updateData.description = description;
    if (hourlyRate) updateData.hourlyRate = hourlyRate;

    const desk = await Desk.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!desk) {
      return ApiResponses.notFound('Desk not found');
    }

    return ApiResponses.success(desk, 'Desk updated successfully');
  } catch (error) {
    console.error('Update desk error:', error);
    return ApiResponses.serverError();
  }
}

// DELETE /api/desks/[id] - Delete desk
async function deleteDesk(request: AuthenticatedRequest, { params }: DeskParams) {
  try {
    await connectDB();
    const { id } = await params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid desk ID');
    }

    // Check for existing bookings
    const existingBookings = await Booking.countDocuments({
      deskId: id,
      status: { $nin: ['cancelled', 'completed'] }
    });

    if (existingBookings > 0) {
      return ApiResponses.conflict('Cannot delete desk with active bookings');
    }

    const desk = await Desk.findByIdAndDelete(id);
    if (!desk) {
      return ApiResponses.notFound('Desk not found');
    }

    return ApiResponses.success(null, 'Desk deleted successfully');
  } catch (error) {
    console.error('Delete desk error:', error);
    return ApiResponses.serverError();
  }
}

export const GET = requireRole(['admin', 'staff'])(getDesk);
export const PATCH = requireRole(['admin', 'staff'])(updateDesk);
export const DELETE = requireRole(['admin'])(deleteDesk);