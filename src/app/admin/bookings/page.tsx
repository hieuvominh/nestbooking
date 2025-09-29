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
  status: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  totalAmount: number;
  paymentStatus: 'pending' | 'paid' | 'refunded';
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

export default function BookingsPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [formData, setFormData] = useState<{
    customerName: string;
    customerEmail: string;
    deskId: string;
    startTime: string;
    endTime: string;
    status: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  }>({
    customerName: '',
    customerEmail: '',
    deskId: '',
    startTime: '',
    endTime: '',
    status: 'pending'
  });

  const { data: bookingsResponse, mutate: mutateBookings } = useApi<BookingsResponse>('/api/bookings', {
    refreshInterval: 10000 // Poll every 10 seconds
  });
  const bookings = bookingsResponse?.bookings;
  const { data: desks } = useApi<any[]>('/api/desks', {
    refreshInterval: 10000 // Poll every 10 seconds
  });
  const { apiCall } = useApi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBooking) {
        // Transform the form data to match API expectations for updates
        const updateData = {
          deskId: formData.deskId,
          customer: {
            name: formData.customerName,
            email: formData.customerEmail,
            phone: editingBooking.customer.phone // Keep existing phone
          },
          startTime: formData.startTime,
          endTime: formData.endTime,
          status: formData.status
        };
        
        await apiCall(`/api/bookings/${editingBooking._id}`, {
          method: 'PUT',
          body: JSON.stringify(updateData)
        });
      } else {
        // Transform the form data to match API expectations
        const bookingData = {
          deskId: formData.deskId,
          customer: {
            name: formData.customerName,
            email: formData.customerEmail,
            phone: '' // Default empty phone since it's not in the form
          },
          startTime: formData.startTime,
          endTime: formData.endTime
        };
        
        await apiCall('/api/bookings', {
          method: 'POST',
          body: JSON.stringify(bookingData)
        });
      }
      mutateBookings();
      resetForm();
    } catch (error) {
      console.error('Error saving booking:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this booking?')) return;
    
    try {
      await apiCall(`/api/bookings/${id}`, { method: 'DELETE' });
      mutateBookings();
    } catch (error) {
      console.error('Error deleting booking:', error);
    }
  };

  const handleCheckIn = async (id: string) => {
    try {
      await apiCall(`/api/bookings/${id}/checkin`, { method: 'POST' });
      mutateBookings();
    } catch (error) {
      console.error('Error checking in:', error);
    }
  };

  const generatePublicUrl = async (id: string) => {
    try {
      const response = await apiCall<{ url: string }>(`/api/bookings/${id}/public-url`, {
        method: 'POST'
      });
      navigator.clipboard.writeText(response.url);
      alert('Public URL copied to clipboard!');
      mutateBookings();
    } catch (error) {
      console.error('Error generating public URL:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      customerEmail: '',
      deskId: '',
      startTime: '',
      endTime: '',
      status: 'pending'
    });
    setIsCreating(false);
    setEditingBooking(null);
  };

  const startEdit = (booking: Booking) => {
    setFormData({
      customerName: booking.customer?.name || '',
      customerEmail: booking.customer?.email || '',
      deskId: booking.deskId,
      startTime: new Date(booking.startTime).toISOString().slice(0, 16),
      endTime: new Date(booking.endTime).toISOString().slice(0, 16),
      status: booking.status
    });
    setEditingBooking(booking);
    setIsCreating(true);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'confirmed': return 'text-blue-600 bg-blue-100';
      case 'checked-in': return 'text-green-600 bg-green-100';
      case 'completed': return 'text-gray-600 bg-gray-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Bookings Management</h1>
        <Button onClick={() => setIsCreating(true)}>
          Create New Booking
        </Button>
      </div>

      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>{editingBooking ? 'Edit Booking' : 'Create New Booking'}</CardTitle>
            <CardDescription>
              {editingBooking ? 'Update booking details' : 'Add a new booking to the system'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="customerName" className="text-sm font-medium">
                    Customer Name
                  </label>
                  <Input
                    id="customerName"
                    value={formData.customerName}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="customerEmail" className="text-sm font-medium">
                    Customer Email
                  </label>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label htmlFor="deskId" className="text-sm font-medium">
                    Desk
                  </label>
                  <select
                    id="deskId"
                    value={formData.deskId}
                    onChange={(e) => setFormData(prev => ({ ...prev, deskId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select a desk</option>
                    {desks?.map((desk) => (
                      <option key={desk._id} value={desk._id}>
                        Desk {desk.number} ({desk.status})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="startTime" className="text-sm font-medium">
                    Start Time
                  </label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="endTime" className="text-sm font-medium">
                    End Time
                  </label>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="status" className="text-sm font-medium">
                  Status
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="checked-in">Checked In</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="flex gap-2">
                <Button type="submit">
                  {editingBooking ? 'Update Booking' : 'Create Booking'}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

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
                <TableRow key={booking._id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{booking.customer.name}</div>
                      <div className="text-sm text-gray-500">{booking.customer.email}</div>
                    </div>
                  </TableCell>
                  <TableCell>Desk {booking.deskNumber}</TableCell>
                  <TableCell>{formatDateTime(booking.startTime)}</TableCell>
                  <TableCell>{formatDateTime(booking.endTime)}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {booking.checkedInAt ? (
                      <span className="text-sm text-green-600">
                        {formatDateTime(booking.checkedInAt)}
                      </span>
                    ) : booking.status === 'confirmed' ? (
                      <Button size="sm" onClick={() => handleCheckIn(booking._id)}>
                        Check In
                      </Button>
                    ) : (
                      <span className="text-sm text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      ${booking.totalAmount?.toFixed(2) || '0.00'}
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
                        onClick={() => startEdit(booking)}
                      >
                        Edit
                      </Button>
                      {!booking.publicToken && booking.status === 'confirmed' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => generatePublicUrl(booking._id)}
                        >
                          Generate URL
                        </Button>
                      )}
                      {booking.publicToken && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/p/${booking._id}`);
                            alert('Public URL copied to clipboard!');
                          }}
                        >
                          Copy URL
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(booking._id)}
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
    </div>
  );
}