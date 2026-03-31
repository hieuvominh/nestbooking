import mongoose, { Document, Schema } from 'mongoose';

export type VoucherType =
  | 'fixed_amount'
  | 'percent'
  | 'combo_price_override'
  | 'per_person_price_override';

export interface IVoucher extends Document {
  _id: string;
  code: string;
  name?: string;
  description?: string;
  type: VoucherType;
  value: number;
  maxDiscount?: number;
  isActive: boolean;
  validFrom: Date;
  validTo: Date;
  appliesTo: 'booking';
  applyToPerPersonCombosOnly?: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const VoucherSchema = new Schema<IVoucher>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      trim: true,
      default: undefined,
    },
    description: {
      type: String,
      trim: true,
      default: undefined,
    },
    type: {
      type: String,
      enum: ['fixed_amount', 'percent', 'combo_price_override', 'per_person_price_override'],
      required: true,
    },
    value: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscount: {
      type: Number,
      min: 0,
      default: undefined,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    validFrom: {
      type: Date,
      required: true,
    },
    validTo: {
      type: Date,
      required: true,
    },
    appliesTo: {
      type: String,
      enum: ['booking'],
      default: 'booking',
    },
    applyToPerPersonCombosOnly: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
  },
  {
    timestamps: true,
  }
);

VoucherSchema.index({ code: 1 }, { unique: true });
VoucherSchema.index({ isActive: 1, validFrom: 1, validTo: 1 });

export default mongoose.models.Voucher || mongoose.model<IVoucher>('Voucher', VoucherSchema);
