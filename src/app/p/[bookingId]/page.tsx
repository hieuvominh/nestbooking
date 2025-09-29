'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Booking {
  _id: string;
  customerName: string;
  customerEmail: string;
  deskId: string;
  deskNumber: number;
  startTime: string;
  endTime: string;
  status: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled';
  checkInTime?: string;
  signature?: string;
  orders?: {
    _id: string;
    itemId: string;
    itemName: string;
    quantity: number;
    price: number;
  }[];
}

interface InventoryItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: 'food' | 'drinks' | 'snacks' | 'supplies';
  isAvailable: boolean;
  image?: string;
}

interface Order {
  itemId: string;
  itemName: string;
  quantity: number;
  price: number;
}

export default function PublicBookingPage() {
  const params = useParams();
  const bookingId = params.bookingId as string;
  
  const [booking, setBooking] = useState<Booking | null>(null);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState('');
  const [cart, setCart] = useState<Order[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);

  useEffect(() => {
    fetchBookingData();
    fetchInventory();
  }, [bookingId]);

  const fetchBookingData = async () => {
    try {
      const response = await fetch(`/api/public/booking/${bookingId}`);
      if (!response.ok) {
        throw new Error('Booking not found or access denied');
      }
      const data = await response.json();
      setBooking(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  };

  const fetchInventory = async () => {
    try {
      const response = await fetch('/api/inventory');
      if (response.ok) {
        const data = await response.json();
        setInventory(data.data.filter((item: InventoryItem) => item.isAvailable && item.stock > 0));
      }
    } catch (err) {
      console.error('Failed to load inventory:', err);
    }
  };

  const handleCheckIn = async () => {
    if (!signature.trim()) {
      alert('Please provide your signature to check in');
      return;
    }

    try {
      const response = await fetch(`/api/public/booking/${bookingId}/checkin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature })
      });

      if (!response.ok) {
        throw new Error('Check-in failed');
      }

      const data = await response.json();
      setBooking(data.data);
      alert('Successfully checked in!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Check-in failed');
    }
  };

  const addToCart = (item: InventoryItem) => {
    const existingItem = cart.find(cartItem => cartItem.itemId === item._id);
    if (existingItem) {
      if (existingItem.quantity < item.stock) {
        setCart(prev => prev.map(cartItem =>
          cartItem.itemId === item._id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        ));
      } else {
        alert('Not enough stock available');
      }
    } else {
      setCart(prev => [...prev, {
        itemId: item._id,
        itemName: item.name,
        quantity: 1,
        price: item.price
      }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(item => item.itemId !== itemId));
  };

  const updateCartQuantity = (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    const inventoryItem = inventory.find(item => item._id === itemId);
    if (inventoryItem && quantity > inventoryItem.stock) {
      alert('Not enough stock available');
      return;
    }

    setCart(prev => prev.map(item =>
      item.itemId === itemId ? { ...item, quantity } : item
    ));
  };

  const submitOrder = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    setOrderLoading(true);
    try {
      const response = await fetch(`/api/public/booking/${bookingId}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: cart })
      });

      if (!response.ok) {
        throw new Error('Failed to submit order');
      }

      const data = await response.json();
      setBooking(data.data);
      setCart([]);
      alert('Order submitted successfully!');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit order');
    } finally {
      setOrderLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getCartTotal = () => {
    return cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getOrdersTotal = () => {
    return booking?.orders?.reduce((total, order) => total + (order.price * order.quantity), 0) || 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Loading your booking...</p>
        </div>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">{error || 'Booking not found'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">BookingCoo</h1>
          <p className="text-gray-600">Your Co-working Space Booking</p>
        </div>

        {/* Booking Details */}
        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
            <CardDescription>Your reservation information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Customer Name</label>
                <p className="text-lg font-semibold">{booking.customerName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-lg">{booking.customerEmail}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Desk Number</label>
                <p className="text-lg font-semibold">Desk {booking.deskNumber}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Status</label>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  booking.status === 'confirmed' ? 'bg-blue-100 text-blue-600' :
                  booking.status === 'checked-in' ? 'bg-green-100 text-green-600' :
                  booking.status === 'completed' ? 'bg-gray-100 text-gray-600' :
                  'bg-yellow-100 text-yellow-600'
                }`}>
                  {booking.status}
                </span>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Start Time</label>
                <p className="text-lg">{formatDateTime(booking.startTime)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">End Time</label>
                <p className="text-lg">{formatDateTime(booking.endTime)}</p>
              </div>
            </div>
            
            {booking.checkInTime && (
              <div className="mt-4 p-4 bg-green-50 rounded-lg">
                <p className="text-green-800">
                  ✅ Checked in at: {formatDateTime(booking.checkInTime)}
                </p>
                {booking.signature && (
                  <p className="text-sm text-green-600 mt-1">
                    Signature: {booking.signature}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Check-in Section */}
        {booking.status === 'confirmed' && !booking.checkInTime && (
          <Card>
            <CardHeader>
              <CardTitle>Check In</CardTitle>
              <CardDescription>Please provide your signature to check in</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="signature" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Signature
                </label>
                <Input
                  id="signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Enter your full name as signature"
                  required
                />
              </div>
              <Button onClick={handleCheckIn} className="w-full">
                Check In
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Food Ordering Section */}
        {(booking.status === 'confirmed' || booking.status === 'checked-in') && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Order Food & Drinks</CardTitle>
                <CardDescription>Browse our menu and place your order</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {inventory.map((item) => (
                    <div key={item._id} className="border rounded-lg p-4 space-y-3">
                      {item.image && (
                        <img 
                          src={item.image} 
                          alt={item.name}
                          className="w-full h-32 object-cover rounded"
                        />
                      )}
                      <div>
                        <h3 className="font-semibold">{item.name}</h3>
                        <p className="text-sm text-gray-600">{item.description}</p>
                        <p className="text-sm text-gray-500 capitalize">{item.category}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold">${item.price.toFixed(2)}</span>
                        <span className="text-sm text-gray-500">Stock: {item.stock}</span>
                      </div>
                      <Button 
                        onClick={() => addToCart(item)}
                        className="w-full"
                        disabled={item.stock === 0}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  ))}
                </div>
                
                {inventory.length === 0 && (
                  <p className="text-center text-gray-500 py-8">
                    No items available for ordering at the moment.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Shopping Cart */}
            {cart.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Order</CardTitle>
                  <CardDescription>Review your items before placing order</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cart.map((item) => (
                        <TableRow key={item.itemId}>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>${item.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateCartQuantity(item.itemId, item.quantity - 1)}
                                className="h-6 w-6 p-0"
                              >
                                -
                              </Button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateCartQuantity(item.itemId, item.quantity + 1)}
                                className="h-6 w-6 p-0"
                              >
                                +
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>${(item.price * item.quantity).toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeFromCart(item.itemId)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex justify-between items-center">
                    <span className="text-lg font-semibold">
                      Total: ${getCartTotal().toFixed(2)}
                    </span>
                    <Button 
                      onClick={submitOrder}
                      disabled={orderLoading}
                      className="min-w-32"
                    >
                      {orderLoading ? 'Placing Order...' : 'Place Order'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Previous Orders */}
        {booking.orders && booking.orders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Orders</CardTitle>
              <CardDescription>Previously placed orders</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {booking.orders.map((order, index) => (
                    <TableRow key={index}>
                      <TableCell>{order.itemName}</TableCell>
                      <TableCell>${order.price.toFixed(2)}</TableCell>
                      <TableCell>{order.quantity}</TableCell>
                      <TableCell>${(order.price * order.quantity).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="mt-4 text-right">
                <span className="text-lg font-semibold">
                  Total Spent: ${getOrdersTotal().toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}