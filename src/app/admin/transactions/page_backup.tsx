'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Plus, DollarSign, TrendingUp, TrendingDown, Activity } from 'lucide-react';

interface Transaction {
  _id: string;
  type: 'income' | 'expense';
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
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM format
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: transactionResponse } = useApi<{transactions: Transaction[], pagination: any}>(
    `/api/transactions?month=${currentMonth}&type=${typeFilter !== 'all' ? typeFilter : ''}&limit=100`,
    { refreshInterval: 30000 }
  );
  
  const { data: aggregateResponse } = useApi<{summary: any, breakdown: any[]}>(
    `/api/transactions?month=${currentMonth}&aggregate=true`,
    { refreshInterval: 30000 }
  );

  // Extract transactions array from API response
  const transactions = transactionResponse?.transactions || [];
  const summary = aggregateResponse?.summary;
  
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income': return 'text-green-600 bg-green-100';
      case 'expense': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Transactions & Analytics</h1>
        <div className="flex gap-2">
          <Input
            type="date"
            value={dateFilter.startDate}
            onChange={(e) => setDateFilter(prev => ({ ...prev, startDate: e.target.value }))}
            className="w-auto"
          />
          <Input
            type="date"
            value={dateFilter.endDate}
            onChange={(e) => setDateFilter(prev => ({ ...prev, endDate: e.target.value }))}
            className="w-auto"
          />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="booking">Bookings</option>
            <option value="order">Orders</option>
            <option value="refund">Refunds</option>
          </select>
        </div>
      </div>

      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${stats?.totalRevenue?.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.totalBookings || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {stats?.totalOrders || 0}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Avg Order Value</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${stats?.averageOrderValue?.toFixed(2) || '0.00'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Day Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Day</CardTitle>
            <CardDescription>Daily revenue breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.revenueByDay || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="bookings" stackId="a" fill="#0088FE" name="Bookings" />
                <Bar dataKey="orders" stackId="a" fill="#00C49F" name="Orders" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Type Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue by Type</CardTitle>
            <CardDescription>Revenue distribution by transaction type</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats?.revenueByType || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {stats?.revenueByType?.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Revenue']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Items */}
      {stats?.topItems && stats.topItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Selling Items</CardTitle>
            <CardDescription>Most popular items by quantity and revenue</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Quantity Sold</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topItems.map((item, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>${item.revenue.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>
            Detailed transaction records
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTransactions && filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction) => (
                  <TableRow key={transaction._id}>
                    <TableCell className="font-mono text-sm">
                      {formatDateTime(transaction.createdAt)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getTypeColor(transaction.type)}`}>
                        {transaction.type}
                      </span>
                    </TableCell>
                    <TableCell>{transaction.customerName}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {transaction.description}
                    </TableCell>
                    <TableCell className={`font-medium ${
                      transaction.type === 'refund' ? 'text-red-600' : 'text-green-600'
                    }`}>
                      {transaction.type === 'refund' ? '-' : ''}${transaction.amount.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                        {transaction.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {transaction.metadata && (
                        <div className="text-sm text-gray-600">
                          {transaction.metadata.deskNumber && (
                            <div>Desk: {transaction.metadata.deskNumber}</div>
                          )}
                          {transaction.metadata.duration && (
                            <div>Duration: {transaction.metadata.duration}h</div>
                          )}
                          {transaction.metadata.items && transaction.metadata.items.length > 0 && (
                            <div>Items: {transaction.metadata.items.join(', ')}</div>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                    No transactions found for the selected period.
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