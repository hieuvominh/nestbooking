"use client";

import { useApi } from "@/hooks/useApi";
import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RefreshIndicator } from "@/components/ui/refresh-indicator";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";

function playNewOrderSound() {
  try {
    const audio = new Audio("/notification.mp3");
    audio.volume = 1.0;
    const promise = audio.play();
    if (promise !== undefined) {
      promise.catch((err) => {
        console.warn("[Sound] Autoplay blocked:", err);
      });
    }
  } catch (err) {
    console.warn("[Sound] Error:", err);
  }
}

interface DashboardStats {
  totalDesks: number;
  availableDesks: number;
  todayBookings: number;
  activeBookings: number;
  lowStockItems: number;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const ordersRef = useRef<any>(null);
  const [soundEnabled, setSoundEnabled] = useState(
    () =>
      typeof window !== "undefined" &&
      localStorage.getItem("dashboardSoundEnabled") === "true",
  );

  const enableSound = () => {
    playNewOrderSound();
    setSoundEnabled(true);
    localStorage.setItem("dashboardSoundEnabled", "true");
  };

  const { data: desks, isLoading: desksLoading } = useApi<any[]>("/api/desks", {
    refreshInterval: 20000,
  });
  const { data: bookings, isLoading: bookingsLoading } = useApi<any>(
    "/api/bookings?limit=100",
    {
      refreshInterval: 20000,
    },
  );
  const { data: inventory, isLoading: inventoryLoading } = useApi<any[]>(
    "/api/inventory?lowStock=true",
    {
      refreshInterval: 20000,
    },
  );
  const { data: orders, isLoading: ordersLoading } = useApi<any>(
    "/api/orders?limit=20",
    {
      refreshInterval: 20000,
    },
  );

  // Keep ref in sync with latest orders data
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);

  // Independent interval — check every 10s regardless of SWR dedup
  useEffect(() => {
    // Skip first tick so we don't beep on page load
    if (!soundEnabled) return;
    let firstTick = true;
    const interval = setInterval(() => {
      if (firstTick) {
        firstTick = false;
        return;
      }
      // Only play sound if there are pending orders
      const currentOrders = ordersRef.current;
      const pendingOrders = currentOrders?.orders?.filter(
        (o: any) => o.status === "pending",
      );
      if (pendingOrders && pendingOrders.length > 0) {
        playNewOrderSound();
      }
    }, 20000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  const nowMs = Date.now();
  const bookingList = bookings?.bookings || [];

  const activeNowBookings = bookingList.filter((booking: any) => {
    if (booking.status === "completed" || booking.status === "cancelled") {
      return false;
    }

    const startMs = new Date(booking.startTime).getTime();
    const endMs = new Date(booking.endTime).getTime();
    const hasValidTime = Number.isFinite(startMs) && Number.isFinite(endMs);
    const inBookingWindow = hasValidTime
      ? startMs <= nowMs && endMs >= nowMs
      : true;

    return (
      booking.status === "checked-in" ||
      (booking.status === "confirmed" && inBookingWindow)
    );
  });

  const occupiedDeskIds = new Set(
    activeNowBookings
      .map((booking: any) => {
        const desk = booking.deskId;
        if (!desk) return null;
        if (typeof desk === "string") return desk;
        if (desk._id) return String(desk._id);
        if (desk.id) return String(desk.id);
        return null;
      })
      .filter(Boolean),
  );

  const stats: DashboardStats = {
    totalDesks: desks?.length || 0,
    availableDesks: Math.max((desks?.length || 0) - occupiedDeskIds.size, 0),
    todayBookings: bookingList.filter((booking: any) => {
      if (booking.status === "cancelled") return false;
      const today = new Date().toDateString();
      return new Date(booking.startTime).toDateString() === today;
    }).length,
    activeBookings: activeNowBookings.length,
    lowStockItems: inventory?.length || 0,
  };

  if (desksLoading || bookingsLoading || inventoryLoading || ordersLoading) {
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
          <div className="flex items-center gap-3">
            {!soundEnabled ? (
              <button
                onClick={enableSound}
                className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold shadow transition-colors animate-pulse"
              >
                🔔 Bật thông báo âm thanh
              </button>
            ) : (
              <span className="text-xs text-green-600 font-medium">
                🔔 Âm thanh bật
              </span>
            )}
            <RefreshIndicator
              isLoading={desksLoading || bookingsLoading || inventoryLoading}
              refreshInterval={20000}
            />
            <span className="text-[11px] text-green-600 font-medium whitespace-nowrap">
              ● Trực tuyến
            </span>
          </div>
        </div>
        <p className="text-gray-600">
          Chào mừng {user?.name || user?.email || "bạn"} đến với bảng quản trị
          Nest Study Space
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                      100,
                  )
                : 0}
              %
            </div>
            <p className="text-xs text-muted-foreground">Đang được sử dụng</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Đặt chỗ gần đây</CardTitle>
            <CardDescription>Hoạt động đặt chỗ mới nhất</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {bookings?.bookings
                ?.filter(
                  (booking: any) =>
                    booking.status !== "completed" &&
                    booking.status !== "cancelled",
                )
                .slice(0, 5)
                .map((booking: any) => {
                  const nowMs = Date.now();
                  const endMs = new Date(booking.endTime).getTime();
                  const remainingMinutes = Math.ceil(
                    (endMs - nowMs) / (1000 * 60),
                  );
                  const isActiveBooking =
                    booking.status === "checked-in" ||
                    booking.status === "confirmed";
                  const isEndingSoon =
                    isActiveBooking &&
                    remainingMinutes > 0 &&
                    remainingMinutes <= 10;
                  const isVerySoon =
                    isActiveBooking &&
                    remainingMinutes > 0 &&
                    remainingMinutes <= 5;

                  return (
                    <div
                      key={booking._id}
                      className={`flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg ${
                        isEndingSoon
                          ? isVerySoon
                            ? "ring-2 ring-red-300 animate-pulse"
                            : "ring-1 ring-amber-300 animate-pulse"
                          : ""
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {booking.customer.name}
                        </p>
                        <p className="text-sm text-gray-600 truncate">
                          Bàn {booking.deskId?.label} •{" "}
                          {new Date(booking.startTime).toLocaleDateString()} •{" "}
                          {new Date(booking.endTime).toLocaleTimeString(
                            "vi-VN",
                            {
                              hour: "2-digit",
                              minute: "2-digit",
                            },
                          )}{" "}
                          kết thúc
                        </p>
                        {isEndingSoon && (
                          <p
                            className={`text-xs mt-1 font-semibold animate-pulse ${
                              isVerySoon ? "text-red-600" : "text-amber-600"
                            }`}
                          >
                            ⏰ Còn {remainingMinutes} phút • sắp hết giờ
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-medium whitespace-nowrap">
                          {formatCurrency(booking.totalAmount)}
                        </p>
                        <span
                          className={`text-xs px-2 py-1 rounded-full whitespace-nowrap inline-block mt-1 ${
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
                        </span>
                      </div>
                    </div>
                  );
                }) || (
                <p className="text-gray-500">Không có đặt chỗ đang hoạt động</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Đơn hàng gần đây</CardTitle>
            <CardDescription>Món đã gọi mới nhất</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orders?.orders
                ?.filter(
                  (order: any) =>
                    order.status !== "delivered" &&
                    order.status !== "cancelled",
                )
                .slice(0, 5)
                .map((order: any) => {
                  const normalizedStatus =
                    order.status === "delivered" || order.status === "cancelled"
                      ? order.status
                      : "pending";

                  const statusLabel = "đang chờ";

                  const statusClass = "bg-yellow-100 text-yellow-800";

                  return (
                    <div
                      key={order._id}
                      onClick={() => {
                        if (order._id) {
                          window.location.href = `/admin/orders?open=${order._id}`;
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          if (order._id) {
                            window.location.href = `/admin/orders?open=${order._id}`;
                          }
                        }
                      }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    >
                      <div>
                        <p className="font-medium">
                          {order.bookingId?.customer?.name || "Khách"}
                        </p>
                        <p className="text-sm text-gray-600">
                          Bàn {order.bookingId?.deskId?.label || "—"} •{" "}
                          {order.items?.length || 0} món
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">
                          {formatCurrency(order.total || 0)}
                        </p>
                        <p
                          className={`text-sm px-2 py-1 rounded-full ${statusClass}`}
                        >
                          {statusLabel}
                        </p>
                      </div>
                    </div>
                  );
                }) || (
                <p className="text-gray-500">Chưa có đơn hàng đang xử lý</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Các mặt hàng sắp hết ở kho tổng</CardTitle>
            <CardDescription>Các mặt hàng cần bổ sung</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {inventory
                ?.filter(
                  (item: any) =>
                    item?.type !== "combo" && item?.category !== "combo",
                )
                .map((item: any) => (
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
