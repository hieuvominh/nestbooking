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

const inventorySchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  description: z.string().optional(),
  price: z.number().min(0, 'Price must be positive'),
  quantity: z.number().min(0, 'Quantity must be positive'),
  category: z.enum(['food', 'beverage', 'office-supplies', 'merchandise']),
  unit: z.string().min(1, 'Unit is required'),
  sku: z.string().min(1, 'SKU is required'),
  lowStockThreshold: z.number().min(0, 'Low stock threshold must be positive')
})

type InventoryFormData = z.infer<typeof inventorySchema>

interface InventoryItem {
  _id: string
  name: string
  description: string
  price: number
  quantity: number
  category: 'food' | 'beverage' | 'office-supplies' | 'merchandise'
  unit: string
  sku: string
  lowStockThreshold: number
  createdAt: string
  updatedAt: string
}

interface InventoryEditModalProps {
  isOpen: boolean
  onClose: () => void
  item?: InventoryItem | null
  onSave: (data: InventoryFormData) => Promise<void>
  isLoading?: boolean
}

export function InventoryEditModal({
  isOpen,
  onClose,
  item,
  onSave,
  isLoading = false
}: InventoryEditModalProps) {
  const form = useForm<InventoryFormData>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      quantity: 0,
      category: 'food',
      unit: 'pcs',
      sku: '',
      lowStockThreshold: 5
    }
  })

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        description: item.description || '',
        price: item.price,
        quantity: item.quantity,
        category: item.category,
        unit: item.unit,
        sku: item.sku,
        lowStockThreshold: item.lowStockThreshold
      })
    } else {
      form.reset({
        name: '',
        description: '',
        price: 0,
        quantity: 0,
        category: 'food',
        unit: 'pcs',
        sku: '',
        lowStockThreshold: 5
      })
    }
  }, [item, form])

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
      title={item ? 'Edit Inventory Item' : 'Create Inventory Item'}
      onSave={handleSave}
      onCancel={handleCancel}
      isLoading={isLoading}
    >
      <Form {...form}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Enter item name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., COFF001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="food">Food</SelectItem>
                    <SelectItem value="beverage">Beverage</SelectItem>
                    <SelectItem value="office-supplies">Office Supplies</SelectItem>
                    <SelectItem value="merchandise">Merchandise</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Unit *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., pcs, cups, bottles" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="0" 
                    step="0.01" 
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
            name="quantity"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quantity *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="0" 
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="lowStockThreshold"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Low Stock Alert *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="0" 
                    placeholder="5"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="md:col-span-2">
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <textarea
                      placeholder="Optional description"
                      className="w-full p-2 border border-gray-300 rounded-md min-h-[80px] resize-none"
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