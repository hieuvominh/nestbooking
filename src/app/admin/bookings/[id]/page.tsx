'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useApi } from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Copy, Plus, QrCode } from 'lucide-react';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  paymentMethod?: string;
  publicToken?: string;
  signature?: string;
  notes?: string;
  checkedInAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface InventoryItem {
  _id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  status: 'available' | 'out-of-stock' | 'discontinued';
}

interface Order {
  _id: string;
  bookingId: string;
  items: Array<{
    itemId: string;
    name: string;
    price: number;
    quantity: number;
  }>;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bookingId = params.id as string;

  const [selectedItem, setSelectedItem] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);

  // API hooks
  const { 
    data: booking, 
    isLoading: bookingLoading, 
    error: bookingError,
    mutate: mutateBooking
  } = useApi<Booking>(`/api/bookings/${bookingId}`);

  const { 
    data: inventory, 
    isLoading: inventoryLoading 
  } = useApi<InventoryItem[]>('/api/inventory');

  const { 
    data: orders, 
    isLoading: ordersLoading,
    mutate: mutateOrders
  } = useApi<Order[]>(`/api/public/${bookingId}/orders`);

  // Auto-generate token if booking exists and doesn't have a valid token
  useEffect(() => {
    const isTokenValid = (token: string) => {
      try {
        // Simple JWT payload decode to check expiration
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp > Math.floor(Date.now() / 1000);
      } catch {
        return false;
      }
    };

    if (booking && booking.status !== 'cancelled') {
      const hasValidToken = (booking.publicToken && isTokenValid(booking.publicToken)) || 
                           (booking.signature && isTokenValid(booking.signature));
      
      if (!hasValidToken) {
        generateNewToken();
      }
    }
  }, [booking]);

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'confirmed': 'bg-blue-100 text-blue-800',
      'checked-in': 'bg-green-100 text-green-800',
      'completed': 'bg-gray-100 text-gray-800',
      'cancelled': 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'paid': 'bg-green-100 text-green-800',
      'refunded': 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const generatePublicUrl = () => {
    if (!booking?.publicToken && !booking?.signature) {
      return '';
    }
    
    const token = booking.signature || booking.publicToken;
    return `${window.location.origin}/p/${bookingId}?t=${token}`;
  };

  const generateNewToken = async () => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('bookingcoo_token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate token');
      }

      const data = await response.json();
      toast.success('Public token generated successfully!');
      
      // Update the booking data with the new token
      mutateBooking();
      
      return data.publicUrl;
    } catch (error) {
      toast.error('Failed to generate public token');
      return '';
    }
  };

  const copyPublicUrl = () => {
    const url = generatePublicUrl();
    if (url) {
      navigator.clipboard.writeText(url);
      toast.success('Public URL copied to clipboard!');
    }
  };

  const handleAddOrder = async () => {
    if (!selectedItem || quantity < 1) {
      toast.error('Please select an item and specify quantity');
      return;
    }

    const item = inventory?.find(i => i._id === selectedItem);
    if (!item) {
      toast.error('Selected item not found');
      return;
    }

    if (item.stock < quantity) {
      toast.error('Insufficient stock available');
      return;
    }

    try {
      const response = await fetch(`/api/public/${bookingId}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: [{
            itemId: selectedItem,
            name: item.name,
            price: item.price,
            quantity
          }]
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add order');
      }

      toast.success('Order added successfully!');
      setSelectedItem('');
      setQuantity(1);
      setIsOrderDialogOpen(false);
      mutateOrders();
    } catch (error) {
      toast.error('Failed to add order');
    }
  };

  if (bookingLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading booking details...</div>
      </div>
    );
  }

  if (bookingError || !booking) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="text-lg text-red-600">Failed to load booking details</div>
        <Button onClick={() => router.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  const publicUrl = generatePublicUrl();
  const hasValidToken = Boolean(booking?.publicToken || booking?.signature);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Bookings
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Booking Details</h1>
            <p className="text-gray-500">Booking ID: {booking._id}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column - Booking Details & QR Code */}
        <div className="space-y-6">
          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Name</Label>
                <p className="text-lg font-semibold">{booking.customer.name}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Email</Label>
                <p>{booking.customer.email}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-500">Phone</Label>
                <p>{booking.customer.phone}</p>
              </div>
            </CardContent>
          </Card>

          {/* Booking Information */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-500">Desk</Label>
                <p className="text-lg font-semibold">Desk {booking.deskNumber}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Start Time</Label>
                  <p>{formatDateTime(booking.startTime)}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">End Time</Label>
                  <p>{formatDateTime(booking.endTime)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Status</Label>
                  <div className="mt-1">
                    <Badge className={getStatusColor(booking.status)}>
                      {booking.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Check-in</Label>
                  <p>{booking.checkedInAt ? formatDateTime(booking.checkedInAt) : 'Not checked in'}</p>
                </div>
              </div>
              {booking.notes && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Notes</Label>
                  <p className="text-sm bg-gray-50 p-3 rounded-md">{booking.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Total Amount</Label>
                  <p className="text-lg font-bold">${booking.totalAmount?.toFixed(2) || '0.00'}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Payment Status</Label>
                  <div className="mt-1">
                    <Badge className={getPaymentStatusColor(booking.paymentStatus)}>
                      {booking.paymentStatus}
                    </Badge>
                  </div>
                </div>
              </div>
              {booking.paymentMethod && (
                <div>
                  <Label className="text-sm font-medium text-gray-500">Payment Method</Label>
                  <p>{booking.paymentMethod}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QR Code Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <QrCode className="w-5 h-5" />
                <span>Public Booking URL</span>
              </CardTitle>
              <CardDescription>
                Share this QR code or URL with the customer for easy access
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasValidToken && publicUrl ? (
                <>
                  <div className="text-xs text-gray-500 mb-2">
                    QR URL: {publicUrl}
                  </div>
                  <div className="flex justify-center">
                    <Dialog open={isQrDialogOpen} onOpenChange={setIsQrDialogOpen}>
                      <DialogTrigger asChild>
                        <div className="cursor-pointer p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors bg-white">
                          <div className="flex items-center justify-center">
                            <QRCode 
                              value={publicUrl} 
                              size={150}
                              bgColor={"#ffffff"}
                              fgColor={"#000000"}
                              level={"L"}
                              includeMargin={false}
                            />
                          </div>
                        </div>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>Booking QR Code</DialogTitle>
                          <DialogDescription>
                            Customer can scan this QR code to access their booking
                          </DialogDescription>
                        </DialogHeader>
                        <div className="flex justify-center py-4">
                          <div className="bg-white p-4 rounded-lg">
                            <QRCode 
                              value={publicUrl} 
                              size={300}
                              bgColor={"#ffffff"}
                              fgColor={"#000000"}
                              level={"L"}
                              includeMargin={true}
                            />
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="flex space-x-2">
                    <Input 
                      value={publicUrl} 
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button onClick={copyPublicUrl} size="icon">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-500 mb-4">
                    {booking?.status === 'cancelled' ? (
                      "Cannot generate public URL for cancelled bookings"
                    ) : (
                      "Generating public URL and QR code..."
                    )}
                  </div>
                  {booking?.status !== 'cancelled' && (
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Orders Management */}
        <div className="space-y-6">
          {/* Add Order Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Extra Services / Orders
                <Dialog open={isOrderDialogOpen} onOpenChange={setIsOrderDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Service
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Extra Service</DialogTitle>
                      <DialogDescription>
                        Add additional services or items to this booking
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="item">Select Item</Label>
                        <Select value={selectedItem} onValueChange={setSelectedItem}>
                          <SelectTrigger>
                            <SelectValue placeholder="Choose an item..." />
                          </SelectTrigger>
                          <SelectContent>
                            {inventory?.filter(item => item.status === 'available' && item.stock > 0).map((item) => (
                              <SelectItem key={item._id} value={item._id}>
                                {item.name} - ${item.price.toFixed(2)} (Stock: {item.stock})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="quantity">Quantity</Label>
                        <Input
                          id="quantity"
                          type="number"
                          min="1"
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="flex justify-end space-x-2">
                        <Button variant="outline" onClick={() => setIsOrderDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleAddOrder}>
                          Add to Order
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardTitle>
              <CardDescription>
                Additional services and items for this booking
              </CardDescription>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="text-center py-4">Loading orders...</div>
              ) : orders && orders.length > 0 ? (
                <div className="space-y-4">
                  {orders.map((order) => (
                    <div key={order._id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h4 className="font-semibold">Order #{order._id.slice(-8)}</h4>
                          <p className="text-sm text-gray-500">{formatDateTime(order.createdAt)}</p>
                        </div>
                        <Badge className={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {order.items.map((item, index) => (
                          <div key={index} className="flex justify-between text-sm">
                            <span>{item.name} × {item.quantity}</span>
                            <span>${(item.price * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-semibold">
                        <span>Total</span>
                        <span>${order.totalAmount.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No additional orders yet. Add extra services using the button above.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}