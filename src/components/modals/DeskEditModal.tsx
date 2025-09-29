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

const deskSchema = z.object({
  label: z.string().min(1, 'Desk label is required'),
  location: z.string().optional(),
  description: z.string().optional(),
  hourlyRate: z.number().min(0, 'Hourly rate must be positive'),
  status: z.enum(['available', 'reserved', 'occupied', 'maintenance'])
})

type DeskFormData = z.infer<typeof deskSchema>

interface Desk {
  _id: string
  label: string
  status: 'available' | 'reserved' | 'occupied' | 'maintenance'
  location?: string
  description?: string
  hourlyRate: number
  createdAt: string
  updatedAt: string
}

interface DeskEditModalProps {
  isOpen: boolean
  onClose: () => void
  desk?: Desk | null
  onSave: (data: DeskFormData) => Promise<void>
  isLoading?: boolean
}

export function DeskEditModal({
  isOpen,
  onClose,
  desk,
  onSave,
  isLoading = false
}: DeskEditModalProps) {
  const form = useForm<DeskFormData>({
    resolver: zodResolver(deskSchema),
    defaultValues: {
      label: '',
      location: '',
      description: '',
      hourlyRate: 10,
      status: 'available'
    }
  })

  useEffect(() => {
    if (desk) {
      form.reset({
        label: desk.label,
        location: desk.location || '',
        description: desk.description || '',
        hourlyRate: desk.hourlyRate,
        status: desk.status
      })
    } else {
      form.reset({
        label: '',
        location: '',
        description: '',
        hourlyRate: 10,
        status: 'available'
      })
    }
  }, [desk, form])

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
      title={desk ? 'Edit Desk' : 'Create Desk'}
      onSave={handleSave}
      onCancel={handleCancel}
      isLoading={isLoading}
    >
      <Form {...form}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="label"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Label *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., A1, B2" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="hourlyRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hourly Rate *</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="0" 
                    step="0.01" 
                    placeholder="10.00"
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
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location</FormLabel>
                <FormControl>
                  <Input placeholder="e.g., Window Side, Center" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="status"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="reserved">Reserved</SelectItem>
                    <SelectItem value="occupied">Occupied</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                  </SelectContent>
                </Select>
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