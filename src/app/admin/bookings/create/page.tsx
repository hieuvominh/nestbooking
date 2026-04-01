"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { formatCurrency, normalizeVndAmount } from "@/lib/currency";
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
  Ticket,
} from "lucide-react";
import { toast } from "sonner";
import { getShiftDateKey } from "@/lib/shift";
import {
  getNowInVietnam,
  formatDateTimeLocal,
  dateTimeLocalToUTC,
} from "@/lib/vietnam-time";

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
  pricePerPerson?: boolean; // If true, price is multiplied by guestCount
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

interface ShiftItem {
  _id: string;
  itemId: { _id: string; name: string; price: number; category: string };
  openingQty: number;
  receivedQty: number;
  soldQty: number;
}

interface ShiftResponse {
  dateKey: string;
  shiftCode: string;
  items: ShiftItem[];
}

interface VoucherValidationResult {
  voucher: {
    _id: string;
    code: string;
    type: string;
    value: number;
  };
  discountApplied: number;
  finalTotal: number;
}

export default function CreateBookingPage() {
  const router = useRouter();
  const { apiCall } = useApi();

  const parsePositiveIntegerInput = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;

    return Math.max(1, Math.floor(parsed));
  };

  const incrementPositiveIntegerInput = (value: string): string => {
    const current = parsePositiveIntegerInput(value) ?? 0;
    return String(current + 1);
  };

  // Current shift params (computed once on mount)
  const shiftDateKey = getShiftDateKey();
  const shiftCode: "S1" = "S1";

  // Fetch available desks
  const { data: desks, isLoading: desksLoading } = useApi<Desk[]>("/api/desks");

  // Fetch inventory items (including combos)
  const { data: inventory, isLoading: inventoryLoading } =
    useApi<InventoryItem[]>("/api/inventory");

  // Fetch current shift inventory for single items
  const { data: shiftData } = useApi<ShiftResponse>(
    `/api/shift-inventory?dateKey=${shiftDateKey}&shiftCode=${shiftCode}`,
  );

  // Map itemId → remaining qty in current shift
  const shiftQtyMap = useMemo(() => {
    const map: Record<string, number> = {};
    shiftData?.items?.forEach((it) => {
      const id = String(it.itemId?._id);
      map[id] = it.openingQty + it.receivedQty - it.soldQty;
    });
    return map;
  }, [shiftData?.items]);

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
    null,
  );

  // Guest count for per-person combos
  const [guestCountInput, setGuestCountInput] = useState<string>("");
  const [comboQuantityInput, setComboQuantityInput] = useState<string>("");

  // Duration in hours for manual bookings (used when no combo selected)
  const [durationHours, setDurationHours] = useState<number>(1);
  // Reveal time-based pricing only after user clicks create
  const [revealTimeCost, setRevealTimeCost] = useState<boolean>(false);

  const getNowPreview = () => {
    const now = getNowInVietnam();
    now.setSeconds(0, 0);
    return formatDateTimeLocal(now);
  };

  // Check-in time preview (disabled) — refresh when desk selection changes
  const [startPreview, setStartPreview] = useState<string>(getNowPreview);

  useEffect(() => {
    if (!formData.deskId) return;
    setStartPreview(getNowPreview());
  }, [formData.deskId]);

  // Search and filter state for single items
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Payment state
  const [paymentStatus, setPaymentStatus] = useState<
    "pending" | "paid" | "refunded"
  >("paid");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [voucherCode, setVoucherCode] = useState<string>("");
  const [voucherApplied, setVoucherApplied] =
    useState<VoucherValidationResult | null>(null);
  const [isValidatingVoucher, setIsValidatingVoucher] = useState(false);
  const guestCount = useMemo(
    () => parsePositiveIntegerInput(guestCountInput),
    [guestCountInput],
  );
  const comboQuantity = useMemo(
    () => parsePositiveIntegerInput(comboQuantityInput),
    [comboQuantityInput],
  );

  // Auto-update end time when combo is selected
  useEffect(() => {
    // If a combo is selected, its fixed duration defines endTime
    if (selectedCombo && selectedCombo.duration && formData.startTime) {
      const [datePart, timePart] = formData.startTime.split("T");
      const [year, month, day] = datePart.split("-").map(Number);
      const [hours, minutes] = timePart.split(":").map(Number);

      const durationMultiplier = selectedCombo.pricePerPerson
        ? 1
        : (comboQuantity ?? 0);

      if (!selectedCombo.pricePerPerson && durationMultiplier <= 0) {
        setFormData((prev) => ({ ...prev, endTime: "" }));
        return;
      }

      const startDate = new Date(year, month - 1, day, hours, minutes);
      const endDate = new Date(
        startDate.getTime() +
          selectedCombo.duration * durationMultiplier * 60 * 60 * 1000,
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
        startDate.getTime() + durationHours * 60 * 60 * 1000,
      );

      const endYear = endDate.getFullYear();
      const endMonth = String(endDate.getMonth() + 1).padStart(2, "0");
      const endDay = String(endDate.getDate()).padStart(2, "0");
      const endHours = String(endDate.getHours()).padStart(2, "0");
      const endMinutes = String(endDate.getMinutes()).padStart(2, "0");
      const endTimeString = `${endYear}-${endMonth}-${endDay}T${endHours}:${endMinutes}`;

      setFormData((prev) => ({ ...prev, endTime: endTimeString }));
    }
  }, [selectedCombo, formData.startTime, durationHours, comboQuantity]);

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
      // Combo selected: use combo price, multiply by guestCount if pricePerPerson
      const base = normalizeVndAmount(selectedCombo.price);
      return selectedCombo.pricePerPerson
        ? base * (guestCount ?? 0)
        : base * (comboQuantity ?? 0);
    }
    // Regular booking: calculate based on desk hourly rate
    if (!selectedDesk || bookingDuration <= 0) return 0;
    return Math.ceil(
      bookingDuration * normalizeVndAmount(selectedDesk.hourlyRate),
    );
  }, [selectedCombo, selectedDesk, bookingDuration, guestCount, comboQuantity]);

  // Calculate inventory/cart total (add-ons)
  const inventoryTotal = useMemo(() => {
    return cart.reduce(
      (sum, item) => sum + normalizeVndAmount(item.price) * item.quantity,
      0,
    );
  }, [cart]);

  // Booking total (desk/combo only). Orders are paid separately.
  const bookingTotal = useMemo(() => {
    return deskCost;
  }, [deskCost]);

  const voucherDiscount = useMemo(() => {
    if (!voucherApplied) return 0;
    return normalizeVndAmount(voucherApplied.discountApplied);
  }, [voucherApplied]);

  const bookingTotalAfterVoucher = useMemo(() => {
    return Math.max(0, bookingTotal - voucherDiscount);
  }, [bookingTotal, voucherDiscount]);

  // For the cart display, optionally hide the time-based desk cost until
  // the user actually creates the booking (controlled by revealTimeCost).
  const displayedDeskCost = revealTimeCost ? bookingTotalAfterVoucher : 0;
  const displayedGrandTotal = displayedDeskCost + inventoryTotal;
  const displayedBookingTotal = revealTimeCost ? bookingTotalAfterVoucher : 0;

  // Represent the desk (or selected combo) as a cart-like item so it appears
  // in the right-column cart list. Price uses displayedDeskCost so it will be
  // hidden (0) until revealTimeCost is true.
  const deskCartEntry = selectedCombo
    ? {
        id: `combo-${selectedCombo._id}`,
        name: `Gói: ${selectedCombo.name}`,
        price: selectedCombo.price,
        quantity: selectedCombo.pricePerPerson
          ? (guestCount ?? 0)
          : (comboQuantity ?? 0),
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
    setGuestCountInput("");
    setComboQuantityInput("");
    setRevealTimeCost(false);
    setVoucherApplied(null);
    toast.info("Đã xóa chọn bàn/gói");
  };

  const filteredCombos = useMemo(() => {
    if (!inventory) return [];

    return inventory.filter((item) => {
      if (item.type !== "combo") return false;
      if (item.isActive === false) return false;
      return true;
    });
  }, [inventory]);

  const filteredSingleItems = useMemo(() => {
    if (!inventory) return [];

    return inventory.filter((item) => {
      if (item.type === "combo") return false;
      if (item.isActive === false) return false;

      const shiftQty = shiftQtyMap[String(item._id)] ?? 0;
      if (shiftQty <= 0) return false;

      if (categoryFilter !== "all" && item.category !== categoryFilter) {
        return false;
      }

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
  }, [inventory, searchQuery, categoryFilter, shiftQtyMap]);

  // Handle combo selection
  const selectCombo = (combo: InventoryItem) => {
    if (selectedCombo?._id === combo._id) {
      if (combo.pricePerPerson) {
        setGuestCountInput((prev) => incrementPositiveIntegerInput(prev));
        toast.success(`Đã tăng số khách cho ${combo.name}`);
        return;
      }

      setComboQuantityInput((prev) => incrementPositiveIntegerInput(prev));
      toast.success(`Đã tăng số combo cho ${combo.name}`);
      return;
    }

    setSelectedCombo(combo);
    setGuestCountInput(combo.pricePerPerson ? "1" : "");
    setComboQuantityInput(combo.pricePerPerson ? "" : "1");
    toast.success(
      `${combo.name} đã được chọn! Thời lượng: ${combo.duration} giờ`,
    );
  };

  const resetComboSelection = () => {
    setSelectedCombo(null);
    setGuestCountInput("");
    setComboQuantityInput("");
    setRevealTimeCost(false);
    setVoucherApplied(null);
  };

  const clearVoucher = () => {
    setVoucherApplied(null);
    setVoucherCode("");
    toast.info("Đã xóa voucher");
  };

  const handleValidateVoucher = async () => {
    if (!voucherCode.trim()) {
      toast.error("Vui lòng nhập mã voucher");
      return;
    }
    if (!formData.deskId) {
      toast.error("Vui lòng chọn bàn trước khi áp voucher");
      return;
    }
    if (selectedCombo?.pricePerPerson && !guestCount) {
      toast.error("Vui lòng nhập số khách hợp lệ");
      return;
    }
    if (selectedCombo && !selectedCombo.pricePerPerson && !comboQuantity) {
      toast.error("Vui lòng nhập số combo hợp lệ");
      return;
    }

    setIsValidatingVoucher(true);
    try {
      const data = await apiCall<VoucherValidationResult>(
        "/api/vouchers/validate",
        {
          method: "POST",
          body: {
            code: voucherCode.trim().toUpperCase(),
            subtotal: bookingTotal,
            isComboBooking: Boolean(selectedCombo),
            comboId: selectedCombo?._id,
            guestCount: guestCount ?? undefined,
            comboPricePerPerson: Boolean(selectedCombo?.pricePerPerson),
          },
        },
      );

      setVoucherApplied(data);
      setVoucherCode(data.voucher.code);
      toast.success(`Áp dụng voucher ${data.voucher.code} thành công`);
    } catch (error: any) {
      setVoucherApplied(null);
      const message =
        error?.message || "Voucher không hợp lệ hoặc không áp dụng được";
      toast.error(message);
    } finally {
      setIsValidatingVoucher(false);
    }
  };

  useEffect(() => {
    // Booking amount basis changed -> require re-validate voucher to avoid stale quote
    setVoucherApplied(null);
  }, [
    bookingTotal,
    selectedCombo?._id,
    selectedCombo?.pricePerPerson,
    guestCount,
    comboQuantity,
  ]);

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
            : cartItem,
        ),
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
        item.itemId === itemId ? { ...item, quantity: newQuantity } : item,
      ),
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
    if (!formData.deskId) {
      toast.error("Vui lòng chọn bàn");
      return false;
    }
    if (selectedCombo?.pricePerPerson && !guestCount) {
      toast.error("Vui lòng nhập số khách hợp lệ");
      return false;
    }
    if (selectedCombo && !selectedCombo.pricePerPerson && !comboQuantity) {
      toast.error("Vui lòng nhập số combo hợp lệ");
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
      const now = getNowInVietnam();
      now.setSeconds(0, 0);
      const startIso = formatDateTimeLocal(now);

      let endDate = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
      if (selectedCombo && selectedCombo.duration) {
        const durationMultiplier = selectedCombo.pricePerPerson
          ? 1
          : (comboQuantity ?? 0);
        endDate = new Date(
          now.getTime() +
            selectedCombo.duration * durationMultiplier * 60 * 60 * 1000,
        );
      }
      const endIso = formatDateTimeLocal(endDate);

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
      setStartPreview(startIso);

      // Walk-in flow: payment is required before use, so mark as checked-in + paid.
      const resolvedStatus = "checked-in";
      const resolvedPaymentStatus = "paid";

      // Always create booking and redirect to billing page for payment/invoice
      const bookingData = {
        customer: {
          name: formData.customerName?.trim() || undefined,
          email: formData.customerEmail || undefined,
          phone: formData.customerPhone || undefined,
        },
        deskId: formData.deskId,
        startTime: dateTimeLocalToUTC(startIso),
        endTime: dateTimeLocalToUTC(endIso),
        status: resolvedStatus,
        totalAmount: bookingTotalAfterVoucher,
        subtotalAmount: bookingTotal,
        discountPercent: 0,
        discountAmount: voucherDiscount,
        promoCode: voucherApplied?.voucher.code || undefined,
        voucherCode: voucherApplied?.voucher.code || undefined,
        paymentStatus: resolvedPaymentStatus,
        notes: formData.notes,
        // include combo selection so server and billing know this is a combo booking
        ...(selectedCombo
          ? {
              comboId: selectedCombo._id,
              isComboBooking: true,
              ...(selectedCombo.pricePerPerson ? { guestCount } : {}),
              ...(!selectedCombo.pricePerPerson && comboQuantity
                ? { comboQuantity }
                : {}),
            }
          : {}),
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

        try {
          await apiCall("/api/orders", {
            method: "POST",
            body: orderData,
          });
        } catch (orderError) {
          // rollback booking to avoid reserved desk when order fails
          try {
            await apiCall(`/api/bookings/${bookingId}`, { method: "DELETE" });
          } catch (rollbackErr) {
            console.error("Failed to rollback booking:", rollbackErr);
          }
          throw orderError;
        }
      }

      toast.success("Đã tạo đặt bàn thành công!");

      // Redirect to billing page so user can pay and view invoice
      router.push(`/admin/billing/${bookingId}`);
    } catch (error) {
      console.error("Error creating booking:", error);
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === "string"
            ? error
            : typeof error === "object" && error
              ? // Try common error shapes
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (error as any).error ||
                (error as any).message ||
                JSON.stringify(error)
              : "Tạo bàn thất bại. Vui lòng thử lại.";
      toast.error(msg);
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:items-start">
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
                  <Label htmlFor="customerName">Họ và Tên (tùy chọn)</Label>
                  <Input
                    id="customerName"
                    placeholder="Nguyễn Văn A"
                    value={formData.customerName}
                    onChange={(e) =>
                      setFormData({ ...formData, customerName: e.target.value })
                    }
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
                        .sort((a, b) =>
                          a.label.localeCompare(b.label, undefined, {
                            numeric: true,
                            sensitivity: "base",
                          }),
                        )
                        .map((desk) => (
                          <SelectItem key={desk._id} value={desk._id}>
                            {desk.label} - {desk.location} (
                            {formatCurrency(desk.hourlyRate)}/giờ)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label>Chọn Gói Combo (tùy chọn)</Label>
                    <p className="text-sm text-gray-500 mt-1">
                      Chọn gói combo với thời lượng và giá cố định
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                    {filteredCombos.length === 0 ? (
                      <div className="col-span-2 text-center py-8 text-gray-500 border rounded-lg">
                        Không tìm thấy gói combo
                      </div>
                    ) : (
                      filteredCombos.map((combo) => (
                        <div
                          key={combo._id}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selectedCombo?._id === combo._id}
                          className={`border rounded-lg p-4 transition cursor-pointer ${
                            selectedCombo?._id === combo._id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 hover:bg-gray-50"
                          }`}
                          onClick={() => selectCombo(combo)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              selectCombo(combo);
                            }
                          }}
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

                              {combo.duration && (
                                <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                                  <Clock className="h-3 w-3" />
                                  <span>
                                    {combo.duration} giờ
                                    {combo.pricePerPerson
                                      ? " / khách"
                                      : " / gói"}
                                  </span>
                                </div>
                              )}

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
                                          if (typeof comp === "string") {
                                            return <li key={idx}>{comp}</li>;
                                          }

                                          if (typeof comp === "object") {
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

                                            const compId =
                                              typeof comp.item === "string"
                                                ? comp.item
                                                : comp.item?._id;
                                            const found = inventory?.find(
                                              (it: any) => it._id === compId,
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

                                          return <li key={idx}>{String(comp)}</li>;
                                        },
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
                            <div className="flex items-center gap-2">
                              {selectedCombo?._id === combo._id && (
                                <span className="text-sm font-medium text-gray-600">
                                  {combo.pricePerPerson
                                    ? `Khách: ${guestCount ?? 1}`
                                    : `SL: ${comboQuantity ?? 1}`}
                                </span>
                              )}
                              <span
                                className={`inline-flex items-center gap-1 rounded-md border px-3 py-1 text-xs font-semibold ${
                                  selectedCombo?._id === combo._id
                                    ? "border-blue-600 bg-blue-600 text-white"
                                    : "border-slate-300 bg-white text-slate-700"
                                }`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                {selectedCombo?._id === combo._id
                                  ? "+1 gói"
                                  : "Bấm để thêm"}
                              </span>
                            </div>
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            Có sẵn: {combo.quantity} gói
                          </p>
                        </div>
                      ))
                    )}
                  </div>
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
                              {selectedCombo.pricePerPerson
                                ? `${formatCurrency(selectedCombo.price)}/khách`
                                : formatCurrency(selectedCombo.price)}
                            </span>
                          </p>
                        </div>
                        {selectedCombo.pricePerPerson && (
                          <div className="mt-3 flex items-center gap-2">
                            <Label
                              htmlFor="guestCount"
                              className="text-sm whitespace-nowrap"
                            >
                              Số khách *
                            </Label>
                            <Input
                              id="guestCount"
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              autoComplete="off"
                              placeholder="Nhập số"
                              value={guestCountInput}
                              onChange={(e) => {
                                const nextValue = e.target.value;
                                if (nextValue === "") {
                                  setGuestCountInput("");
                                  return;
                                }

                                if (!/^\d+$/.test(nextValue)) {
                                  return;
                                }

                                const parsed =
                                  parsePositiveIntegerInput(nextValue);
                                setGuestCountInput(
                                  parsed ? String(parsed) : "",
                                );
                              }}
                              onBlur={() => {
                                if (!guestCountInput.trim()) {
                                  resetComboSelection();
                                  return;
                                }
                                const parsed =
                                  parsePositiveIntegerInput(guestCountInput);
                                setGuestCountInput(
                                  parsed ? String(parsed) : "",
                                );
                              }}
                              className="w-24"
                            />
                            <span className="text-sm text-gray-600">
                              → Tổng:{" "}
                              <strong>
                                {formatCurrency(
                                  normalizeVndAmount(selectedCombo.price) *
                                    (guestCount ?? 0),
                                )}
                              </strong>
                            </span>
                          </div>
                        )}
                        {!selectedCombo.pricePerPerson && (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <Label
                                htmlFor="comboQuantity"
                                className="text-sm whitespace-nowrap"
                              >
                                Số combo *
                              </Label>
                              <Input
                                id="comboQuantity"
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                autoComplete="off"
                                placeholder="Nhập số"
                                value={comboQuantityInput}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  if (nextValue === "") {
                                    setComboQuantityInput("");
                                    return;
                                  }

                                  if (!/^\d+$/.test(nextValue)) {
                                    return;
                                  }

                                  const parsed =
                                    parsePositiveIntegerInput(nextValue);
                                  setComboQuantityInput(
                                    parsed ? String(parsed) : "",
                                  );
                                }}
                                onBlur={() => {
                                    if (!comboQuantityInput.trim()) {
                                      resetComboSelection();
                                      return;
                                    }
                                  const parsed =
                                    parsePositiveIntegerInput(
                                      comboQuantityInput,
                                    );
                                  setComboQuantityInput(
                                    parsed ? String(parsed) : "",
                                  );
                                }}
                                className="w-24"
                              />
                              <span className="text-sm text-gray-600">
                                → Tổng:{" "}
                                <strong>
                                  {formatCurrency(
                                    normalizeVndAmount(selectedCombo.price) *
                                      (comboQuantity ?? 0),
                                  )}
                                </strong>
                              </span>
                            </div>
                            <p className="text-sm text-blue-700">
                              Tổng thời gian:{" "}
                              <strong>
                                {(selectedCombo.duration || 0) *
                                  (comboQuantity ?? 0)}{" "}
                                giờ
                              </strong>
                            </p>
                          </div>
                        )}
                        <p className="mt-3 text-xs text-gray-600">
                          Bấm lại vào gói ở trên để tăng nhanh số lượng, hoặc sửa
                          trực tiếp trong ô nhập.
                        </p>
                      </div>
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

            {/* Inventory Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Thêm Món
                </CardTitle>
                <CardDescription>
                  Thêm đồ ăn, đồ uống hoặc văn phòng phẩm
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search and Filter */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Tìm món..."
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
                    </SelectContent>
                  </Select>
                </div>

                {/* Inventory Items Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {filteredSingleItems.length === 0 ? (
                    <div className="col-span-2 text-center py-8 text-gray-500">
                      Không tìm thấy món nào
                    </div>
                  ) : (
                    filteredSingleItems.map((item) => (
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
                              item.category,
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
                            disabled={(shiftQtyMap[item._id] ?? 0) <= 0}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Thêm
                          </Button>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Tồn kho ca: {shiftQtyMap[item._id] ?? 0} {item.unit}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Cart & Payment */}
          <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
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
                                    durationHours,
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
                              deskCartEntry.price * deskCartEntry.quantity,
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
                                  item.quantity - 1,
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
                                  item.quantity + 1,
                                )
                              }
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                          <span className="font-bold">
                            {formatCurrency(
                              normalizeVndAmount(item.price) * item.quantity,
                            )}
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
                <div className="space-y-2 rounded-lg border p-3">
                  <Label className="text-sm flex items-center gap-2">
                    <Ticket className="h-4 w-4" />
                    Voucher
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nhập mã voucher"
                      value={voucherCode}
                      onChange={(e) =>
                        setVoucherCode(e.target.value.toUpperCase())
                      }
                      className="uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleValidateVoucher}
                      disabled={isValidatingVoucher || !voucherCode.trim()}
                    >
                      {isValidatingVoucher ? "Đang kiểm tra..." : "Áp dụng"}
                    </Button>
                  </div>

                  {voucherApplied && (
                    <div className="rounded-md bg-green-50 border border-green-200 p-2 text-sm">
                      <p className="font-medium text-green-700">
                        Đã áp dụng: {voucherApplied.voucher.code}
                      </p>
                      <p className="text-green-700">
                        Giảm: {formatCurrency(voucherDiscount)}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-7 px-2 text-red-600"
                        onClick={clearVoucher}
                      >
                        Bỏ voucher
                      </Button>
                    </div>
                  )}
                </div>

                {/* Breakdown */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Thuê Bàn</span>
                    <span className="font-medium">
                      {formatCurrency(deskCost)}
                    </span>
                  </div>
                  {voucherDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Voucher</span>
                      <span className="font-medium">
                        -{formatCurrency(voucherDiscount)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Món ({cart.length})</span>
                    <span className="font-medium">
                      {formatCurrency(inventoryTotal)}
                    </span>
                  </div>

                  <Separator />

                  <button
                    type="submit"
                    className="cursor-pointer w-full flex justify-between items-center bg-gradient-to-r from-slate-900 to-slate-700 text-white p-4 rounded-lg shadow-md hover:from-slate-800 hover:to-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isSubmitting || displayedGrandTotal === 0}
                  >
                    <span className="text-lg font-semibold">
                      {isSubmitting ? "Đang tạo đặt bàn..." : "Tổng thanh toán"}
                    </span>
                    <span className="text-2xl font-bold">
                      {formatCurrency(displayedGrandTotal)}
                    </span>
                  </button>
                </div>

                {/* Info */}
                <p className="text-xs text-gray-500 text-center">
                  Thanh toán sẽ được đánh dấu hoàn thành trước khi sử dụng
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </form>
    </div>
  );
}
