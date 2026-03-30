"use client";

import { useEffect, useState, useMemo } from "react";
import { useApi } from "@/hooks/useApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  ChevronDown,
  ChevronRight,
  X,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

interface RefData {
  // Order fields
  items?: OrderItem[];
  total?: number;
  status?: string;
  notes?: string;
  // Booking fields
  customer?: { name: string; phone?: string; email?: string };
  startTime?: string;
  endTime?: string;
  totalAmount?: number;
  // InventoryItem fields
  name?: string;
  unit?: string;
  category?: string;
  description?: string;
}

interface Transaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  source: string;
  description: string;
  category?: string;
  date: string;
  createdBy?: { name: string };
  referenceId?: RefData | null;
  referenceModel?: "Booking" | "Order" | "InventoryItem";
}

interface DayStats {
  date: string;
  income: number;
  expense: number;
  net: number;
  count: number;
  bySource: Record<string, { income: number; expense: number }>;
  transactions: Transaction[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<string, string> = {
  booking: "Đặt chỗ",
  order: "Đơn hàng",
  inventory: "Kho hàng",
  maintenance: "Bảo trì",
  utilities: "Tiện ích",
  other: "Khác",
};

// Renders multi-line restock description in table cells
function RestockDesc({ description }: { description: string }) {
  const raw = description.replace(/^Nhập hàng:\s*/, "");
  const [itemsPart, notePart] = raw.split(" — ");
  const lines = itemsPart.split(", ").filter(Boolean);
  return (
    <div>
      {lines.map((line, i) => {
        const [nameQty] = line.split("~");
        return (
          <div key={i} className="text-xs text-slate-600">
            {nameQty}
          </div>
        );
      })}
      {notePart && (
        <div className="text-xs text-slate-400 mt-0.5">{notePart}</div>
      )}
    </div>
  );
}

const fmtDate = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

const fmtTime = (d: string) =>
  new Date(d).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

// ─── Page ─────────────────────────────────────────────────────────────────────

type Mode = "month" | "range";

export default function TransactionsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const today = new Date().toISOString().slice(0, 10);
  const currentYM = new Date().toISOString().slice(0, 7);

  const [mode, setMode] = useState<Mode>("month");
  const [selectedMonth, setSelectedMonth] = useState(currentYM);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Source-group modal
  const [modal, setModal] = useState<{
    title: string;
    txs: Transaction[];
  } | null>(null);
  const openModal = (title: string, txs: Transaction[]) =>
    setModal({ title, txs });
  const closeModal = () => setModal(null);

  // Transaction detail modal
  const [detail, setDetail] = useState<Transaction | null>(null);
  const openDetail = (tx: Transaction) => setDetail(tx);
  const closeDetail = () => setDetail(null);

  // Build query string
  useEffect(() => {
    if (!isAdmin) {
      setMode("range");
      setDateFrom(today);
      setDateTo(today);
    }
  }, [isAdmin, today]);

  const query = useMemo(() => {
    if (!isAdmin) {
      return `dateFrom=${today}&dateTo=${today}`;
    }
    if (mode === "range") {
      return `dateFrom=${dateFrom}&dateTo=${dateTo}`;
    }
    return `month=${selectedMonth}`;
  }, [mode, selectedMonth, dateFrom, dateTo, isAdmin, today]);

  const { data, isLoading } = useApi<{ days: DayStats[]; summary: any }>(
    `/api/transactions?daily=true&${query}`,
    { refreshInterval: 30000 },
  );

  const days: DayStats[] = data?.days || [];
  const summary = data?.summary || { income: 0, expense: 0, net: 0, count: 0 };

  // Chart data — sorted ascending for display
  const chartData = [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: new Date(d.date + "T00:00:00").toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
      }),
      "Thu nhập": d.income,
      "Chi phí": d.expense,
      "Lợi nhuận": d.net,
    }));

  const toggleDay = (date: string) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Thống kê giao dịch
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isAdmin ? "Doanh thu và chi phí theo ngày" : "Doanh thu hôm nay"}
          </p>
        </div>

        {/* Filter controls */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-sm">
              <button
                onClick={() => setMode("month")}
                className={`px-3 py-1.5 ${mode === "month" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                Theo tháng
              </button>
              <button
                onClick={() => setMode("range")}
                className={`px-3 py-1.5 ${mode === "range" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-50"}`}
              >
                Tuỳ chọn ngày
              </button>
            </div>

            {mode === "month" ? (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-400 text-sm">?</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-green-500" /> Tổng thu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.income)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <TrendingDown className="h-4 w-4 text-red-500" /> Tổng chi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.expense)}
            </div>
          </CardContent>
        </Card>
        {isAdmin && (
          <>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-blue-500" /> Lợi nhuận
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${summary.net >= 0 ? "text-green-600" : "text-red-600"}`}
                >
                  {formatCurrency(summary.net)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-purple-500" /> Giao dịch
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {summary.count}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {chartData.length > 0 && (
        <Card>
          <CardHeader>Biểu đồ doanh thu theo ngày</CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) =>
                    v >= 1000000
                      ? `${(v / 1000000).toFixed(1)}M`
                      : v >= 1000
                        ? `${(v / 1000).toFixed(0)}K`
                        : v
                  }
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatCurrency(value),
                    name,
                  ]}
                />
                <Legend />
                <Bar dataKey="Thu nhập" fill="#22c55e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Chi phí" fill="#ef4444" radius={[3, 3, 0, 0]} />
                {isAdmin && (
                  <Bar
                    dataKey="Lợi nhuận"
                    fill="#3b82f6"
                    radius={[3, 3, 0, 0]}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {isLoading && (
          <div className="text-center py-12 text-gray-400">Đang tải...</div>
        )}
        {!isLoading && days.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Không có giao dịch trong khoảng thời gian này.
          </div>
        )}
        {days.map((day) => {
          const expanded = expandedDays.has(day.date);
          return (
            <Card key={day.date} className="overflow-hidden">
              {/* Day header — clickable */}
              <button
                onClick={() => toggleDay(day.date)}
                className="w-full text-left px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {expanded ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="font-semibold text-slate-800">
                    {fmtDate(day.date)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {day.count} giao dịch
                  </span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <span className="text-green-600 font-medium">
                    +{formatCurrency(day.income)}
                  </span>
                  {day.expense > 0 && (
                    <span className="text-red-500 font-medium">
                      −{formatCurrency(day.expense)}
                    </span>
                  )}
                  <span
                    className={`font-bold ${day.net >= 0 ? "text-blue-600" : "text-red-600"}`}
                  >
                    = {formatCurrency(day.net)}
                  </span>
                </div>
              </button>

              {expanded && (
                <div className="border-t border-slate-100">
                  {/* Source breakdown */}
                  {Object.keys(day.bySource).length > 0 && (
                    <div className="px-5 py-3 bg-slate-50 flex flex-wrap gap-2 border-b border-slate-100">
                      {Object.entries(day.bySource).map(([src, val]) => (
                        <button
                          key={src}
                          onClick={() =>
                            openModal(
                              `${SOURCE_LABEL[src] || src} — ${fmtDate(day.date)}`,
                              day.transactions.filter((t) => t.source === src),
                            )
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-xs text-slate-600 transition-colors cursor-pointer"
                        >
                          <span className="font-medium">
                            {SOURCE_LABEL[src] || src}:
                          </span>
                          {val.income > 0 && (
                            <span className="text-green-600">
                              +{formatCurrency(val.income)}
                            </span>
                          )}
                          {val.income > 0 && val.expense > 0 && (
                            <span className="text-slate-300">|</span>
                          )}
                          {val.expense > 0 && (
                            <span className="text-red-500">
                              −{formatCurrency(val.expense)}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Transactions */}
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-white">
                        <TableHead className="w-20">Giờ</TableHead>
                        <TableHead className="w-24">Loại</TableHead>
                        <TableHead className="w-28">Nguồn</TableHead>
                        <TableHead>Mô tả</TableHead>
                        <TableHead className="w-24">Danh mục</TableHead>
                        <TableHead className="text-right w-32">
                          Số tiền
                        </TableHead>
                        <TableHead className="w-28">Người tạo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {day.transactions.map((tx) => (
                        <TableRow
                          key={tx._id}
                          className="text-sm cursor-pointer hover:bg-blue-50 transition-colors"
                          onClick={() => openDetail(tx)}
                        >
                          <TableCell className="text-slate-400 font-mono text-xs">
                            {fmtTime(tx.date)}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-medium ${tx.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                            >
                              {tx.type === "income" ? "Thu" : "Chi"}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {SOURCE_LABEL[tx.source] || tx.source}
                          </TableCell>
                          <TableCell className="text-slate-700 max-w-xs">
                            {tx.source === "inventory" &&
                            tx.category === "Nhập hàng" &&
                            !tx.referenceId ? (
                              <RestockDesc description={tx.description} />
                            ) : (
                              <span className="truncate block">
                                {tx.description}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">
                            {tx.category || "—"}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${tx.type === "income" ? "text-green-600" : "text-red-600"}`}
                          >
                            {tx.type === "income" ? "+" : "−"}
                            {formatCurrency(tx.amount)}
                          </TableCell>
                          <TableCell className="text-slate-500 text-xs">
                            {tx.createdBy?.name || "Hệ thống"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Transaction detail modal */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeDetail}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-800">
                  {detail.description}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  {SOURCE_LABEL[detail.source] || detail.source} ·{" "}
                  {fmtTime(detail.date)}
                </p>
              </div>
              <button
                onClick={closeDetail}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4 space-y-4">
              {/* Basic info */}
              <div className="flex flex-wrap gap-2">
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-400">Loại</p>
                  <p
                    className={`text-sm font-semibold ${detail.type === "income" ? "text-green-600" : "text-red-600"}`}
                  >
                    {detail.type === "income" ? "Thu nhập" : "Chi phí"}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-400">Số tiền</p>
                  <p
                    className={`text-sm font-bold ${detail.type === "income" ? "text-green-600" : "text-red-600"}`}
                  >
                    {detail.type === "income" ? "+" : "−"}
                    {formatCurrency(detail.amount)}
                  </p>
                </div>
                {detail.category && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-400">Danh mục</p>
                    <p className="text-sm font-medium text-slate-700">
                      {detail.category}
                    </p>
                  </div>
                )}
                {detail.createdBy && (
                  <div className="bg-slate-50 rounded-lg px-3 py-2">
                    <p className="text-xs text-slate-400">Người tạo</p>
                    <p className="text-sm font-medium text-slate-700">
                      {detail.createdBy.name}
                    </p>
                  </div>
                )}
              </div>

              {/* Order detail */}
              {detail.referenceModel === "Order" && detail.referenceId ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Chi tiết đơn hàng
                  </p>
                  {detail.referenceId.items?.map((item, i) => (
                    <div
                      key={i}
                      className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-700">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          x{item.quantity} · {formatCurrency(item.price)}/cái
                        </p>
                      </div>
                      <p className="font-semibold text-slate-700">
                        {formatCurrency(item.subtotal)}
                      </p>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 mt-1">
                    <p className="font-semibold text-slate-600">Tổng cộng</p>
                    <p className="font-bold text-blue-600 text-base">
                      {formatCurrency(
                        detail.referenceId.total ?? detail.amount,
                      )}
                    </p>
                  </div>
                  {detail.referenceId.notes && (
                    <p className="text-xs text-slate-400 mt-2">
                      Ghi chú: {detail.referenceId.notes}
                    </p>
                  )}
                </div>
              ) : detail.source === "inventory" &&
                detail.category === "Nhập hàng" ? (
                (() => {
                  const raw = detail.description.replace(/^Nhập hàng:\s*/, "");
                  const [itemsPart, notePart] = raw.split(" — ");
                  const lines = itemsPart.split(", ").filter(Boolean);
                  const parsed = lines.map((line) => {
                    const tildeIdx = line.lastIndexOf("~");
                    if (tildeIdx === -1) return { label: line, cost: null };
                    return {
                      label: line.slice(0, tildeIdx),
                      cost: parseFloat(line.slice(tildeIdx + 1)) || null,
                    };
                  });
                  return (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        Chi tiết nhập hàng
                      </p>
                      <div>
                        {parsed.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                          >
                            <div className="flex items-center">
                              <span className="w-2 h-2 rounded-full bg-orange-400 mr-3 shrink-0" />
                              <p className="text-sm font-medium text-slate-700">
                                {item.label}
                              </p>
                            </div>
                            {item.cost !== null && (
                              <p className="text-sm font-semibold text-slate-600">
                                {formatCurrency(item.cost)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      {notePart && (
                        <p className="text-xs text-slate-400 mt-2">
                          Ghi chú: {notePart}
                        </p>
                      )}
                      <div className="flex justify-between items-center pt-3 mt-1 border-t border-slate-100">
                        <p className="font-semibold text-slate-600">
                          Tổng chi phí
                        </p>
                        <p className="font-bold text-red-600 text-base">
                          {formatCurrency(detail.amount)}
                        </p>
                      </div>
                    </div>
                  );
                })()
              ) : detail.referenceModel === "Booking" && detail.referenceId ? (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Chi tiết đặt chỗ
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Khách hàng</span>
                      <span className="font-medium text-slate-700">
                        {detail.referenceId.customer?.name}
                      </span>
                    </div>
                    {detail.referenceId.customer?.phone && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">SĐT</span>
                        <span className="font-medium text-slate-700">
                          {detail.referenceId.customer.phone}
                        </span>
                      </div>
                    )}
                    {detail.referenceId.startTime && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Bắt đầu</span>
                        <span className="font-medium text-slate-700">
                          {new Date(
                            detail.referenceId.startTime,
                          ).toLocaleString("vi-VN")}
                        </span>
                      </div>
                    )}
                    {detail.referenceId.endTime && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Kết thúc</span>
                        <span className="font-medium text-slate-700">
                          {new Date(detail.referenceId.endTime).toLocaleString(
                            "vi-VN",
                          )}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Tổng tiền</span>
                      <span className="font-bold text-blue-600">
                        {formatCurrency(
                          detail.referenceId.totalAmount ?? detail.amount,
                        )}
                      </span>
                    </div>
                    {detail.referenceId.notes && (
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Ghi chú</span>
                        <span className="text-slate-700">
                          {detail.referenceId.notes}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Source detail modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-base">
                {modal.title}
              </h2>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Modal body */}
            <div className="overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Giờ</TableHead>
                    <TableHead className="w-20">Loại</TableHead>
                    <TableHead>Mô tả</TableHead>
                    <TableHead className="w-24">Danh mục</TableHead>
                    <TableHead className="text-right w-32">Số tiền</TableHead>
                    <TableHead className="w-28">Người tạo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modal.txs.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center py-8 text-slate-400"
                      >
                        Không có giao dịch
                      </TableCell>
                    </TableRow>
                  )}
                  {modal.txs.map((tx) => (
                    <TableRow key={tx._id} className="text-sm">
                      <TableCell className="text-slate-400 font-mono text-xs">
                        {fmtTime(tx.date)}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            tx.type === "income"
                              ? "bg-green-100 text-green-700"
                              : "bg-red-100 text-red-700"
                          }`}
                        >
                          {tx.type === "income" ? "Thu" : "Chi"}
                        </span>
                      </TableCell>
                      <TableCell className="text-slate-700">
                        {tx.source === "inventory" &&
                        tx.category === "Nhập hàng" &&
                        !tx.referenceId ? (
                          <RestockDesc description={tx.description} />
                        ) : (
                          tx.description
                        )}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {tx.category || "—"}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          tx.type === "income"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {tx.type === "income" ? "+" : "−"}
                        {formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="text-slate-500 text-xs">
                        {tx.createdBy?.name || "Hệ thống"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
