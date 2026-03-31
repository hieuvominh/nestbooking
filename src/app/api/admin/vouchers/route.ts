import connectDB from '@/lib/mongodb';
import { Voucher } from '@/models';
import { requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

async function getVouchers(request: AuthenticatedRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const q = (searchParams.get('q') || '').trim();
    const active = searchParams.get('active');
    const skip = (page - 1) * limit;

    const query: any = {};
    if (q) {
      query.$or = [
        { code: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
      ];
    }
    if (active === 'true') query.isActive = true;
    if (active === 'false') query.isActive = false;

    const [vouchers, total] = await Promise.all([
      Voucher.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Voucher.countDocuments(query),
    ]);

    return ApiResponses.success({
      vouchers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Get vouchers error:', error);
    return ApiResponses.serverError();
  }
}

async function createVoucher(request: AuthenticatedRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const {
      code,
      name,
      description,
      type,
      value,
      maxDiscount,
      isActive,
      validFrom,
      validTo,
      applyToPerPersonCombosOnly,
    } = body;

    if (!code || !type || value === undefined || !validFrom || !validTo) {
      return ApiResponses.badRequest('code, type, value, validFrom, validTo are required');
    }

    const exists = await Voucher.findOne({ code: String(code).trim().toUpperCase() }).lean();
    if (exists) {
      return ApiResponses.conflict('Voucher code already exists');
    }

    const voucher = await Voucher.create({
      code: String(code).trim().toUpperCase(),
      name,
      description,
      type,
      value,
      maxDiscount,
      isActive: isActive !== false,
      validFrom: new Date(validFrom),
      validTo: new Date(validTo),
      appliesTo: 'booking',
      applyToPerPersonCombosOnly: applyToPerPersonCombosOnly === true,
      createdBy: request.user.userId,
    });

    return ApiResponses.created(voucher, 'Voucher created successfully');
  } catch (error) {
    console.error('Create voucher error:', error);
    return ApiResponses.serverError();
  }
}

export const GET = requireRole(['admin'])(getVouchers);
export const POST = requireRole(['admin'])(createVoucher);
