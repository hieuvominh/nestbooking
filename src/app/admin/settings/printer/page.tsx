"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getNativePrinterInfo,
  isNativePrinterAvailable,
  pickNativePrinter,
} from "@/lib/native-printer";

export default function PrinterSettingsPage() {
  const [status, setStatus] = useState<
    "ready" | "missing" | "error" | "empty"
  >(isNativePrinterAvailable() ? "ready" : "missing");
  const [printerName, setPrinterName] = useState<string | null>(null);
  const [printerMac, setPrinterMac] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  const refreshInfo = () => {
    if (!isNativePrinterAvailable()) {
      setStatus("missing");
      setPrinterName(null);
      setPrinterMac(null);
      setMessage("Native printer bridge không khả dụng");
      return;
    }
    const info = getNativePrinterInfo();
    if (!info.ok) {
      setStatus("error");
      setMessage(info.message);
      return;
    }
    if (!info.name && !info.mac) {
      setStatus("empty");
      setMessage("Chưa chọn máy in");
      return;
    }
    setStatus("ready");
    setPrinterName(info.name || null);
    setPrinterMac(info.mac || null);
    setMessage("");
  };

  useEffect(() => {
    refreshInfo();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt máy in</h1>
        <p className="text-gray-600">
          Chọn máy in Bluetooth (Classic) để in hóa đơn và mở két
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Máy in hiện tại</CardTitle>
          <CardDescription>
            Chỉ hoạt động trong Android app wrapper (Native Printer Bridge)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            {status === "ready" && <Badge>Đã chọn</Badge>}
            {status === "empty" && <Badge variant="outline">Chưa chọn</Badge>}
            {status === "missing" && (
              <Badge variant="destructive">Không có bridge</Badge>
            )}
            {status === "error" && (
              <Badge variant="destructive">Lỗi</Badge>
            )}
            <div className="text-sm text-muted-foreground">
              {printerName && <span>{printerName}</span>}
              {!printerName && printerMac && <span>{printerMac}</span>}
              {!printerName && !printerMac && message}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                const result = pickNativePrinter();
                if (!result.ok) {
                  setStatus("error");
                  setMessage(result.message);
                } else {
                  setMessage("Đang mở chọn máy in...");
                }
              }}
              disabled={!isNativePrinterAvailable()}
            >
              Chọn máy in
            </Button>
            <Button variant="outline" onClick={refreshInfo}>
              Làm mới trạng thái
            </Button>
          </div>

          <div className="text-xs text-muted-foreground">
            Gợi ý: nên pair máy in trước trong Android Settings để ổn định hơn.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
