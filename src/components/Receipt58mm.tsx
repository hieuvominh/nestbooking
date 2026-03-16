"use client";

import React from "react";
import { QRCodeCanvas } from "qrcode.react";

export type ReceiptItem = {
  name: string;
  quantity: string;
  unitPrice: string;
  total: string;
};

export type Receipt58mmProps = {
  brand?: {
    line1: string;
    line2?: string;
  };
  title: string;
  invoiceNumber: string;
  meta: {
    orderCode: string;
    cashier: string;
    table: string;
    date: string;
    timeIn: string;
    timeOut: string;
  };
  items: ReceiptItem[];
  itemCount: number;
  totals: {
    subtotal: string;
    total: string;
    paymentLabel?: string;
    paymentAmount?: string;
    cashReceived?: string;
    changeDue?: string;
  };
  footer?: {
    storeName?: string;
    address?: string;
    wifi?: string;
    note?: string;
    qrValue?: string;
    qrLabel?: string;
    thanks?: string;
    poweredBy?: string;
  };
  variant?: "preview" | "print";
  className?: string;
};

function RowSeparator() {
  return <div className="h-[0.5px] w-full bg-[#CCCCCC]" />;
}

export function Receipt58mm({
  brand,
  title,
  invoiceNumber,
  meta,
  items,
  itemCount,
  totals,
  footer,
  variant = "preview",
  className,
}: Receipt58mmProps) {
  const hasCashRows = Boolean(totals.cashReceived) || Boolean(totals.changeDue);

  return (
    <div
      className={`flex w-[220px] flex-col gap-1 bg-white py-3 pr-5 text-black ${
        variant === "preview"
          ? "rounded-[4px] shadow-[0_4px_20px_rgba(0,0,0,0.12)]"
          : ""
      } ${className ?? ""}`}
    >
      <section className="flex flex-col items-center gap-1 text-center">
        {brand?.line1 ? (
          <div className="text-[15px] font-semibold uppercase tracking-[1px]">
            {brand.line1}
          </div>
        ) : null}
        {brand?.line2 ? (
          <div className="text-[15px] font-semibold uppercase tracking-[1px]">
            {brand.line2}
          </div>
        ) : null}
        <div className="text-[14px] font-bold uppercase">{title}</div>
        <div className="text-[10px]">Số HĐ: {invoiceNumber}</div>
      </section>

      <section className="flex flex-col gap-1 text-[10px]">
        <div className="flex w-full items-start justify-between">
          <span>Mã HĐ: {meta.orderCode}</span>
          <span>TN: {meta.cashier}</span>
        </div>
        <div className="flex w-full items-start justify-between">
          <span>Bàn: {meta.table}</span>
          <span>Ngày: {meta.date}</span>
        </div>
        <div className="flex w-full items-start justify-between">
          <span>Giờ vào: {meta.timeIn}</span>
          <span>Giờ ra: {meta.timeOut}</span>
        </div>
      </section>

      <section className="flex flex-col gap-1">
        <div className="flex w-full items-end text-[9px] font-semibold">
          <div className="w-[8%] shrink-0 text-center">TT</div>
          <div className="w-[42%] shrink-0 pl-1">Tên món</div>
          <div className="w-[10%] shrink-0 text-center">SL</div>
          <div className="w-[20%] shrink-0 text-right leading-[11px]">
            <span className="block">Đơn</span>
            <span className="block">giá</span>
          </div>
          <div className="w-[20%] shrink-0 text-right leading-[11px]">
            <span className="block">Thành</span>
            <span className="block">tiền</span>
          </div>
        </div>

        {items.map((item, index) => (
          <React.Fragment key={`${item.name}-${index}`}>
            <div className="flex w-full items-start text-[9px]">
              <div className="w-[8%] shrink-0 text-center">{index + 1}</div>
              <div className="w-[42%] shrink-0 pr-1 leading-tight">
                {item.name}
              </div>
              <div className="w-[10%] shrink-0 text-center">{item.quantity}</div>
              <div className="w-[20%] shrink-0 text-right">{item.unitPrice}</div>
              <div className="w-[20%] shrink-0 text-right">{item.total}</div>
            </div>
            {index < items.length - 1 ? <RowSeparator /> : null}
          </React.Fragment>
        ))}

        <div className="pt-1 text-[10px]">Tổng số món: {itemCount}</div>
      </section>

      <section className="flex flex-col gap-1 text-[10px]">
        <div className="flex w-full items-start justify-between">
          <span>Thành tiền:</span>
          <span className="text-right font-semibold">{totals.subtotal}</span>
        </div>
        <div className="flex w-full items-start justify-between text-[11px] font-bold">
          <span>Tổng tiền:</span>
          <span className="text-right">{totals.total}</span>
        </div>
        {totals.paymentLabel && totals.paymentAmount ? (
          <div className="flex w-full items-start justify-between">
            <span>{totals.paymentLabel}</span>
            <span className="text-right">{totals.paymentAmount}</span>
          </div>
        ) : null}
        {hasCashRows ? (
          <>
            {totals.cashReceived ? (
              <div className="flex w-full items-start justify-between">
                <span>Tiền nhận</span>
                <span className="text-right">{totals.cashReceived}</span>
              </div>
            ) : null}
            {totals.changeDue ? (
              <div className="flex w-full items-start justify-between">
                <span>Tiền thừa</span>
                <span className="text-right">{totals.changeDue}</span>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="flex flex-col items-center gap-1 text-center pb-3 text-[10px]">
        {footer?.storeName ? (
          <div className="text-[10px] font-semibold uppercase">
            {footer.storeName}
          </div>
        ) : null}
        {footer?.address ? <div>{footer.address}</div> : null}
        {footer?.wifi ? <div>Pass Wifi : {footer.wifi}</div> : null}
        {footer?.note ? <div>{footer.note}</div> : null}
        {footer?.qrValue ? (
          <div className="flex flex-col items-center gap-1 pt-1">
            <div className="rounded-md border border-dashed border-gray-300 p-1">
              <QRCodeCanvas
                value={footer.qrValue}
                size={110}
                level="H"
                includeMargin={false}
                bgColor="#FFFFFF"
                fgColor="#000000"
                style={{
                  imageRendering: "pixelated",
                  shapeRendering: "crispEdges",
                }}
              />
            </div>
            <div className="text-[9px]">
              {footer.qrLabel ?? "Quét mã để gọi thêm món"}
            </div>
            <div className="text-[7px] break-all max-w-[200px]">
              {footer.qrValue}
            </div>
          </div>
        ) : null}
        <div className="pt-2 text-[10px] font-semibold">
          {footer?.thanks ?? "Một Chút Xin Cảm Ơn!"}
        </div>
        {footer?.poweredBy ? (
          <div className="text-[9px]">{footer.poweredBy}</div>
        ) : null}
      </section>
    </div>
  );
}
