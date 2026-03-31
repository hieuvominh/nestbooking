import mongoose from 'mongoose';
import connectDB from '@/lib/mongodb';
import { Voucher } from '@/models';
import { requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

interface VoucherParams {
  params: Promise<{ id: string }>;
}

async function getVoucher(request: AuthenticatedRequest, { params }: VoucherParams) {
  try {
    await connectDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid voucher ID');
    }
    const voucher = await Voucher.findById(id).lean();
    if (!voucher) return ApiResponses.notFound('Voucher not found');
    return ApiResponses.success(voucher);
  } catch (error) {
    console.error('Get voucher error:', error);
    return ApiResponses.serverError();
  }
}

async function updateVoucher(request: AuthenticatedRequest, { params }: VoucherParams) {
  try {
    await connectDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid voucher ID');
    }

    const body = await request.json();
    const updateData: any = {};
    const allowed = [
      'name',
      'description',
      'type',
      'value',
      'maxDiscount',
      'isActive',
      'validFrom',
      'validTo',
      'applyToPerPersonCombosOnly',
    ];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        updateData[key] = body[key];
      }
    }
    if (updateData.validFrom) updateData.validFrom = new Date(updateData.validFrom);
    if (updateData.validTo) updateData.validTo = new Date(updateData.validTo);

    const updated = await Voucher.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) return ApiResponses.notFound('Voucher not found');
    return ApiResponses.success(updated, 'Voucher updated successfully');
  } catch (error) {
    console.error('Update voucher error:', error);
    return ApiResponses.serverError();
  }
}

async function deleteVoucher(request: AuthenticatedRequest, { params }: VoucherParams) {
  try {
    await connectDB();
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ApiResponses.badRequest('Invalid voucher ID');
    }

    const deleted = await Voucher.findByIdAndDelete(id).lean();
    if (!deleted) return ApiResponses.notFound('Voucher not found');
    return ApiResponses.success(deleted, 'Voucher deleted successfully');
  } catch (error) {
    console.error('Delete voucher error:', error);
    return ApiResponses.serverError();
  }
}

export const GET = requireRole(['admin'])(getVoucher);
export const PATCH = requireRole(['admin'])(updateVoucher);
export const DELETE = requireRole(['admin'])(deleteVoucher);
