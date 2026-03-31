/**
 * ESC/POS command builder for 58mm thermal printers
 * Supports Vietnamese text via UTF-8 encoding
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const CMD = {
  INIT: [ESC, 0x40],
  LF: [LF],

  // Alignment
  ALIGN_LEFT: [ESC, 0x61, 0x00],
  ALIGN_CENTER: [ESC, 0x61, 0x01],
  ALIGN_RIGHT: [ESC, 0x61, 0x02],

  // Text style
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  UNDERLINE_ON: [ESC, 0x2d, 0x01],
  UNDERLINE_OFF: [ESC, 0x2d, 0x00],

  // Text size
  SIZE_DOUBLE: [GS, 0x21, 0x11],   // double width + height
  SIZE_WIDE: [GS, 0x21, 0x10],     // double width only
  SIZE_TALL: [GS, 0x21, 0x01],     // double height only
  SIZE_NORMAL: [GS, 0x21, 0x00],

  // Paper cut
  CUT_FULL: [GS, 0x56, 0x00],
  CUT_PARTIAL: [GS, 0x56, 0x41, 0x10],

  // Cash drawer (pin 2 = most common)
  OPEN_DRAWER_PIN2: [ESC, 0x70, 0x00, 0x19, 0xfa],
  OPEN_DRAWER_PIN5: [ESC, 0x70, 0x01, 0x19, 0xfa],
};

// 58mm paper = 32 chars wide at normal font
const PAPER_WIDTH = 32;

function textToBytes(text: string): number[] {
  const encoder = new TextEncoder();
  return Array.from(encoder.encode(text));
}

function padRight(text: string, width: number): string {
  return text.padEnd(width, ' ').slice(0, width);
}

function padLeft(text: string, width: number): string {
  return text.padStart(width, ' ').slice(-width);
}

export class EscPosBuilder {
  private bytes: number[] = [];

  private push(...cmds: number[][]): this {
    for (const cmd of cmds) this.bytes.push(...cmd);
    return this;
  }

  init(): this { return this.push(CMD.INIT); }
  lf(n = 1): this { for (let i = 0; i < n; i++) this.push(CMD.LF); return this; }

  alignLeft(): this { return this.push(CMD.ALIGN_LEFT); }
  alignCenter(): this { return this.push(CMD.ALIGN_CENTER); }
  alignRight(): this { return this.push(CMD.ALIGN_RIGHT); }

  bold(on: boolean): this { return this.push(on ? CMD.BOLD_ON : CMD.BOLD_OFF); }
  sizeDouble(): this { return this.push(CMD.SIZE_DOUBLE); }
  sizeNormal(): this { return this.push(CMD.SIZE_NORMAL); }

  text(str: string): this {
    this.bytes.push(...textToBytes(str));
    return this;
  }

  line(str: string): this { return this.text(str).lf(); }

  /** In 1 dòng với text trái và phải (dùng cho item - giá) */
  rowLeftRight(left: string, right: string, width = PAPER_WIDTH): this {
    const maxLeft = width - right.length - 1;
    const leftTrunc = left.slice(0, maxLeft).padEnd(maxLeft, ' ');
    return this.text(leftTrunc + ' ' + right).lf();
  }

  /** In 3 cột: tên | qty | giá (canh cột cố định) */
  row3Col(name: string, qty: string, price: string, width = PAPER_WIDTH): this {
    const priceW = 10; // right-aligned
    const qtyW = 4; // right-aligned
    const nameW = Math.max(0, width - priceW - qtyW - 2);
    const nameTrunc = name.slice(0, nameW).padEnd(nameW, ' ');
    const qtyPad = qty.slice(0, qtyW).padStart(qtyW, ' ');
    const pricePad = price.slice(0, priceW).padStart(priceW, ' ');
    return this.text(nameTrunc + ' ' + qtyPad + ' ' + pricePad).lf();
  }

  divider(char = '-', width = PAPER_WIDTH): this {
    return this.line(char.repeat(width));
  }

  cut(partial = true): this {
    return this.lf(3).push(partial ? CMD.CUT_PARTIAL : CMD.CUT_FULL);
  }

  openCashDrawer(): this {
    return this.push(CMD.OPEN_DRAWER_PIN2);
  }

  /** Print QR code (Model 2) */
  qrCode(data: string, size = 6, ecc = 48): this {
    const payload = textToBytes(data);
    const pL = (payload.length + 3) & 0xff;
    const pH = (payload.length + 3) >> 8;

    // Model 2
    this.bytes.push(GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00);
    // Size (1-16)
    this.bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, size);
    // Error correction (48=L,49=M,50=Q,51=H)
    this.bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, ecc);
    // Store data
    this.bytes.push(GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...payload);
    // Print
    this.bytes.push(GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30);
    return this;
  }

  build(): Uint8Array {
    return new Uint8Array(this.bytes);
  }
}

/** Build ESC/POS receipt từ dữ liệu booking */
export interface ReceiptData {
  storeName: string;
  storeSubtitle?: string;
  storeAddress?: string;
  storePhone?: string;
  invoiceNumber: string;
  orderCode?: string;
  cashier: string;
  table: string;
  date: string;
  timeIn: string;
  timeOut: string;
  items: Array<{ name: string; qty: string; price: string }>;
  subtotal: string;
  discountLabel?: string;
  discountAmount?: string;
  total: string;
  cashReceived?: string;
  changeDue?: string;
  footerNote?: string;
  qrValue?: string;
  qrLabel?: string;
  logoUrl?: string;
  logoWidth?: number;
  openDrawer?: boolean;
}

export function buildReceipt(data: ReceiptData): Uint8Array {
  const b = new EscPosBuilder();

  b.init();

  // Header
  b.alignCenter()
    .bold(true).sizeDouble()
    .line(data.storeName)
    .sizeNormal().bold(false);

  if (data.storeSubtitle) b.line(data.storeSubtitle);
  if (data.storeAddress) b.line(data.storeAddress);
  if (data.storePhone) b.line(data.storePhone);
  b.lf();

  // Title
  b.bold(true).line('HOA DON THANH TOAN').bold(false);
  b.line(`So: ${data.invoiceNumber}`);
  b.lf();

  // Meta
  b.alignLeft();
  if (data.orderCode) b.line(`Ma Don Hang : ${data.orderCode}`);
  b.line(`Thu ngan: ${data.cashier}`)
    .line(`${data.table}`)
    .line(`Ngay  : ${data.date}`)
    .line(`Vao   : ${data.timeIn}`)
    .line(`Ra    : ${data.timeOut}`);

  b.divider();

  // Items header
  b.row3Col('Ten mon', 'SL', 'Tien');
  b.divider();

  // Items
  for (const item of data.items) {
    b.row3Col(item.name, item.qty, item.price);
  }

  b.divider();

  // Totals
  b.rowLeftRight('Tam tinh:', data.subtotal);
  if (data.discountAmount) {
    b.rowLeftRight(data.discountLabel || 'Giam gia:', data.discountAmount);
  }
  b.bold(true).rowLeftRight('TONG CONG:', data.total).bold(false);

  if (data.cashReceived) {
    b.rowLeftRight('Tien mat:', data.cashReceived);
    b.rowLeftRight('Tien thua:', data.changeDue ?? '0d');
  }

  b.lf();

  // Footer
  b.alignCenter();
  if (data.footerNote) b.line(data.footerNote);
  if (data.qrLabel) b.line(data.qrLabel);
  if (data.qrValue) {
    b.qrCode(data.qrValue, 6, 49).lf();
  }
  b.line('Cam on quy khach!');
  b.line('Hen gap lai :)');
  b.lf();

  b.cut();

  if (data.openDrawer) {
    b.openCashDrawer();
  }

  return b.build();
}
