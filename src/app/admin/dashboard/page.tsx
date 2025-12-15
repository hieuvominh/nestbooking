"use client";

import { useApi } from "@/hooks/useApi";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RefreshIndicator } from "@/components/ui/refresh-indicator";
import { formatCurrency } from "@/lib/currency";

interface DashboardStats {
  totalDesks: number;
  availableDesks: number;
  todayBookings: number;
  activeBookings: number;
  todayRevenue: number;
  lowStockItems: number;
}

export default function DashboardPage() {
  const { data: desks, isLoading: desksLoading } = useApi<any[]>("/api/desks", {
    refreshInterval: 10000, // Poll every 10 seconds
  });
  const { data: bookings, isLoading: bookingsLoading } = useApi<any>(
    "/api/bookings?limit=100",
    {
      refreshInterval: 10000, // Poll every 10 seconds
    }
  );
  const { data: inventory, isLoading: inventoryLoading } = useApi<any[]>(
    "/api/inventory?lowStock=true",
    {
      refreshInterval: 10000, // Poll every 10 seconds
    }
  );

  const stats: DashboardStats = {
    totalDesks: desks?.length || 0,
    availableDesks:
      desks?.filter((desk) => desk.status === "available").length || 0,
    todayBookings:
      bookings?.bookings?.filter((booking: any) => {
        const today = new Date().toDateString();
        return new Date(booking.startTime).toDateString() === today;
      }).length || 0,
    activeBookings:
      bookings?.bookings?.filter(
        (booking: any) => booking.status === "checked-in"
      ).length || 0,
    todayRevenue:
      bookings?.bookings
        ?.filter((booking: any) => {
          const today = new Date().toDateString();
          return new Date(booking.startTime).toDateString() === today;
        })
        .reduce((sum: number, booking: any) => sum + booking.totalAmount, 0) ||
      0,
    lowStockItems: inventory?.length || 0,
  };

  if (desksLoading || bookingsLoading || inventoryLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Đang tải bảng điều khiển...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Bảng điều khiển</h1>
          <RefreshIndicator
            isLoading={desksLoading || bookingsLoading || inventoryLoading}
            refreshInterval={10000}
          />
        </div>
        <p className="text-gray-600">
          Chào mừng đến với bảng quản trị BookingCoo
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tổng số bàn</CardTitle>
            <div className="h-4 w-4 text-muted-foreground">🪑</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalDesks}</div>
            <p className="text-xs text-muted-foreground">
              {stats.availableDesks} còn trống
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Đặt chỗ hôm nay
            </CardTitle>
            <div className="h-4 w-4 text-muted-foreground">📅</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todayBookings}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeBookings} đang hoạt động
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Doanh thu hôm nay
            </CardTitle>
            <div className="h-4 w-4 text-muted-foreground">💰</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.todayRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">Từ các đặt chỗ bàn</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Mặt hàng sắp hết
            </CardTitle>
            <div className="h-4 w-4 text-muted-foreground">⚠️</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.lowStockItems}</div>
            <p className="text-xs text-muted-foreground">Cần bổ sung hàng</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tỷ lệ sử dụng bàn
            </CardTitle>
            <div className="h-4 w-4 text-muted-foreground">📊</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalDesks > 0
                ? Math.round(
                    ((stats.totalDesks - stats.availableDesks) /
                      stats.totalDesks) *
                      100
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">Đang được sử dụng</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Trạng thái</CardTitle>
            <div className="h-4 w-4 text-muted-foreground">✅</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">Trực tuyến</div>
            <p className="text-xs text-muted-foreground">
              Tất cả hệ thống hoạt động bình thường
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Đặt chỗ gần đây</CardTitle>
            <CardDescription>Hoạt động đặt chỗ mới nhất</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bookings?.bookings?.slice(0, 5).map((booking: any) => (
                <div
                  key={booking._id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{booking.customer.name}</p>
                    <p className="text-sm text-gray-600">
                      Bàn {booking.deskId?.label} •{" "}
                      {new Date(booking.startTime).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(booking.totalAmount)}
                    </p>
                    <p
                      className={`text-sm px-2 py-1 rounded-full ${
                        booking.status === "confirmed"
                          ? "bg-blue-100 text-blue-800"
                          : booking.status === "checked-in"
                          ? "bg-green-100 text-green-800"
                          : booking.status === "completed"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {booking.status === "confirmed"
                        ? "đã xác nhận"
                        : booking.status === "checked-in"
                        ? "đã check-in"
                        : booking.status === "completed"
                        ? "đã hoàn thành"
                        : "đang xử lý"}
                    </p>
                  </div>
                </div>
              )) || <p className="text-gray-500">No recent bookings</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cảnh báo hàng sắp hết</CardTitle>
            <CardDescription>Các mặt hàng cần bổ sung</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inventory?.map((item: any) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{item.name}</p>
                    <p className="text-sm text-gray-600">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-red-600">
                      {item.quantity} {item.unit}
                    </p>
                    <p className="text-sm text-gray-600">
                      Min: {item.lowStockThreshold}
                    </p>
                  </div>
                </div>
              )) || (
                <p className="text-gray-500">Tất cả mặt hàng đều đủ tồn kho</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
