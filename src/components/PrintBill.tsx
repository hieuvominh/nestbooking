"use client";

import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatCurrency } from "@/lib/currency";
import { Receipt58mm, type ReceiptItem } from "@/components/Receipt58mm";
import { Be_Vietnam_Pro } from "next/font/google";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese"],
  weight: ["400", "500", "600", "700"],
});

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
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Bill-${booking._id.slice(-8)}`,
    pageStyle: `
      @page {
        size: 58mm auto;
        margin: 0;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
          font-family: ${fontFamily};
          font-size: 11px;
          -webkit-print-color-adjust: exact;
        }
      }
      pre { font-family: ${fontFamily}; }
    `,
    onAfterPrint: () => {
      if (onAfterAutoPrint) onAfterAutoPrint();
    },
  });

  const calculateDuration = () => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const hours = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (Number.isInteger(hours)) return hours.toString();
    return hours.toFixed(1);
  };

  const calculateDeskCost = () => {
    if (booking.comboPackage) {
      return booking.comboPackage.price;
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
  const discountValue = (subtotal * discountPercent) / 100;
  const vatValue = ((subtotal - discountValue) * vatPercent) / 100;
  const grandTotal = subtotal - discountValue + vatValue;
  const allItems = getAllItems();
  const receiptItems: ReceiptItem[] = [];

  if (booking.comboPackage) {
    receiptItems.push({
      name: `Gói: ${booking.comboPackage.name}`,
      quantity: "1",
      unitPrice: formatVnd(booking.comboPackage.price),
      total: formatVnd(booking.comboPackage.price),
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

  React.useEffect(() => {
    if (autoPrint && canPrint) {
      setTimeout(() => {
        try {
          handlePrint?.();
        } catch (e) {
          // ignore print errors
        }
      }, 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, canPrint]);

  return (
    <>
      <Button onClick={handlePrint} className={className} variant="outline">
        <Printer className="w-4 h-4 mr-2" />
        In Hóa Đơn
      </Button>

      <div
        style={{
          visibility: "hidden",
          position: "absolute",
          left: -9999,
          top: 0,
        }}
      >
        <div ref={componentRef} className={beVietnamPro.className}>
          <div style={{ width: "58mm", margin: "0 auto" }}>
            <Receipt58mm
              variant="print"
              brand={resolvedBrand}
              title="HÓA ĐƠN THANH TOÁN"
              invoiceNumber={resolvedInvoiceNumber}
              meta={{
                orderCode: `#${booking._id.slice(-5).toUpperCase()}`,
                cashier: cashierName,
                table: `Bàn ${booking.deskNumber}`,
                date: formatDate(invoiceDate),
                timeIn: formatTime(booking.startTime),
                timeOut: formatTime(booking.endTime),
              }}
              items={receiptItems}
              itemCount={allItems.length}
              totals={{
                subtotal: formatVnd(subtotal),
                total: formatVnd(grandTotal),
                paymentLabel: "+Thanh toán tiền mặt",
                paymentAmount: formatVnd(cashGiven ?? grandTotal),
                cashReceived: cashGiven ? formatVnd(cashGiven) : undefined,
                changeDue: changeDue ? formatVnd(changeDue) : undefined,
              }}
              footer={resolvedFooter}
            />
          </div>
          {showDebugInfo ? (
            <div className="mt-2 text-[10px] text-black">58mm</div>
          ) : null}
        </div>
      </div>
    </>
  );
}
