'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { OrderEditModal } from '@/components/modals';

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
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
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
  const { data: ordersResponse, mutate: mutateOrders } = useApi<OrdersResponse>('/api/orders', {
    refreshInterval: 5000 // Poll orders frequently for kitchen updates
  });
  const { apiCall } = useApi();

  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  const handleEdit = (order: Order) => {
    setEditingOrder(order);
  };

  const handleSaveOrder = async (orderData: any) => {
    try {
      await apiCall(`/api/orders/${editingOrder!._id}`, {
        method: 'PUT',
        body: JSON.stringify(orderData)
      });
      mutateOrders();
      setEditingOrder(null);
    } catch (error) {
      console.error('Error saving order:', error);
      throw error;
    }
  };

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await apiCall(`/api/orders/${orderId}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      mutateOrders();
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'confirmed': return 'text-blue-600 bg-blue-100';
      case 'preparing': return 'text-orange-600 bg-orange-100';
      case 'ready': return 'text-green-600 bg-green-100';
      case 'delivered': return 'text-gray-600 bg-gray-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders Management</h1>
          <p className="text-gray-600">Track and manage customer orders</p>
        </div>
      </div>

      {/* Orders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Active Orders ({ordersResponse?.orders?.length || 0})</CardTitle>
          <CardDescription>Manage order status and fulfillment</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ordered At</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordersResponse?.orders?.map((order) => (
                <TableRow key={order._id}>
                  <TableCell className="font-mono text-sm">
                    {order._id.slice(-8)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{order.bookingId.customer.name}</div>
                    <div className="text-sm text-gray-500">{order.bookingId.customer.email}</div>
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
                    ${order.total.toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order._id, e.target.value)}
                      className={`px-2 py-1 rounded-full text-xs font-medium border-0 ${getStatusColor(order.status)}`}
                    >
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirmed</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                      <option value="delivered">Delivered</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </TableCell>
                  <TableCell>{formatDateTime(order.orderedAt)}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(order)}
                      >
                        Edit
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {!ordersResponse?.orders || ordersResponse.orders.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No orders found.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Order Modal */}
      <OrderEditModal
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        order={editingOrder}
        onSave={handleSaveOrder}
      />
    </div>
  );
}