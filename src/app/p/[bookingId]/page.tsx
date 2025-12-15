"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/currency";

interface Booking {
  _id: string;
  customer: {
    name: string;
    email: string;
    phone?: string;
  };
  desk: {
    label: string;
    location?: string;
  };
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "checked-in" | "completed" | "cancelled";
  checkInTime?: string;
  signature?: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: "food" | "drinks" | "snacks" | "supplies";
  isAvailable: boolean;
  image?: string;
}

interface CartItem {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
}

interface OrderItem {
  _id: string;
  itemId: string;
  itemName?: string; // Legacy field
  name?: string; // Current field from API
  quantity: number;
  price: number;
}

interface ExistingOrder {
  _id: string;
  bookingId: string;
  items: OrderItem[];
  totalAmount: number;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export default function PublicBookingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookingId = params.bookingId as string;
  const token = searchParams.get("t");

  const [booking, setBooking] = useState<Booking | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [existingOrders, setExistingOrders] = useState<ExistingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(() => {
    fetchBookingData();
    fetchInventory();
    fetchExistingOrders();
  }, [bookingId, token]);

  const fetchBookingData = async () => {
    try {
      if (!token) {
        throw new Error("Access token required");
      }

      const response = await fetch(`/api/public/${bookingId}?t=${token}`);
      if (!response.ok) {
        throw new Error("Booking not found or access denied");
      }
      const data = await response.json();
      setBooking(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load booking");
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const response = await fetch("/api/public/inventory");
      if (response.ok) {
        const data = await response.json();
        // The public endpoint returns allItems array
        const items = data.data.allItems || [];
        setInventory(
          items.map((item: any) => ({
            _id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            stock: item.quantity,
            category: item.category,
            isAvailable: true,
            image: item.imageUrl,
          }))
        );
      } else {
        console.error(
          "Failed to fetch inventory:",
          response.status,
          response.statusText
        );
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
    }
  };

  const fetchExistingOrders = async () => {
    try {
      if (!token) {
        console.log("fetchExistingOrders: No token available, skipping");
        return;
      }

      console.log(
        "fetchExistingOrders: Making request with token:",
        token.substring(0, 20) + "..."
      );
      const response = await fetch(
        `/api/public/${bookingId}/orders?t=${token}`
      );
      console.log("fetchExistingOrders: Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log(
          "fetchExistingOrders: Success, received orders:",
          data.data?.length || 0
        );
        setExistingOrders(data.data || []);
      } else {
        console.error(
          "Failed to fetch orders:",
          response.status,
          response.statusText
        );
        const errorData = await response.text();
        console.error("Error response:", errorData);
      }
    } catch (err) {
      console.error("Failed to load existing orders:", err);
    }
  };

  const handleCheckIn = async () => {
    if (!signature.trim()) {
      toast.error("Please provide your signature to check in");
      return;
    }

    try {
      const response = await fetch(`/api/public/${bookingId}/checkin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          signature,
          token,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Check-in failed");
      }

      const data = await response.json();
      setBooking(data.data);
      toast.success("Successfully checked in!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in failed");
    }
  };

  const addToCart = (item: InventoryItem) => {
    const existingItem = cart.find((cartItem) => cartItem.itemId === item._id);
    if (existingItem) {
      if (existingItem.quantity < item.stock) {
        setCart((prev) =>
          prev.map((cartItem) =>
            cartItem.itemId === item._id
              ? { ...cartItem, quantity: cartItem.quantity + 1 }
              : cartItem
          )
        );
        toast.success(`Added another ${item.name} to cart`);
      } else {
        toast.error("Not enough stock available");
      }
    } else {
      setCart((prev) => [
        ...prev,
        {
          itemId: item._id,
          itemName: item.name,
          quantity: 1,
          price: item.price,
        },
      ]);
      toast.success(`${item.name} added to cart`);
    }
  };

  const removeFromCart = (itemId: string) => {
    const item = cart.find((cartItem) => cartItem.itemId === itemId);
    setCart((prev) => prev.filter((item) => item.itemId !== itemId));
    if (item) {
      toast.success(`${item.itemName} removed from cart`);
    }
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    const inventoryItem = inventory.find((item) => item._id === itemId);
    if (inventoryItem && quantity > inventoryItem.stock) {
      toast.error(
        `Only ${inventoryItem.stock} ${inventoryItem.name}(s) available`
      );
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, quantity } : item
      )
    );
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    if (!token) {
      toast.error("Authentication required");
      return;
    }

    setOrderLoading(true);
    try {
      const response = await fetch(`/api/public/${bookingId}/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            sku: item.itemId,
            quantity: item.quantity,
          })),
          bookingId,
          token,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit order");
      }

      const data = await response.json();
      setCart([]);
      fetchExistingOrders(); // Refresh orders list
      toast.success("Order placed successfully!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to submit order"
      );
    } finally {
      setOrderLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getOrdersTotal = () => {
    return existingOrders.reduce(
      (total: number, order: ExistingOrder) => total + (order.totalAmount || 0),
      0
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading your booking...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error || "Booking not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">BookingCoo</h1>
          <p className="text-gray-600">Your Co-working Space Booking</p>
        </div>

        {/* Booking Details */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>Your reservation information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Customer Name
                </label>
                <p className="text-lg font-semibold">{booking.customer.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Email
                </label>
                <p className="text-lg">{booking.customer.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Desk
                </label>
                <p className="text-lg font-semibold">{booking.desk.label}</p>
                {booking.desk.location && (
                  <p className="text-sm text-gray-500">
                    {booking.desk.location}
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Status
                </label>
                <span
                  className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                    booking.status === "confirmed"
                      ? "bg-blue-100 text-blue-600"
                      : booking.status === "checked-in"
                      ? "bg-green-100 text-green-600"
                      : booking.status === "completed"
                      ? "bg-gray-100 text-gray-600"
                      : "bg-yellow-100 text-yellow-600"
                  }`}
                >
                  {booking.status}
                </span>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">
                  Time Range
                </label>
                <p className="text-lg">
                  {formatDateTime(booking.startTime)} →{" "}
                  {formatDateTime(booking.endTime)}
                </p>
              </div>
            </div>

            {booking.checkInTime && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <p className="text-green-800">
                  ✅ Checked in at: {formatDateTime(booking.checkInTime)}
                </p>
                {booking.signature && (
                  <p className="text-sm text-green-600 mt-1">
                    Signature: {booking.signature}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Check-in Section */}
        {booking.status === "confirmed" && !booking.checkInTime && (
          <Card>
            <CardHeader>
              <CardTitle>Check In</CardTitle>
              <CardDescription>
                Please provide your signature to check in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label
                  htmlFor="signature"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Your Signature
                </label>
                <Input
                  id="signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Enter your full name as signature"
                  required
                />
              </div>
              <Button onClick={handleCheckIn} className="w-full">
                Check In
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Food Ordering Section */}
        {(booking.status === "confirmed" ||
          booking.status === "checked-in") && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Order Food & Items</CardTitle>
                <CardDescription>
                  Browse our menu and place your order
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventory.map((item) => {
                    const cartItem = cart.find(
                      (cartItem) => cartItem.itemId === item._id
                    );
                    const cartQuantity = cartItem ? cartItem.quantity : 0;
                    const maxQuantity = item.stock - cartQuantity;

                    return (
                      <div
                        key={item._id}
                        className="border rounded-lg p-4 space-y-3 bg-white hover:shadow-md transition-shadow"
                      >
                        {item.image && (
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-32 object-cover rounded"
                          />
                        )}
                        <div>
                          <h3 className="font-semibold text-lg">{item.name}</h3>
                          <p className="text-sm text-gray-600">
                            {item.description}
                          </p>
                          <div className="flex items-center justify-start mt-2">
                            <span className="text-sm text-gray-500 capitalize bg-gray-100 px-2 py-1 rounded">
                              {item.category}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xl font-bold text-green-600">
                            {formatCurrency(item.price)}
                          </span>
                          {cartQuantity > 0 && (
                            <span className="text-sm bg-blue-100 text-blue-600 px-2 py-1 rounded">
                              {cartQuantity} in cart
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => addToCart(item)}
                            className="flex-1"
                            disabled={maxQuantity === 0}
                            variant={
                              maxQuantity === 0 ? "secondary" : "default"
                            }
                          >
                            {maxQuantity === 0 ? "Out of Stock" : "Add to Cart"}
                          </Button>
                          {cartQuantity > 0 && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateCartQuantity(item._id, cartQuantity - 1)
                                }
                                className="h-9 w-9 p-0"
                              >
                                -
                              </Button>
                              <span className="w-8 text-center text-sm">
                                {cartQuantity}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateCartQuantity(item._id, cartQuantity + 1)
                                }
                                className="h-9 w-9 p-0"
                                disabled={maxQuantity === 0}
                              >
                                +
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {inventory.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500 text-lg">
                      No items available for ordering at the moment.
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      Please check back later or contact staff for assistance.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shopping Cart */}
            {cart.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Order</CardTitle>
                  <CardDescription>
                    Review your items before placing order
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.itemId}>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>{formatCurrency(item.price)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateCartQuantity(
                                    item.itemId,
                                    item.quantity - 1
                                  )
                                }
                                className="h-6 w-6 p-0"
                              >
                                -
                              </Button>
                              <span className="w-8 text-center">
                                {item.quantity}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  updateCartQuantity(
                                    item.itemId,
                                    item.quantity + 1
                                  )
                                }
                                className="h-6 w-6 p-0"
                              >
                                +
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {formatCurrency(item.price * item.quantity)}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFromCart(item.itemId)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-lg font-semibold">
                      Total: {formatCurrency(getCartTotal())}
                    </span>
                    <Button
                      onClick={submitOrder}
                      disabled={orderLoading}
                      className="min-w-32"
                    >
                      {orderLoading ? "Placing Order..." : "Place Order"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Previous Orders */}
        {existingOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Orders</CardTitle>
              <CardDescription>Previously placed orders</CardDescription>
            </CardHeader>
            <CardContent>
              {existingOrders.map((order) => (
                <div key={order._id} className="mb-6 p-4 border rounded-lg">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold">
                      Order #{order._id.slice(-8)}
                    </h4>
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-1 rounded text-sm ${
                          order.status === "confirmed"
                            ? "bg-blue-100 text-blue-600"
                            : order.status === "completed"
                            ? "bg-green-100 text-green-600"
                            : order.status === "cancelled"
                            ? "bg-red-100 text-red-600"
                            : "bg-yellow-100 text-yellow-600"
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(order.totalAmount || 0)}
                      </span>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {order.items?.map((item) => (
                        <TableRow key={item._id}>
                          <TableCell>
                            {item.name || item.itemName || "Unknown Item"}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(item.price || 0)}
                          </TableCell>
                          <TableCell>{item.quantity || 0}</TableCell>
                          <TableCell>
                            {formatCurrency(
                              (item.price || 0) * (item.quantity || 0)
                            )}
                          </TableCell>
                        </TableRow>
                      )) || (
                        <TableRow>
                          <TableCell
                            colSpan={4}
                            className="text-center text-gray-500"
                          >
                            No items found in this order
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <p className="text-xs text-gray-500 mt-2">
                    Ordered on {formatDateTime(order.createdAt)}
                  </p>
                </div>
              ))}
              <div className="mt-4 text-right">
                <span className="text-lg font-semibold">
                  Total Spent: {formatCurrency(getOrdersTotal())}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
