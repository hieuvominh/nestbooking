"use client";

import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { BluetoothPrintButton } from "@/components/BluetoothPrintButton";

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
  items: {
    itemId: {
      _id: string;
      name: string;
      price: number;
    };
    name: string;
    price: number;
    quantity: number;
    subtotal: number;
  }[];
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

export default function OrdersPage() {
  const { user } = useAuth();
  const { data: ordersResponse, mutate: mutateOrders } = useApi<OrdersResponse>(
    "/api/orders",
    {
      refreshInterval: 20000, // Poll orders frequently for kitchen updates
    },
  );
  const { apiCall } = useApi();

  const handleCompleteOrder = async (orderId: string): Promise<boolean> => {
    try {
      await apiCall(`/api/orders/${orderId}`, {
        method: "PUT",
        body: { status: "delivered" },
      });
      mutateOrders();
      toast.success("Đã hoàn thành đơn hàng!");
      return true;
    } catch (error: any) {
      const msg =
        error?.message || "Không thể hoàn thành đơn — kiểm tra kho ca";
      toast.error(msg);
      return false;
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await apiCall(`/api/orders/${orderId}`, {
        method: "PUT",
        body: { status: newStatus },
      });
      mutateOrders();
      if (newStatus === "delivered") {
        toast.success("Đã giao đơn hàng");
      } else if (newStatus === "cancelled") {
        toast.info("Đã hủy đơn hàng");
      }
    } catch (error: any) {
      const msg =
        error?.message ||
        error?.data?.message ||
        "Cập nhật trạng thái thất bại";
      toast.error(msg);
      mutateOrders(); // Reset dropdown to current status
    }
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
      case "confirmed":
      case "preparing":
      case "ready":
        return "Đang chờ";
      case "delivered":
        return "Đã giao";
      case "cancelled":
        return "Đã hủy";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý đơn hàng</h1>
          <p className="text-gray-600">
            Theo dõi và quản lý đơn hàng của khách
          </p>
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Đơn hàng đang hoạt động ({ordersResponse?.orders?.length || 0})
          </CardTitle>
          <CardDescription>
            Quản lý trạng thái và thực hiện đơn hàng
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Khách hàng</TableHead>
                <TableHead>Mặt hàng</TableHead>
                <TableHead>Tổng</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Đặt lúc</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersResponse?.orders?.map((order) => (
                <TableRow key={order._id}>
                  <TableCell className="font-mono text-sm">
                    {order._id.slice(-8)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {order.bookingId &&
                      typeof order.bookingId === "object" &&
                      order.bookingId.customer
                        ? order.bookingId.customer.name
                        : "—"}
                    </div>
                    <div className="text-sm text-gray-500">
                      {order.bookingId &&
                      typeof order.bookingId === "object" &&
                      order.bookingId.customer
                        ? order.bookingId.customer.email
                        : "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {order.items.map((item, index) => (
                        <div key={index} className="text-sm">
                          {item.quantity}x {item.name}
                        </div>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(order.total)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        order.status,
                      )}`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </TableCell>
                  <TableCell>{formatDateTime(order.orderedAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {order.status !== "delivered" &&
                        order.status !== "cancelled" && (
                          <BluetoothPrintButton
                            label="Hoàn thành"
                            onBeforePrint={() => handleCompleteOrder(order._id)}
                            receiptData={{
                              storeName: "Nest Study Space",
                              invoiceNumber: order._id.slice(-6).toUpperCase(),
                              orderCode: `#${order._id.slice(-5).toUpperCase()}`,
                              cashier: user?.name || "Nhân viên",
                              table:
                                order.bookingId &&
                                typeof order.bookingId === "object"
                                  ? `Khách: ${order.bookingId.customer?.name || "—"}`
                                  : "—",
                              date: new Date(
                                order.orderedAt,
                              ).toLocaleDateString("vi-VN"),
                              timeIn: new Date(
                                order.orderedAt,
                              ).toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }),
                              timeOut: new Date().toLocaleTimeString("vi-VN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              }),
                              items: order.items.map((item) => ({
                                name: item.name,
                                qty: String(item.quantity),
                                price:
                                  Number(item.subtotal).toLocaleString(
                                    "vi-VN",
                                  ) + "đ",
                              })),
                              subtotal:
                                Number(order.total).toLocaleString("vi-VN") +
                                "đ",
                              total:
                                Number(order.total).toLocaleString("vi-VN") +
                                "đ",
                              footerNote: "Phiếu giao hàng",
                              logoUrl: "/bill-logo.png",
                              logoWidth: 320,
                            }}
                          />
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!ordersResponse?.orders ||
            (ordersResponse.orders.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Không tìm thấy đơn hàng.
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
