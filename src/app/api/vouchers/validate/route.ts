import connectDB from '@/lib/mongodb';
import { InventoryItem, Voucher } from '@/models';
import { calculateVoucherDiscount } from '@/lib/voucher';
import { normalizeVndAmount } from '@/lib/currency';
import { requireRole, ApiResponses, AuthenticatedRequest } from '@/lib/api-middleware';

async function validateVoucher(request: AuthenticatedRequest) {
  try {
    await connectDB();
    const body = await request.json();
    const {
      code,
      subtotal,
      isComboBooking,
      comboId,
      guestCount,
      comboPricePerPerson,
    } = body;

    if (!code || subtotal === undefined) {
      return ApiResponses.badRequest('code and subtotal are required');
    }

    const voucher = await Voucher.findOne({
      code: String(code).trim().toUpperCase(),
    }).lean();

    if (!voucher) {
      return ApiResponses.badRequest('Voucher không tồn tại');
    }

    let perPerson = comboPricePerPerson === true;
    if (!perPerson && comboId) {
      const combo = await InventoryItem.findById(comboId).select('pricePerPerson').lean();
      perPerson = (combo as any)?.pricePerPerson === true;
    }

    const result = calculateVoucherDiscount(voucher as any, {
      subtotal: normalizeVndAmount(subtotal),
      isComboBooking: isComboBooking === true,
      comboPricePerPerson: perPerson,
      guestCount,
    });

    if (!result.valid) {
      return ApiResponses.badRequest(result.reason || 'Voucher không hợp lệ');
    }

    return ApiResponses.success({
      voucher: {
        _id: voucher._id,
        code: voucher.code,
        type: voucher.type,
        value: voucher.value,
      },
      discountApplied: result.discountApplied,
      finalTotal: result.finalTotal,
    });
  } catch (error) {
    console.error('Validate voucher error:', error);
    return ApiResponses.serverError();
  }
}

export const POST = requireRole(['admin', 'staff'])(validateVoucher);
