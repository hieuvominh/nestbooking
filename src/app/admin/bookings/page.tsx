"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Plus, Edit, Link, Copy, DollarSign, Trash2 } from "lucide-react";
import { BookingEditModal } from "@/components/modals";

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
  publicToken?: string;
  notes?: string;
  checkedInAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface BookingsResponse {
  bookings: Booking[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface Desk {
  _id: string;
  label: string;
  status: string;
}

export default function BookingsPage() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState<string>(""); // yyyy-mm-dd
  const [endDate, setEndDate] = useState<string>("");
  const [onlyToday, setOnlyToday] = useState<boolean>(false);

  const bookingsUrl = useMemo(() => {
    const base = "/api/bookings";
    const params = new URLSearchParams();

    if (onlyToday) {
      const today = new Date().toISOString().slice(0, 10);
      params.set("startDate", `${today}T00:00:00`);
      params.set("endDate", `${today}T23:59:59`);
    } else if (startDate && endDate) {
      params.set("startDate", `${startDate}T00:00:00`);
      params.set("endDate", `${endDate}T23:59:59`);
    }

    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }, [startDate, endDate, onlyToday]);

  const { data: bookingsResponse, mutate: mutateBookings } =
    useApi<BookingsResponse>(bookingsUrl, {
      refreshInterval: 300000, // Poll every 5 minutes
    });
  const bookings = bookingsResponse?.bookings;
  const { data: desks } = useApi<Desk[]>("/api/desks", {
    refreshInterval: 300000, // Poll every 5 minutes
  });
  const { apiCall } = useApi();

  const handleSaveBooking = async () => {
    // This function is now handled inside the modal
    // Just refresh the bookings list
    mutateBookings();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa đặt chỗ này không?")) return;

    try {
      await apiCall(`/api/bookings/${id}`, { method: "DELETE" });
      mutateBookings();
    } catch (error) {
      console.error("Error deleting booking:", error);
      // Show a user-friendly message with the API error if available
      const message = error instanceof Error ? error.message : String(error);
      alert(`Không thể xóa đặt chỗ: ${message}`);
    }
  };

  const handleCheckIn = async (id: string) => {
    try {
      await apiCall(`/api/bookings/${id}/checkin`, { method: "POST" });
      mutateBookings();
    } catch (error) {
      console.error("Error checking in:", error);
    }
  };

  const generatePublicUrl = async (id: string) => {
    try {
      const response = await apiCall<{ url: string }>(
        `/api/bookings/${id}/public-url`,
        {
          method: "POST",
        }
      );
      navigator.clipboard.writeText(response.url);
      alert("Đã sao chép URL công khai vào clipboard!");
      mutateBookings();
    } catch (error) {
      console.error("Error generating public URL:", error);
    }
  };

  const handleEdit = (booking: Booking) => {
    setEditingBooking(booking);
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setEditingBooking(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBooking(null);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const translateStatus = (status: string) => {
    switch (status) {
      case "pending":
        return "đang chờ";
      case "confirmed":
        return "đã xác nhận";
      case "checked-in":
        return "đã check-in";
      case "completed":
        return "đã hoàn thành";
      case "cancelled":
        return "đã hủy";
      default:
        return status;
    }
  };

  const translatePaymentStatus = (status: string) => {
    switch (status) {
      case "pending":
        return "chưa thanh toán";
      case "paid":
        return "đã thanh toán";
      case "refunded":
        return "đã hoàn tiền";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-600 bg-yellow-100";
      case "confirmed":
        return "text-blue-600 bg-blue-100";
      case "checked-in":
        return "text-green-600 bg-green-100";
      case "completed":
        return "text-gray-600 bg-gray-100";
      case "cancelled":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Quản lý đặt chỗ</h1>
        <Button onClick={() => router.push("/admin/bookings/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Tạo đặt chỗ mới
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tất cả đặt chỗ</CardTitle>
          <CardDescription>
            Quản lý đặt chỗ khách hàng và check-in
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-end sm:gap-4 gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Label htmlFor="startDate" className="text-sm">
                Từ ngày
              </Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="endDate" className="text-sm">
                Đến ngày
              </Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="onlyToday"
                checked={onlyToday}
                onCheckedChange={(c) => {
                  const checked = c === true;
                  setOnlyToday(checked);
                  if (checked) {
                    const today = new Date().toISOString().slice(0, 10);
                    setStartDate(today);
                    setEndDate(today);
                  }
                }}
              />
              <Label htmlFor="onlyToday" className="text-sm cursor-pointer">
                Chỉ hôm nay
              </Label>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setOnlyToday(false);
                }}
              >
                Clear
              </Button>
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Thời gian bắt đầu</TableHead>
                <TableHead>Thời gian kết thúc</TableHead>
                <TableHead className="min-w-[150px]">Trạng thái</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Thanh toán</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings?.map((booking) => (
                <TableRow
                  key={booking._id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/admin/bookings/${booking._id}`)}
                >
                  <TableCell>
                    <div>
                      <div className="font-medium">{booking.customer.name}</div>
                      <div className="text-sm text-gray-500">
                        {booking.customer.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{formatDateTime(booking.startTime)}</TableCell>
                  <TableCell>{formatDateTime(booking.endTime)}</TableCell>
                  <TableCell className="min-w-[150px]">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(
                        booking.status
                      )}`}
                    >
                      {translateStatus(booking.status)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {booking.checkedInAt ? (
                      <span className="text-sm text-green-600">
                        {formatDateTime(booking.checkedInAt)}
                      </span>
                    ) : booking.status === "confirmed" ? (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCheckIn(booking._id);
                        }}
                      >
                        Check-in
                      </Button>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {formatCurrency(booking.totalAmount ?? 0)}
                      <div className="text-xs text-gray-500">
                        {translatePaymentStatus(booking.paymentStatus)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Sửa"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(booking);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>

                      {!booking.publicToken &&
                        booking.status === "confirmed" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Tạo URL công khai"
                            onClick={(e) => {
                              e.stopPropagation();
                              generatePublicUrl(booking._id);
                            }}
                          >
                            <Link className="h-4 w-4" />
                          </Button>
                        )}

                      {booking.publicToken && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Sao chép URL công khai"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(
                              `${window.location.origin}/p/${booking._id}`
                            );
                            alert("Đã sao chép URL công khai vào clipboard!");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        size="icon"
                        variant="ghost"
                        title="Thanh toán"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/billing/${booking._id}`);
                        }}
                        className="text-green-600"
                      >
                        <DollarSign className="h-4 w-4" />
                      </Button>

                      {booking.status !== "cancelled" &&
                        booking.status !== "completed" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Xóa"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(booking._id);
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {(!bookings || bookings.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              Không tìm thấy đặt chỗ. Tạo đặt chỗ đầu tiên để bắt đầu.
            </div>
          )}
        </CardContent>
      </Card>

      <BookingEditModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        booking={editingBooking}
        onSave={handleSaveBooking}
        onSuccess={() => {
          mutateBookings();
          setIsModalOpen(false);
          setEditingBooking(null);
        }}
        isLoading={isLoading}
      />
    </div>
  );
}
