"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/currency";

interface InventoryItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  quantity?: number;
  sku?: string;
  unit?: string;
  duration?: number;
  lowStockThreshold?: number;
  includedItems?: { item: string; quantity: number }[];
  category: "food" | "drinks" | "snacks" | "supplies" | "combo";
  isAvailable: boolean;
  image?: string;
  pricePerPerson?: boolean;
}

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
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "delivered"
    | "cancelled";
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

export default function InventoryPage() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<"inventory" | "orders">(
    "inventory",
  );
  const [isRestocking, setIsRestocking] = useState(false);
  const [restockRows, setRestockRows] = useState<
    Record<string, { quantity: string; totalCost: string; note: string }>
  >({});
  const [restockLoading, setRestockLoading] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);
  const [adjustmentForm, setAdjustmentForm] = useState({
    actualQuantity: "0",
    costDelta: "0",
    note: "",
  });
  const [adjustmentLoading, setAdjustmentLoading] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [adjustmentSuccess, setAdjustmentSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    price: number;
    stock: number;
    sku: string;
    unit: string;
    lowStockThreshold: number;
    includedItems?: { item: string; quantity: number }[];
    duration?: number | undefined;
    category: "food" | "drinks" | "snacks" | "supplies" | "combo";
    isAvailable: boolean;
    image: string;
    pricePerPerson: boolean;
  }>({
    name: "",
    description: "",
    price: 0,
    stock: 0,
    sku: "",
    unit: "pcs",
    lowStockThreshold: 5,
    includedItems: [],
    duration: undefined,
    category: "food",
    isAvailable: true,
    image: "",
    pricePerPerson: false,
  });

  const generateSKU = (name: string) => {
    const clean = (name || "ITEM").toUpperCase().replace(/[^A-Z0-9]/g, "");
    const prefix = clean.slice(0, 3).padEnd(3, "X");
    const suffix = `${Date.now()}`.slice(-4);
    return `${prefix}${suffix}`;
  };

  const { data: inventory, mutate: mutateInventory } = useApi<InventoryItem[]>(
    "/api/inventory",
    {
      refreshInterval: 20000, // Poll every 20 seconds
    },
  );
  const { data: ordersResponse, mutate: mutateOrders } = useApi<OrdersResponse>(
    "/api/orders",
    {
      refreshInterval: 20000, // Poll orders more frequently (20 seconds) for kitchen updates
    },
  );
  const { apiCall } = useApi();

  const inventoryById = useMemo(() => {
    const map = new Map<string, InventoryItem>();
    (inventory || []).forEach((it) => map.set(it._id, it));
    return map;
  }, [inventory]);

  const formatComboSummary = (item: InventoryItem) => {
    if (item.category !== "combo") return null;
    const parts = (item.includedItems || [])
      .map((comp) => {
        const compItem = inventoryById.get(comp.item);
        const name = compItem?.name || `Item ${String(comp.item).slice(-6)}`;
        const qty = comp.quantity ? ` x${comp.quantity}` : "";
        return `${name}${qty}`;
      })
      .filter(Boolean);
    return {
      duration: item.duration ? `${item.duration}h` : "-",
      items: parts.length > 0 ? parts.join(", ") : "No items",
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const body: any = {
        sku: formData.sku,
        name: formData.name,
        description: formData.description,
        category:
          formData.category === "drinks"
            ? "beverage"
            : formData.category === "snacks"
              ? "merchandise"
              : formData.category,
        price: formData.price,
        quantity: formData.stock,
        lowStockThreshold: formData.lowStockThreshold,
        unit: formData.unit,
        imageUrl: formData.image,
      };
      if (formData.category === "combo") {
        body.includedItems = formData.includedItems || [];
        if (formData.duration !== undefined) body.duration = formData.duration;
        body.pricePerPerson = formData.pricePerPerson;
      }

      if (editingItem) {
        await apiCall(`/api/inventory/${editingItem._id}`, {
          method: "PATCH",
          body,
        });
      } else {
        await apiCall("/api/inventory", {
          method: "POST",
          body,
        });
      }
      mutateInventory();
      resetForm();
    } catch (error) {
      console.error("Error saving inventory item:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      await apiCall(`/api/inventory/${id}`, { method: "DELETE" });
      mutateInventory();
    } catch (error) {
      console.error("Error deleting item:", error);
    }
  };

  const handleStockUpdate = async (id: string, newStock: number) => {
    try {
      await apiCall(`/api/inventory/${id}`, {
        method: "PATCH",
        body: { stockAdjustment: newStock, adjustmentType: "set" },
      });
      mutateInventory();
    } catch (error) {
      console.error("Error updating stock:", error);
    }
  };

  const openAdjustmentDialog = (item: InventoryItem) => {
    const currentQuantity = String((item as any).quantity ?? item.stock ?? 0);
    setAdjustingItem(item);
    setAdjustmentForm({
      actualQuantity: currentQuantity,
      costDelta: "0",
      note: "",
    });
    setAdjustmentError(null);
  };

  const closeAdjustmentDialog = () => {
    if (adjustmentLoading) return;
    setAdjustingItem(null);
    setAdjustmentError(null);
  };

  const handleInventoryAdjustment = async () => {
    if (!adjustingItem) return;

    const actualQuantity = Number(adjustmentForm.actualQuantity);
    const costDelta = Number(adjustmentForm.costDelta || "0");

    if (!Number.isFinite(actualQuantity) || actualQuantity < 0) {
      setAdjustmentError("Tồn kho thực tế phải lớn hơn hoặc bằng 0.");
      return;
    }

    if (!Number.isFinite(costDelta)) {
      setAdjustmentError("Chi phí điều chỉnh phải là một số hợp lệ.");
      return;
    }

    setAdjustmentLoading(true);
    setAdjustmentError(null);

    try {
      await apiCall(`/api/inventory/${adjustingItem._id}/adjustment`, {
        method: "POST",
        body: {
          actualQuantity,
          costDelta,
          note: adjustmentForm.note.trim() || undefined,
        },
      });
      mutateInventory();
      setAdjustmentSuccess(`Đã điều chỉnh ${adjustingItem.name} thành công.`);
      setAdjustingItem(null);
    } catch (error) {
      setAdjustmentError(
        error instanceof Error ? error.message : "Không thể điều chỉnh mặt hàng.",
      );
    } finally {
      setAdjustmentLoading(false);
    }
  };

  const handleBulkRestock = async () => {
    const entries = Object.entries(restockRows).filter(([id, v]) => {
      const item = inventoryById.get(id);
      if (item && ((item as any).type === "combo" || item.category === "combo"))
        return false;
      return parseFloat(v.quantity) > 0 && parseFloat(v.totalCost) >= 0;
    });
    if (entries.length === 0) return;
    setRestockLoading(true);
    try {
      await apiCall("/api/inventory/restock-bulk", {
        method: "POST",
        body: {
          items: entries.map(([id, v]) => ({
            id,
            quantity: parseFloat(v.quantity),
            cost: parseFloat(v.totalCost),
            note: v.note || undefined,
          })),
        },
      });
      mutateInventory();
      setIsRestocking(false);
      setRestockRows({});
    } catch (error) {
      console.error("Error restocking items:", error);
    } finally {
      setRestockLoading(false);
    }
  };

  const handleOrderStatusUpdate = async (
    orderId: string,
    status: Order["status"],
  ) => {
    try {
      await apiCall(`/api/orders/${orderId}`, {
        method: "PUT",
        body: { status },
      });
      mutateOrders();
    } catch (error) {
      console.error("Error updating order status:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      price: 0,
      stock: 0,
      sku: "",
      unit: "pcs",
      lowStockThreshold: 5,
      includedItems: [],
      duration: undefined,
      category: "food",
      isAvailable: true,
      image: "",
      pricePerPerson: false,
    });
    setIsCreating(false);
    setEditingItem(null);
  };

  const startEdit = (item: InventoryItem) => {
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price,
      stock: (item as any).quantity ?? item.stock,
      sku: item.sku || "",
      unit: item.unit || "pcs",
      lowStockThreshold: item.lowStockThreshold || 5,
      includedItems: item.includedItems || [],
      duration: (item as any).duration ?? undefined,
      category: (item.category as any) || "food",
      isAvailable: item.isAvailable,
      image: item.image || "",
      pricePerPerson: (item as any).pricePerPerson ?? false,
    });
    setEditingItem(item);
    setIsCreating(true);
  };

  const getStockColor = (stock: number) => {
    if (stock === 0) return "text-red-600 bg-red-100";
    if (stock < 10) return "text-yellow-600 bg-yellow-100";
    return "text-green-600 bg-green-100";
  };

  const getOrderStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-600 bg-yellow-100";
      case "preparing":
        return "text-blue-600 bg-blue-100";
      case "ready":
        return "text-green-600 bg-green-100";
      case "delivered":
        return "text-gray-600 bg-gray-100";
      case "cancelled":
        return "text-red-600 bg-red-100";
      default:
        return "text-gray-600 bg-gray-100";
    }
  };

  const translateCategory = (cat: string) => {
    switch (cat) {
      case "food":
        return "Thức ăn";
      case "drinks":
        return "Đồ uống";
      case "snacks":
        return "Đồ ăn vặt";
      case "supplies":
        return "Vật tư";
      default:
        return cat;
    }
  };

  const translateAvailability = (available: boolean) =>
    available ? "Còn hàng" : "Hết hàng";

  const translateOrderStatus = (status: string) => {
    switch (status) {
      case "pending":
        return "Đang chờ";
      case "preparing":
        return "Đang chuẩn bị";
      case "ready":
        return "Sẵn sàng";
      case "delivered":
        return "Đã giao";
      case "cancelled":
        return "Đã hủy";
      default:
        return status;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Kho hàng & Đơn hàng</h1>
        <div className="flex gap-2">
          <div className="flex border rounded-lg">
            <button
              onClick={() => setActiveTab("inventory")}
              className={`px-4 py-2 rounded-l-lg ${
                activeTab === "inventory"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Kho hàng
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-2 rounded-r-lg ${
                activeTab === "orders"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Đơn hàng
            </button>
          </div>
          {activeTab === "inventory" && (
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setIsRestocking(true);
                  setRestockRows({});
                }}
              >
                Nhập hàng
              </Button>
              <Button onClick={() => setIsCreating(true)}>
                Thêm mặt hàng mới
              </Button>
            </>
          )}
        </div>
      </div>

      {activeTab === "inventory" && (
        <>
          {isRestocking && (
            <Card>
              <CardHeader>
                <CardTitle>Nhập hàng</CardTitle>
                <CardDescription>
                  Điền số lượng và chi phí cho mặt hàng cần nhập. Mặt hàng nào
                  không điền sẽ bỏ qua.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mặt hàng</TableHead>
                      <TableHead>Tồn kho</TableHead>
                      <TableHead>Số lượng nhập</TableHead>
                      <TableHead>Tổng chi phí (VND)</TableHead>
                      <TableHead>Ghi chú</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventory
                      ?.filter(
                        (item) =>
                          (item as any).type !== "combo" &&
                          item.category !== "combo",
                      )
                      .map((item) => {
                        const itemStock = (item as any).quantity ?? item.stock;
                        const row = restockRows[item._id] ?? {
                          quantity: "",
                          totalCost: "",
                          note: "",
                        };
                        return (
                          <TableRow key={item._id}>
                            <TableCell>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-gray-500">
                                {translateCategory(item.category)}
                              </div>
                            </TableCell>

                            <TableCell>
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${getStockColor(itemStock)}`}
                              >
                                {itemStock}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={row.quantity}
                                onChange={(e) =>
                                  setRestockRows((prev) => ({
                                    ...prev,
                                    [item._id]: {
                                      ...row,
                                      quantity: e.target.value,
                                    },
                                  }))
                                }
                                className="w-24"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={0}
                                placeholder="0"
                                value={row.totalCost}
                                onChange={(e) =>
                                  setRestockRows((prev) => ({
                                    ...prev,
                                    [item._id]: {
                                      ...row,
                                      totalCost: e.target.value,
                                    },
                                  }))
                                }
                                className="w-32"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                placeholder="Ghi chú..."
                                value={row.note}
                                onChange={(e) =>
                                  setRestockRows((prev) => ({
                                    ...prev,
                                    [item._id]: {
                                      ...row,
                                      note: e.target.value,
                                    },
                                  }))
                                }
                                className="w-40"
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
                <div className="flex gap-2 mt-4">
                  <Button onClick={handleBulkRestock} disabled={restockLoading}>
                    {restockLoading ? "Đang lưu..." : "Xác nhận nhập hàng"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsRestocking(false);
                      setRestockRows({});
                    }}
                  >
                    Hủy
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isCreating && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingItem ? "Chỉnh sửa mặt hàng" : "Thêm mặt hàng mới"}
                </CardTitle>
                <CardDescription>
                  {editingItem
                    ? "Cập nhật thông tin mặt hàng"
                    : "Thêm mặt hàng mới vào kho"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">
                        Tên mặt hàng
                      </label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                            ...(editingItem
                              ? {}
                              : { sku: generateSKU(e.target.value) }),
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="category" className="text-sm font-medium">
                        Danh mục
                      </label>
                      <select
                        id="category"
                        value={formData.category}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            category: e.target.value as any,
                          }))
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="food">Thức ăn</option>
                        <option value="drinks">Đồ uống</option>
                        <option value="snacks">Đồ ăn vặt</option>
                        <option value="supplies">Vật tư</option>
                        <option value="combo">Combo</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-2">
                    <div className="space-y-2">
                      <label htmlFor="unit" className="text-sm font-medium">
                        Đơn vị
                      </label>
                      <Input
                        id="unit"
                        value={formData.unit}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            unit: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="description"
                      className="text-sm font-medium"
                    >
                      Mô tả
                    </label>
                    <Input
                      id="description"
                      value={formData.description}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  {formData.category === "combo" && (
                    <div className="mt-4 border p-4 rounded bg-gray-50">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="font-medium">Combo settings</div>
                        <div className="text-xs text-gray-500">
                          Chọn món kèm và số lượng
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="text-sm font-medium">
                          Thời lượng (giờ)
                        </label>
                        <Input
                          type="number"
                          min={0}
                          value={formData.duration ?? ""}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              duration:
                                e.target.value === ""
                                  ? undefined
                                  : parseFloat(e.target.value) || 0,
                            }))
                          }
                        />
                      </div>
                      <div className="mb-4 flex items-center gap-2">
                        <input
                          id="pricePerPerson"
                          type="checkbox"
                          checked={formData.pricePerPerson}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              pricePerPerson: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded"
                        />
                        <label
                          htmlFor="pricePerPerson"
                          className="text-sm font-medium"
                        >
                          Tính giá theo đầu người (giá × số khách)
                        </label>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">Món đi kèm</h4>
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              includedItems: [
                                ...(prev.includedItems || []),
                                { item: "", quantity: 1 },
                              ],
                            }))
                          }
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm"
                        >
                          Thêm món
                        </button>
                      </div>
                      {(formData.includedItems || []).length === 0 && (
                        <div className="text-sm text-gray-500 mb-2">
                          Chưa có món đi kèm
                        </div>
                      )}
                      {(formData.includedItems || []).map((comp, idx) => (
                        <div key={idx} className="flex gap-2 items-center mb-2">
                          <select
                            value={comp.item}
                            onChange={(e) => {
                              const list = formData.includedItems || [];
                              list[idx] = {
                                ...list[idx],
                                item: e.target.value,
                              };
                              setFormData((prev) => ({
                                ...prev,
                                includedItems: list,
                              }));
                            }}
                            className="flex-1 p-2 border rounded"
                          >
                            <option value="">-- chọn món --</option>
                            {inventory
                              ?.filter(
                                (it: any) => (it as any).type !== "combo",
                              )
                              .map((it: any) => (
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
                              const list = formData.includedItems || [];
                              list[idx] = { ...list[idx], quantity: val };
                              setFormData((prev) => ({
                                ...prev,
                                includedItems: list,
                              }));
                            }}
                            className="w-24 p-2 border rounded"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const list = formData.includedItems || [];
                              list.splice(idx, 1);
                              setFormData((prev) => ({
                                ...prev,
                                includedItems: list,
                              }));
                            }}
                            className="px-2 py-1 text-sm text-red-600"
                          >
                            Xóa
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="price" className="text-sm font-medium">
                        Giá (VNĐ)
                      </label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.price}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            price: parseFloat(e.target.value) || 0,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        htmlFor="isAvailable"
                        className="text-sm font-medium"
                      >
                        Còn hàng
                      </label>
                      <div className="flex items-center pt-2">
                        <input
                          id="isAvailable"
                          type="checkbox"
                          checked={formData.isAvailable}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              isAvailable: e.target.checked,
                            }))
                          }
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label
                          htmlFor="isAvailable"
                          className="ml-2 text-sm text-gray-700"
                        >
                          Mặt hàng có thể đặt
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="image" className="text-sm font-medium">
                      URL hình ảnh (tùy chọn)
                    </label>
                    <Input
                      id="image"
                      type="url"
                      value={formData.image}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          image: e.target.value,
                        }))
                      }
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit">
                      {editingItem ? "Cập nhật mặt hàng" : "Thêm mặt hàng"}
                    </Button>
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Hủy
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Mặt hàng trong kho</CardTitle>
              <CardDescription>Quản lý tồn kho và mức tồn</CardDescription>
            </CardHeader>
            <CardContent>
              {adjustmentSuccess && (
                <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                  {adjustmentSuccess}
                </div>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mặt hàng</TableHead>
                    <TableHead>Danh mục</TableHead>
                    <TableHead>Combo</TableHead>
                    <TableHead>Giá</TableHead>
                    <TableHead>Tồn kho</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead>Hành động</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory?.map((item) => {
                    const isCombo =
                      item.category === "combo" ||
                      (item as any).type === "combo";
                    const itemStock = isCombo
                      ? null
                      : ((item as any).quantity ?? item.stock);
                    return (
                      <TableRow key={item._id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-gray-500">
                              {item.description}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="capitalize">
                          {translateCategory(item.category)}
                        </TableCell>
                        <TableCell>
                          {item.category === "combo" ? (
                            <div className="text-xs text-gray-600">
                              <div>
                                Thời lượng: {formatComboSummary(item)?.duration}
                              </div>
                              <div className="line-clamp-2">
                                {formatComboSummary(item)?.items}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>{formatCurrency(item.price)}</TableCell>
                        <TableCell>
                          {isCombo ? (
                            <span className="text-xs text-gray-400">-</span>
                          ) : (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getStockColor(itemStock)}`}
                            >
                              {itemStock}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          {isCombo ? (
                            <span className="px-2 py-1 rounded-full text-xs font-medium text-gray-600 bg-gray-100">
                              Combo
                            </span>
                          ) : (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${(item.quantity ?? 0) > 0 ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"}`}
                            >
                              {(item.quantity ?? 0) > 0
                                ? "Còn hàng"
                                : "Hết hàng"}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {!isCombo && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openAdjustmentDialog(item)}
                              >
                                Điều chỉnh
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startEdit(item)}
                            >
                              Sửa
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(item._id)}
                              className="text-red-600 hover:bg-red-50"
                            >
                              Xóa
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {!inventory ||
                (inventory.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    Không tìm thấy mặt hàng trong kho. Thêm mặt hàng đầu tiên để
                    bắt đầu.
                  </div>
                ))}
            </CardContent>
          </Card>

          <Dialog open={!!adjustingItem} onOpenChange={(open) => !open && closeAdjustmentDialog()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Điều chỉnh tồn kho</DialogTitle>
                <DialogDescription>
                  Set lại số lượng thực tế và ghi nhận chênh lệch chi phí nếu cần.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">
                    {adjustingItem?.name}
                  </div>
                  <div>
                    Tồn kho hiện tại: {adjustingItem ? ((adjustingItem as any).quantity ?? adjustingItem.stock ?? 0) : 0}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tồn kho thực tế</label>
                  <Input
                    type="number"
                    min={0}
                    value={adjustmentForm.actualQuantity}
                    onChange={(e) =>
                      setAdjustmentForm((prev) => ({
                        ...prev,
                        actualQuantity: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Chênh lệch chi phí (VND)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={adjustmentForm.costDelta}
                    onChange={(e) =>
                      setAdjustmentForm((prev) => ({
                        ...prev,
                        costDelta: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-gray-500">
                    Nhập số dương nếu cần cộng thêm chi phí, số âm nếu cần giảm hoặc hoàn chi phí.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Ghi chú</label>
                  <Input
                    placeholder="Ví dụ: kiểm kho lại, nhập dư, nhà cung cấp hoàn tiền..."
                    value={adjustmentForm.note}
                    onChange={(e) =>
                      setAdjustmentForm((prev) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                  />
                </div>

                {adjustmentError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {adjustmentError}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={closeAdjustmentDialog} disabled={adjustmentLoading}>
                  Hủy
                </Button>
                <Button onClick={handleInventoryAdjustment} disabled={adjustmentLoading}>
                  {adjustmentLoading ? "Đang lưu..." : "Lưu điều chỉnh"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {activeTab === "orders" && (
        <Card>
          <CardHeader>
            <CardTitle>Đơn hàng khách</CardTitle>
            <CardDescription>
              Quản lý đơn thức ăn và đồ uống của khách
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Khách hàng</TableHead>
                  <TableHead>Mặt hàng</TableHead>
                  <TableHead>Tổng</TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Hành động</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersResponse?.orders?.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell className="font-mono text-sm">
                      {order._id.slice(-8)}
                    </TableCell>
                    <TableCell>
                      {order.bookingId &&
                      typeof order.bookingId === "object" &&
                      order.bookingId.customer
                        ? order.bookingId.customer.name
                        : "—"}
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
                    <TableCell>{formatCurrency(order.total)}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(
                          order.status,
                        )}`}
                      >
                        {translateOrderStatus(order.status)}
                      </span>
                    </TableCell>
                    <TableCell>{formatDateTime(order.orderedAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {order.status === "pending" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleOrderStatusUpdate(order._id, "preparing")
                            }
                          >
                            Bắt đầu
                          </Button>
                        )}
                        {order.status === "preparing" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleOrderStatusUpdate(order._id, "ready")
                            }
                          >
                            Sẵn sàng
                          </Button>
                        )}
                        {order.status === "ready" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              handleOrderStatusUpdate(order._id, "delivered")
                            }
                          >
                            Giao
                          </Button>
                        )}
                        {order.status !== "delivered" &&
                          order.status !== "cancelled" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleOrderStatusUpdate(order._id, "cancelled")
                              }
                              className="text-red-600 hover:bg-red-50"
                            >
                              Hủy
                            </Button>
                          )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {!ordersResponse?.orders ||
              (ordersResponse.orders.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No orders found.
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
