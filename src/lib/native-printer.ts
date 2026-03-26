export type NativePrintResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

declare global {
  interface Window {
    NativePrinter?: {
      print: (base64: string) => string | null | undefined;
      pickPrinter?: () => string | null | undefined;
      isReady?: () => boolean;
      getPrinterInfo?: () => string | null | undefined;
    };
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

export function isNativePrinterAvailable(): boolean {
  return typeof window !== "undefined" && !!window.NativePrinter?.print;
}

export function pickNativePrinter(): NativePrintResult {
  if (!isNativePrinterAvailable()) {
    return { ok: false, message: "Native printer bridge not available" };
  }
  try {
    const res = window.NativePrinter?.pickPrinter?.();
    if (res && res.startsWith("ERROR:")) {
      return { ok: false, message: res.replace(/^ERROR:\s*/, "") };
    }
    return { ok: true, message: res || undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}

export function printNative(bytes: Uint8Array): NativePrintResult {
  if (!isNativePrinterAvailable()) {
    return { ok: false, message: "Native printer bridge not available" };
  }

  try {
    const base64 = bytesToBase64(bytes);
    const res = window.NativePrinter?.print(base64);
    if (res && res.startsWith("ERROR:")) {
      return { ok: false, message: res.replace(/^ERROR:\s*/, "") };
    }
    return { ok: true, message: res || undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}

export function getNativePrinterInfo(): NativePrintResult & {
  name?: string;
  mac?: string;
} {
  if (!isNativePrinterAvailable()) {
    return { ok: false, message: "Native printer bridge not available" };
  }

  try {
    const res = window.NativePrinter?.getPrinterInfo?.();
    if (!res || res === "EMPTY") {
      return { ok: true, message: "No printer selected" };
    }
    if (res.startsWith("ERROR:")) {
      return { ok: false, message: res.replace(/^ERROR:\\s*/, "") };
    }
    const [name, mac] = res.split("|");
    return { ok: true, name: name || undefined, mac: mac || undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, message: msg };
  }
}

export {};
