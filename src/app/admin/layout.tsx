"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Calendar,
  ShoppingCart,
  CreditCard,
  Settings,
  Users,
  Monitor,
  Package,
  LogOut,
  Building2,
} from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  useEffect(() => {
    if (!isLoading && !user && pathname !== "/admin/login") {
      router.push("/admin/login");
    }
  }, [user, isLoading, router, pathname]);

  useEffect(() => {
    // Auto-expand settings if we're on a settings page
    if (
      pathname === "/admin/settings/desks" ||
      pathname === "/admin/settings/inventory"
    ) {
      setSettingsExpanded(true);
    }
  }, [pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Đang tải...</div>
      </div>
    );
  }

  if (!user && pathname !== "/admin/login") {
    return null;
  }

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  const navigation = [
    {
      name: "Bảng điều khiển",
      href: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    { name: "Đặt chỗ", href: "/admin/bookings", icon: Calendar },
    { name: "Đơn hàng", href: "/admin/orders", icon: ShoppingCart },
    { name: "Giao dịch", href: "/admin/transactions", icon: CreditCard },
  ];

  const settingsNavigation = [
    { name: "Bàn", href: "/admin/settings/desks", icon: Monitor },
    { name: "Kho hàng", href: "/admin/settings/inventory", icon: Package },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg border-r border-slate-200/50 flex flex-col h-screen fixed left-0 top-0">
        {/* Logo Section */}
        <div className="flex items-center h-16 px-6 border-b border-slate-200/50 bg-gradient-to-r from-blue-600 to-blue-700 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <Building2 className="h-8 w-8 text-white" />
            <h1 className="text-xl font-bold text-white">BookingCoo</h1>
          </div>
        </div>

        {/* Navigation - flex-1 to take up available space */}
        <nav className="flex-1 mt-8 px-4 overflow-y-auto">
          <div className="space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                    isActive
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/25"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm"
                  }`}
                >
                  <Icon
                    className={`mr-3 h-5 w-5 ${
                      isActive
                        ? "text-white"
                        : "text-slate-500 group-hover:text-slate-700"
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}

            {/* Settings Section */}
            <div className="pt-6">
              <div className="pb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-3">
                  Cài đặt
                </span>
              </div>
              <button
                onClick={() => setSettingsExpanded(!settingsExpanded)}
                className={`group flex items-center justify-between w-full px-3 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                  pathname.startsWith("/admin/settings/")
                    ? "bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-md shadow-slate-500/25"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 hover:shadow-sm"
                }`}
              >
                <div className="flex items-center">
                  <Settings
                    className={`mr-3 h-5 w-5 ${
                      pathname.startsWith("/admin/settings/")
                        ? "text-white"
                        : "text-slate-500 group-hover:text-slate-700"
                    }`}
                  />
                  <span>Cài đặt</span>
                </div>
                {settingsExpanded ? (
                  <ChevronDown
                    className={`h-4 w-4 transition-transform duration-200 ${
                      pathname.startsWith("/admin/settings/")
                        ? "text-white"
                        : "text-slate-500"
                    }`}
                  />
                ) : (
                  <ChevronRight
                    className={`h-4 w-4 transition-transform duration-200 ${
                      pathname.startsWith("/admin/settings/")
                        ? "text-white"
                        : "text-slate-500"
                    }`}
                  />
                )}
              </button>

              {settingsExpanded && (
                <div className="mt-2 space-y-1 animate-in slide-in-from-top-1 duration-200">
                  {settingsNavigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`group flex items-center pl-6 pr-3 py-2.5 text-sm rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-blue-50 text-blue-700 border-r-2 border-blue-500"
                            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <Icon
                          className={`mr-3 h-4 w-4 ${
                            isActive
                              ? "text-blue-600"
                              : "text-slate-400 group-hover:text-slate-600"
                          }`}
                        />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* User section at bottom - flex-shrink-0 to prevent shrinking */}
        <div className="flex-shrink-0 p-4 border-t border-slate-200/50 bg-gradient-to-r from-slate-50 to-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-slate-800">
                  {user?.name}
                </span>
                <span className="text-xs text-slate-500 capitalize">
                  {user?.role}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main content - add margin-left to account for fixed sidebar */}
      <div className="flex-1 ml-64 overflow-auto">
        <main className="p-8">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
