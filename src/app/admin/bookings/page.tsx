"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApi } from "@/hooks/useApi";
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
    if (!confirm("Are you sure you want to delete this booking?")) return;

    try {
      await apiCall(`/api/bookings/${id}`, { method: "DELETE" });
      mutateBookings();
    } catch (error) {
      console.error("Error deleting booking:", error);
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
      alert("Public URL copied to clipboard!");
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
        <h1 className="text-3xl font-bold">Bookings Management</h1>
        <Button onClick={() => router.push("/admin/bookings/create")}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Booking
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Bookings</CardTitle>
          <CardDescription>
            Manage customer bookings and check-ins
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Desk</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Actions</TableHead>
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
                      {booking.status}
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
                        Check In
                      </Button>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      ${booking.totalAmount?.toFixed(2) || "0.00"}
                      <div className="text-xs text-gray-500">
                        {booking.paymentStatus}
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
                        Edit
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
                            Generate URL
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
                            alert("Public URL copied to clipboard!");
                          }}
                        >
                          Copy URL
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
                        Billing
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(booking._id);
                        }}
                        className="text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {(!bookings || bookings.length === 0) && (
            <div className="text-center py-8 text-gray-500">
              No bookings found. Create your first booking to get started.
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
