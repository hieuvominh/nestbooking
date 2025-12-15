import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryItem extends Document {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  category: 'food' | 'beverage' | 'merchandise' | 'office-supplies' | 'combo';
  price: number;
  quantity: number;
  lowStockThreshold: number;
  unit: string;
  imageUrl?: string;
  isActive: boolean;
  type?: 'combo' | 'item';
  duration?: number;
  includedItems?: { item: string; quantity: number }[];
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
      enum: ['food', 'beverage', 'merchandise', 'office-supplies', 'combo'],
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
    type: {
      type: String,
      enum: ['combo', 'item'],
      default: 'item',
    },
    duration: {
      type: Number,
      min: 0,
    },
    includedItems: {
      type: [
        {
          item: { type: Schema.Types.ObjectId, ref: 'InventoryItem', required: true },
          quantity: { type: Number, required: true, min: 1 },
        },
      ],
      default: [],
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

const MODEL_NAME = 'InventoryItem';
// If model already compiled with old schema (hot-reload), delete it so we register fresh schema
if (mongoose.models[MODEL_NAME]) {
  try {
    delete mongoose.models[MODEL_NAME];
  } catch (e) {
    // ignore
  }
}

export default mongoose.models[MODEL_NAME] || mongoose.model<IInventoryItem>(MODEL_NAME, InventoryItemSchema);