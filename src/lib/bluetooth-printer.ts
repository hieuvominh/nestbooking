/**
 * Web Bluetooth API wrapper for BLE thermal printers
 *
 * Hỗ trợ các dòng máy in phổ biến (Xprinter, KPrinter, v.v.)
 * Chrome Android yêu cầu HTTPS để dùng Web Bluetooth.
 *
 * Thứ tự thử service UUID (từ phổ biến nhất):
 *  1. Xprinter / KPrinter BLE standard
 *  2. Nordic UART Service (NUS) - dùng bởi nhiều máy in BLE
 *  3. Generic Serial over BLE
 */

export interface PrinterServiceProfile {
  serviceUUID: string;
  characteristicUUID: string;
  label: string;
}

const PRINTER_PROFILES: PrinterServiceProfile[] = [
  {
    // Xprinter, KPrinter, Hoin, MUNBYN BLE
    serviceUUID: '000018f0-0000-1000-8000-00805f9b34fb',
    characteristicUUID: '00002af1-0000-1000-8000-00805f9b34fb',
    label: 'Xprinter/KPrinter BLE',
  },
  {
    // Nordic UART Service - rất nhiều máy in dùng
    serviceUUID: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    characteristicUUID: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
    label: 'Nordic UART (NUS)',
  },
  {
    // Peripage / Paperang BLE
    serviceUUID: '49535343-fe7d-4ae5-8fa9-9fafd205e455',
    characteristicUUID: '49535343-8841-43f4-a8d4-ecbe34729bb3',
    label: 'Generic BLE Serial',
  },
];

const CHUNK_SIZE = 512; // BLE MTU thường 512 bytes

export function isBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
}

let cachedDevice: BluetoothDevice | null = null;
let cachedCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
let cachedProfile: PrinterServiceProfile | null = null;

/** Kết nối máy in BLE, thử lần lượt từng profile */
export async function connectPrinter(): Promise<{
  characteristic: BluetoothRemoteGATTCharacteristic;
  profile: PrinterServiceProfile;
  device: BluetoothDevice;
}> {
  if (!isBluetoothSupported()) {
    throw new Error(
      'Trình duyệt không hỗ trợ Web Bluetooth. Hãy dùng Chrome Android (HTTPS).'
    );
  }

  const serviceUUIDs = PRINTER_PROFILES.map((p) => p.serviceUUID);

  const device = await (navigator.bluetooth as Bluetooth).requestDevice({
    filters: [
      { namePrefix: 'KPrinter' },
      { namePrefix: 'XP-' },
      { namePrefix: 'Xprinter' },
      { namePrefix: 'printer' },
      { namePrefix: 'Printer' },
    ],
    optionalServices: serviceUUIDs,
  });

  device.addEventListener('gattserverdisconnected', () => {
    cachedDevice = null;
    cachedCharacteristic = null;
    cachedProfile = null;
  });

  const server = await device.gatt!.connect();

  // Thử từng profile cho đến khi thành công
  for (const profile of PRINTER_PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.serviceUUID);
      const characteristic = await service.getCharacteristic(
        profile.characteristicUUID
      );

      cachedDevice = device;
      cachedCharacteristic = characteristic;
      cachedProfile = profile;

      console.log(`[BT Printer] Kết nối thành công với profile: ${profile.label}`);
      return { characteristic, profile, device };
    } catch {
      // profile này không phù hợp, thử tiếp
    }
  }

  throw new Error(
    'Không tìm thấy service phù hợp trên máy in.\n' +
      'Máy in có thể dùng Classic Bluetooth (SPP) thay vì BLE.\n' +
      'Xem hướng dẫn cài print-server bên dưới.'
  );
}

/** Dùng lại kết nối cũ nếu còn, nếu không tự kết nối lại */
export async function getOrConnect(): Promise<BluetoothRemoteGATTCharacteristic> {
  if (
    cachedDevice?.gatt?.connected &&
    cachedCharacteristic
  ) {
    return cachedCharacteristic;
  }
  const { characteristic } = await connectPrinter();
  return characteristic;
}

/** Gửi bytes đến máy in, chia thành chunks */
export async function sendBytes(
  characteristic: BluetoothRemoteGATTCharacteristic,
  data: Uint8Array
): Promise<void> {
  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    await characteristic.writeValueWithoutResponse(chunk);
    // Delay nhỏ giữa các chunk để máy in kịp xử lý
    await new Promise((r) => setTimeout(r, 50));
  }
}

/** In và (tuỳ chọn) mở két tiền */
export async function printReceipt(
  data: Uint8Array,
  options?: { onProgress?: (msg: string) => void }
): Promise<void> {
  const log = options?.onProgress ?? (() => {});

  log('Đang kết nối máy in...');
  const characteristic = await getOrConnect();

  log('Đang gửi dữ liệu...');
  await sendBytes(characteristic, data);

  log('In xong!');
}

/** Ngắt kết nối */
export function disconnectPrinter(): void {
  cachedDevice?.gatt?.disconnect();
  cachedDevice = null;
  cachedCharacteristic = null;
  cachedProfile = null;
}
