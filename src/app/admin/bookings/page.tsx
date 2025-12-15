"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
import { formatCurrency } from "@/lib/currency";
import { Button } from "@/components/ui/button";
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
import { Plus } from "lucide-react";
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

  const { data: bookingsResponse, mutate: mutateBookings } =
    useApi<BookingsResponse>("/api/bookings", {
      refreshInterval: 10000, // Poll every 10 seconds
    });
  const bookings = bookingsResponse?.bookings;
  const { data: desks } = useApi<Desk[]>("/api/desks", {
    refreshInterval: 10000, // Poll every 10 seconds
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Bàn</TableHead>
                <TableHead>Thời gian bắt đầu</TableHead>
                <TableHead>Thời gian kết thúc</TableHead>
                <TableHead>Trạng thái</TableHead>
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
                  <TableCell>Desk {booking.deskNumber}</TableCell>
                  <TableCell>{formatDateTime(booking.startTime)}</TableCell>
                  <TableCell>{formatDateTime(booking.endTime)}</TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
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
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(booking);
                        }}
                      >
                        Sửa
                      </Button>
                      {!booking.publicToken &&
                        booking.status === "confirmed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              generatePublicUrl(booking._id);
                            }}
                          >
                            Tạo URL
                          </Button>
                        )}
                      {booking.publicToken && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(
                              `${window.location.origin}/p/${booking._id}`
                            );
                            alert("Đã sao chép URL công khai vào clipboard!");
                          }}
                        >
                          Sao chép URL
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/billing/${booking._id}`);
                        }}
                        className="bg-green-50 text-green-600 hover:bg-green-100"
                      >
                        Thanh toán
                      </Button>
                      {booking.status !== "cancelled" &&
                        booking.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(booking._id);
                            }}
                            className="text-red-600 hover:bg-red-50"
                          >
                            Xóa
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
