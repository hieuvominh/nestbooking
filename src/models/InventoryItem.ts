import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryItem extends Document {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  category: 'food' | 'beverage' | 'merchandise' | 'office-supplies';
  price: number;
  quantity: number;
  lowStockThreshold: number;
  unit: string;
  imageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryItemSchema = new Schema<IInventoryItem>(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      enum: ['food', 'beverage', 'merchandise', 'office-supplies'],
      required: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    lowStockThreshold: {
      type: Number,
      required: true,
      min: 0,
      default: 5,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      default: 'pcs',
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create indexes
// Note: sku already has unique index from schema definition
InventoryItemSchema.index({ category: 1 });
InventoryItemSchema.index({ isActive: 1 });
InventoryItemSchema.index({ quantity: 1, lowStockThreshold: 1 });

// Virtual for low stock status
InventoryItemSchema.virtual('isLowStock').get(function () {
  return this.quantity <= this.lowStockThreshold;
});

export default mongoose.models.InventoryItem || mongoose.model<IInventoryItem>('InventoryItem', InventoryItemSchema);