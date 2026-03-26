"use client";

import React, { useState } from "react";
import { Bluetooth, BluetoothOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isBluetoothSupported,
  printReceipt,
} from "@/lib/bluetooth-printer";
import { buildReceipt, type ReceiptData } from "@/lib/esc-pos";
import {
  isNativePrinterAvailable,
  printNative,
} from "@/lib/native-printer";

interface BluetoothPrintButtonProps {
  receiptData: ReceiptData;
  className?: string;
  /** Label tùy chỉnh */
  label?: string;
}

type Status = "idle" | "printing" | "done" | "error" | "unsupported";

export function BluetoothPrintButton({
  receiptData,
  className,
  label = "In (Bluetooth)",
}: BluetoothPrintButtonProps) {
  const [status, setStatus] = useState<Status>(
    isBluetoothSupported() || isNativePrinterAvailable() ? "idle" : "unsupported"
  );
  const [message, setMessage] = useState("");

  async function handlePrint() {
    if (status === "printing") return;
    setStatus("printing");
    setMessage("Đang kết nối...");

    try {
      const bytes = buildReceipt(receiptData);

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
          <Bluetooth className="w-4 h-4 mr-2" />
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
