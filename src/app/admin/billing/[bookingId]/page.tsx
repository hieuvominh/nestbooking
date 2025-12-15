"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Receipt,
  CreditCard,
  Package,
  DollarSign,
  Percent,
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingCart,
  X,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PrintBill } from "@/components/PrintBill";
import { formatCurrency } from "@/lib/currency";

// TypeScript Interfaces
interface Booking {
  _id: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  deskId: {
    _id: string;
    label: string;
    location: string;
    hourlyRate: number;
  };
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "checked-in" | "completed" | "cancelled";
  totalAmount: number;
  paymentStatus: "pending" | "paid" | "refunded";
  notes?: string;
  checkedInAt?: string;
  completedAt?: string;
  createdAt: string;
  // Combo-related fields
  comboId?: {
    _id: string;
    name: string;
    price: number;
    duration: number;
  };
  isComboBooking?: boolean;
}

interface OrderItem {
  itemId: {
    _id: string;
    name: string;
    price: number;
  };
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface Order {
  _id: string;
  bookingId: string;
  items: OrderItem[];
  total: number;
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "delivered"
    | "cancelled";
  notes?: string;
  orderedAt: string;
}

interface OrdersResponse {
  orders: Order[];
}

interface InventoryItem {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  category: "food" | "beverage" | "office-supplies" | "merchandise" | "combo";
  price: number;
  quantity: number;
  unit?: string;
  type?: "item" | "combo";
}

interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

export default function BillingPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.bookingId as string;

  // State for discount/promo
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [promoCode, setPromoCode] = useState<string>("");
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // State for adding items (only for active bookings)
  const [showAddItems, setShowAddItems] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddingOrder, setIsAddingOrder] = useState(false);

  // Fetch booking data
  const {
    data: booking,
    isLoading: bookingLoading,
    error: bookingError,
    mutate: mutateBooking,
  } = useApi<Booking>(`/api/bookings/${bookingId}`);

  // Fetch orders for this booking
  const {
    data: ordersResponse,
    isLoading: ordersLoading,
    mutate: mutateOrders,
  } = useApi<OrdersResponse>(`/api/orders?bookingId=${bookingId}`);

  // Fetch inventory items for adding to active booking
  const { data: inventory } = useApi<InventoryItem[]>("/api/inventory");

  const { apiCall } = useApi();

  const orders = ordersResponse?.orders || [];

  // Calculate booking duration in hours
  const bookingDuration = useMemo(() => {
    if (!booking) return 0;
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    return (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  }, [booking]);

  /**
   * Calculate desk cost with combo support
   * - If combo booking: use combo fixed price (ignore hourly rate)
   * - If regular booking: duration × hourly rate
   */
  const deskCost = useMemo(() => {
    if (!booking) return 0;

    // Check if this is a combo booking
    if (booking.comboId || booking.isComboBooking) {
      return booking.comboId?.price || 0;
    }

    // Regular desk booking - calculate based on hourly rate
    return Math.ceil(bookingDuration * booking.deskId.hourlyRate);
  }, [booking, bookingDuration]);

  // Calculate total orders cost
  const ordersTotal = useMemo(() => {
    return orders.reduce((sum, order) => sum + order.total, 0);
  }, [orders]);

  // Calculate subtotal (desk/combo + orders)
  const subtotal = useMemo(() => {
    return deskCost + ordersTotal;
  }, [deskCost, ordersTotal]);

  // Calculate discount
  const calculatedDiscount = useMemo(() => {
    if (discountAmount > 0) return discountAmount;
    if (discountPercent > 0) return (subtotal * discountPercent) / 100;
    return 0;
  }, [discountAmount, discountPercent, subtotal]);

  // Calculate final total after discount
  const finalTotal = useMemo(() => {
    return Math.max(0, subtotal - calculatedDiscount);
  }, [subtotal, calculatedDiscount]);

  // Format date and time
  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  // Get status color classes
  const getBookingStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      "checked-in": "bg-green-100 text-green-800",
      completed: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getPaymentStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      paid: "bg-green-100 text-green-800 border-green-300",
      refunded: "bg-red-100 text-red-800 border-red-300",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const getOrderStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800",
      confirmed: "bg-blue-100 text-blue-800",
      preparing: "bg-orange-100 text-orange-800",
      ready: "bg-green-100 text-green-800",
      delivered: "bg-gray-100 text-gray-800",
      cancelled: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  // Handle payment status update
  const handleMarkAsPaid = async () => {
    if (!booking) return;

    setIsProcessingPayment(true);
    try {
      await apiCall(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        body: {
          paymentStatus: "paid",
          totalAmount: finalTotal, // Update total if discount was applied
        },
      });
      mutateBooking();
      toast.success("Payment marked as paid successfully!");
    } catch (error) {
      console.error("Error updating payment status:", error);
      toast.error("Failed to update payment status");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleRefund = async () => {
    if (!booking) return;

    const confirmed = confirm("Are you sure you want to refund this payment?");
    if (!confirmed) return;

    setIsProcessingPayment(true);
    try {
      await apiCall(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        body: { paymentStatus: "refunded" },
      });
      mutateBooking();
      toast.success("Payment refunded successfully!");
    } catch (error) {
      console.error("Error refunding payment:", error);
      toast.error("Failed to refund payment");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  /**
   * Handle check-out / complete booking
   * Combines payment processing with booking completion
   * - If payment pending: mark as paid with final total
   * - Complete booking status and set completedAt timestamp
   */
  const handleCheckOut = async () => {
    if (!booking) return;

    const confirmed = confirm(
      `Complete check-out for ${booking.customer.name}?

Final Total: ${formatCurrency(finalTotal)}
Payment Status: ${booking.paymentStatus}`
    );
    if (!confirmed) return;

    setIsProcessingPayment(true);
    try {
      const updateData: {
        status: string;
        completedAt: string;
        totalAmount: number;
        paymentStatus?: string;
      } = {
        status: "completed",
        completedAt: new Date().toISOString(),
        totalAmount: finalTotal, // Always update with final calculated total
      };

      // If payment is pending, mark as paid
      if (booking.paymentStatus === "pending") {
        updateData.paymentStatus = "paid";
      }

      await apiCall(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        body: updateData,
      });

      mutateBooking();

      if (booking.paymentStatus === "pending") {
        toast.success(
          "Payment completed and booking checked out successfully!"
        );
      } else {
        toast.success("Booking checked out successfully!");
      }
    } catch (error) {
      console.error("Error checking out:", error);
      toast.error("Failed to check out booking");
    } finally {
      setIsProcessingPayment(false);
    }
  };

  /**
   * Check if booking can be checked out
   * Only confirmed or checked-in bookings can be completed
   */
  const canCheckOut = () => {
    if (!booking) return false;
    return booking.status === "confirmed" || booking.status === "checked-in";
  };

  // Apply promo code (placeholder logic - you can enhance this)
  const handleApplyPromo = () => {
    const validPromoCodes: { [key: string]: number } = {
      SAVE10: 10,
      SAVE20: 20,
      FIRSTVISIT: 15,
    };

    const discount = validPromoCodes[promoCode.toUpperCase()];
    if (discount) {
      setDiscountPercent(discount);
      setDiscountAmount(0);
      toast.success(`Promo code applied! ${discount}% discount`);
    } else {
      toast.error("Invalid promo code");
    }
  };

  /**
   * Cart Management Functions for Adding Items to Active Booking
   */

  // Check if booking is active (can add items)
  const isActiveBooking = useMemo(() => {
    if (!booking) return false;
    return booking.status === "confirmed" || booking.status === "checked-in";
  }, [booking]);

  // Filter inventory (exclude combos, only show items)
  const availableItems = useMemo(() => {
    if (!inventory) return [];

    return inventory.filter((item) => {
      // Only show regular items (not combos)
      if (item.type === "combo") return false;

      // Only show active items with stock
      if (item.quantity <= 0) return false;

      // Apply search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [inventory, searchQuery]);

  // Add item to cart
  const addToCart = (item: InventoryItem) => {
    const existingItem = cart.find((cartItem) => cartItem.itemId === item._id);

    if (existingItem) {
      setCart(
        cart.map((cartItem) =>
          cartItem.itemId === item._id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      );
    } else {
      setCart([
        ...cart,
        {
          itemId: item._id,
          name: item.name,
          price: item.price,
          quantity: 1,
          category: item.category,
        },
      ]);
    }
    toast.success(`${item.name} added to cart`);
  };

  // Remove item from cart
  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((item) => item.itemId !== itemId));
    toast.info("Item removed from cart");
  };

  // Update cart quantity
  const updateCartQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart(
      cart.map((item) =>
        item.itemId === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  // Calculate cart total
  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  /**
   * Submit new order for active booking
   * Creates an order with items in cart and updates billing totals
   */
  const handleAddItemsToBooking = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    setIsAddingOrder(true);
    try {
      const orderData = {
        bookingId: bookingId,
        items: cart.map((item) => ({
          itemId: item.itemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          subtotal: item.price * item.quantity,
        })),
        total: cartTotal,
        status: "pending",
        notes: "Additional items added during booking",
      };

      await apiCall("/api/orders", {
        method: "POST",
        body: orderData,
      });

      // Refresh orders and booking data
      mutateOrders();
      mutateBooking();

      // Clear cart and close dialog
      setCart([]);
      setShowAddItems(false);

      toast.success(`Added ${cart.length} item(s) to booking!`);
    } catch (error) {
      console.error("Error adding items:", error);
      toast.error("Failed to add items to booking");
    } finally {
      setIsAddingOrder(false);
    }
  };

  // Loading state
  if (bookingLoading || ordersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading billing information...</div>
      </div>
    );
  }

  // Error state
  if (bookingError || !booking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-lg text-red-600 mb-4">
            Failed to load billing information
          </div>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Billing & Payment</h1>
            <p className="text-gray-500">Booking ID: {bookingId.slice(-8)}</p>
          </div>
        </div>
        <Badge
          className={`text-lg px-4 py-2 ${getPaymentStatusColor(
            booking.paymentStatus
          )}`}
        >
          {booking.paymentStatus.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Booking & Orders Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Booking Details Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  <CardTitle>Booking Details</CardTitle>
                </div>
                <Badge className={getBookingStatusColor(booking.status)}>
                  {booking.status}
                </Badge>
              </div>
              <CardDescription>Desk reservation information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Info */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold mb-2">Customer</h3>
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{booking.customer.name}</p>
                  <p className="text-gray-600">{booking.customer.email}</p>
                  <p className="text-gray-600">{booking.customer.phone}</p>
                </div>
              </div>

              {/* Desk Info */}
              <div>
                <h3 className="font-semibold mb-2">Desk Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-500">Desk</Label>
                    <p className="font-medium">{booking.deskId.label}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Location</Label>
                    <p className="font-medium">{booking.deskId.location}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Hourly Rate</Label>
                    <p className="font-medium">
                      {formatCurrency(booking.deskId.hourlyRate)}/hr
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">Duration</Label>
                    <p className="font-medium">
                      {bookingDuration.toFixed(2)} hours
                    </p>
                  </div>
                </div>
              </div>

              {/* Time Info */}
              <div>
                <h3 className="font-semibold mb-2">Booking Time</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-gray-500">Start Time</Label>
                    <p className="text-sm">
                      {formatDateTime(booking.startTime)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-gray-500">End Time</Label>
                    <p className="text-sm">{formatDateTime(booking.endTime)}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Desk Cost Calculation */}
              <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg">
                <div>
                  <p className="text-sm text-gray-600">Desk Rental</p>
                  <p className="text-xs text-gray-500">
                    {bookingDuration.toFixed(2)} hrs ×{" "}
                    {formatCurrency(booking.deskId.hourlyRate)}/hr
                  </p>
                </div>
                <p className="text-xl font-bold text-blue-600">
                  {formatCurrency(deskCost)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Orders Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  <CardTitle>Orders</CardTitle>
                </div>
                {/* Add Items Button - only show for active bookings */}
                {isActiveBooking && !showAddItems && (
                  <Button
                    size="sm"
                    onClick={() => setShowAddItems(true)}
                    className="gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Add Items
                  </Button>
                )}
              </div>
              <CardDescription>
                Food, beverages, and items ordered
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Add Items Interface - shown when active */}
              {showAddItems && isActiveBooking && (
                <Card className="mb-6 border-2 border-blue-200 bg-blue-50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-blue-600" />
                        <CardTitle className="text-blue-900">
                          Add Items to Booking
                        </CardTitle>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAddItems(false);
                          setCart([]);
                          setSearchQuery("");
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardDescription>
                      Select items to add to this active booking
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Search */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search items..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-white"
                      />
                    </div>

                    {/* Available Items Grid */}
                    <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                      {availableItems.map((item) => (
                        <div
                          key={item._id}
                          className="border rounded-lg p-3 bg-white hover:bg-gray-50 transition"
                        >
                          <div className="mb-2">
                            <h4 className="font-semibold text-sm">
                              {item.name}
                            </h4>
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {item.description}
                            </p>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-green-600">
                              {formatCurrency(item.price)}
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => addToCart(item)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Cart Preview */}
                    {cart.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-3">
                          <h4 className="font-semibold text-sm">
                            Cart ({cart.length})
                          </h4>
                          {cart.map((item) => (
                            <div
                              key={item.itemId}
                              className="flex justify-between items-center bg-white p-2 rounded border"
                            >
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {item.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatCurrency(item.price)} each
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() =>
                                    updateCartQuantity(
                                      item.itemId,
                                      item.quantity - 1
                                    )
                                  }
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-6 text-center text-sm font-medium">
                                  {item.quantity}
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() =>
                                    updateCartQuantity(
                                      item.itemId,
                                      item.quantity + 1
                                    )
                                  }
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => removeFromCart(item.itemId)}
                                >
                                  <Trash2 className="h-3 w-3 text-red-500" />
                                </Button>
                              </div>
                            </div>
                          ))}

                          <div className="flex justify-between items-center pt-2 border-t">
                            <span className="font-semibold">Cart Total:</span>
                            <span className="text-lg font-bold text-green-600">
                              {formatCurrency(cartTotal)}
                            </span>
                          </div>

                          <Button
                            className="w-full"
                            onClick={handleAddItemsToBooking}
                            disabled={isAddingOrder}
                          >
                            {isAddingOrder
                              ? "Adding Items..."
                              : `Add ${cart.length} Item(s) - ${formatCurrency(
                                  cartTotal
                                )}`}
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Existing Orders List */}
              {orders.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No orders for this booking
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order._id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <p className="font-semibold">
                            Order #{order._id.slice(-8)}
                          </p>
                          <p className="text-sm text-gray-500">
                            {formatDateTime(order.orderedAt)}
                          </p>
                        </div>
                        <Badge className={getOrderStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>

                      {/* Order Items */}
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center text-sm"
                          >
                            <div className="flex-1">
                              <p className="font-medium">{item.name}</p>
                              <p className="text-gray-500">
                                {item.quantity} × {formatCurrency(item.price)}
                              </p>
                            </div>
                            <p className="font-semibold">
                              {formatCurrency(item.subtotal)}
                            </p>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-sm text-gray-600">
                            <span className="font-medium">Notes:</span>{" "}
                            {order.notes}
                          </p>
                        </div>
                      )}

                      <Separator className="my-3" />

                      {/* Order Total */}
                      <div className="flex justify-between items-center font-semibold">
                        <span>Order Total</span>
                        <span className="text-lg">
                          {formatCurrency(order.total)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Payment Summary */}
        <div className="space-y-6">
          {/* Discount/Promo Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Percent className="h-5 w-5" />
                <CardTitle>Discount & Promo</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Promo Code */}
              <div>
                <Label className="text-sm">Promo Code</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    placeholder="Enter code"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    className="uppercase"
                  />
                  <Button
                    variant="outline"
                    onClick={handleApplyPromo}
                    disabled={!promoCode}
                  >
                    Apply
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Try: SAVE10, SAVE20, FIRSTVISIT
                </p>
              </div>

              <Separator />

              {/* Manual Discount */}
              <div>
                <Label className="text-sm">Discount Percentage</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => {
                    setDiscountPercent(Number(e.target.value));
                    setDiscountAmount(0);
                  }}
                  placeholder="0"
                  className="mt-1"
                />
              </div>

              <div>
                <Label className="text-sm">Discount Amount ($)</Label>
                <Input
                  type="number"
                  min="0"
                  value={discountAmount}
                  onChange={(e) => {
                    setDiscountAmount(Number(e.target.value));
                    setDiscountPercent(0);
                  }}
                  placeholder="0.00"
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* Payment Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                <CardTitle>Payment Summary</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Breakdown */}
              <div className="space-y-3">
                {/* Show combo info if applicable */}
                {(booking.comboId || booking.isComboBooking) && (
                  <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="h-4 w-4 text-green-600" />
                      <span className="text-xs font-semibold text-green-800">
                        COMBO PACKAGE
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {booking.comboId?.name || "Combo Package"}
                    </p>
                    <p className="text-xs text-gray-600">
                      {booking.comboId?.duration || 0} hours included
                    </p>
                  </div>
                )}

                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {booking.comboId || booking.isComboBooking
                      ? "Combo Package"
                      : "Desk Rental"}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(deskCost)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    Orders {orders.length > 0 && `(${orders.length})`}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(ordersTotal)}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between font-medium">
                  <span>Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>

                {calculatedDiscount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(calculatedDiscount)}</span>
                  </div>
                )}

                <Separator />

                {/* Total */}
                <div className="flex justify-between items-center bg-gray-900 text-white p-4 rounded-lg">
                  <span className="text-lg font-semibold">Total</span>
                  <span className="text-2xl font-bold">
                    {formatCurrency(finalTotal)}
                  </span>
                </div>
              </div>

              {/* Payment Actions */}
              <div className="space-y-2 pt-4">
                {/* Check-Out Button - Shows for active bookings */}
                {canCheckOut() && (
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700"
                    size="lg"
                    onClick={handleCheckOut}
                    disabled={isProcessingPayment}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {isProcessingPayment
                      ? "Processing..."
                      : booking.paymentStatus === "pending"
                      ? `Pay & Complete Check-Out (${formatCurrency(
                          finalTotal
                        )})`
                      : "Complete Check-Out"}
                  </Button>
                )}

                {/* Mark as Paid - Only show if not checking out */}
                {booking.paymentStatus === "pending" && !canCheckOut() && (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleMarkAsPaid}
                    disabled={isProcessingPayment}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    {isProcessingPayment ? "Processing..." : "Mark as Paid"}
                  </Button>
                )}

                {booking.paymentStatus === "paid" && (
                  <>
                    <div className="flex items-center justify-center gap-2 py-3 bg-green-50 rounded-lg text-green-700">
                      <svg
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      <span className="font-medium">Payment Completed</span>
                    </div>

                    {/* Print Bill Button */}
                    <PrintBill
                      booking={{
                        _id: booking._id,
                        customer: {
                          name: booking.customer.name,
                          phone: booking.customer.phone,
                          email: booking.customer.email,
                        },
                        deskNumber:
                          parseInt(booking.deskId.label.replace(/\D/g, "")) ||
                          0,
                        startTime: booking.startTime,
                        endTime: booking.endTime,
                        checkedInAt: booking.checkedInAt,
                        totalAmount: booking.totalAmount,
                        paymentStatus: booking.paymentStatus,
                        status: booking.status,
                        notes: booking.notes,
                        comboPackage: booking.comboId
                          ? {
                              name: booking.comboId.name,
                              duration: booking.comboId.duration,
                              price: booking.comboId.price,
                            }
                          : undefined,
                      }}
                      orders={orders}
                      deskHourlyRate={booking.deskId.hourlyRate}
                      className="w-full"
                    />

                    {!canCheckOut() && (
                      <Button
                        variant="outline"
                        className="w-full text-red-600 border-red-300 hover:bg-red-50"
                        onClick={handleRefund}
                        disabled={isProcessingPayment}
                      >
                        {isProcessingPayment ? "Processing..." : "Issue Refund"}
                      </Button>
                    )}
                  </>
                )}

                {booking.paymentStatus === "refunded" && (
                  <div className="text-center py-3 bg-red-50 rounded-lg text-red-700">
                    <span className="font-medium">Payment Refunded</span>
                  </div>
                )}
              </div>

              {/* Payment Info */}
              <div className="pt-4 border-t text-xs text-gray-500 space-y-1">
                <p>Booking Created: {formatDateTime(booking.createdAt)}</p>
                <p>
                  Payment Status:{" "}
                  <span className="font-medium">{booking.paymentStatus}</span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
