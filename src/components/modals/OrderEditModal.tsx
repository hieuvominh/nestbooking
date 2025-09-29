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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ShoppingCart, User, Mail, Package, Clock, CheckCircle, FileText, DollarSign } from 'lucide-react'

const orderSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled']),
  notes: z.string().optional()
})

type OrderFormData = z.infer<typeof orderSchema>

interface Order {
  _id: string
  bookingId: {
    _id: string
    customer: {
      name: string
      email: string
    }
    deskId: string
  }
  items: {
    itemId: {
      _id: string
      name: string
      price: number
    }
    name: string
    price: number
    quantity: number
    subtotal: number
  }[]
  total: number
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  notes?: string
  orderedAt: string
  deliveredAt?: string
  createdAt: string
  updatedAt: string
}

interface OrderEditModalProps {
  isOpen: boolean
  onClose: () => void
  order?: Order | null
  onSave: (data: OrderFormData) => Promise<void>
  isLoading?: boolean
}

export function OrderEditModal({
  isOpen,
  onClose,
  order,
  onSave,
  isLoading = false
}: OrderEditModalProps) {
  const form = useForm<OrderFormData>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      status: 'pending',
      notes: ''
    }
  })

  useEffect(() => {
    if (order) {
      form.reset({
        status: order.status,
        notes: order.notes || ''
      })
    } else {
      form.reset({
        status: 'pending',
        notes: ''
      })
    }
  }, [order, form])

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'text-yellow-600 bg-yellow-100'
      case 'confirmed': return 'text-blue-600 bg-blue-100'
      case 'preparing': return 'text-orange-600 bg-orange-100'
      case 'ready': return 'text-green-600 bg-green-100'
      case 'delivered': return 'text-gray-600 bg-gray-100'
      case 'cancelled': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  return (
    <EditModal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
          </div>
          <span>Edit Order</span>
        </div>
      }
      onSave={handleSave}
      onCancel={handleCancel}
      isLoading={isLoading}
      className="max-w-2xl"
    >
      {order && (
        <div className="space-y-6">
          
          {/* Customer Information Section */}
          <div className="bg-slate-50 rounded-xl p-6 border border-slate-100">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-slate-600" />
              <h3 className="font-semibold text-slate-800">Customer Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-600">Customer:</span>
                <span className="text-slate-900">{order.bookingId.customer.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-600">Email:</span>
                <span className="text-slate-900">{order.bookingId.customer.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-600">Order ID:</span>
                <span className="text-slate-900 font-mono">{order._id.slice(-8)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                <span className="font-medium text-slate-600">Ordered:</span>
                <span className="text-slate-900">{new Date(order.orderedAt).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Order Items Section */}
          <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
            <div className="flex items-center gap-2 mb-4">
              <Package className="h-5 w-5 text-blue-600" />
              <h3 className="font-semibold text-blue-800">Order Items</h3>
            </div>
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-100">
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-blue-500" />
                    <div>
                      <span className="font-medium text-slate-900">{item.name}</span>
                      <p className="text-xs text-slate-500">Quantity: {item.quantity}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold text-slate-900">${item.subtotal.toFixed(2)}</span>
                    <p className="text-xs text-slate-500">${item.price.toFixed(2)} each</p>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3 border-t border-blue-200">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-800">Total Amount</span>
                </div>
                <span className="text-xl font-bold text-blue-900">${order.total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Status and Notes Section */}
          <Form {...form}>
            <div className="space-y-6">
              
              {/* Order Status Section */}
              <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <h3 className="font-semibold text-green-800">Order Status</h3>
                </div>
                
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
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="pending">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-yellow-400" />
                              Pending
                            </div>
                          </SelectItem>
                          <SelectItem value="confirmed">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-blue-400" />
                              Confirmed
                            </div>
                          </SelectItem>
                          <SelectItem value="preparing">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-orange-400" />
                              Preparing
                            </div>
                          </SelectItem>
                          <SelectItem value="ready">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-green-400" />
                              Ready
                            </div>
                          </SelectItem>
                          <SelectItem value="delivered">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-gray-400" />
                              Delivered
                            </div>
                          </SelectItem>
                          <SelectItem value="cancelled">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full bg-red-400" />
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

              {/* Notes Section */}
              <div className="bg-amber-50 rounded-xl p-6 border border-amber-100">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="h-5 w-5 text-amber-600" />
                  <h3 className="font-semibold text-amber-800">Order Notes</h3>
                </div>
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Notes
                      </FormLabel>
                      <FormControl>
                        <textarea
                          placeholder="Add any special instructions or notes about this order..."
                          className="w-full h-20 px-4 py-3 border border-amber-200 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none transition-all duration-200"
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
        </div>
      )}
    </EditModal>
  )
}