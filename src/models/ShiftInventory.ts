import mongoose, { Document, Schema } from 'mongoose';

export interface IShiftInventory extends Document {
  _id: string;
  dateKey: string; // YYYY-MM-DD
  shiftCode: 'S1' | 'S2' | 'S3';
  itemId: mongoose.Types.ObjectId;
  openingQty: number;
  receivedQty: number;
  soldQty: number;
  actualQty?: number;
  variance?: number;
  reconciledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ShiftInventorySchema = new Schema<IShiftInventory>(
  {
    dateKey: {
      type: String,
      required: true,
    },
    shiftCode: {
      type: String,
      enum: ['S1', 'S2', 'S3'],
      required: true,
    },
    itemId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: true,
    },
    openingQty: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    receivedQty: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    soldQty: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    actualQty: {
      type: Number,
      min: 0,
      default: undefined,
    },
    variance: {
      type: Number,
      default: undefined,
    },
    reconciledAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

ShiftInventorySchema.index({ dateKey: 1, shiftCode: 1, itemId: 1 }, { unique: true });

export default mongoose.models.ShiftInventory ||
  mongoose.model<IShiftInventory>('ShiftInventory', ShiftInventorySchema);
