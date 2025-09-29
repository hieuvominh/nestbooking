import { NextRequest } from 'next/server';
import connectDB from '@/lib/mongodb';
import { Desk } from '@/models';
import { withAuth, requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

// GET /api/desks - Get all desks
async function getDesks(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'label';
    const order = searchParams.get('order') === 'desc' ? -1 : 1;

    // Build query
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const desks = await Desk.find(query)
      .sort({ [sortBy]: order })
      .lean();

    return ApiResponses.success(desks);
  } catch (error) {
    console.error('Get desks error:', error);
    return ApiResponses.serverError();
  }
}

// POST /api/desks - Create new desk
async function createDesk(request: AuthenticatedRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { label, location, description, hourlyRate } = body;

    if (!label) {
      return ApiResponses.badRequest('Desk label is required');
    }

    if (hourlyRate && (isNaN(hourlyRate) || hourlyRate < 0)) {
      return ApiResponses.badRequest('Hourly rate must be a positive number');
    }

    // Check if desk label already exists
    const existingDesk = await Desk.findOne({ label });
    if (existingDesk) {
      return ApiResponses.conflict('Desk with this label already exists');
    }

    const desk = new Desk({
      label,
      location,
      description,
      hourlyRate: hourlyRate || 10,
    });

    await desk.save();

    return ApiResponses.created(desk, 'Desk created successfully');
  } catch (error) {
    console.error('Create desk error:', error);
    return ApiResponses.serverError();
  }
}

export const GET = requireRole(['admin', 'staff'])(getDesks);
export const POST = requireRole(['admin'])(createDesk);