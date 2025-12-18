import mongoose, { Document, Schema } from 'mongoose';

export interface ICustomerInfo {
  name: string;
  email?: string;
  phone?: string;
}

export interface IBooking extends Document {
  _id: string;
  deskId: mongoose.Types.ObjectId;
  customer: ICustomerInfo;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  totalAmount: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
  publicToken?: string;
  notes?: string;
  checkedInAt?: Date;
  completedAt?: Date;
  // Combo support
  comboId?: mongoose.Types.ObjectId | any;
  isComboBooking?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerInfoSchema = new Schema<ICustomerInfo>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: false,
    lowercase: true,
    trim: true,
    default: undefined,
  },
  phone: {
    type: String,
    required: false,
    trim: true,
    default: undefined,
  },
}, { _id: false });

const BookingSchema = new Schema<IBooking>(
  {
    deskId: {
      type: Schema.Types.ObjectId,
      ref: 'Desk',
      required: true,
    },
    customer: {
      type: CustomerInfoSchema,
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'checked-in', 'completed', 'cancelled'],
      default: 'pending',
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'paid', 'refunded'],
      default: 'pending',
    },
    publicToken: {
      type: String,
      unique: true,
      sparse: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    // Optional combo reference (for bookings created with a combo package)
    comboId: {
      type: Schema.Types.ObjectId,
      ref: 'InventoryItem',
      required: false,
    },
    isComboBooking: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes for efficient queries
BookingSchema.index({ deskId: 1, startTime: 1, endTime: 1 });
BookingSchema.index({ status: 1 });
// Note: publicToken already has unique sparse index from schema definition
BookingSchema.index({ 'customer.email': 1 });
BookingSchema.index({ startTime: 1, endTime: 1 });

// Validate that endTime is after startTime
BookingSchema.pre('save', function (next) {
  if (this.endTime <= this.startTime) {
    next(new Error('End time must be after start time'));
  } else {
    next();
  }
});

export default mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);