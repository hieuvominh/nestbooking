"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
// Checkbox removed: we no longer offer "Đặt Trước" in create flow; redirect to billing instead
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Calendar,
  Clock,
  DollarSign,
  Package,
  Plus,
  Minus,
  Trash2,
  Search,
  ShoppingCart,
  CreditCard,
  X,
  Check,
} from "lucide-react";
import { toast } from "sonner";

// TypeScript Interfaces
interface Desk {
  _id: string;
  label: string;
  location: string;
  description?: string;
  hourlyRate: number;
  status: "available" | "reserved" | "occupied" | "maintenance";
}

interface InventoryItem {
  _id: string;
  sku: string;
  name: string;
  description?: string;
  category: "food" | "beverage" | "office-supplies" | "merchandise" | "combo";
  price: number;
  quantity: number;
  lowStockThreshold?: number;
  unit?: string;
  isActive?: boolean;
  // Combo-specific fields
  type?: "item" | "combo";
  duration?: number; // Duration in hours for combo packages
  includedItems?: string[]; // Items included in combo (optional)
}

interface CartItem {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
  category: string;
}

interface BookingFormData {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deskId: string;
  startTime: string;
  endTime: string;
  notes: string;
}

export default function CreateBookingPage() {
  const router = useRouter();
  const { apiCall } = useApi();

  // Fetch available desks
  const { data: desks, isLoading: desksLoading } = useApi<Desk[]>("/api/desks");

  // Fetch inventory items (including combos)
  const { data: inventory, isLoading: inventoryLoading } =
    useApi<InventoryItem[]>("/api/inventory");

  // Form state
  const [formData, setFormData] = useState<BookingFormData>({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    deskId: "",
    startTime: "",
    endTime: "",
    notes: "",
  });

  // Cart state for inventory items
  const [cart, setCart] = useState<CartItem[]>([]);

  // Combo state - tracks selected combo package
  const [selectedCombo, setSelectedCombo] = useState<InventoryItem | null>(
    null
  );

  // Duration in hours for manual bookings (used when no combo selected)
  const [durationHours, setDurationHours] = useState<number>(1);
  // Reveal time-based pricing only after user clicks create
  const [revealTimeCost, setRevealTimeCost] = useState<boolean>(false);

  // Check-in time preview (disabled) — actual check-in time will be set to current time when creating
  const [startPreview, setStartPreview] = useState<string>(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now.toISOString().slice(0, 16);
  });

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"items" | "combos">("items"); // Toggle between items and combos

  // Payment state
  const [paymentStatus, setPaymentStatus] = useState<
    "pending" | "paid" | "refunded"
  >("pending");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-update end time when combo is selected
  useEffect(() => {
    // If a combo is selected, its fixed duration defines endTime
    if (selectedCombo && selectedCombo.duration && formData.startTime) {
      const [datePart, timePart] = formData.startTime.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes] = timePart.split(":").map(Number);

      const startDate = new Date(year, month - 1, day, hours, minutes);
      const endDate = new Date(
        startDate.getTime() + selectedCombo.duration * 60 * 60 * 1000
      );

      const endYear = endDate.getFullYear();
      const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
      const endDay = String(endDate.getDate()).padStart(2, "0");
      const endHours = String(endDate.getHours()).padStart(2, "0");
      const endMinutes = String(endDate.getMinutes()).padStart(2, "0");
      const endTimeString = `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`;

      setFormData((prev) => ({ ...prev, endTime: endTimeString }));
      return; // combo takes precedence
    }

    // If no combo selected, compute endTime from startTime + durationHours
    if (!selectedCombo && formData.startTime && durationHours > 0) {
      const [datePart, timePart] = formData.startTime.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes] = timePart.split(":").map(Number);

      const startDate = new Date(year, month - 1, day, hours, minutes);
      const endDate = new Date(
        startDate.getTime() + durationHours * 60 * 60 * 1000
      );

      const endYear = endDate.getFullYear();
      const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
      const endDay = String(endDate.getDate()).padStart(2, "0");
      const endHours = String(endDate.getHours()).padStart(2, "0");
      const endMinutes = String(endDate.getMinutes()).padStart(2, "0");
      const endTimeString = `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`;

      setFormData((prev) => ({ ...prev, endTime: endTimeString }));
    }
  }, [selectedCombo, formData.startTime, durationHours]);

  // Get selected desk details
  const selectedDesk = useMemo(() => {
    return desks?.find((desk) => desk._id === formData.deskId);
  }, [desks, formData.deskId]);

  // Calculate booking duration in hours
  const bookingDuration = useMemo(() => {
    return durationHours;
  }, [durationHours]);

  // Calculate desk cost based on combo or regular booking
  // If combo selected: use combo price (ignores hourly rate)
  // If no combo: use desk hourly rate × duration
  const deskCost = useMemo(() => {
    console.log("Calculating desk cost:", selectedCombo, {
      selectedDesk,
      bookingDuration,
    });

    if (selectedCombo) {
      // Combo selected: use fixed combo price
      return selectedCombo.price;
    }
    // Regular booking: calculate based on desk hourly rate
    if (!selectedDesk || bookingDuration <= 0) return 0;
    return Math.ceil(bookingDuration * selectedDesk.hourlyRate);
  }, [selectedCombo, selectedDesk, bookingDuration]);

  // Calculate inventory/cart total (add-ons)
  const inventoryTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }, [cart]);

  // Calculate grand total
  // If combo: combo price + add-on items
  // If no combo: desk cost + add-on items
  const grandTotal = useMemo(() => {
    return deskCost + inventoryTotal;
  }, [deskCost, inventoryTotal]);

  // For the cart display, optionally hide the time-based desk cost until
  // the user actually creates the booking (controlled by revealTimeCost).
  const displayedDeskCost = revealTimeCost ? deskCost : 0;
  const displayedGrandTotal = displayedDeskCost + inventoryTotal;

  // Represent the desk (or selected combo) as a cart-like item so it appears
  // in the right-column cart list. Price uses displayedDeskCost so it will be
  // hidden (0) until revealTimeCost is true.
  const deskCartEntry = selectedCombo
    ? {
        id: `combo-${selectedCombo._id}`,
        name: `Gói: ${selectedCombo.name}`,
        price: selectedCombo.price,
        quantity: 1,
        isCombo: true,
      }
    : selectedDesk
    ? {
        id: `desk-${selectedDesk._id}`,
        name: `Thuê Bàn - ${selectedDesk.label}`,
        price: displayedDeskCost,
        quantity: 1,
        isCombo: false,
      }
    : null;

  const clearDeskSelection = () => {
    // Clear desk selection and reset duration
    setFormData((prev) => ({ ...prev, deskId: "", endTime: "" }));
    setDurationHours(1);
    setSelectedCombo(null);
    setRevealTimeCost(false);
    toast.info("Đã xóa chọn bàn/gói");
  };

  // Filter inventory based on search, category, and view mode
  const filteredInventory = useMemo(() => {
    if (!inventory) return [];

    return inventory.filter((item) => {
      // Filter by active status and stock
      if (item.isActive === false || item.quantity <= 0) return false;

      // Filter by view mode (items vs combos)
      if (viewMode === "combos") {
        if (item.type !== "combo") return false;
      } else {
        // In items view, exclude combos
        if (item.type === "combo") return false;
      }

      // Filter by category (not applicable in combo view)
      if (
        viewMode === "items" &&
        categoryFilter !== "all" &&
        item.category !== categoryFilter
      )
        return false;

      // Filter by search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          item.name.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.sku.toLowerCase().includes(query)
        );
      }

      return true;
    });
  }, [inventory, searchQuery, categoryFilter, viewMode]);

  // Handle combo selection
  const selectCombo = (combo: InventoryItem) => {
    setSelectedCombo(combo);
    toast.success(
      `${combo.name} đã được chọn! Thời lượng: ${combo.duration} giờ`
    );
  };

  // Clear combo selection
  const clearCombo = () => {
    setSelectedCombo(null);
    // Reset combo and compute endTime from durationHours if startTime exists
    if (formData.startTime && durationHours > 0) {
      const [datePart, timePart] = formData.startTime.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes] = timePart.split(":").map(Number);

      const startDate = new Date(year, month - 1, day, hours, minutes);
      const endDate = new Date(
        startDate.getTime() + durationHours * 60 * 60 * 1000
      );

      const endYear = endDate.getFullYear();
      const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
      const endDay = String(endDate.getDate()).padStart(2, "0");
      const endHours = String(endDate.getHours()).padStart(2, "0");
      const endMinutes = String(endDate.getMinutes()).padStart(2, "0");
      const endTimeString = `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`;

      setFormData((prev) => ({ ...prev, endTime: endTimeString }));
    } else {
      setFormData((prev) => ({ ...prev, endTime: "" }));
    }
    setRevealTimeCost(false);
    toast.info("Đã xóa combo. Bạn có thể tự chọn thời lượng.");
  };

  // Automatically reveal time-based pricing when a desk + duration is selected
  // or when a combo is selected. Hide it otherwise.
  useEffect(() => {
    if (selectedCombo) {
      setRevealTimeCost(true);
      return;
    }
    if (selectedDesk && durationHours > 0) {
      setRevealTimeCost(true);
      return;
    }
    setRevealTimeCost(false);
  }, [selectedCombo, selectedDesk, durationHours]);

  // Add item to cart
  const addToCart = (item: InventoryItem) => {
    const existingItem = cart.find((cartItem) => cartItem.itemId === item._id);

    if (existingItem) {
      // Increase quantity if already in cart
      setCart(
        cart.map((cartItem) =>
          cartItem.itemId === item._id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        )
      );
    } else {
      // Add new item to cart
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

    toast.success(`${item.name} đã thêm vào giỏ hàng`);
  };

  // Update cart item quantity
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

  // Remove item from cart
  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((item) => item.itemId !== itemId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
  };

  // Get category badge color
  const getCategoryColor = (category: string) => {
    const colors = {
      food: "bg-orange-100 text-orange-800",
      beverage: "bg-blue-100 text-blue-800",
      "office-supplies": "bg-purple-100 text-purple-800",
      merchandise: "bg-pink-100 text-pink-800",
      combo: "bg-green-100 text-green-800",
    };
    return (
      colors[category as keyof typeof colors] || "bg-gray-100 text-gray-800"
    );
  };

  // Get payment status color
  const getPaymentStatusColor = (status: string) => {
    const colors = {
      pending: "bg-yellow-100 text-yellow-800 border-yellow-300",
      paid: "bg-green-100 text-green-800 border-green-300",
      refunded: "bg-red-100 text-red-800 border-red-300",
    };
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-800";
  };

  // Validate form
  const validateForm = (): boolean => {
    if (!formData.customerName.trim()) {
      toast.error("Vui lòng nhập tên khách hàng");
      return false;
    }
    if (!formData.deskId) {
      toast.error("Vui lòng chọn bàn");
      return false;
    }
    return true;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      // Compute actual start (check-in) and end times now (start = now)
      const now = new Date();
      now.setSeconds(0, 0);
      const startIso = now.toISOString().slice(0, 16);

      let endDate = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
      if (selectedCombo && selectedCombo.duration) {
        endDate = new Date(
          now.getTime() + selectedCombo.duration * 60 * 60 * 1000
        );
      }
      const endIso = endDate.toISOString().slice(0, 16);

      // Basic validation for computed times
      if (endDate.getTime() <= now.getTime()) {
        toast.error("Giờ kết thúc phải sau giờ bắt đầu");
        setIsSubmitting(false);
        return;
      }

      // Persist computed times to formData for UI consistency
      setFormData((prev) => ({
        ...prev,
        startTime: startIso,
        endTime: endIso,
      }));

      // Always create booking and redirect to billing page for payment/invoice
      const bookingData = {
        customer: {
          name: formData.customerName,
          email: formData.customerEmail || undefined,
          phone: formData.customerPhone || undefined,
        },
        deskId: formData.deskId,
        startTime: startIso,
        endTime: endIso,
        // default to pending; payment will be handled on the billing page
        status: "pending",
        totalAmount: grandTotal,
        paymentStatus: paymentStatus,
        notes: formData.notes,
      };

      const bookingResponse: { booking?: { _id: string }; _id?: string } =
        await apiCall("/api/bookings", {
          method: "POST",
          body: bookingData,
        });

      // Extract booking ID from nested response structure
      const bookingId = bookingResponse?.booking?._id || bookingResponse?._id;

      if (!bookingId) {
        throw new Error("Invalid booking response: missing booking ID");
      }

      // Step 2: Create order if there are items in cart
      if (cart.length > 0) {
        const orderData = {
          bookingId: bookingId,
          items: cart.map((item) => ({
            itemId: item.itemId,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity,
          })),
          total: inventoryTotal,
          status: "pending",
          notes: `Items ordered with booking`,
        };

        await apiCall("/api/orders", {
          method: "POST",
          body: orderData,
        });
      }

      toast.success("Đã tạo đặt bàn thành công!");

      // Redirect to billing page so user can pay and view invoice
      router.push(`/admin/billing/${bookingId}`);
    } catch (error) {
      console.error("Error creating booking:", error);
      toast.error("Tạo đặt bàn thất bại. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle immediate payment
  const handlePayNow = () => {
    setPaymentStatus("paid");
    toast.success("Trạng thái thanh toán đã cập nhật: Đã thanh toán");
  };

  if (desksLoading || inventoryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tạo Đặt Bàn Mới</h1>
            <p className="text-gray-500">Đặt bàn và thêm món trong một lần</p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Booking Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <Card>
              <CardHeader>
                <CardTitle>Thông Tin Khách Hàng</CardTitle>
                <CardDescription>Nhập thông tin khách hàng</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="customerName">Họ và Tên *</Label>
                  <Input
                    id="customerName"
                    placeholder="Nguyễn Văn A"
                    value={formData.customerName}
                    onChange={(e) =>
                      setFormData({ ...formData, customerName: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="customerEmail">Email</Label>
                    <Input
                      id="customerEmail"
                      type="email"
                      placeholder="nguyen@example.com"
                      value={formData.customerEmail}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customerEmail: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="customerPhone">Số Điện Thoại</Label>
                    <Input
                      id="customerPhone"
                      type="tel"
                      placeholder="+84 123 456 789"
                      value={formData.customerPhone}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          customerPhone: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Desk Selection & Time */}
            <Card>
              <CardHeader>
                <CardTitle>Chọn Bàn & Thời Gian</CardTitle>
                <CardDescription>Chọn bàn và thời lượng đặt</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="deskId">Chọn Bàn *</Label>
                  <Select
                    value={formData.deskId}
                    onValueChange={(value) =>
                      setFormData({ ...formData, deskId: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Chọn một bàn" />
                    </SelectTrigger>
                    <SelectContent>
                      {desks
                        ?.filter((desk) => desk.status === "available")
                        .map((desk) => (
                          <SelectItem key={desk._id} value={desk._id}>
                            {desk.label} - {desk.location} (
                            {formatCurrency(desk.hourlyRate)}/giờ)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                {!selectedCombo && selectedDesk && (
                  <div className="mb-3">
                    <Label htmlFor="durationHours">Số giờ *</Label>
                    <Input
                      id="durationHours"
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={durationHours}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        const intVal = Number.isFinite(v)
                          ? Math.max(1, Math.floor(v))
                          : 1;
                        setDurationHours(intVal);
                      }}
                      onBlur={(e) => {
                        // ensure integer on blur
                        const v = Number(e.target.value);
                        const intVal = Number.isFinite(v)
                          ? Math.max(1, Math.floor(v))
                          : 1;
                        setDurationHours(intVal);
                      }}
                    />
                  </div>
                )}
                {selectedDesk && !selectedCombo && (
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <p className="text-sm font-medium">
                      {selectedDesk.label} - {selectedDesk.location}
                    </p>
                    <p className="text-xs text-gray-600">
                      {selectedDesk.description}
                    </p>
                    <p className="text-sm font-semibold mt-1">
                      {formatCurrency(selectedDesk.hourlyRate)}/giờ
                    </p>
                  </div>
                )}

                {/* Show combo info if selected */}
                {selectedCombo && (
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 p-4 rounded-lg border-2 border-green-300">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Package className="h-4 w-4 text-green-600" />
                          <p className="text-sm font-bold text-green-800">
                            ĐÃ CHỌN GÓI COMBO
                          </p>
                        </div>
                        <p className="text-base font-semibold">
                          {selectedCombo.name}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {selectedCombo.description}
                        </p>
                        <div className="flex gap-4 mt-2">
                          <p className="text-sm">
                            <Clock className="inline h-4 w-4 mr-1" />
                            <span className="font-semibold">
                              {selectedCombo.duration} giờ cố định
                            </span>
                          </p>
                          <p className="text-sm">
                            <DollarSign className="inline h-4 w-4 mr-1" />
                            <span className="font-semibold text-green-600">
                              {formatCurrency(selectedCombo.price)}
                            </span>
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clearCombo}
                        className="text-red-600 hover:text-red-700"
                      >
                        Gỡ Bỏ
                      </Button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="startTime">
                      Giờ Check-in (tự động khi tạo)
                    </Label>
                    <Input
                      id="startTime"
                      type="datetime-local"
                      value={startPreview}
                      disabled
                      className="bg-gray-100 cursor-not-allowed"
                      readOnly
                    />
                  </div>
                  <div>
                    <Label htmlFor="endTime">
                      Giờ Kết Thúc *{" "}
                      {selectedCombo && (
                        <span className="text-xs text-gray-500">
                          (Tự động tính từ combo)
                        </span>
                      )}
                    </Label>
                    <Input
                      id="endTime"
                      type="datetime-local"
                      value={formData.endTime}
                      disabled
                      required
                      className="bg-gray-100 cursor-not-allowed"
                    />
                  </div>
                </div>

                {/* Removed 'Đặt Trước' flow: create booking redirects to billing for payment/invoice */}

                {revealTimeCost && bookingDuration > 0 && !selectedCombo && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <p className="text-sm">
                      <Clock className="inline h-4 w-4 mr-1" />
                      Thời Lượng:{" "}
                      <span className="font-semibold">
                        {Math.floor(bookingDuration)} giờ
                      </span>
                    </p>
                    <p className="text-sm mt-1">
                      <DollarSign className="inline h-4 w-4 mr-1" />
                      Phí Bàn:{" "}
                      <span className="font-semibold">
                        {formatCurrency(deskCost)}
                      </span>
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="notes">Ghi Chú (Tùy chọn)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Yêu cầu đặc biệt hoặc ghi chú..."
                    value={formData.notes}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Inventory/Combo Selection */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      {viewMode === "combos" ? "Chọn Gói Combo" : "Thêm Món"}
                    </CardTitle>
                    <CardDescription>
                      {viewMode === "combos"
                        ? "Chọn gói combo với thời lượng và giá cố định"
                        : "Thêm đồ ăn, đồ uống hoặc văn phòng phẩm"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* View Mode Toggle */}
                <div className="flex flex-col sm:flex-row gap-2 p-1 bg-gray-100 rounded-lg">
                  <Button
                    type="button"
                    variant={viewMode === "combos" ? "default" : "ghost"}
                    className="flex-1"
                    onClick={() => setViewMode("combos")}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Gói Combo
                  </Button>
                  <Button
                    type="button"
                    variant={viewMode === "items" ? "default" : "ghost"}
                    className="flex-1"
                    onClick={() => setViewMode("items")}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Món Đơn Lẻ
                  </Button>
                </div>

                {/* Search and Filter */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={
                        viewMode === "combos" ? "Tìm combo..." : "Tìm món..."
                      }
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                  >
                    <SelectTrigger className="w-full sm:w-[180px]">
                      <SelectValue placeholder="Danh mục" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tất Cả Danh Mục</SelectItem>
                      <SelectItem value="food">Đồ Ăn</SelectItem>
                      <SelectItem value="beverage">Đồ Uống</SelectItem>
                      <SelectItem value="office-supplies">
                        Văn Phòng Phẩm
                      </SelectItem>
                      <SelectItem value="merchandise">Hàng Hóa</SelectItem>
                      <SelectItem value="combo">Combo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Inventory Items Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {filteredInventory.length === 0 ? (
                    <div className="col-span-2 text-center py-8 text-gray-500">
                      {viewMode === "combos"
                        ? "Không tìm thấy gói combo"
                        : "Không tìm thấy món nào"}
                    </div>
                  ) : viewMode === "combos" ? (
                    // Combo Packages View
                    filteredInventory.map((combo) => (
                      <div
                        key={combo._id}
                        className={`border-2 rounded-lg p-4 transition ${
                          selectedCombo?._id === combo._id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-bold text-base">
                                {combo.name}
                              </h4>
                              {selectedCombo?._id === combo._id && (
                                <Badge className="bg-blue-600">Đã Chọn</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {combo.description}
                            </p>

                            {/* Combo Duration */}
                            {combo.duration && (
                              <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                <Clock className="h-3 w-3" />
                                <span>{combo.duration} giờ bao gồm</span>
                              </div>
                            )}

                            {/* Included Items */}
                            {combo.includedItems &&
                              combo.includedItems.length > 0 && (
                                <div className="text-xs text-gray-500 mb-2">
                                  <span className="font-semibold">
                                    Bao gồm:
                                  </span>
                                  <ul className="list-disc list-inside ml-2 mt-1">
                                    {combo.includedItems.map(
                                      (comp: any, idx: number) => {
                                        if (!comp) return null;
                                        // simple string entry
                                        if (typeof comp === "string")
                                          return <li key={idx}>{comp}</li>;

                                        // object entry - try to resolve name
                                        if (typeof comp === "object") {
                                          // if the component is already populated with a name
                                          if (comp.name) {
                                            const qty = comp.quantity
                                              ? ` x${comp.quantity}`
                                              : "";
                                            return (
                                              <li key={idx}>
                                                {comp.name}
                                                {qty}
                                              </li>
                                            );
                                          }

                                          // try to resolve by id using loaded inventory
                                          const compId =
                                            typeof comp.item === "string"
                                              ? comp.item
                                              : comp.item?._id;
                                          const found = inventory?.find(
                                            (it: any) => it._id === compId
                                          );
                                          const label = found
                                            ? found.name
                                            : compId || JSON.stringify(comp);
                                          const qty = comp.quantity
                                            ? ` x${comp.quantity}`
                                            : "";
                                          return (
                                            <li key={idx}>
                                              {label}
                                              {qty}
                                            </li>
                                          );
                                        }

                                        return (
                                          <li key={idx}>{String(comp)}</li>
                                        );
                                      }
                                    )}
                                  </ul>
                                </div>
                              )}
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-2 border-t">
                          <span className="text-xl font-bold text-green-600">
                            {formatCurrency(combo.price)}
                          </span>
                          {selectedCombo?._id === combo._id ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={clearCombo}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Gỡ Bỏ
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => selectCombo(combo)}
                              disabled={combo.quantity <= 0}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Chọn
                            </Button>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                          Có sẵn: {combo.quantity} gói
                        </p>
                      </div>
                    ))
                  ) : (
                    // Regular Items View (for cart)
                    filteredInventory.map((item) => (
                      <div
                        key={item._id}
                        className="border rounded-lg p-3 hover:bg-gray-50 transition"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">
                              {item.name}
                            </h4>
                            <p className="text-xs text-gray-500 line-clamp-1">
                              {item.description}
                            </p>
                          </div>
                          <Badge
                            className={`text-xs ${getCategoryColor(
                              item.category
                            )}`}
                          >
                            {item.category}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-bold text-green-600">
                            {formatCurrency(item.price)}
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => addToCart(item)}
                            disabled={item.quantity <= 0}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Thêm
                          </Button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Tồn kho: {item.quantity} {item.unit}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Cart & Payment */}
          <div className="space-y-6">
            {/* Cart */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5" />
                    Giỏ Hàng ({cart.length})
                  </CardTitle>
                  {cart.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={clearCart}
                    >
                      Xóa
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {cart.length === 0 && !deskCartEntry ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>Không có món trong giỏ</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Desk/combo pseudo-item first (if selected) */}
                    {deskCartEntry && (
                      <div
                        key={deskCartEntry.id}
                        className="border rounded-lg p-3"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">
                              {deskCartEntry.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {!deskCartEntry.isCombo && formData.startTime
                                ? `Thời lượng: ${Math.max(
                                    1,
                                    durationHours
                                  )} giờ`
                                : deskCartEntry.isCombo
                                ? "Gói cố định"
                                : "Chưa chọn bàn"}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={clearDeskSelection}
                          >
                            <Trash2 className="h-3 w-3 text-red-500" />
                          </Button>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-8 text-center font-medium">
                              {deskCartEntry.quantity}
                            </span>
                          </div>
                          <span className="font-bold">
                            {formatCurrency(
                              deskCartEntry.price * deskCartEntry.quantity
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Regular cart items */}
                    {cart.map((item) => (
                      <div key={item.itemId} className="border rounded-lg p-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1">
                            <h4 className="font-semibold text-sm">
                              {item.name}
                            </h4>
                            <p className="text-xs text-gray-500">
                              {formatCurrency(item.price)}
                            </p>
                          </div>
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
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                updateCartQuantity(
                                  item.itemId,
                                  item.quantity - 1
                                )
                              }
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-8 text-center font-medium">
                              {item.quantity}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() =>
                                updateCartQuantity(
                                  item.itemId,
                                  item.quantity + 1
                                )
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="font-bold">
                            {formatCurrency(item.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payment Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Tổng Thanh Toán
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Breakdown */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Thuê Bàn</span>
                    <span className="font-medium">
                      {formatCurrency(deskCost)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Món ({cart.length})</span>
                    <span className="font-medium">
                      {formatCurrency(inventoryTotal)}
                    </span>
                  </div>

                  <Separator />

                  <div className="flex justify-between items-center bg-gray-900 text-white p-4 rounded-lg">
                    <span className="text-lg font-semibold">Tổng Cộng</span>
                    <span className="text-2xl font-bold">
                      {formatCurrency(displayedGrandTotal)}
                    </span>
                  </div>
                </div>
                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting || displayedGrandTotal === 0}
                >
                  {isSubmitting
                    ? "Đang tạo đặt bàn..."
                    : `Tạo Đặt Bàn - ${formatCurrency(displayedGrandTotal)}`}
                </Button>

                {/* Info */}
                <p className="text-xs text-gray-500 text-center">
                  {paymentStatus === "paid"
                    ? "Thanh toán sẽ được đánh dấu hoàn thành"
                    : "Có thể thanh toán sau"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
