"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Plus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
} from "lucide-react";
import { formatCurrency } from "@/lib/currency";

interface Transaction {
  _id: string;
  type: "income" | "expense";
  amount: number;
  source: string;
  description: string;
  category?: string;
  date: string;
  createdAt: string;
  createdBy?: {
    name: string;
    email: string;
  };
  referenceId?: string;
}

export default function TransactionsPage() {
  const [currentMonth, setCurrentMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: transactionResponse } = useApi<{
    transactions: Transaction[];
    pagination: any;
  }>(
    `/api/transactions?month=${currentMonth}&type=${
      typeFilter !== "all" ? typeFilter : ""
    }&limit=100`,
    { refreshInterval: 30000 }
  );

  const { data: aggregateResponse } = useApi<{
    summary: any;
    breakdown: any[];
  }>(`/api/transactions?month=${currentMonth}&aggregate=true`, {
    refreshInterval: 30000,
  });

  // Extract data from API response
  const transactions = transactionResponse?.transactions || [];
  const summary = aggregateResponse?.summary || {
    totalIncome: 0,
    totalExpenses: 0,
    netIncome: 0,
    transactionCount: 0,
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "income":
        return "text-green-600 bg-green-100";
      case "expense":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const translateType = (type: string) => {
    switch (type) {
      case "income":
        return "Thu nhập";
      case "expense":
        return "Chi tiêu";
      default:
        return type;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Giao dịch</h1>
        <div className="flex gap-3">
          <Input
            type="month"
            value={currentMonth}
            onChange={(e) => setCurrentMonth(e.target.value)}
            className="w-auto"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tất cả loại</option>
            <option value="income">Thu nhập</option>
            <option value="expense">Chi tiêu</option>
          </select>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Thêm giao dịch
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Tổng thu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summary.totalIncome || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              Tổng chi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summary.totalExpenses || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Lợi nhuận
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                summary.netIncome >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatCurrency(summary.netIncome || 0)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Tổng giao dịch
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {summary.transactionCount || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Lịch sử giao dịch</CardTitle>
          <CardDescription>
            Bản ghi giao dịch chi tiết cho {currentMonth}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ngày</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Nguồn</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead>Số tiền</TableHead>
                <TableHead>Người tạo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions && transactions.length > 0 ? (
                transactions.map((transaction) => (
                  <TableRow key={transaction._id}>
                    <TableCell className="font-mono text-sm">
                      {formatDateTime(transaction.date)}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getTypeColor(
                          transaction.type
                        )}`}
                      >
                        {translateType(transaction.type)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {transaction.source}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.description}
                    </TableCell>
                    <TableCell>{transaction.category || "-"}</TableCell>
                    <TableCell
                      className={`font-medium ${
                        transaction.type === "expense"
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {transaction.type === "expense" ? "-" : "+"}
                      {formatCurrency(transaction.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {transaction.createdBy?.name || "Hệ thống"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-gray-500"
                  >
                    Không tìm thấy giao dịch cho khoảng thời gian đã chọn.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
