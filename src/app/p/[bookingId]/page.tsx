"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    hourlyRate?: number;
  };
  startTime: string;
  endTime: string;
  status: "confirmed" | "checked-in" | "completed" | "cancelled";
  isMeetingRoomBooking?: boolean;
  checkInTime?: string;
  signature?: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category:
    | "food"
    | "beverage"
    | "merchandise"
    | "office-supplies"
    | "combo"
    | string;
  isAvailable: boolean;
  image?: string;
  pricePerPerson?: boolean;
  duration?: number;
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
  totalAmount?: number;
  total?: number;
  notes?: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
}

export default function PublicBookingPage() {
  const ODD_HOUR_ITEM_ID = "__ODD_HOUR__";
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
  const [orderNote, setOrderNote] = useState("");
  const [orderLoading, setOrderLoading] = useState(false);

  const fetchWithTimeout = async (
    url: string,
    options?: RequestInit,
    timeoutMs = 15000,
  ) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const statusLabel = (status: Booking["status"]) => {
    switch (status) {
      case "confirmed":
        return "Đã đặt";
      case "checked-in":
        return "Đã check-in";
      case "completed":
        return "Hoàn thành";
      case "cancelled":
        return "Đã hủy";
      default:
        return status;
    }
  };

  const orderStatusLabel = (status: ExistingOrder["status"]) => {
    switch (status) {
      case "pending":
        return "Đang chờ";
      case "confirmed":
        return "Đang chờ";
      case "completed":
        return "Đã giao";
      case "cancelled":
        return "Đã hủy";
      default:
        return status;
    }
  };

  useEffect(() => {
    fetchBookingData();
    fetchInventory();
    fetchExistingOrders();
  }, [bookingId, token]);

  const fetchBookingData = async () => {
    try {
      if (!token) {
        throw new Error("Cần mã truy cập");
      }

      const response = await fetchWithTimeout(
        `/api/public/${bookingId}?t=${token}`,
        undefined,
        15000,
      );
      if (!response.ok) {
        throw new Error("Không tìm thấy đặt chỗ hoặc không có quyền truy cập");
      }
      const data = await response.json();
      setBooking(data.data);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        setError("Kết nối quá chậm. Vui lòng tải lại trang.");
        return;
      }
      setError(
        err instanceof Error ? err.message : "Không tải được thông tin đặt chỗ",
      );
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
            pricePerPerson: Boolean(item.pricePerPerson),
            duration: item.duration,
          })),
        );
      } else {
        console.error(
          "Khong tai duoc danh sach mon:",
          response.status,
          response.statusText,
        );
      }
    } catch (err) {
      console.error("Khong tai duoc danh sach mon:", err);
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
        token.substring(0, 20) + "...",
      );
      const response = await fetch(
        `/api/public/${bookingId}/orders?t=${token}`,
      );
      console.log("fetchExistingOrders: Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        const list = Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.data?.orders)
            ? data.data.orders
            : [];
        console.log(
          "fetchExistingOrders: Success, received orders:",
          list.length || 0,
        );
        setExistingOrders(list);
      } else {
        console.error(
          "Failed to fetch orders:",
          response.status,
          response.statusText,
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
      toast.error("Vui lòng nhập chữ ký để check-in");
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
        throw new Error(errorData.message || "Check-in thất bại");
      }

      const data = await response.json();
      setBooking(data.data);
      toast.success("Check-in thành công!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Check-in thất bại");
    }
  };

  const addToCart = (item: InventoryItem) => {
    const existingItem = cart.find((cartItem) => cartItem.itemId === item._id);
    if (existingItem) {
      setCart((prev) =>
        prev.map((cartItem) =>
          cartItem.itemId === item._id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem,
        ),
      );
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
    }
  };

  const removeFromCart = (itemId: string) => {
    const item = cart.find((cartItem) => cartItem.itemId === itemId);
    setCart((prev) => prev.filter((item) => item.itemId !== itemId));
    if (item) {
      toast.success(`Đã xóa ${item.itemName} khỏi giỏ`);
    }
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.itemId === itemId ? { ...item, quantity } : item,
      ),
    );
  };
  const cancelOrder = async (orderId: string) => {
    try {
      if (!token) return;
      const response = await fetch(
        `/api/public/${bookingId}/orders/${orderId}?t=${token}`,
        {
          method: "PATCH",
        },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || "Không hủy được đơn");
      }
      toast.success("Đã hủy đơn");
      fetchExistingOrders();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Không hủy được đơn";
      toast.error(message);
    }
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      toast.error("Giỏ hàng đang trống");
      return;
    }

    if (!token) {
      toast.error("Cần xác thực");
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
          notes: orderNote.trim() || undefined,
          token,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error || errorData.message || "Gửi đơn thất bại",
        );
      }

      const data = await response.json();
      setCart([]);
      setOrderNote("");
      fetchExistingOrders(); // Refresh orders list
      toast.success("Đã gửi đơn thành công!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gửi đơn thất bại");
    } finally {
      setOrderLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("vi-VN");
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const getOrdersTotal = () => {
    return existingOrders.reduce(
      (total: number, order: ExistingOrder) =>
        total + (order.totalAmount ?? order.total ?? 0),
      0,
    );
  };

  const isMeetingRoomBooking = Boolean(booking?.isMeetingRoomBooking);

  const oddHourItem: InventoryItem | null =
    !isMeetingRoomBooking && booking?.desk?.hourlyRate
    ? {
        _id: ODD_HOUR_ITEM_ID,
        name: "Giờ lẻ",
        description: "Gia hạn theo giờ lẻ, không bao gồm nước",
        price: booking.desk.hourlyRate,
        stock: 999999,
        category: "hourly",
        isAvailable: true,
      }
    : null;

  const comboItems = isMeetingRoomBooking
    ? []
    : [
        ...inventory.filter(
          (item) => item.category === "combo" && !item.pricePerPerson,
        ),
        ...(oddHourItem ? [oddHourItem] : []),
      ];

  const regularItems = inventory.filter((item) => item.category !== "combo");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-left">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Đang tải thông tin đặt chỗ...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">
              Không có quyền truy cập
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-500">Không tìm thấy đặt chỗ</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="mx-auto w-full max-w-md px-4 py-4 space-y-4">
        <div className="flex flex-col items-center text-center">
          <img
            src="/app-logo.png"
            alt="Nest Study Space Logo"
            className="w-20 h-auto object-contain mb-3"
          />
          <h1 className="text-2xl font-bold text-gray-900">Nest Study Space</h1>
          <p className="text-gray-600">Gọi món nhanh</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Thông tin đặt chỗ</CardTitle>
            <CardDescription className="text-[11px]">
              Chi tiết đặt chỗ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-3 items-start">
              <div>
                <p className="text-[11px] text-gray-500">Khách hàng</p>
                <p className="text-sm font-medium">{booking.customer.name}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Bàn</p>
                <p className="text-sm font-medium">{booking.desk.label}</p>
                {booking.desk.location && (
                  <p className="text-[11px] text-gray-500">
                    {booking.desk.location}
                  </p>
                )}
              </div>
            </div>
            {booking.customer.email && (
              <div>
                <p className="text-[11px] text-gray-500">Email</p>
                <p className="text-[11px]">{booking.customer.email}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 items-start">
              <div>
                <p className="text-[11px] text-gray-500">Trạng thái</p>
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    booking.status === "confirmed"
                      ? "bg-blue-100 text-blue-600"
                      : booking.status === "checked-in"
                        ? "bg-green-100 text-green-600"
                        : booking.status === "completed"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-yellow-100 text-yellow-600"
                  }`}
                >
                  {statusLabel(booking.status)}
                </span>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Thời gian</p>
                <p className="text-[11px]">
                  {formatDateTime(booking.startTime)}
                </p>
                <p className="text-[11px]">{formatDateTime(booking.endTime)}</p>
              </div>
            </div>

            {booking.checkInTime && (
              <div className="mt-2 rounded-md bg-green-50 p-2 text-xs text-green-800">
                Đã check-in lúc: {formatDateTime(booking.checkInTime)}
                {booking.signature && (
                  <div className="text-[11px] text-green-700 mt-1">
                    Chữ ký: {booking.signature}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {booking.status === "confirmed" && !booking.checkInTime && (
          <Card>
            <CardHeader>
              <CardTitle>Check-in</CardTitle>
              <CardDescription>
                Vui lòng nhập chữ ký để check-in
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <label
                  htmlFor="signature"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Chữ ký
                </label>
                <Input
                  id="signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Nhập họ tên làm chữ ký"
                  required
                />
              </div>
              <Button onClick={handleCheckIn} className="w-full">
                Check-in
              </Button>
            </CardContent>
          </Card>
        )}

        {(booking.status === "confirmed" ||
          booking.status === "checked-in") && (
          <Card>
            <CardHeader>
              <CardTitle>Gọi món</CardTitle>
              <CardDescription>Chọn món và gửi yêu cầu</CardDescription>
            </CardHeader>
            <CardContent>
              {comboItems.length > 0 && (
                <div className="mb-4">
                  <p className="mb-2 text-sm font-semibold text-gray-700">
                    Giờ thêm
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {comboItems.map((item) => {
                      const cartItem = cart.find(
                        (cartItem) => cartItem.itemId === item._id,
                      );
                      const cartQuantity = cartItem ? cartItem.quantity : 0;

                      return (
                        <div
                          key={item._id}
                          className="rounded-lg border bg-white p-3"
                        >
                          {item.image && (
                            <img
                              src={item.image}
                              alt={item.name}
                              className="h-24 w-full rounded object-cover"
                            />
                          )}
                          <div className="mt-2">
                            <p className="text-sm font-medium">{item.name}</p>
                            {item.description && (
                              <p className="text-xs text-gray-500 line-clamp-2">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-green-600">
                              {formatCurrency(item.price)}
                            </span>
                            {cartQuantity > 0 && (
                              <span className="text-[11px] text-blue-600">
                                {cartQuantity} trong giỏ
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex flex-col gap-2">
                            <Button
                              onClick={() => addToCart(item)}
                              className="w-full"
                              size="sm"
                            >
                              Thêm
                            </Button>
                            {cartQuantity > 0 && (
                              <div className="flex items-center justify-between rounded-md border px-2 py-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    updateCartQuantity(item._id, cartQuantity - 1)
                                  }
                                  className="h-7 w-7 p-0"
                                >
                                  -
                                </Button>
                                <span className="text-sm font-medium">
                                  {cartQuantity}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() =>
                                    updateCartQuantity(item._id, cartQuantity + 1)
                                  }
                                  className="h-7 w-7 p-0"
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
                </div>
              )}

              <div>
                <p className="mb-2 text-sm font-semibold text-gray-700">Món khác</p>
                <div className="grid grid-cols-2 gap-3">
                  {regularItems.map((item) => {
                  const cartItem = cart.find(
                    (cartItem) => cartItem.itemId === item._id,
                  );
                  const cartQuantity = cartItem ? cartItem.quantity : 0;

                  return (
                    <div
                      key={item._id}
                      className="rounded-lg border bg-white p-3"
                    >
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-24 w-full rounded object-cover"
                        />
                      )}
                      <div className="mt-2">
                        <p className="text-sm font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-xs text-gray-500 line-clamp-2">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-green-600">
                          {formatCurrency(item.price)}
                        </span>
                        {cartQuantity > 0 && (
                          <span className="text-[11px] text-blue-600">
                            {cartQuantity} trong giỏ
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-col gap-2">
                        <Button
                          onClick={() => addToCart(item)}
                          className="w-full"
                          size="sm"
                        >
                          Thêm
                        </Button>
                        {cartQuantity > 0 && (
                          <div className="flex items-center justify-between rounded-md border px-2 py-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateCartQuantity(item._id, cartQuantity - 1)
                              }
                              className="h-7 w-7 p-0"
                            >
                              -
                            </Button>
                            <span className="text-sm font-medium">
                              {cartQuantity}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                updateCartQuantity(item._id, cartQuantity + 1)
                              }
                              className="h-7 w-7 p-0"
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
              </div>

              {!oddHourItem && comboItems.length === 0 && regularItems.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-500">Hiện chưa có món để gọi.</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Vui lòng quay lại sau hoặc liên hệ nhân viên.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {cart.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Giỏ món</CardTitle>
              <CardDescription>Xem lại trước khi gửi</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {cart.map((item) => (
                  <div
                    key={item.itemId}
                    className="rounded-lg border bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className="font-medium">{item.itemName}</p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(item.price)} x {item.quantity}
                        </p>
                      </div>
                      <div className="text-right font-semibold">
                        {formatCurrency(item.price * item.quantity)}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateCartQuantity(item.itemId, item.quantity - 1)
                          }
                          className="h-8 w-8 p-0"
                        >
                          -
                        </Button>
                        <span className="w-8 text-center text-sm">
                          {item.quantity}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateCartQuantity(item.itemId, item.quantity + 1)
                          }
                          className="h-8 w-8 p-0"
                        >
                          +
                        </Button>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => removeFromCart(item.itemId)}
                        className="text-red-600 hover:bg-red-50"
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <label
                  htmlFor="orderNote"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Lời nhắn cho nhân viên (không bắt buộc)
                </label>
                <Textarea
                  id="orderNote"
                  value={orderNote}
                  onChange={(e) => setOrderNote(e.target.value.slice(0, 200))}
                  placeholder="Ví dụ: Mình chọn trà xanh/ ít đá/ thêm sữa"
                  className="min-h-20"
                />
                <p className="mt-1 text-xs text-gray-500 text-right">
                  {orderNote.length}/200
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {existingOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Đơn đã gọi</CardTitle>
              <CardDescription>Các đơn đã gửi</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {existingOrders.map((order) => (
                  <div
                    key={order._id}
                    className="rounded-lg border bg-white p-3"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">
                        Đơn #{order._id.slice(-8)}
                      </h4>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          order.status === "confirmed"
                            ? "bg-blue-100 text-blue-600"
                            : order.status === "completed"
                              ? "bg-green-100 text-green-600"
                              : order.status === "cancelled"
                                ? "bg-red-100 text-red-600"
                                : "bg-yellow-100 text-yellow-600"
                        }`}
                      >
                        {orderStatusLabel(order.status)}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {order.items?.map((item) => (
                        <div
                          key={item._id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span>
                            {item.name || item.itemName || "Món"} x{" "}
                            {item.quantity || 0}
                          </span>
                          <span>
                            {formatCurrency(
                              (item.price || 0) * (item.quantity || 0),
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-gray-500">
                        Gửi lúc {formatDateTime(order.createdAt)}
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(order.totalAmount ?? order.total ?? 0)}
                      </span>
                    </div>
                    {order.notes && (
                      <div className="mt-2 rounded-md bg-amber-50 border border-amber-100 p-2 text-xs text-amber-800">
                        <span className="font-semibold">Lời nhắn:</span>{" "}
                        {order.notes}
                      </div>
                    )}
                    {order.status === "pending" && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => cancelOrder(order._id)}
                        >
                          Hủy đơn
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 text-right">
                <span className="text-base font-semibold">
                  Tổng đã gọi: {formatCurrency(getOrdersTotal())}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {cart.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t bg-white">
          <div className="mx-auto w-full max-w-md px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Tạm tính</p>
              <p className="text-base font-semibold">
                {formatCurrency(getCartTotal())}
              </p>
            </div>
            <Button
              onClick={submitOrder}
              disabled={orderLoading}
              className="min-w-28"
            >
              {orderLoading ? "Đang gửi..." : "Gửi đơn"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
