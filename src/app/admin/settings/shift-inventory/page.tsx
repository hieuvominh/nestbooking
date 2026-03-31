"use client";

import { useEffect, useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getShiftCode, getShiftDateKey } from "@/lib/shift";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface InventoryItem {
  _id: string;
  name: string;
  price: number;
  quantity: number;
  category?: string;
}

interface ShiftItem {
  _id: string;
  itemId: InventoryItem;
  openingQty: number;
  receivedQty: number;
  soldQty: number;
  actualQty?: number;
  variance?: number;
  reconciledAt?: string;
}

interface ShiftResponse {
  dateKey: string;
  shiftCode: "S1" | "S2" | "S3";
  items: ShiftItem[];
}

export default function ShiftInventoryPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const todayKey = getShiftDateKey();
  const currentShift = getShiftCode();
  const [selectedDate, setSelectedDate] = useState<string>(todayKey);
  const [selectedShift, setSelectedShift] = useState<"S1" | "S2" | "S3">(
    currentShift || "S1",
  );
  const { apiCall } = useApi();

  const { data: inventory } = useApi<InventoryItem[]>("/api/inventory");
  const { data: shiftData, mutate } = useApi<ShiftResponse>(
    `/api/shift-inventory?dateKey=${selectedDate}&shiftCode=${selectedShift}`,
  );

  const [allocateQty, setAllocateQty] = useState<Record<string, string>>({});
  const [actualQty, setActualQty] = useState<Record<string, string>>({});
  const [justReconciled, setJustReconciled] = useState(false);

  const shiftMap = useMemo(() => {
    const map = new Map<string, ShiftItem>();
    shiftData?.items?.forEach((it) => {
      map.set(String(it.itemId?._id || it._id), it);
    });
    return map;
  }, [shiftData?.items]);

  useEffect(() => {
    if (!shiftData?.items) return;
    const next: Record<string, string> = {};
    shiftData.items.forEach((it) => {
      if (it.actualQty !== undefined && it.actualQty !== null) {
        next[String(it.itemId._id)] = String(it.actualQty);
      } else {
        const remaining = it.openingQty + it.receivedQty - it.soldQty;
        next[String(it.itemId._id)] = String(Math.max(0, remaining));
      }
    });
    // Reset to current shift's items only, avoid carrying stale keys
    // from previously viewed date/shift that can break reconcile payload.
    setActualQty(next);
  }, [shiftData?.items]);

  useEffect(() => {
    // Reset optimistic reconcile marker when user switches date/shift view.
    setJustReconciled(false);
  }, [selectedDate, selectedShift]);

  const handleAllocate = async () => {
    if (!isAdmin) {
      toast.error("Chỉ admin được cấp hàng");
      return;
    }
    const items = Object.entries(allocateQty)
      .map(([itemId, qty]) => ({ itemId, qty: Number(qty) }))
      .filter((i) => i.qty > 0);

    if (items.length === 0) {
      toast.error("Nhập số lượng cấp");
      return;
    }

    try {
      await apiCall("/api/shift-inventory/allocate", {
        method: "POST",
        body: { dateKey: selectedDate, shiftCode: selectedShift, items },
      });
      setAllocateQty({});
      await mutate();
      toast.success("Đã cấp hàng cho ca");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Cấp hàng thất bại");
    }
  };

  const isReconciled =
    justReconciled ||
    ((shiftData?.items?.length ?? 0) > 0 &&
      shiftData!.items.every((it) => it.reconciledAt));

  const handleReconcile = async () => {
    if (isReconciled) return;
    const currentShiftItemIds = new Set(
      (shiftData?.items || []).map((it) => String(it.itemId._id)),
    );

    const items = Object.entries(actualQty)
      .filter(([itemId]) => currentShiftItemIds.has(String(itemId)))
      .map(([itemId, qty]) => ({ itemId, actualQty: Number(qty) }))
      .filter((i) => !Number.isNaN(i.actualQty));

    if (items.length === 0) {
      toast.error("Nhập số kiểm kê");
      return;
    }

    try {
      await apiCall("/api/shift-inventory/reconcile", {
        method: "POST",
        body: { dateKey: selectedDate, shiftCode: selectedShift, items },
      });
      // Optimistic UI: apply reconciled state immediately.
      setJustReconciled(true);
      await mutate();
      toast.success("Đã kết ca và trả tồn về kho tổng");
    } catch (error) {
      setJustReconciled(false);
      toast.error(error instanceof Error ? error.message : "Kết ca thất bại");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-gray-900">Kho ca</h1>
          {currentShift && (
            <Badge className="bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 text-white border-0 text-sm px-3 py-1">
              Hiện tại: {currentShift}
            </Badge>
          )}
        </div>
        <p className="text-gray-600">
          Ngày {selectedDate} - Ca {selectedShift}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chọn ca để xem</CardTitle>
          <CardDescription>
            Chủ có thể xem thống kê bất kỳ ngày/ca nào
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Ngày</label>
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-gray-600">Ca</label>
            <div className="flex gap-2">
              {(["S1", "S2", "S3"] as const).map((code) => (
                <Button
                  key={code}
                  type="button"
                  variant={selectedShift === code ? "default" : "outline"}
                  onClick={() => setSelectedShift(code)}
                >
                  {code}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cấp hàng cho ca</CardTitle>
          <CardDescription>Trừ kho tổng và cộng vào kho ca</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mặt hàng</TableHead>
                <TableHead>Tồn kho tổng</TableHead>
                <TableHead>Tồn kho ca</TableHead>
                <TableHead className="w-40">Cấp thêm</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {inventory?.map((item) => {
                const shiftItem = shiftMap.get(String(item._id));
                const remaining = shiftItem
                  ? shiftItem.openingQty +
                    shiftItem.receivedQty -
                    shiftItem.soldQty
                  : 0;
                return (
                  <TableRow key={item._id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{remaining}</Badge>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={allocateQty[item._id] || ""}
                        disabled={!isAdmin}
                        onChange={(e) =>
                          setAllocateQty((prev) => ({
                            ...prev,
                            [item._id]: e.target.value,
                          }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-4">
            {isAdmin && (
              <Button onClick={handleAllocate} disabled={!isAdmin}>
                Cấp hàng
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kiểm kê cuối ca</CardTitle>
          <CardDescription>
            Nhập số tồn đếm được thực tế để đối chiếu với sổ sách và trả về kho
            tổng
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mặt hàng</TableHead>
                <TableHead>
                  Tồn sổ sách
                  <span className="block text-xs font-normal text-slate-400">
                    (tồn đầu + cấp − đã bán)
                  </span>
                </TableHead>
                <TableHead>Đã bán</TableHead>
                <TableHead className="w-40">
                  Đếm thực tế
                  <span className="block text-xs font-normal text-slate-400">
                    (nhập số đếm tay)
                  </span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shiftData?.items?.map((item) => {
                const expected =
                  item.openingQty + item.receivedQty - item.soldQty;
                const entered = actualQty[item.itemId._id];
                const hasValue = entered !== undefined && entered !== "";
                const matched = hasValue && Number(entered) === expected;
                const rowColor = !isReconciled
                  ? ""
                  : matched
                    ? "bg-green-50"
                    : "bg-red-50";
                return (
                  <TableRow key={item._id} className={rowColor}>
                    <TableCell className="font-medium">
                      {item.itemId?.name}
                    </TableCell>
                    <TableCell>{expected}</TableCell>
                    <TableCell>{item.soldQty}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="0"
                        value={entered || ""}
                        disabled={isReconciled}
                        className={
                          !isReconciled
                            ? ""
                            : matched
                              ? "border-green-400"
                              : "border-red-400"
                        }
                        onChange={(e) =>
                          setActualQty((prev) => ({
                            ...prev,
                            [item.itemId._id]: e.target.value,
                          }))
                        }
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={handleReconcile}
              variant="outline"
              disabled={isReconciled}
            >
              Kết ca
            </Button>
            {isReconciled && (
              <span className="text-sm text-green-600 font-medium">
                ✓ Ca này đã được kết
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
