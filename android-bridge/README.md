# BookingCoo Android Print Bridge

This is a thin Android WebView wrapper that provides a native Bluetooth Classic (SPP) bridge so your web app can print directly to 58mm thermal printers (JK-5802H) and open the cash drawer using ESC/POS bytes.

## What it does
- Loads your web app URL in a WebView
- Exposes `window.NativePrinter` to JavaScript
- Uses Bluetooth Classic (SPP) to connect and print
- Lets users pick a printer in-app (scan + paired devices)

## Setup
1. Open `android-bridge` in Android Studio.
2. Edit `app/build.gradle` and update `WEB_URL` to your deployed web app URL.
3. Build and run on your Android tablet.

## JavaScript API
Available in the WebView as `window.NativePrinter`:

- `print(base64)`
  - Base64-encoded ESC/POS bytes
  - If no printer is selected, it opens the picker and prints after selection
- `pickPrinter()`
  - Open the device picker manually
- `isReady()`
  - Returns `true` if Bluetooth is supported

## Permissions
The app requests Bluetooth permissions at runtime. On Android 12+ it uses `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT`. On Android 6-11 it requests Location permissions (required by Android to scan Classic Bluetooth).

## Notes
- JK-5802H should be in **Classic** mode (not BLE)
- Pairing in Android Settings can improve stability
- If printing fails, clear saved printer and pick again
