import { InventoryItem, Order } from '@/models';
import { applyShiftSale, validateShiftSale } from '@/lib/shift-stock';

export interface EnsureComboOrderParams {
  bookingId: string;
  comboId: string;
  guestCount?: number;
  comboQuantity?: number;
}

async function buildComboOrderItems({
  comboId,
  guestCount = 1,
  comboQuantity = 1,
}: Omit<EnsureComboOrderParams, 'bookingId'>) {
  const combo = await InventoryItem.findById(comboId).lean();
  if (!combo) {
    throw new Error('Combo not found');
  }
  if (combo.type !== 'combo' && combo.category !== 'combo') {
    throw new Error('Selected item is not a combo');
  }

  const quantityMultiplier = combo.pricePerPerson
    ? Math.max(1, guestCount)
    : Math.max(1, comboQuantity);

  const included = Array.isArray(combo.includedItems)
    ? combo.includedItems.filter((it: any) => it && it.item && it.quantity)
    : [];

  if (included.length === 0) {
    return { combo, quantityMultiplier, orderItems: [] };
  }

  const componentIds = included.map((it: any) => String(it.item));
  const components = await InventoryItem.find({
    _id: { $in: componentIds }
  }).lean();
  const componentMap = new Map(
    components.map((it: any) => [String(it._id), it])
  );

  const orderItems = included.map((it: any) => {
    const itemId = String(it.item);
    const qty = (Number(it.quantity || 0) || 0) * quantityMultiplier;
    const component = componentMap.get(itemId);
    return {
      itemId,
      name: component?.name || `Item ${itemId.slice(-6)}`,
      price: 0,
      quantity: qty,
      subtotal: 0
    };
  });

  return { combo, quantityMultiplier, orderItems };
}

export async function validateComboOrderForPaidBooking({
  comboId,
  guestCount = 1,
  comboQuantity = 1,
}: Omit<EnsureComboOrderParams, 'bookingId'>) {
  if (!comboId) return;

  const { orderItems } = await buildComboOrderItems({
    comboId,
    guestCount,
    comboQuantity,
  });

  if (orderItems.length === 0) {
    return;
  }

  await validateShiftSale(
    orderItems.map((it) => ({
      itemId: String(it.itemId),
      quantity: Number(it.quantity || 0),
    }))
  );
}

export async function ensureComboOrderForPaidBooking({
  bookingId,
  comboId,
  guestCount = 1,
  comboQuantity = 1,
}: EnsureComboOrderParams) {
  if (!bookingId || !comboId) return null;

  // Avoid duplicates
  const existing = await Order.findOne({
    bookingId,
    isComboOrder: true
  });
  if (existing) return existing;

  const { combo, quantityMultiplier, orderItems } = await buildComboOrderItems({
    comboId,
    guestCount,
    comboQuantity,
  });

  if (orderItems.length === 0) {
    return null;
  }

  // Apply shift stock (same as normal order flow)
  await applyShiftSale(
    orderItems.map((it) => ({
      itemId: String(it.itemId),
      quantity: Number(it.quantity || 0)
    }))
  );

  const total = 0;

  const order = new Order({
    bookingId,
    items: orderItems,
    total,
    status: 'pending',
    notes: `Combo: ${combo.name}${!combo.pricePerPerson && quantityMultiplier > 1 ? ` x${quantityMultiplier}` : ''}`,
    orderedAt: new Date(),
    isComboOrder: true
  });

  await order.save();

  return order;
}
