"use client";

import { useState, useEffect } from "react";
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
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Copy,
  Plus,
  QrCode,
  Trash2,
  Receipt,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import { QRCodeCanvas as QRCode } from "qrcode.react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrintBill } from "@/components/PrintBill";

interface Booking {
  _id: string;
  customer: {
    name: string;
    email: string;
    phone: string;
  };
  deskId: string;
  deskNumber: number;
  startTime: string;
  endTime: string;
  status: "pending" | "confirmed" | "checked-in" | "completed" | "cancelled";
  totalAmount: number;
  paymentStatus: "pending" | "paid" | "refunded";
  paymentMethod?: string;
  publicToken?: string;
  signature?: string;
  notes?: string;
  checkedInAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  isActive: boolean;
}

interface Order {
  _id: string;
  bookingId: {
    _id: string;
    customer: {
      name: string;
      email: string;
    };
    deskId: string;
  };
  items: Array<{
    itemId: {
      _id: string;
      name: string;
      price: number;
    };
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
  }>;
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
  deliveredAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface OrdersResponse {
  orders: Order[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [selectedItem, setSelectedItem] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  // Cart state for multiple items
  const [cart, setCart] = useState<
    Array<{
      itemId: string;
      name: string;
      price: number;
      quantity: number;
    }>
  >([]);

  // API hooks
  const {
    data: booking,
    isLoading: bookingLoading,
    error: bookingError,
    mutate: mutateBooking,
  } = useApi<Booking>(`/api/bookings/${bookingId}`);

  const { data: inventory, isLoading: inventoryLoading } =
    useApi<InventoryItem[]>("/api/inventory");

  const {
    data: ordersResponse,
    isLoading: ordersLoading,
    mutate: mutateOrders,
  } = useApi<OrdersResponse>(`/api/orders?bookingId=${bookingId}`);

  const { apiCall } = useApi();

  const orders = ordersResponse?.orders || [];

  // Auto-generate token if booking exists and doesn't have a valid token
  useEffect(() => {
    const isTokenValid = (token: string) => {
      try {
        // Simple JWT payload decode to check expiration
        const payload = JSON.parse(atob(token.split(".")[1]));
        return payload.exp > Math.floor(Date.now() / 1000);
      } catch {
        return false;
      }
    };

    if (booking && booking.status !== "cancelled") {
      const hasValidToken =
        (booking.publicToken && isTokenValid(booking.publicToken)) ||
        (booking.signature && isTokenValid(booking.signature));

      if (!hasValidToken) {
        generateNewToken();
      }
    }
  }, [booking]);

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusColor = (status: string) => {
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
      pending: "bg-yellow-100 text-yellow-800",
      paid: "bg-green-100 text-green-800",
      refunded: "bg-red-100 text-red-800",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  const generatePublicUrl = () => {
    if (!booking?.publicToken && !booking?.signature) {
      return "";
    }

    const token = booking.signature || booking.publicToken;
    return `${window.location.origin}/p/${bookingId}?t=${token}`;
  };

  const generateNewToken = async () => {
    try {
      const response = await fetch(
        `/api/bookings/${bookingId}/generate-token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("bookingcoo_token")}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate token");
      }

      const data = await response.json();
      toast.success("Public token generated successfully!");

      // Update the booking data with the new token
      mutateBooking();

      return data.publicUrl;
    } catch (error) {
      toast.error("Failed to generate public token");
      return "";
    }
  };

  const copyPublicUrl = () => {
    const url = generatePublicUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      toast.success("Đã sao chép URL công khai vào clipboard!");
    }
  };

  const addItemToCart = () => {
    if (!selectedItem || quantity < 1) {
      toast.error("Vui lòng chọn món và số lượng");
      return;
    }

    const item = inventory?.find((i) => i._id === selectedItem);
    if (!item) {
      toast.error("Không tìm thấy món đã chọn");
      return;
    }

    if (item.quantity < quantity) {
      toast.error("Không đủ tồn kho");
      return;
    }

    // Check if item already in cart
    const existingItemIndex = cart.findIndex(
      (cartItem) => cartItem.itemId === selectedItem
    );

    if (existingItemIndex >= 0) {
      // Update existing item quantity
      const updatedCart = [...cart];
      updatedCart[existingItemIndex].quantity += quantity;
      setCart(updatedCart);
    } else {
      // Add new item to cart
      setCart([
        ...cart,
        {
          itemId: selectedItem,
          name: item.name,
          price: item.price,
          quantity: quantity,
        },
      ]);
    }

    setSelectedItem("");
    setQuantity(1);
    toast.success("Đã thêm món vào giỏ!");
  };

  const removeItemFromCart = (itemId: string) => {
    setCart(cart.filter((item) => item.itemId !== itemId));
  };

  const updateCartItemQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItemFromCart(itemId);
      return;
    }

    setCart(
      cart.map((item) =>
        item.itemId === itemId ? { ...item, quantity: newQuantity } : item
      )
    );
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + item.price * item.quantity, 0);
  };

  const clearCart = () => {
    setCart([]);
  };

  const handleSubmitOrder = async () => {
    if (cart.length === 0) {
      toast.error("Vui lòng thêm món vào giỏ trước khi gửi");
      return;
    }

    const orderData = {
      bookingId: bookingId,
      items: cart.map((cartItem) => ({
        itemId: cartItem.itemId,
        name: cartItem.name,
        price: cartItem.price,
        quantity: cartItem.quantity,
        subtotal: cartItem.price * cartItem.quantity,
      })),
    };

    console.log("Submitting order data:", orderData);

    try {
      await apiCall("/api/orders", {
        method: "POST",
        body: orderData,
      });

      toast.success("Đã thêm đơn hàng thành công!");
      clearCart();
      setIsOrderDialogOpen(false);
      mutateOrders();
    } catch (error) {
      console.error("Error submitting order:", error);
      toast.error("Không thể gửi đơn hàng");
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await apiCall(`/api/orders/${orderId}`, {
        method: "PUT",
        body: { status: newStatus },
      });
      mutateOrders();
      toast.success("Đã cập nhật trạng thái đơn hàng thành công!");
    } catch (error) {
      console.error("Error updating order status:", error);
      toast.error("Không thể cập nhật trạng thái đơn hàng");
    }
  };

  const handleBookingStatusChange = async (newStatus: string) => {
    try {
      await apiCall(`/api/bookings/${bookingId}`, {
        method: "PATCH",
        body: { status: newStatus },
      });
      mutateBooking();
      toast.success("Đã cập nhật trạng thái đặt bàn thành công!");
    } catch (error) {
      console.error("Error updating booking status:", error);
      toast.error("Không thể cập nhật trạng thái đặt bàn");
    }
  };

  /**
   * Check if booking can be checked out
   * Only confirmed or checked-in bookings can be checked out
   */
  const canCheckOut = () => {
    if (!booking) return false;
    return booking.status === "confirmed" || booking.status === "checked-in";
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-600 bg-yellow-100";
      case "confirmed":
        return "text-blue-600 bg-blue-100";
      case "preparing":
        return "text-orange-600 bg-orange-100";
      case "ready":
        return "text-green-600 bg-green-100";
      case "delivered":
        return "text-gray-600 bg-gray-100";
      case "cancelled":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  if (bookingLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Đang tải chi tiết đặt bàn...</div>
      </div>
    );
  }

  if (bookingError || !booking) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-lg text-red-600">
          Không thể tải chi tiết đặt bàn
        </div>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay Lại
        </Button>
      </div>
    );
  }

  const publicUrl = generatePublicUrl();
  const hasValidToken = Boolean(booking?.publicToken || booking?.signature);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Quay Lại Danh Sách
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Chi Tiết Đặt Bàn</h1>
            <p className="text-gray-500">Mã Đặt Bàn: {booking._id}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {/* Print Bill Button - Only visible when payment is completed */}
          <PrintBill booking={booking} orders={orders} deskHourlyRate={5} />
          <Button
            onClick={() => router.push(`/admin/billing/${bookingId}`)}
            className="bg-green-600 hover:bg-green-700"
          >
            <Receipt className="w-4 h-4 mr-2" />
            Xem Hóa Đơn
          </Button>
          {canCheckOut() && (
            <Button
              onClick={() => router.push(`/admin/billing/${bookingId}`)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Hoàn Tất & Thanh Toán / Trả bàn
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Booking Details & QR Code */}
        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Thông Tin Khách Hàng</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Tên</Label>
                <p className="text-lg font-semibold">{booking.customer.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">
                  Email
                </Label>
                <p>{booking.customer.email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">
                  Số Điện Thoại
                </Label>
                <p>{booking.customer.phone}</p>
              </div>
            </CardContent>
          </Card>

          {/* Booking Information */}
          <Card>
            <CardHeader>
              <CardTitle>Thông Tin Đặt Bàn</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Bàn</Label>
                <p className="text-lg font-semibold">
                  Bàn {booking.deskNumber}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Giờ Bắt Đầu
                  </Label>
                  <p>{formatDateTime(booking.startTime)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Giờ Kết Thúc
                  </Label>
                  <p>{formatDateTime(booking.endTime)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Trạng Thái
                  </Label>
                  <div className="mt-1">
                    <select
                      value={booking.status}
                      onChange={(e) =>
                        handleBookingStatusChange(e.target.value)
                      }
                      className={`w-full px-3 py-2 rounded-md text-sm font-medium border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 ${getStatusColor(
                        booking.status
                      )}`}
                    >
                      <option value="pending">Chờ</option>
                      <option value="confirmed">Đã Xác Nhận</option>
                      <option value="checked-in">Đã Check-in</option>
                      <option value="completed">Hoàn Tất</option>
                      <option value="cancelled">Đã Hủy</option>
                    </select>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Check-in
                  </Label>
                  <p>
                    {booking.checkedInAt
                      ? formatDateTime(booking.checkedInAt)
                      : "Chưa check-in"}
                  </p>
                </div>
              </div>
              {booking.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Ghi Chú
                  </Label>
                  <p className="text-sm bg-gray-50 p-3 rounded-md">
                    {booking.notes}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle>Thông Tin Thanh Toán</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Tổng Cộng
                  </Label>
                  <p className="text-lg font-bold">
                    ${booking.totalAmount?.toFixed(2) || "0.00"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Trạng Thái Thanh Toán
                  </Label>
                  <div className="mt-1">
                    <Badge
                      className={getPaymentStatusColor(booking.paymentStatus)}
                    >
                      {booking.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </div>
              {booking.paymentMethod && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Phương Thức Thanh Toán
                  </Label>
                  <p>{booking.paymentMethod}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QR Code Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <QrCode className="w-5 h-5" />
                <span>Đường Dẫn Công Khai</span>
              </CardTitle>
              <CardDescription>
                Chia sẻ mã QR hoặc URL này với khách hàng để truy cập dễ dàng
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasValidToken && publicUrl ? (
                <>
                  <div className="text-xs text-gray-500 mb-2">
                    QR URL: {publicUrl}
                  </div>
                  <div className="flex justify-center">
                    <Dialog
                      open={isQrDialogOpen}
                      onOpenChange={setIsQrDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <div className="cursor-pointer p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors bg-white">
                          <div className="flex items-center justify-center">
                            <QRCode
                              value={publicUrl}
                              size={150}
                              bgColor={"#ffffff"}
                              fgColor={"#000000"}
                              level={"L"}
                              includeMargin={false}
                            />
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Mã QR Đặt Bàn</DialogTitle>
                          <DialogDescription>
                            Khách hàng có thể quét mã QR này để truy cập đặt bàn
                            của họ
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-center py-4">
                          <div className="bg-white p-4 rounded-lg">
                            <QRCode
                              value={publicUrl}
                              size={300}
                              bgColor={"#ffffff"}
                              fgColor={"#000000"}
                              level={"L"}
                              includeMargin={true}
                            />
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="flex space-x-2">
                    <Input
                      value={publicUrl}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button onClick={copyPublicUrl} size="icon">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">
                    {booking?.status === "cancelled"
                      ? "Không thể tạo URL công khai cho đặt bàn đã hủy"
                      : "Đang tạo URL công khai và mã QR..."}
                  </div>
                  {booking?.status !== "cancelled" && (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Orders Management */}
        <div className="space-y-6">
          {/* Add Order Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Dịch Vụ Thêm / Đơn Hàng
                <Dialog
                  open={isOrderDialogOpen}
                  onOpenChange={(open) => {
                    setIsOrderDialogOpen(open);
                    if (!open) {
                      clearCart();
                      setSelectedItem("");
                      setQuantity(1);
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Thêm Dịch Vụ
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Thêm Dịch Vụ Phụ</DialogTitle>
                      <DialogDescription>
                        Thêm dịch vụ hoặc món phụ vào đặt bàn này
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6">
                      {/* Add Item Section */}
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="item">Chọn Món</Label>
                          <Select
                            value={selectedItem}
                            onValueChange={setSelectedItem}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Chọn một món..." />
                            </SelectTrigger>
                            <SelectContent>
                              {inventory?.map((item) => (
                                <SelectItem key={item._id} value={item._id}>
                                  {item.name} - ${item.price.toFixed(2)} (Tồn
                                  kho: {item.quantity}){" "}
                                  {!item.isActive && " (Ngừng hoạt động)"}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <Label htmlFor="quantity">Số Lượng</Label>
                            <Input
                              id="quantity"
                              type="number"
                              min="1"
                              value={quantity}
                              onChange={(e) =>
                                setQuantity(parseInt(e.target.value) || 1)
                              }
                            />
                          </div>
                          <div className="flex items-end">
                            <Button
                              onClick={addItemToCart}
                              disabled={!selectedItem}
                            >
                              Thêm Vào Giỏ
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Cart Section */}
                      {cart.length > 0 && (
                        <div className="space-y-4">
                          <Separator />
                          <div>
                            <h4 className="font-semibold mb-3">
                              Giỏ Đơn Hàng ({cart.length} món)
                            </h4>
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                              {cart.map((cartItem) => (
                                <div
                                  key={cartItem.itemId}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {cartItem.name}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      ${cartItem.price.toFixed(2)} mỗi
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      type="number"
                                      min="1"
                                      value={cartItem.quantity}
                                      onChange={(e) =>
                                        updateCartItemQuantity(
                                          cartItem.itemId,
                                          parseInt(e.target.value) || 1
                                        )
                                      }
                                      className="w-20"
                                    />
                                    <div className="text-sm font-medium w-16 text-right">
                                      $
                                      {(
                                        cartItem.price * cartItem.quantity
                                      ).toFixed(2)}
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() =>
                                        removeItemFromCart(cartItem.itemId)
                                      }
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="mt-3 pt-3 border-t">
                              <div className="flex justify-between items-center font-semibold">
                                <span>Tổng:</span>
                                <span>${getCartTotal().toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex justify-between">
                        <div>
                          {cart.length > 0 && (
                            <Button variant="outline" onClick={clearCart}>
                              Xóa Giỏ
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setIsOrderDialogOpen(false)}
                          >
                            Hủy
                          </Button>
                          <Button
                            onClick={handleSubmitOrder}
                            disabled={cart.length === 0}
                          >
                            Gửi Đơn ({cart.length} món)
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
              <CardDescription>
                Dịch vụ và món phụ cho đặt bàn này
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="text-center py-4">Đang tải đơn hàng...</div>
              ) : orders && orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order._id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold">
                            Đơn Hàng #{order._id.slice(-8)}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {formatDateTime(order.createdAt)}
                          </p>
                        </div>
                        <select
                          value={order.status}
                          onChange={(e) =>
                            handleStatusChange(order._id, e.target.value)
                          }
                          className={`px-2 py-1 rounded-full text-xs font-medium border-0 ${getOrderStatusColor(
                            order.status
                          )}`}
                        >
                          <option value="pending">Chờ</option>
                          <option value="confirmed">Đã Xác Nhận</option>
                          <option value="preparing">Đang Chuẩn Bị</option>
                          <option value="ready">Sẵn Sàng</option>
                          <option value="delivered">Đã Giao</option>
                          <option value="cancelled">Đã Hủy</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        {order.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex justify-between text-sm"
                          >
                            <span>
                              {item.name} × {item.quantity}
                            </span>
                            <span>
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-semibold">
                        <span>Tổng</span>
                        <span>${order.total.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Chưa có đơn hàng phụ. Thêm dịch vụ bằng nút ở trên.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
