import { Be_Vietnam_Pro } from "next/font/google";
import { Receipt58mm } from "@/components/Receipt58mm";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export default function Receipt58mmPage() {
  return (
    <div className={`${beVietnamPro.className} min-h-screen bg-[#F5F5F5] px-6 py-10`}>
      <div className="mx-auto w-[220px]">
        <Receipt58mm
          brand={{ line1: "mot", line2: "chut." }}
          title="HÓA ĐƠN THANH TOÁN"
          invoiceNumber="150511"
          meta={{
            orderCode: "#3H04X",
            cashier: "Bán hàng",
            table: "Bàn mang về",
            date: "15/03/2026",
            timeIn: "20:16",
            timeOut: "20:16",
          }}
          items={[
            {
              name: "TRÀ MƠ SƠ RI",
              quantity: "1",
              unitPrice: "50,000 đ",
              total: "50,000 đ",
            },
            {
              name: "HOUJICHA LATTE",
              quantity: "1",
              unitPrice: "70,000 đ",
              total: "70,000 đ",
            },
          ]}
          itemCount={2}
          totals={{
            subtotal: "120,000 đ",
            total: "120,000 đ",
            paymentLabel: "+Thanh toán tiền mặt",
            paymentAmount: "120,000 đ",
            cashReceived: "120,000 đ",
            changeDue: "0 đ",
          }}
          footer={{
            storeName: "MỘT CHÚT COFFEE & MATCHA",
            address: "Địa chỉ: K1+K2, Nguyễn Ái Quốc, Tân Phong, Biên Hòa, Đồng Nai",
            wifi: "motchutxinchao",
            thanks: "Một Chút Xin Cảm Ơn!",
            poweredBy: "Powered by iPOS.vn",
          }}
          variant="preview"
        />
      </div>
    </div>
  );
}
