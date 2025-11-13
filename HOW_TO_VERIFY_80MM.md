# How to Verify 80mm Print Width

## Understanding 80mm Paper

**80mm thermal paper** is the most common size for receipt printers.
- **Width in millimeters:** 80mm
- **Width in pixels (at 96 DPI):** ~302px (80mm ÷ 25.4mm/inch × 96 DPI = 301.57px)
- **Width in pixels (at 72 DPI):** ~226px (used by some printers)
- **Width in inches:** ~3.15 inches

## Current Implementation

The PrintBill component uses **302px width**:

```tsx
<div style={{
  width: "302px",  // ← 80mm at 96 DPI
  margin: "0 auto",
  padding: "10px",
  fontFamily: "'Courier New', monospace",
  fontSize: "12px",
  ...
}}>
```

## Verification Methods

### Method 1: Print Preview (Browser)

1. Click "In Hóa Đơn" button
2. In print dialog, check **"More settings"** or **"Page setup"**
3. Look for dimensions shown in preview
4. Measure on-screen with ruler tool

**Chrome/Edge:**
- Open print dialog
- Click "More settings"
- Look for "Paper size" or custom dimensions

**Firefox:**
- Open print dialog
- Check "Page Setup" button
- View current dimensions

### Method 2: Save as PDF and Measure

1. Click "In Hóa Đơn"
2. Select **"Save as PDF"** as printer
3. Save the file
4. Open PDF in Adobe Reader or browser
5. **Right-click → Properties** to see dimensions
6. Or use PDF ruler tool to measure width

**Expected PDF dimensions:**
- Width: ~80mm or ~3.15 inches
- Height: Variable (auto, based on content)

### Method 3: Print to Actual Thermal Printer

If you have an 80mm thermal printer:

1. Configure printer for **80mm paper**:
   ```
   Printer Settings:
   - Paper size: 80mm (3.15")
   - Width: 80mm
   - Height: Continuous/Auto
   ```

2. Print test bill
3. Measure printed paper width with ruler
4. Should be exactly **80mm (8cm)**

### Method 4: CSS Print Simulation

Add temporary visual guide to check width:

```tsx
// Add to PrintBill component temporarily
<div style={{
  width: "302px",
  border: "2px solid red",  // ← Visual boundary
  margin: "0 auto",
  ...
}}>
```

Then:
1. In browser DevTools, press **Ctrl+Shift+P** (Cmd+Shift+P on Mac)
2. Type "Render" and select "Show Rendering"
3. Check "Emulate CSS media type: print"
4. Your page will show print view
5. Red border shows exact 302px width

### Method 5: Online DPI Calculator

Use this calculation:

```
Width in pixels = (Width in mm ÷ 25.4) × DPI

For 80mm at 96 DPI:
(80 ÷ 25.4) × 96 = 301.57px ≈ 302px ✅

For 80mm at 72 DPI:
(80 ÷ 25.4) × 72 = 226.77px ≈ 227px

For 80mm at 300 DPI (high-res):
(80 ÷ 25.4) × 300 = 944.88px ≈ 945px
```

## Adjusting Width for Different Printers

Some thermal printers use different DPI. Here's how to adjust:

### For 72 DPI Printers (older models):
```tsx
width: "227px",  // 80mm at 72 DPI
```

### For 203 DPI Printers (high-quality):
```tsx
width: "640px",  // 80mm at 203 DPI
```

### For 58mm Paper (smaller receipts):
```tsx
width: "219px",  // 58mm at 96 DPI
```

## Character Width Verification

The bill uses **32 characters per line** for alignment:

```tsx
const padLine = (left: string, right: string, totalWidth: number = 32)
```

**To verify character width fits:**

1. Count characters in this line:
   ```
   ================================
   ```
   Should be exactly **32 characters**

2. Test with longest item name:
   ```tsx
   padLine("Very Long Item Name Here", "$999.99", 32)
   ```
   Should not overflow

3. If text wraps or overflows, reduce character width:
   ```tsx
   const padLine = (left, right, totalWidth: number = 28)  // Smaller
   ```

## Common Width Issues & Fixes

### Issue 1: Bill too wide for printer

**Symptoms:** Text cuts off on right side, paper jam

**Fix:** Reduce width
```tsx
width: "280px",  // Slightly narrower (allows margins)
```

### Issue 2: Bill too narrow, wasted space

**Symptoms:** Large white margins on sides

**Fix:** Increase width
```tsx
width: "310px",  // Slightly wider
```

### Issue 3: Text doesn't align

**Symptoms:** Prices not right-aligned properly

**Fix:** Reduce character count
```tsx
const padLine = (left, right, totalWidth: number = 30)
```

### Issue 4: Different printer = different width

**Symptoms:** Works on one printer, not another

**Fix:** Make width configurable via props:
```tsx
interface PrintBillProps {
  // ... existing props
  paperWidthPx?: number;  // Optional width in pixels
}

export function PrintBill({ 
  booking, 
  orders, 
  deskHourlyRate = 5, 
  paperWidthPx = 302,  // Default 80mm at 96 DPI
  className 
}: PrintBillProps) {
  // Use paperWidthPx in styles
  <div style={{ width: `${paperWidthPx}px`, ... }}>
}
```

Then customize per location:
```tsx
<PrintBill paperWidthPx={227} />  // 72 DPI printer
<PrintBill paperWidthPx={302} />  // 96 DPI printer (default)
<PrintBill paperWidthPx={640} />  // 203 DPI printer
```

## Test with Different Paper Sizes

### 80mm (Standard Receipt - Current):
```tsx
width: "302px"  // Most common
```

### 58mm (Small Receipt):
```tsx
width: "219px"  // Smaller restaurants, cafes
```

### 112mm (Wide Receipt):
```tsx
width: "423px"  // Some restaurants, detailed bills
```

## Printer Configuration Checklist

Before printing, verify printer settings:

```
✅ Paper type: Thermal
✅ Paper width: 80mm (3.15")
✅ Paper size: Custom or "Roll Paper 80mm"
✅ Orientation: Portrait
✅ Margins: None (0mm all sides)
✅ Scale: 100% (no shrink/fit)
✅ Headers/Footers: None
```

## Browser Print Settings

### Chrome/Edge:
```
1. Destination: [Your thermal printer]
2. Pages: All
3. Layout: Portrait
4. Color: Black and white
5. More settings:
   - Paper size: 80mm × Continuous
   - Margins: None
   - Scale: 100%
   - Headers/Footers: Off
```

### Firefox:
```
1. Printer: [Your thermal printer]
2. Page Setup:
   - Format: Custom (80mm width)
   - Margins: 0mm all
3. Print Background: Off
```

## Physical Measurement Guide

If you have a ruler:

1. Print a test bill
2. Measure paper width from edge to edge
3. Should be **exactly 80mm (8.0cm)**

```
|<------------ 80mm ------------>|
|                                |
|   ============================  |
|        BOOKINGCOO              |
|   ============================  |
|                                |
```

4. If different:
   - < 80mm: Increase `width` in code
   - > 80mm: Decrease `width` in code

## Online Testing Tools

**Without printer?** Test with these online tools:

1. **PDFaid.com** - PDF ruler tool
   - Upload your saved PDF
   - Measure width with built-in ruler

2. **Canva** - Design tool
   - Create 80mm × 200mm canvas
   - Paste screenshot of bill preview
   - Check if it fits exactly

3. **Figma** - Free design tool
   - Create frame: 302px width
   - Take screenshot of print preview
   - Paste and compare

## Quick Visual Test

Add this temporary helper to see exact dimensions:

```tsx
// Add inside the bill container temporarily
<div style={{ 
  fontSize: "8px", 
  color: "#999", 
  textAlign: "center",
  borderTop: "1px dashed #ccc",
  paddingTop: "5px",
  marginTop: "10px"
}}>
  Width: 302px (80mm @ 96 DPI)
</div>
```

This will show on the printed bill so you can confirm dimensions.

## Recommended Testing Workflow

1. ✅ **Visual check:** DevTools print emulation
2. ✅ **PDF check:** Save as PDF and verify properties
3. ✅ **Preview check:** Print preview shows clean layout
4. ✅ **Test print:** Print one copy on actual thermal printer
5. ✅ **Measure:** Use ruler to confirm 80mm width
6. ✅ **Adjust:** Fine-tune width if needed
7. ✅ **Production:** Deploy when perfect

---

**Current Setting: 302px = 80mm at 96 DPI (Standard)**

This is the most common configuration and should work with 99% of thermal printers. If you need to adjust, use the methods above to fine-tune for your specific printer model.
