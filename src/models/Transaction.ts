import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  _id: string;
  type: 'income' | 'expense';
  amount: number;
  source: 'booking' | 'order' | 'inventory' | 'maintenance' | 'utilities' | 'other';
  description: string;
  referenceId?: mongoose.Types.ObjectId;
  referenceModel?: 'Booking' | 'Order' | 'InventoryItem';
  category?: string;
  date: Date;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    source: {
      type: String,
      enum: ['booking', 'order', 'inventory', 'maintenance', 'utilities', 'other'],
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    referenceId: {
      type: Schema.Types.ObjectId,
      refPath: 'referenceModel',
    },
    referenceModel: {
      type: String,
      enum: ['Booking', 'Order', 'InventoryItem'],
    },
    category: {
      type: String,
      trim: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for efficient queries
TransactionSchema.index({ type: 1, date: -1 });
TransactionSchema.index({ source: 1, date: -1 });
TransactionSchema.index({ date: -1 });
TransactionSchema.index({ referenceId: 1, referenceModel: 1 });

export default mongoose.models.Transaction || mongoose.model<ITransaction>('Transaction', TransactionSchema);