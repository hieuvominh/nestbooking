import { normalizeVndAmount } from '@/lib/currency';
import { getNowInVietnam } from '@/lib/vietnam-time';
import type { IVoucher } from '@/models';

export interface BookingVoucherContext {
  subtotal: number;
  isComboBooking?: boolean;
  comboPricePerPerson?: boolean;
  guestCount?: number;
}

export interface VoucherCalculationResult {
  valid: boolean;
  reason?: string;
  discountApplied: number;
  finalTotal: number;
  voucherCode?: string;
}

export function isVoucherActive(voucher: Pick<IVoucher, 'isActive' | 'validFrom' | 'validTo'>, now: Date = getNowInVietnam()) {
  if (!voucher.isActive) return false;
  const from = new Date(voucher.validFrom);
  const to = new Date(voucher.validTo);
  return now >= from && now <= to;
}

export function calculateVoucherDiscount(voucher: Pick<IVoucher, 'type' | 'value' | 'maxDiscount' | 'code' | 'applyToPerPersonCombosOnly' | 'isActive' | 'validFrom' | 'validTo'>, context: BookingVoucherContext): VoucherCalculationResult {
  const subtotal = Math.max(0, normalizeVndAmount(context.subtotal));
  if (subtotal <= 0) {
    return {
      valid: false,
      reason: 'Subtotal must be greater than zero',
      discountApplied: 0,
      finalTotal: subtotal,
      voucherCode: voucher.code,
    };
  }

  if (!isVoucherActive(voucher)) {
    return {
      valid: false,
      reason: 'Voucher is inactive or expired',
      discountApplied: 0,
      finalTotal: subtotal,
      voucherCode: voucher.code,
    };
  }

  if (voucher.applyToPerPersonCombosOnly && !context.comboPricePerPerson) {
    return {
      valid: false,
      reason: 'Voucher chỉ áp dụng cho combo tính theo đầu người',
      discountApplied: 0,
      finalTotal: subtotal,
      voucherCode: voucher.code,
    };
  }

  const guestCount = Math.max(1, Math.floor(context.guestCount || 1));
  let discount = 0;

  if (voucher.type === 'fixed_amount') {
    discount = normalizeVndAmount(voucher.value);
  } else if (voucher.type === 'percent') {
    discount = normalizeVndAmount((subtotal * Math.max(0, voucher.value)) / 100);
  } else if (voucher.type === 'combo_price_override') {
    if (!context.isComboBooking) {
      return {
        valid: false,
        reason: 'Voucher này chỉ áp dụng cho combo',
        discountApplied: 0,
        finalTotal: subtotal,
        voucherCode: voucher.code,
      };
    }
    const overrideTotal = normalizeVndAmount(voucher.value);
    discount = subtotal - overrideTotal;
  } else if (voucher.type === 'per_person_price_override') {
    if (!context.isComboBooking || !context.comboPricePerPerson) {
      return {
        valid: false,
        reason: 'Voucher này chỉ áp dụng cho combo theo đầu người',
        discountApplied: 0,
        finalTotal: subtotal,
        voucherCode: voucher.code,
      };
    }
    const overrideTotal = normalizeVndAmount(voucher.value) * guestCount;
    discount = subtotal - overrideTotal;
  }

  discount = Math.max(0, normalizeVndAmount(discount));
  if (typeof voucher.maxDiscount === 'number' && voucher.maxDiscount >= 0) {
    discount = Math.min(discount, normalizeVndAmount(voucher.maxDiscount));
  }
  discount = Math.min(discount, subtotal);

  const finalTotal = Math.max(0, subtotal - discount);
  return {
    valid: true,
    discountApplied: discount,
    finalTotal,
    voucherCode: voucher.code,
  };
}
