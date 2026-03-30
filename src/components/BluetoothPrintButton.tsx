"use client";

import React, { useState } from "react";
import { BluetoothOff, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isBluetoothSupported, printReceipt } from "@/lib/bluetooth-printer";
import { buildReceipt, type ReceiptData } from "@/lib/esc-pos";
import { isNativePrinterAvailable, printNative } from "@/lib/native-printer";

interface BluetoothPrintButtonProps {
  receiptData: ReceiptData;
  className?: string;
  /** Label tùy chỉnh */
  label?: string;
  /** Callback chạy trước khi in. Trả về false thì hủy in. */
  onBeforePrint?: () => Promise<boolean> | boolean;
}

type Status = "idle" | "printing" | "done" | "error" | "unsupported";

function concatBytes(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function rasterizeImage(img: HTMLImageElement, maxWidth = 384): Uint8Array {
  const scale = Math.min(1, maxWidth / img.width);
  const width = Math.max(1, Math.floor(img.width * scale));
  const height = Math.max(1, Math.floor(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Uint8Array();
  ctx.drawImage(img, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);

  const bytesPerRow = Math.ceil(width / 8);
  const totalBytes = bytesPerRow * height;
  const out = new Uint8Array(8 + totalBytes);

  // GS v 0
  out[0] = 0x1d;
  out[1] = 0x76;
  out[2] = 0x30;
  out[3] = 0x00;
  out[4] = bytesPerRow & 0xff;
  out[5] = (bytesPerRow >> 8) & 0xff;
  out[6] = height & 0xff;
  out[7] = (height >> 8) & 0xff;

  let offset = 8;
  for (let y = 0; y < height; y++) {
    for (let xByte = 0; xByte < bytesPerRow; xByte++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x >= width) continue;
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        const lum = r * 0.299 + g * 0.587 + b * 0.114;
        const isBlack = a > 0 && lum < 200;
        if (isBlack) byte |= 1 << (7 - bit);
      }
      out[offset++] = byte;
    }
  }

  return out;
}

async function buildLogoBytes(
  logoUrl: string | undefined,
  maxWidth = 384,
): Promise<Uint8Array | null> {
  if (!logoUrl) return null;
  const img = await loadImage(logoUrl);
  const raster = rasterizeImage(img, maxWidth);
  if (!raster.length) return null;
  // Center align + image + line feed
  const prefix = new Uint8Array([0x1b, 0x61, 0x01]); // ESC a 1
  const lf = new Uint8Array([0x0a]);
  return concatBytes(concatBytes(prefix, raster), lf);
}

function stripDiacritics(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");
}

function sanitizeReceiptData(data: ReceiptData): ReceiptData {
  return {
    ...data,
    storeName: "",
    storeSubtitle: data.storeSubtitle
      ? stripDiacritics(data.storeSubtitle)
      : undefined,
    storeAddress: data.storeAddress
      ? stripDiacritics(data.storeAddress)
      : undefined,
    storePhone: data.storePhone ? stripDiacritics(data.storePhone) : undefined,
    invoiceNumber: stripDiacritics(data.invoiceNumber),
    orderCode: stripDiacritics(data.orderCode ?? ""),
    cashier: stripDiacritics(data.cashier),
    table: stripDiacritics(data.table),
    date: stripDiacritics(data.date),
    timeIn: stripDiacritics(data.timeIn),
    timeOut: stripDiacritics(data.timeOut),
    subtotal: stripDiacritics(data.subtotal),
    total: stripDiacritics(data.total),
    cashReceived: data.cashReceived
      ? stripDiacritics(data.cashReceived)
      : undefined,
    changeDue: data.changeDue ? stripDiacritics(data.changeDue) : undefined,
    footerNote: data.footerNote ? stripDiacritics(data.footerNote) : undefined,
    qrValue: data.qrValue ? data.qrValue : undefined,
    qrLabel: data.qrLabel ? stripDiacritics(data.qrLabel) : undefined,
    items: data.items.map((item) => ({
      ...item,
      name: stripDiacritics(item.name),
      qty: stripDiacritics(item.qty),
      price: stripDiacritics(item.price),
    })),
  };
}

export function BluetoothPrintButton({
  receiptData,
  className,
  label = "In bill",
  onBeforePrint,
}: BluetoothPrintButtonProps) {
  const [status, setStatus] = useState<Status>(
    isBluetoothSupported() || isNativePrinterAvailable()
      ? "idle"
      : "unsupported",
  );
  const [message, setMessage] = useState("");

  async function handlePrint() {
    if (status === "printing") return;

    // Run pre-print callback (e.g. mark order as delivered)
    if (onBeforePrint) {
      const ok = await onBeforePrint();
      if (!ok) return; // Abort print
    }

    setStatus("printing");
    setMessage("Đang kết nối...");

    try {
      const logoBytes = await buildLogoBytes(
        receiptData.logoUrl,
        receiptData.logoWidth || 384,
      );
      const receiptBytes = buildReceipt(sanitizeReceiptData(receiptData));
      const bytes = logoBytes
        ? concatBytes(logoBytes, receiptBytes)
        : receiptBytes;

      if (isNativePrinterAvailable()) {
        const result = printNative(bytes);
        if (!result.ok) {
          throw new Error(result.message);
        }
      } else {
        await printReceipt(bytes, {
          onProgress: (msg) => setMessage(msg),
        });
      }

      setStatus("done");
      setMessage("In thành công!");
      setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Người dùng huỷ chọn thiết bị → không báo lỗi
      if (msg.includes("cancelled") || msg.includes("chosen")) {
        setStatus("idle");
        setMessage("");
        return;
      }
      setStatus("error");
      setMessage(msg);
    }
  }

  if (status === "unsupported") {
    return (
      <Button variant="outline" disabled className={className}>
        <BluetoothOff className="w-4 h-4 mr-2" />
        Bluetooth không hỗ trợ
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        variant={status === "done" ? "default" : "outline"}
        onClick={handlePrint}
        disabled={status === "printing"}
        className={className}
      >
        {status === "printing" ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Printer className="w-4 h-4 mr-2" />
        )}
        {status === "printing" ? "Đang in..." : label}
      </Button>

      {message && (
        <p
          className={`text-xs px-1 ${
            status === "error"
              ? "text-red-500"
              : status === "done"
                ? "text-green-600"
                : "text-muted-foreground"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
