'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EditModal } from './EditModal'
import { useApi } from '@/hooks/useApi'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { User, Mail, Phone, Monitor, Clock, Calendar, CheckCircle, CreditCard, DollarSign } from 'lucide-react'

// Enhanced schema matching the booking model
const bookingSchema = z.object({
  // Customer Info
  customerName: z.string().min(1, 'Customer name is required'),
  customerPhone: z.string().min(10, 'Phone number must be at least 10 digits').regex(/^[\+]?[0-9\s\-\(\)]+$/, 'Invalid phone number format'),
  customerEmail: z.string().email('Invalid email address').optional().or(z.literal('')),
  
  // Desk Selection
  deskId: z.string().min(1, 'Desk selection is required'),
  
  // Booking Time
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  
  // Status
  status: z.enum(['pending', 'confirmed', 'checked-in', 'completed', 'cancelled']),
  
  // Payment
  paymentMethod: z.enum(['cash', 'card', 'transfer']),
  totalAmount: z.number().min(0, 'Amount must be positive'),
  paymentStatus: z.enum(['pending', 'paid', 'refunded']),
  
  // Optional
  notes: z.string().optional()
}).refine((data) => {
  const start = new Date(data.startTime);
  const end = new Date(data.endTime);
  return end > start;
}, {
  message: "End time must be after start time",
  path: ["endTime"]
})

type BookingFormData = z.infer<typeof bookingSchema>

interface Booking {
  _id: string
  customer: {
    name: string
    email: string
    phone: string
  }
  deskId: string
  startTime: string
  endTime: string
  status: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled'
  totalAmount: number
  paymentStatus: 'pending' | 'paid' | 'refunded'
  notes?: string
  createdAt: string
  updatedAt: string
}

interface Desk {
  _id: string
  number: number
  label: string
  status: 'available' | 'occupied' | 'maintenance'
  hourlyRate: number
}

interface BookingEditModalProps {
  isOpen: boolean
  onClose: () => void
  booking?: Booking | null
  onSave: (data: BookingFormData) => Promise<void>
  onSuccess?: () => void
  isLoading?: boolean
}

export function BookingEditModal({
  isOpen,
  onClose,
  booking,
  onSave,
  onSuccess,
  isLoading = false
}: BookingEditModalProps) {
  // Fetch available desks
  const { data: desksData } = useApi<Desk[]>('/api/desks')
  const availableDesks = desksData?.filter(desk => desk.status === 'available') || []

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      deskId: '',
      startTime: '',
      endTime: '',
      status: 'pending',
      paymentMethod: 'cash',
      totalAmount: 0,
      paymentStatus: 'pending',
      notes: ''
    }
  })

  useEffect(() => {
    if (booking) {
      form.reset({
        customerName: booking.customer.name,
        customerPhone: booking.customer.phone,
        customerEmail: booking.customer.email || '',
        deskId: booking.deskId,
        startTime: new Date(booking.startTime).toISOString().slice(0, 16),
        endTime: new Date(booking.endTime).toISOString().slice(0, 16),
        status: booking.status,
        paymentMethod: 'cash', // Default since not in existing model
        totalAmount: booking.totalAmount,
        paymentStatus: booking.paymentStatus,
        notes: booking.notes || ''
      })
    } else {
      form.reset({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        deskId: '',
        startTime: new Date().toISOString().slice(0, 16),
        endTime: new Date(Date.now() + 3600000).toISOString().slice(0, 16), // +1 hour
        status: 'pending',
        paymentMethod: 'cash',
        totalAmount: 0,
        paymentStatus: 'pending',
        notes: ''
      })
    }
  }, [booking, form])

  const handleSave = async () => {
    const isValid = await form.trigger()
    if (isValid) {
      const data = form.getValues()
      
      // Transform data to match API expectations
      const bookingData = {
        customer: {
          name: data.customerName,
          phone: data.customerPhone,
          email: data.customerEmail || ''
        },
        deskId: data.deskId,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        status: data.status,
        totalAmount: data.totalAmount,
        paymentStatus: data.paymentStatus,
        notes: data.notes
      }
      
      try {
        if (booking) {
          // Update existing booking
          const response = await fetch(`/api/bookings/${booking._id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
          })
          if (!response.ok) throw new Error('Failed to update booking')
        } else {
          // Create new booking
          const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bookingData)
          })
          if (!response.ok) throw new Error('Failed to create booking')
        }
        
        onSuccess?.()
        onClose()
        form.reset()
      } catch (error) {
        console.error('Error saving booking:', error)
      }
    }
  }

  const handleCancel = () => {
    form.reset()
    onClose()
  }

  return (
    <EditModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <span>{booking ? 'Edit Booking' : 'Create Booking'}</span>
        </div>
      }
      onSave={handleSave}
      onCancel={handleCancel}
      isLoading={isLoading}
      className="max-w-4xl"
    >
      <Form {...form}>
        <div className="space-y-6">
          
          {/* Customer Information Section */}
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-slate-600" />
              <h3 className="font-semibold text-slate-800">Customer Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Customer Name *
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="Enter customer name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone Number *
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="+1 (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="customerEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email Address
                    </FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="customer@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Desk Selection & Booking Details */}
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-800">Desk & Booking Details</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deskId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Monitor className="h-4 w-4" />
                      Select Desk *
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose available desk" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableDesks.map((desk) => (
                          <SelectItem key={desk._id} value={desk._id}>
                            Desk {desk.number} - {desk.label} (${desk.hourlyRate}/hr)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Status
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="confirmed">Confirmed</SelectItem>
                        <SelectItem value="checked-in">Checked In</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Booking Time Section */}
          <div className="bg-green-50 rounded-xl p-6 border border-green-100">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-800">Booking Time</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Start Time *
                    </FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      End Time *
                    </FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Payment Section */}
          <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-800">Payment Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" />
                      Payment Method
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="transfer">Bank Transfer</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Total Amount *
                    </FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="paymentStatus"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Payment Status
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="refunded">Refunded</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Notes Section */}
          <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
            <div className="flex items-center gap-2 mb-4">
              <Mail className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-purple-800">Additional Notes</h3>
            </div>
            
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="Add any special instructions or notes..."
                      className="w-full h-20 px-4 py-3 border border-purple-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none transition-all duration-200"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

        </div>
      </Form>
    </EditModal>
  )
}