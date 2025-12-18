"use client";

import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

/**
 * PrintBill Component
 *
 * Generates a thermal printer-friendly bill (58mm width) for paid bookings.
 * Uses react-to-print library to isolate and print ONLY the bill content.
 *
 * Features:
 * - Optimized for 58mm thermal paper (≈219px width)
 * - Configurable font (monospace recommended for perfect alignment)
 * - Clear sections: Header, Customer Info, Booking Details, Items, Totals
 * - Completely isolated print - no sidebar or UI elements visible
 * - Uses react-to-print for reliable printing across browsers
 */

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
  showDebugInfo?: boolean; // Optional: show width measurement on bill
  autoPrint?: boolean; // If true, trigger print automatically when component mounts
  onAfterAutoPrint?: () => void; // Callback after automatic print completes
  charsPerLine?: number; // allow overriding characters per line for specific printers
  fontFamily?: string; // optional font family for printed bill
}

export function PrintBill({
  booking,
  orders,
  deskHourlyRate = 5,
  className,
  showDebugInfo = false,
  autoPrint = false,
  onAfterAutoPrint,
  charsPerLine = 32,
  fontFamily = "Arial, Calibri, Verdana, sans-serif",
}: PrintBillProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  // Setup react-to-print hook
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
        }
      }
    `,
    // after print, notify parent if requested
    onAfterPrint: () => {
      if (onAfterAutoPrint) onAfterAutoPrint();
    },
  });

  // Calculate booking duration in hours
  const calculateDuration = () => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const hours = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
    // If hours is a whole number, show without decimal (1 instead of 1.0)
    if (Number.isInteger(hours)) return hours.toString();
    return hours.toFixed(1);
  };

  // Calculate desk rental cost
  const calculateDeskCost = () => {
    if (booking.comboPackage) {
      return booking.comboPackage.price;
    }
    const duration = parseFloat(calculateDuration());
    return duration * deskHourlyRate;
  };

  // Aggregate all items from booking and orders
  const getAllItems = () => {
    const allItems: Array<{ name: string; quantity: number; price: number }> =
      [];

    // Add booking items
    if (booking.items && booking.items.length > 0) {
      allItems.push(...booking.items);
    }

    // Add order items
    if (orders && orders.length > 0) {
      orders.forEach((order) => {
        allItems.push(...order.items);
      });
    }

    return allItems;
  };

  // Calculate items total
  const calculateItemsTotal = () => {
    return getAllItems().reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  };

  // Format date and time
  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // currency formatting uses VNĐ via util

  // Pad text for alignment (simple left/right padding)
  // `charsPerLine` can be overridden for specific printers (e.g., Xprinter 58mm)
  const padLine = (
    left: string,
    right: string,
    totalWidth: number = charsPerLine
  ) => {
    // normalize whitespace
    left = left.replace(/\s+/g, " ").trim();
    right = right.replace(/\s+/g, " ").trim();

    // calculate available space for left part
    const availableForLeft = Math.max(0, totalWidth - right.length - 1);

    let leftPart = left;
    if (leftPart.length > availableForLeft) {
      // truncate and indicate with ellipsis
      leftPart = leftPart.slice(0, Math.max(0, availableForLeft - 1)) + "…";
    }

    const padLen = Math.max(1, totalWidth - leftPart.length - right.length);
    const padding = " ".repeat(padLen);
    return leftPart + padding + right;
  };

  // Only show print button if payment is completed
  const canPrint = booking.paymentStatus === "paid";

  if (!canPrint) {
    return null;
  }

  const deskCost = calculateDeskCost();
  const itemsTotal = calculateItemsTotal();
  // Prefer recalculated total from desk + items to reflect current items/discounts
  // Booking.totalAmount may be an older stored value; use it only as a recorded fallback
  const recalculatedTotal = deskCost + itemsTotal;
  const grandTotal = recalculatedTotal;
  const allItems = getAllItems();
  const duration = calculateDuration();
  const currentDateTime = new Date().toLocaleString("vi-VN");

  // Trigger auto-print when requested and allowed
  React.useEffect(() => {
    if (autoPrint && canPrint) {
      // slight delay to ensure DOM is ready
      setTimeout(() => {
        try {
          handlePrint?.();
        } catch (e) {
          // ignore print errors
          // console.error("Auto print failed", e);
        }
      }, 250);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, canPrint]);

  return (
    <>
      {/* Print Button */}
      <Button onClick={handlePrint} className={className} variant="outline">
        <Printer className="w-4 h-4 mr-2" />
        In Hóa Đơn
      </Button>

      {/* Hidden Bill Content - Only rendered for printing */}
      <div style={{ display: "none" }}>
        <div ref={componentRef}>
          <div
            style={{
              width: "58mm",
              margin: "0 auto",
              padding: "0px",
              fontFamily: fontFamily,
              fontSize: "11px",
              lineHeight: "1.3",
              color: "#000",
              backgroundColor: "#fff",
            }}
          >
            {/* Compact bill limited to <= 20 lines for 58mm printers */}
            {(() => {
              const maxLines = 20;
              const company = "Nest Learning";
              const subtitle = "Hóa Đơn Thanh Toán";
              const separator = "-".repeat(60);
              const center = (t: string) => {
                const pad = Math.max(0, Math.floor((50 - t.length) / 2));
                return " ".repeat(pad) + t;
              };

              const lines: string[] = [];
              // Header
              lines.push(center(company));
              lines.push(center(subtitle));
              lines.push(separator);

              // Booking / customer
              lines.push(`Mã: ${booking._id.slice(-8).toUpperCase()}`);
              lines.push(`Ngày: ${currentDateTime}`);
              lines.push(`Khách: ${booking.customer.name}`);
              if (booking.customer.phone)
                lines.push(`SĐT: ${booking.customer.phone}`);
              lines.push(separator);

              // Desk / combo
              if (booking.comboPackage) {
                lines.push(
                  padLine(
                    `Gói: ${booking.comboPackage.name}`,
                    formatCurrency(booking.comboPackage.price),
                    45
                  )
                );
              } else {
                lines.push(
                  padLine(
                    `${duration}x ${formatCurrency(deskHourlyRate)}/h`,
                    formatCurrency(deskCost),
                    45
                  )
                );
              }

              const footerReserve = 4;
              const availableForItems = Math.max(
                0,
                maxLines - lines.length - footerReserve
              );
              const itemsToShow = allItems.slice(0, availableForItems);
              itemsToShow.forEach((it) => {
                lines.push(
                  padLine(
                    `${it.quantity}x ${it.name}`,
                    formatCurrency(it.quantity * it.price),
                    45
                  )
                );
              });
              if (allItems.length > itemsToShow.length) {
                lines.push(
                  `... và ${allItems.length - itemsToShow.length} mục khác`
                );
              }

              // Footer
              lines.push(padLine("TỔNG CỘNG:", formatCurrency(grandTotal), 45));
              lines.push(center("Cảm ơn quý khách!")); // Previously showed stored booking.totalAmount for reference when
              // it differed from the recalculated total. That diagnostic line
              // was removed to keep the printed bill concise.

              // Ensure we never exceed maxLines
              const out = lines.slice(0, maxLines).join("\n");
              return (
                <pre
                  style={{
                    whiteSpace: "pre",
                    fontFamily: fontFamily,
                    margin: 0,
                  }}
                >
                  {out}
                </pre>
              );
            })()}
          </div>
        </div>
      </div>
    </>
  );
}
