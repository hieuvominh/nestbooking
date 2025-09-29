import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  itemId: mongoose.Types.ObjectId;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export interface IOrder extends Document {
  _id: string;
  bookingId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  total: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  notes?: string;
  orderedAt: Date;
  deliveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  itemId: {
    type: Schema.Types.ObjectId,
    ref: 'InventoryItem',
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
});

const OrderSchema = new Schema<IOrder>(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: {
        validator: function (items: IOrderItem[]) {
          return items.length > 0;
        },
        message: 'Order must contain at least one item',
      },
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
      default: 'pending',
    },
    notes: {
      type: String,
      trim: true,
    },
    orderedAt: {
      type: Date,
      default: Date.now,
    },
    deliveredAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes
OrderSchema.index({ bookingId: 1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ orderedAt: -1 });

// Validate total matches sum of item subtotals
OrderSchema.pre('save', function (next) {
  const calculatedTotal = this.items.reduce((sum, item) => sum + item.subtotal, 0);
  if (Math.abs(this.total - calculatedTotal) > 0.01) {
    next(new Error('Order total does not match sum of item subtotals'));
  } else {
    next();
  }
});

export default mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema);