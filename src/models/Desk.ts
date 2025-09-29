import mongoose, { Document, Schema } from 'mongoose';

export interface IDesk extends Document {
  _id: string;
  label: string;
  status: 'available' | 'reserved' | 'occupied' | 'maintenance';
  location?: string;
  description?: string;
  hourlyRate: number;
  createdAt: Date;
  updatedAt: Date;
}

const DeskSchema = new Schema<IDesk>(
  {
    label: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'occupied', 'maintenance'],
      default: 'available',
    },
    location: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    hourlyRate: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes
DeskSchema.index({ status: 1 });
// Note: label already has unique index from schema definition

export default mongoose.models.Desk || mongoose.model<IDesk>('Desk', DeskSchema);