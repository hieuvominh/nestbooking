"use client";

import { useMemo, useState } from "react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { formatCurrency, normalizeVndAmount } from "@/lib/currency";
import { dateTimeLocalToUTC, formatDateTimeLocal } from "@/lib/vietnam-time";

type VoucherType =
  | "fixed_amount"
  | "percent"
  | "combo_price_override"
  | "per_person_price_override";

interface Voucher {
  _id: string;
  code: string;
  name?: string;
  description?: string;
  type: VoucherType;
  value: number;
  maxDiscount?: number;
  isActive: boolean;
  validFrom: string;
  validTo: string;
  applyToPerPersonCombosOnly?: boolean;
}

interface VoucherListResponse {
  vouchers: Voucher[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface VoucherForm {
  code: string;
  name: string;
  description: string;
  type: VoucherType;
  value: number;
  maxDiscount: number | "";
  validFrom: string;
  validTo: string;
  isActive: boolean;
  applyToPerPersonCombosOnly: boolean;
}

const emptyForm = (): VoucherForm => {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  return {
    code: "",
    name: "",
    description: "",
    type: "fixed_amount",
    value: 0,
    maxDiscount: "",
    validFrom: formatDateTimeLocal(now),
    validTo: formatDateTimeLocal(tomorrow),
    isActive: true,
    applyToPerPersonCombosOnly: false,
  };
};

export default function VoucherSettingsPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { apiCall } = useApi();
  const { data, mutate, isLoading } = useApi<VoucherListResponse>(
    "/api/admin/vouchers?limit=200",
  );

  const [form, setForm] = useState<VoucherForm>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const vouchers = data?.vouchers || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vouchers;
    return vouchers.filter((v) => {
      return (
        v.code.toLowerCase().includes(q) ||
        (v.name || "").toLowerCase().includes(q) ||
        (v.description || "").toLowerCase().includes(q)
      );
    });
  }, [vouchers, search]);

  const typeLabel = (type: VoucherType) => {
    switch (type) {
      case "fixed_amount":
        return "Giảm tiền cố định";
      case "percent":
        return "Giảm %";
      case "combo_price_override":
        return "Combo giá cố định";
      case "per_person_price_override":
        return "Combo theo đầu người";
      default:
        return type;
    }
  };

  const valueLabel = (voucher: Voucher) => {
    if (voucher.type === "percent") return `${voucher.value}%`;
    return formatCurrency(voucher.value);
  };

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const startEdit = (voucher: Voucher) => {
    setEditingId(voucher._id);
    setForm({
      code: voucher.code,
      name: voucher.name || "",
      description: voucher.description || "",
      type: voucher.type,
      value: voucher.value,
      maxDiscount:
        typeof voucher.maxDiscount === "number" ? voucher.maxDiscount : "",
      validFrom: formatDateTimeLocal(voucher.validFrom),
      validTo: formatDateTimeLocal(voucher.validTo),
      isActive: voucher.isActive,
      applyToPerPersonCombosOnly: voucher.applyToPerPersonCombosOnly === true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) return;
    if (!form.validFrom || !form.validTo) return;

    setIsSubmitting(true);
    try {
      const payload = {
        ...(editingId ? {} : { code: form.code.trim().toUpperCase() }),
        name: form.name.trim() || undefined,
        description: form.description.trim() || undefined,
        type: form.type,
        value: normalizeVndAmount(form.value),
        maxDiscount:
          form.maxDiscount === ""
            ? undefined
            : normalizeVndAmount(form.maxDiscount),
        validFrom: dateTimeLocalToUTC(form.validFrom),
        validTo: dateTimeLocalToUTC(form.validTo),
        isActive: form.isActive,
        applyToPerPersonCombosOnly: form.applyToPerPersonCombosOnly,
      };

      if (editingId) {
        await apiCall(`/api/admin/vouchers/${editingId}`, {
          method: "PATCH",
          body: payload,
        });
      } else {
        await apiCall("/api/admin/vouchers", {
          method: "POST",
          body: payload,
        });
      }

      await mutate();
      resetForm();
    } catch (error) {
      console.error("Save voucher error", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (voucher: Voucher) => {
    if (!confirm(`Xóa voucher ${voucher.code}?`)) return;
    try {
      await apiCall(`/api/admin/vouchers/${voucher._id}`, {
        method: "DELETE",
      });
      await mutate();
      if (editingId === voucher._id) resetForm();
    } catch (error) {
      console.error("Delete voucher error", error);
    }
  };

  const handleToggleActive = async (voucher: Voucher) => {
    try {
      await apiCall(`/api/admin/vouchers/${voucher._id}`, {
        method: "PATCH",
        body: { isActive: !voucher.isActive },
      });
      await mutate();
    } catch (error) {
      console.error("Toggle voucher active error", error);
    }
  };

  if (isAuthLoading) {
    return <div className="text-sm text-gray-500">Đang tải...</div>;
  }

  if (user?.role !== "admin") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Không có quyền truy cập</CardTitle>
          <CardDescription>
            Chỉ tài khoản admin mới được xem/chỉnh sửa/xóa voucher.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Quản lý voucher</h1>
        <p className="text-gray-500">
          Tạo và quản lý voucher cho booking/combo
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? "Sửa voucher" : "Tạo voucher mới"}</CardTitle>
          <CardDescription>
            Voucher áp dụng cho booking/combo. Khách đã thanh toán sẽ không sửa
            được voucher.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Mã voucher *</label>
                <Input
                  value={form.code}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="VD: MEET15"
                  disabled={Boolean(editingId)}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Tên voucher</label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="VD: Meeting Room 15k"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Loại voucher *</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  value={form.type}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      type: e.target.value as VoucherType,
                    }))
                  }
                >
                  <option value="fixed_amount">Giảm tiền cố định</option>
                  <option value="percent">Giảm %</option>
                  <option value="combo_price_override">
                    Đặt giá combo cố định
                  </option>
                  <option value="per_person_price_override">
                    Đặt giá combo theo đầu người
                  </option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">
                  Giá trị {form.type === "percent" ? "(%)" : "(VND)"} *
                </label>
                <Input
                  type="number"
                  min={0}
                  value={form.value}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      value: Number(e.target.value) || 0,
                    }))
                  }
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Giảm tối đa (VND)</label>
                <Input
                  type="number"
                  min={0}
                  value={form.maxDiscount}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      maxDiscount:
                        e.target.value === "" ? "" : Number(e.target.value),
                    }))
                  }
                  placeholder="Để trống nếu không giới hạn"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Trạng thái</label>
                <div className="flex items-center h-10 gap-2">
                  <input
                    id="isActive"
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        isActive: e.target.checked,
                      }))
                    }
                  />
                  <label htmlFor="isActive" className="text-sm">
                    Kích hoạt
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Hiệu lực từ *</label>
                <Input
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, validFrom: e.target.value }))
                  }
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium">Hiệu lực đến *</label>
                <Input
                  type="datetime-local"
                  value={form.validTo}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, validTo: e.target.value }))
                  }
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Mô tả</label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Mô tả nội bộ"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Ràng buộc combo</label>
                <div className="flex items-center h-10 gap-2">
                  <input
                    id="perPersonOnly"
                    type="checkbox"
                    checked={form.applyToPerPersonCombosOnly}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        applyToPerPersonCombosOnly: e.target.checked,
                      }))
                    }
                  />
                  <label htmlFor="perPersonOnly" className="text-sm">
                    Chỉ áp dụng combo tính theo đầu người
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? "Đang lưu..."
                  : editingId
                    ? "Cập nhật voucher"
                    : "Tạo voucher"}
              </Button>
              <Button type="button" variant="outline" onClick={resetForm}>
                {editingId ? "Hủy sửa" : "Làm mới"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách voucher</CardTitle>
          <CardDescription>
            Tra cứu, bật/tắt, chỉnh sửa hoặc xóa voucher
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Tìm theo mã/tên/mô tả..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Giá trị</TableHead>
                <TableHead>Hiệu lực</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Hành động</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((voucher) => (
                <TableRow key={voucher._id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{voucher.code}</div>
                      {voucher.name && (
                        <div className="text-xs text-gray-500">
                          {voucher.name}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{typeLabel(voucher.type)}</div>
                    {voucher.applyToPerPersonCombosOnly && (
                      <div className="text-xs text-blue-600">
                        Per-person combo only
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{valueLabel(voucher)}</div>
                    {typeof voucher.maxDiscount === "number" && (
                      <div className="text-xs text-gray-500">
                        Max: {formatCurrency(voucher.maxDiscount)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-xs text-gray-600">
                      <div>
                        Từ:{" "}
                        {new Date(voucher.validFrom).toLocaleString("vi-VN")}
                      </div>
                      <div>
                        Đến: {new Date(voucher.validTo).toLocaleString("vi-VN")}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={voucher.isActive ? "default" : "secondary"}
                      className={voucher.isActive ? "bg-green-600" : ""}
                    >
                      {voucher.isActive ? "Đang bật" : "Đang tắt"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(voucher)}
                      >
                        Sửa
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleActive(voucher)}
                      >
                        {voucher.isActive ? "Tắt" : "Bật"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => handleDelete(voucher)}
                      >
                        Xóa
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {!isLoading && filtered.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Chưa có voucher nào
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
