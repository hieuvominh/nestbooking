"use client";

import React from "react";
import { formatCurrency } from "@/lib/currency";
import { type ReceiptItem } from "@/components/Receipt58mm";
import { BluetoothPrintButton } from "@/components/BluetoothPrintButton";

interface PrintBillProps {
  booking: {
    _id: string;
    customer: {
      name: string;
      phone?: string;
      email?: string;
    };
    deskNumber: number;
    startTime: string;
    endTime: string;
    checkedInAt?: string;
    totalAmount?: number;
    paymentStatus: string;
    status: string;
    notes?: string;
    comboPackage?: {
      name: string;
      duration: number;
      price: number;
      pricePerPerson?: boolean;
      guestCount?: number;
    };
    items?: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
  };
  orders?: Array<{
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    total: number;
  }>;
  deskHourlyRate?: number;
  className?: string;
  showDebugInfo?: boolean;
  autoPrint?: boolean;
  onAfterAutoPrint?: () => void;
  fontFamily?: string;
  cashierName?: string;
  invoiceNumber?: string;
  cashGiven?: number;
  changeDue?: number;
  discountPercent?: number;
  discountAmount?: number;
  vatPercent?: number;
  storeInfo?: {
    name: string;
    subtitle: string;
    address: string;
    phone: string;
  };
  brandInfo?: {
    line1: string;
    line2?: string;
  };
  footerInfo?: {
    storeName?: string;
    address?: string;
    wifi?: string;
    note?: string;
    qrValue?: string;
    qrLabel?: string;
    thanks?: string;
    poweredBy?: string;
  };
}

export function PrintBill({
  booking,
  orders,
  deskHourlyRate = 5,
  className,
  showDebugInfo = false,
  autoPrint = false,
  onAfterAutoPrint,
  fontFamily = '"Be Vietnam Pro", "Noto Sans", sans-serif',
  cashierName = "—",
  invoiceNumber,
  cashGiven,
  changeDue,
  discountPercent = 0,
  discountAmount = 0,
  vatPercent = 0,
  storeInfo = {
    name: "NEST LEARNING",
    subtitle: "Đồ dùng học tập - Văn phòng phẩm",
    address: "123 Đường ABC, Quận X, TP.HCM",
    phone: "SĐT: 0909 xxx xxx",
  },
  brandInfo,
  footerInfo,
}: PrintBillProps) {
  const calculateDuration = () => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const hours = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (Number.isInteger(hours)) return hours.toString();
    return hours.toFixed(1);
  };

  const calculateDeskCost = () => {
    if (booking.comboPackage) {
      const base = booking.comboPackage.price;
      const guests = booking.comboPackage.guestCount ?? 1;
      return booking.comboPackage.pricePerPerson ? base * guests : base;
    }
    const duration = parseFloat(calculateDuration());
    return duration * deskHourlyRate;
  };

  const getAllItems = () => {
    const allItems: Array<{ name: string; quantity: number; price: number }> =
      [];

    if (booking.items && booking.items.length > 0) {
      allItems.push(...booking.items);
    }

    if (orders && orders.length > 0) {
      orders.forEach((order) => {
        allItems.push(...order.items);
      });
    }

    return allItems;
  };

  const calculateItemsTotal = () => {
    return getAllItems().reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("vi-VN");

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatVnd = (amount: number) =>
    formatCurrency(amount).replace(/\s*VNĐ/i, "đ");

  const canPrint = booking.paymentStatus === "paid";
  if (!canPrint) return null;

  const deskCost = calculateDeskCost();
  const itemsTotal = calculateItemsTotal();
  const duration = calculateDuration();
  const subtotal = deskCost + itemsTotal;
  const discountValueRaw =
    discountAmount > 0 ? discountAmount : (subtotal * discountPercent) / 100;
  const discountValue = Math.min(discountValueRaw, subtotal);
  const vatValue = ((subtotal - discountValue) * vatPercent) / 100;
  const grandTotal = subtotal - discountValue + vatValue;
  const allItems = getAllItems();
  const receiptItems: ReceiptItem[] = [];

  if (booking.comboPackage) {
    const guests = booking.comboPackage.guestCount ?? 1;
    const isPerPerson = booking.comboPackage.pricePerPerson ?? false;
    receiptItems.push({
      name: `Gói: ${booking.comboPackage.name}`,
      quantity: isPerPerson ? guests.toString() : "1",
      unitPrice: formatVnd(booking.comboPackage.price),
      total: formatVnd(deskCost),
    });
  } else {
    receiptItems.push({
      name: `Bàn ${booking.deskNumber} (${duration}h)`,
      quantity: "1",
      unitPrice: formatVnd(deskCost),
      total: formatVnd(deskCost),
    });
  }

  allItems.forEach((item) => {
    receiptItems.push({
      name: item.name,
      quantity: item.quantity.toString(),
      unitPrice: formatVnd(item.price),
      total: formatVnd(item.price * item.quantity),
    });
  });

  const invoiceDate = booking.startTime || new Date().toISOString();
  const resolvedInvoiceNumber =
    invoiceNumber ?? booking._id.slice(-6).toUpperCase();

  const resolvedBrand =
    brandInfo ??
    (() => {
      const parts = storeInfo.name.trim().split(/\s+/);
      if (parts.length === 1) {
        return { line1: storeInfo.name };
      }
      return { line1: parts[0], line2: parts.slice(1).join(" ") };
    })();

  const resolvedFooter = footerInfo ?? {
    storeName: storeInfo.name,
    address: storeInfo.address,
    note: "Gọi thêm món: quét mã",
  };

  const receiptData = {
    storeName: "",
    storeSubtitle: storeInfo.subtitle,
    storeAddress: storeInfo.address,
    invoiceNumber: resolvedInvoiceNumber,
    orderCode: `#${booking._id.slice(-5).toUpperCase()}`,
    cashier: cashierName,
    table: `Bàn ${booking.deskNumber}`,
    date: formatDate(invoiceDate),
    timeIn: formatTime(booking.startTime),
    timeOut: formatTime(booking.endTime),
    items: receiptItems.map((it) => ({
      name: it.name,
      qty: it.quantity,
      price: it.total,
    })),
    subtotal: formatVnd(subtotal),
    total: formatVnd(grandTotal),
    footerNote: resolvedFooter.note || undefined,
    openDrawer: true,
    logoUrl: "/bill-logo.png",
    logoWidth: 320,
  };

  return (
    <>
      <BluetoothPrintButton
        className={className}
        label="In hóa đơn"
        receiptData={receiptData}
      />
    </>
  );
}
