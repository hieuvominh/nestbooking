"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EditModal } from "./EditModal";
import { useApi } from "@/hooks/useApi";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const inventorySchema = z.object({
  name: z.string().min(1, "Item name is required"),
  description: z.string().optional(),
  price: z.number().min(0, "Price must be positive"),
  quantity: z.number().min(0, "Quantity must be positive"),
  category: z.enum([
    "food",
    "beverage",
    "office-supplies",
    "merchandise",
    "combo",
  ]),
  unit: z.string().min(1, "Unit is required"),
  sku: z.string().min(1, "SKU is required"),
  lowStockThreshold: z.number().min(0, "Low stock threshold must be positive"),
  includedItems: z
    .array(
      z.object({
        item: z.string().min(1),
        quantity: z.number().min(1),
      })
    )
    .optional(),
});

type InventoryFormData = z.infer<typeof inventorySchema>;

interface InventoryItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  category: "food" | "beverage" | "office-supplies" | "merchandise" | "combo";
  unit: string;
  sku: string;
  lowStockThreshold: number;
  includedItems?: { item: string; quantity: number }[];
  createdAt: string;
  updatedAt: string;
}

interface InventoryEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: InventoryItem | null;
  onSave: (data: InventoryFormData) => Promise<void>;
  isLoading?: boolean;
}

export function InventoryEditModal({
  isOpen,
  onClose,
  item,
  onSave,
  isLoading = false,
}: InventoryEditModalProps) {
  const { data: allItems } = useApi<InventoryItem[]>("/api/inventory");
  const form = useForm<InventoryFormData>({
    resolver: zodResolver(inventorySchema),
    defaultValues: {
      name: "",
      description: "",
      price: 0,
      quantity: 0,
      category: "food",
      unit: "pcs",
      sku: "",
      lowStockThreshold: 5,
    },
  });

  useEffect(() => {
    if (item) {
      form.reset({
        name: item.name,
        description: item.description || "",
        price: item.price,
        quantity: item.quantity,
        category: item.category,
        unit: item.unit,
        sku: item.sku,
        lowStockThreshold: item.lowStockThreshold,
        includedItems: item.includedItems || [],
      });
    } else {
      form.reset({
        name: "",
        description: "",
        price: 0,
        quantity: 0,
        category: "food",
        unit: "pcs",
        sku: "",
        lowStockThreshold: 5,
        includedItems: [],
      });
    }
  }, [item, form]);

  const handleSave = async () => {
    const isValid = await form.trigger();
    if (isValid) {
      const data = form.getValues();
      await onSave(data);
    }
  };

  const handleCancel = () => {
    form.reset();
  };

  return (
    <EditModal
      isOpen={isOpen}
      onClose={onClose}
      title={item ? "Edit Inventory Item" : "Create Inventory Item"}
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
                    <SelectItem value="office-supplies">
                      Office Supplies
                    </SelectItem>
                    <SelectItem value="merchandise">Merchandise</SelectItem>
                    <SelectItem value="combo">Combo</SelectItem>
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
                    onChange={(e) =>
                      field.onChange(parseFloat(e.target.value) || 0)
                    }
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
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 0)
                    }
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
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 0)
                    }
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
        {/* Combo builder */}
        {form.watch("category") === "combo" && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Combo components</h4>
            <div className="space-y-2">
              {(form.getValues().includedItems || []).map((comp, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={comp.item}
                    onChange={(e) => {
                      const list = form.getValues().includedItems || [];
                      list[idx] = { ...list[idx], item: e.target.value };
                      form.setValue("includedItems", list);
                    }}
                    className="flex-1 p-2 border rounded"
                  >
                    <option value="">-- select item --</option>
                    {allItems
                      ?.filter((it) => (it as any).type !== "combo")
                      .map((it) => (
                        <option key={it._id} value={it._id}>
                          {it.name}
                        </option>
                      ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={comp.quantity}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      const list = form.getValues().includedItems || [];
                      list[idx] = { ...list[idx], quantity: val };
                      form.setValue("includedItems", list);
                    }}
                    className="w-24 p-2 border rounded"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const list = form.getValues().includedItems || [];
                      list.splice(idx, 1);
                      form.setValue("includedItems", list);
                    }}
                    className="px-2 py-1 text-sm text-red-600"
                  >
                    Remove
                  </button>
                </div>
              ))}

              <div>
                <button
                  type="button"
                  onClick={() => {
                    const list = form.getValues().includedItems || [];
                    list.push({ item: "", quantity: 1 });
                    form.setValue("includedItems", list);
                  }}
                  className="px-3 py-1 bg-blue-500 text-white rounded"
                >
                  Add component
                </button>
              </div>
            </div>
          </div>
        )}
      </Form>
    </EditModal>
  );
}
