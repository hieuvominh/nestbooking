'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { EditModal } from './EditModal'
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
import { User, Mail, Monitor, Clock, Calendar, CheckCircle } from 'lucide-react'

const bookingSchema = z.object({
  customerName: z.string().min(1, 'Customer name is required'),
  customerEmail: z.string().email('Invalid email address'),
  deskId: z.string().min(1, 'Desk selection is required'),
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  status: z.enum(['pending', 'confirmed', 'checked-in', 'completed', 'cancelled'])
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
  deskNumber: number
  startTime: string
  endTime: string
  status: 'pending' | 'confirmed' | 'checked-in' | 'completed' | 'cancelled'
  totalAmount: number
  paymentStatus: 'pending' | 'paid' | 'refunded'
  publicToken?: string
  notes?: string
  checkedInAt?: string
  createdAt: string
  updatedAt: string
}

interface Desk {
  _id: string
  label: string
  status: string
}

interface BookingEditModalProps {
  isOpen: boolean
  onClose: () => void
  booking?: Booking | null
  desks: Desk[]
  onSave: (data: BookingFormData) => Promise<void>
  isLoading?: boolean
}

export function BookingEditModal({
  isOpen,
  onClose,
  booking,
  desks,
  onSave,
  isLoading = false
}: BookingEditModalProps) {
  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      deskId: '',
      startTime: '',
      endTime: '',
      status: 'pending'
    }
  })

  useEffect(() => {
    if (booking) {
      form.reset({
        customerName: booking.customer.name,
        customerEmail: booking.customer.email,
        deskId: booking.deskId,
        startTime: new Date(booking.startTime).toISOString().slice(0, 16),
        endTime: new Date(booking.endTime).toISOString().slice(0, 16),
        status: booking.status
      })
    } else {
      form.reset({
        customerName: '',
        customerEmail: '',
        deskId: '',
        startTime: '',
        endTime: '',
        status: 'pending'
      })
    }
  }, [booking, form])

  const handleSave = async () => {
    const isValid = await form.trigger()
    if (isValid) {
      const data = form.getValues()
      await onSave(data)
    }
  }

  const handleCancel = () => {
    form.reset()
  }

  return (
    <EditModal
      isOpen={isOpen}
      onClose={onClose}
      title={booking ? 'Edit Booking' : 'Create Booking'}
      onSave={handleSave}
      onCancel={handleCancel}
      isLoading={isLoading}
    >
      <Form {...form}>
        <div className="space-y-6">
          {/* Customer Information Section */}
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-medium">Customer Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input 
                          placeholder="Enter customer name" 
                          {...field} 
                          className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
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
                    <FormLabel className="text-slate-700 font-medium">Customer Email</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input 
                          type="email" 
                          placeholder="Enter customer email" 
                          {...field} 
                          className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Booking Details Section */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-700 mb-4 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Booking Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deskId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-medium">Desk</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                          <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4 text-slate-400" />
                            <SelectValue placeholder="Select a desk" />
                          </div>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {desks?.map((desk) => (
                          <SelectItem key={desk._id} value={desk._id}>
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4" />
                              {desk.label}
                            </div>
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
                    <FormLabel className="text-slate-700 font-medium">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="border-slate-300 focus:border-blue-500 focus:ring-blue-500">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-slate-400" />
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            Pending
                          </div>
                        </SelectItem>
                        <SelectItem value="confirmed">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            Confirmed
                          </div>
                        </SelectItem>
                        <SelectItem value="checked-in">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            Checked In
                          </div>
                        </SelectItem>
                        <SelectItem value="completed">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                            Completed
                          </div>
                        </SelectItem>
                        <SelectItem value="cancelled">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            Cancelled
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Time Section */}
          <div className="bg-green-50 rounded-lg p-4 border border-green-200">
            <h3 className="text-sm font-semibold text-green-700 mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Time Schedule
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-700 font-medium">Start Time</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input 
                          type="datetime-local" 
                          {...field} 
                          className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
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
                    <FormLabel className="text-slate-700 font-medium">End Time</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input 
                          type="datetime-local" 
                          {...field} 
                          className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
      </Form>
    </EditModal>
  )
}