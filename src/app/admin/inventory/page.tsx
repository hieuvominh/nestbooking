"use client";

import { useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface InventoryItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  category: "food" | "drinks" | "snacks" | "supplies";
  isAvailable: boolean;
  image?: string;
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
    "inventory"
  );
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    price: number;
    stock: number;
    category: "food" | "drinks" | "snacks" | "supplies";
    isAvailable: boolean;
    image: string;
  }>({
    name: "",
    description: "",
    price: 0,
    stock: 0,
    category: "food",
    isAvailable: true,
    image: "",
  });

  const { data: inventory, mutate: mutateInventory } = useApi<InventoryItem[]>(
    "/api/inventory",
    {
      refreshInterval: 10000, // Poll every 10 seconds
    }
  );
  const { data: ordersResponse, mutate: mutateOrders } = useApi<OrdersResponse>(
    "/api/orders",
    {
      refreshInterval: 5000, // Poll orders more frequently (5 seconds) for kitchen updates
    }
  );
  const { apiCall } = useApi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await apiCall(`/api/inventory/${editingItem._id}`, {
          method: "PUT",
          body: formData,
        });
      } else {
        await apiCall("/api/inventory", {
          method: "POST",
          body: formData,
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
        method: "PUT",
        body: { stock: newStock },
      });
      mutateInventory();
    } catch (error) {
      console.error("Error updating stock:", error);
    }
  };

  const handleOrderStatusUpdate = async (
    orderId: string,
    status: Order["status"]
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
      category: "food",
      isAvailable: true,
      image: "",
    });
    setIsCreating(false);
    setEditingItem(null);
  };

  const startEdit = (item: InventoryItem) => {
    setFormData({
      name: item.name,
      description: item.description,
      price: item.price,
      stock: item.stock,
      category: item.category,
      isAvailable: item.isAvailable,
      image: item.image || "",
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Inventory & Orders</h1>
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
              Inventory
            </button>
            <button
              onClick={() => setActiveTab("orders")}
              className={`px-4 py-2 rounded-r-lg ${
                activeTab === "orders"
                  ? "bg-blue-500 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              Orders
            </button>
          </div>
          {activeTab === "inventory" && (
            <Button onClick={() => setIsCreating(true)}>Add New Item</Button>
          )}
        </div>
      </div>

      {activeTab === "inventory" && (
        <>
          {isCreating && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingItem ? "Edit Item" : "Add New Item"}
                </CardTitle>
                <CardDescription>
                  {editingItem
                    ? "Update item details"
                    : "Add a new item to inventory"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="name" className="text-sm font-medium">
                        Item Name
                      </label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            name: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="category" className="text-sm font-medium">
                        Category
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
                        <option value="food">Food</option>
                        <option value="drinks">Drinks</option>
                        <option value="snacks">Snacks</option>
                        <option value="supplies">Supplies</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="description"
                      className="text-sm font-medium"
                    >
                      Description
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

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label htmlFor="price" className="text-sm font-medium">
                        Price ($)
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
                      <label htmlFor="stock" className="text-sm font-medium">
                        Stock Quantity
                      </label>
                      <Input
                        id="stock"
                        type="number"
                        min="0"
                        value={formData.stock}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            stock: parseInt(e.target.value) || 0,
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
                        Available
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
                          Item is available for ordering
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="image" className="text-sm font-medium">
                      Image URL (optional)
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
                      {editingItem ? "Update Item" : "Add Item"}
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
              <CardTitle>Inventory Items</CardTitle>
              <CardDescription>
                Manage your inventory and stock levels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory?.map((item) => (
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
                        {item.category}
                      </TableCell>
                      <TableCell>${item.price.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${getStockColor(
                              item.stock
                            )}`}
                          >
                            {item.stock}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleStockUpdate(item._id, item.stock + 1)
                              }
                              className="h-6 w-6 p-0"
                            >
                              +
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                handleStockUpdate(
                                  item._id,
                                  Math.max(0, item.stock - 1)
                                )
                              }
                              className="h-6 w-6 p-0"
                            >
                              -
                            </Button>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            item.isAvailable
                              ? "text-green-600 bg-green-100"
                              : "text-red-600 bg-red-100"
                          }`}
                        >
                          {item.isAvailable ? "Available" : "Unavailable"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(item._id)}
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

              {!inventory ||
                (inventory.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No inventory items found. Add your first item to get
                    started.
                  </div>
                ))}
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === "orders" && (
        <Card>
          <CardHeader>
            <CardTitle>Customer Orders</CardTitle>
            <CardDescription>
              Manage customer food and beverage orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Order Time</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ordersResponse?.orders?.map((order) => (
                  <TableRow key={order._id}>
                    <TableCell className="font-mono text-sm">
                      {order._id.slice(-8)}
                    </TableCell>
                    <TableCell>{order.bookingId.customer.name}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {order.items.map((item, index) => (
                          <div key={index} className="text-sm">
                            {item.quantity}x {item.name}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>${order.total.toFixed(2)}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${getOrderStatusColor(
                          order.status
                        )}`}
                      >
                        {order.status}
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
                            Start
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
                            Ready
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
                            Deliver
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
                              Cancel
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
