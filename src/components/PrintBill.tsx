"use client";

import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { formatCurrency } from "@/lib/currency";

/**
 * PrintBill Component
 *
 * Generates a thermal printer-friendly bill (80mm width) for paid bookings.
 * Uses react-to-print library to isolate and print ONLY the bill content.
 *
 * Features:
 * - Optimized for 80mm thermal paper (302px width)
 * - Monospace font for consistent alignment
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
}

export function PrintBill({
  booking,
  orders,
  deskHourlyRate = 5,
  className,
  showDebugInfo = false,
}: PrintBillProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  // Setup react-to-print hook
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Bill-${booking._id.slice(-8)}`,
    pageStyle: `
      @page {
        size: 80mm auto;
        margin: 0;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
        }
      }
    `,
  });

  // Calculate booking duration in hours
  const calculateDuration = () => {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);
    const hours = Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
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
  const padLine = (left: string, right: string, totalWidth: number = 32) => {
    const leftPart = left.slice(0, totalWidth - right.length);
    const padding = " ".repeat(
      Math.max(0, totalWidth - leftPart.length - right.length)
    );
    return leftPart + padding + right;
  };

  // Only show print button if payment is completed
  const canPrint = booking.paymentStatus === "paid";

  if (!canPrint) {
    return null;
  }

  const deskCost = calculateDeskCost();
  const itemsTotal = calculateItemsTotal();
  const grandTotal = booking.totalAmount || deskCost + itemsTotal;
  const allItems = getAllItems();
  const duration = calculateDuration();
  const currentDateTime = new Date().toLocaleString("vi-VN");

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
              width: "302px",
              margin: "0 auto",
              padding: "10px",
              fontFamily: "'Courier New', monospace",
              fontSize: "12px",
              lineHeight: "1.4",
              color: "#000",
              backgroundColor: "#fff",
            }}
          >
            {/* Header */}
            <div style={{ margin: "10px 0" }}>
              <div
                style={{
                  textAlign: "center",
                  fontWeight: "bold",
                  fontSize: "14px",
                }}
              >
                BOOKINGCOO
              </div>
              <div style={{ textAlign: "center", fontSize: "12px" }}>
                Hệ Thống Đặt Bàn
              </div>
              <div style={{ margin: "2px 0" }}>
                ================================
              </div>
            </div>

            {/* Bill Info */}
            <div style={{ margin: "8px 0" }}>
              <div style={{ textAlign: "center", fontWeight: "bold" }}>
                HÓA ĐƠN THANH TOÁN
              </div>
              <div style={{ margin: "2px 0" }}>
                ================================
              </div>
              <div>Mã Đặt Bàn: {booking._id.slice(-8).toUpperCase()}</div>
              <div>Ngày In: {currentDateTime}</div>
              <div style={{ margin: "2px 0" }}>
                --------------------------------
              </div>
            </div>

            {/* Customer Info */}
            <div style={{ margin: "8px 0" }}>
              <div style={{ fontWeight: "bold" }}>THÔNG TIN KHÁCH HÀNG</div>
              <div>Tên: {booking.customer.name}</div>
              {booking.customer.phone && (
                <div>SĐT: {booking.customer.phone}</div>
              )}
              <div style={{ margin: "2px 0" }}>
                --------------------------------
              </div>
            </div>

            {/* Booking Details */}
            <div style={{ margin: "8px 0" }}>
              <div style={{ fontWeight: "bold" }}>THÔNG TIN ĐẶT BÀN</div>
              <div>Bàn: Bàn {booking.deskNumber}</div>
              {booking.comboPackage && (
                <div>Gói: {booking.comboPackage.name}</div>
              )}
              <div>Giờ Vào: {formatDateTime(booking.startTime)}</div>
              <div>Giờ Ra: {formatDateTime(booking.endTime)}</div>
              <div>Thời Lượng: {duration} giờ</div>
              {booking.checkedInAt && (
                <div>Check-in: {formatDateTime(booking.checkedInAt)}</div>
              )}
              <div style={{ margin: "2px 0" }}>
                --------------------------------
              </div>
            </div>

            {/* Desk Rental */}
            <div style={{ margin: "8px 0" }}>
              <div style={{ fontWeight: "bold" }}>CHI TIẾT THANH TOÁN</div>
              <div style={{ margin: "2px 0" }}>
                --------------------------------
              </div>
              {booking.comboPackage ? (
                <div
                  style={{
                    whiteSpace: "pre",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  {padLine(
                    `Gói: ${booking.comboPackage.name}`,
                    formatCurrency(booking.comboPackage.price)
                  )}
                </div>
              ) : (
                <div
                  style={{
                    whiteSpace: "pre",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  {padLine(
                    `Thuê Bàn (${duration}h x ${formatCurrency(
                      deskHourlyRate
                    )}/h)`,
                    formatCurrency(deskCost)
                  )}
                </div>
              )}
              <div style={{ margin: "2px 0" }}>
                --------------------------------
              </div>
            </div>

            {/* Items List */}
            {allItems.length > 0 && (
              <div style={{ margin: "8px 0" }}>
                <div style={{ fontWeight: "bold" }}>MÓN ĐÃ GỌI</div>
                <div style={{ margin: "2px 0" }}>
                  --------------------------------
                </div>
                {allItems.map((item, index) => {
                  const itemTotal = item.price * item.quantity;
                  return (
                    <div key={index}>
                      <div>{item.name}</div>
                      <div
                        style={{
                          whiteSpace: "pre",
                          fontFamily: "'Courier New', monospace",
                        }}
                      >
                        {padLine(
                          `  ${item.quantity} x ${formatCurrency(item.price)}`,
                          formatCurrency(itemTotal)
                        )}
                      </div>
                    </div>
                  );
                })}
                <div style={{ margin: "2px 0" }}>
                  --------------------------------
                </div>
                <div
                  style={{
                    whiteSpace: "pre",
                    fontFamily: "'Courier New', monospace",
                    fontWeight: "bold",
                  }}
                >
                  {padLine("Tổng Món:", formatCurrency(itemsTotal))}
                </div>
                <div style={{ margin: "2px 0" }}>
                  --------------------------------
                </div>
              </div>
            )}

            {/* Grand Total */}
            <div style={{ margin: "8px 0" }}>
              <div
                style={{
                  whiteSpace: "pre",
                  fontFamily: "'Courier New', monospace",
                  fontSize: "14px",
                  fontWeight: "bold",
                }}
              >
                {padLine("TỔNG CỘNG:", formatCurrency(grandTotal))}
              </div>
              <div style={{ margin: "2px 0" }}>
                ================================
              </div>
            </div>

            {/* Payment Status */}
            <div style={{ margin: "8px 0" }}>
              <div style={{ textAlign: "center" }}>
                <div>
                  Trạng Thái:{" "}
                  <span style={{ fontWeight: "bold" }}>ĐÃ THANH TOÁN</span>
                </div>
                <div style={{ margin: "2px 0" }}>
                  --------------------------------
                </div>
              </div>
            </div>

            {/* Notes */}
            {booking.notes && (
              <div style={{ margin: "8px 0" }}>
                <div style={{ fontWeight: "bold" }}>GHI CHÚ:</div>
                <div style={{ fontSize: "10px" }}>{booking.notes}</div>
                <div style={{ margin: "2px 0" }}>
                  --------------------------------
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ margin: "10px 0" }}>
              <div style={{ textAlign: "center", fontSize: "12px" }}>
                Cảm ơn quý khách!
              </div>
              <div style={{ textAlign: "center", fontSize: "12px" }}>
                Hẹn gặp lại!
              </div>
              <div style={{ margin: "2px 0" }}>
                ================================
              </div>
            </div>

            {/* Debug Info - Optional width verification */}
            {showDebugInfo && (
              <div
                style={{
                  margin: "10px 0",
                  padding: "5px",
                  fontSize: "8px",
                  color: "#999",
                  textAlign: "center",
                  borderTop: "1px dashed #ccc",
                }}
              >
                <div>📏 Width: 302px (80mm @ 96 DPI)</div>
                <div>Character width: 32 chars/line</div>
                <div>Font: Courier New 12px</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
