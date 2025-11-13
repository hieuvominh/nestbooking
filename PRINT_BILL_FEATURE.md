# Print Bill Feature Documentation

## Overview
The **Print Bill** feature allows staff to generate and print a thermal printer-friendly receipt for completed bookings with paid status. The bill is optimized for **80mm thermal paper** and includes all relevant booking and order information.

## Features

### 1. **Automatic Display**
- Print button appears automatically when `paymentStatus === 'paid'`
- Available on both:
  - **Booking Detail Page** (`/admin/bookings/[id]`)
  - **Billing Page** (`/admin/billing/[bookingId]`)

### 2. **Bill Content**
The printed bill includes:

#### Header Section
- Business name: "BOOKINGCOO"
- Document type: "HÓA ĐƠN THANH TOÁN" (Payment Receipt)
- Booking ID (last 8 characters)
- Print date and time

#### Customer Information
- Customer name
- Phone number (if available)

#### Booking Details
- Desk number
- Combo package name (if applicable)
- Check-in time
- Check-out time
- Duration in hours
- Actual check-in timestamp (if applicable)

#### Pricing Breakdown

**For Regular Bookings:**
```
Thuê Bàn (2.5h x $5/h)         $12.50
```

**For Combo Bookings:**
```
Gói: Premium Combo              $25.00
```

#### Ordered Items
Lists all items ordered during the booking:
```
MÓN ĐÃ GỌI
--------------------------------
Cappuccino
  2 x $4.50                      $9.00
Sandwich
  1 x $6.00                      $6.00
--------------------------------
Tổng Món:                       $15.00
```

#### Grand Total
```
TỔNG CỘNG:                      $27.50
================================
```

#### Payment Status
- Displays: "ĐÃ THANH TOÁN" (Paid)

#### Notes
- Any special notes added to the booking

#### Footer
- Thank you message in Vietnamese

## Technical Implementation

### Component: `PrintBill.tsx`

**Location:** `src/components/PrintBill.tsx`

**Props:**
```typescript
interface PrintBillProps {
  booking: {
    _id: string;
    customer: {
      name: string;
      phone?: string;
      email?: string;
    };
    deskNumber: number;
    startTime: string;
    endTime: string;
    checkedInAt?: string;
    totalAmount?: number;
    paymentStatus: string;
    status: string;
    notes?: string;
    comboPackage?: {
      name: string;
      duration: number;
      price: number;
    };
    items?: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
  };
  orders?: Array<{
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    total: number;
  }>;
  deskHourlyRate?: number; // Default: 5
  className?: string;
}
```

### Thermal Paper Specifications

**Width:** 80mm (≈ 302px at 96dpi)

**Print Formatting:**
- Font: Courier New (monospace)
- Font Size: 12px (main text)
- Line Height: 1.4
- Character Width: 32 characters per line
- Separators: ASCII characters (-, =)

### CSS Print Styling

The component uses `@media print` to:
1. Hide all page content except the bill
2. Set page size to `80mm auto`
3. Remove margins and padding
4. Apply monospace font for alignment
5. Ensure proper text wrapping

### Key Functions

#### `calculateDuration()`
Calculates booking duration in hours from start/end times.

#### `calculateDeskCost()`
Calculates desk rental cost:
- For combo bookings: uses combo price
- For regular bookings: `duration × hourlyRate`

#### `getAllItems()`
Aggregates items from:
- Booking's initial items
- All associated orders

#### `padLine(left, right, totalWidth)`
Aligns text for thermal printing:
```typescript
padLine("Item Name", "$12.50", 32)
// Result: "Item Name               $12.50"
```

## Usage Examples

### 1. Integration in Booking Detail Page

```tsx
import { PrintBill } from "@/components/PrintBill";

// Inside component render:
<PrintBill 
  booking={booking} 
  orders={orders}
  deskHourlyRate={5}
/>
```

### 2. Integration in Billing Page

```tsx
import { PrintBill } from "@/components/PrintBill";

// Transform booking data to match PrintBill interface:
<PrintBill
  booking={{
    _id: booking._id,
    customer: {
      name: booking.customer.name,
      phone: booking.customer.phone,
      email: booking.customer.email,
    },
    deskNumber: parseInt(booking.deskId.label.replace(/\D/g, '')) || 0,
    startTime: booking.startTime,
    endTime: booking.endTime,
    checkedInAt: booking.checkedInAt,
    totalAmount: booking.totalAmount,
    paymentStatus: booking.paymentStatus,
    status: booking.status,
    notes: booking.notes,
    comboPackage: booking.comboId ? {
      name: booking.comboId.name,
      duration: booking.comboId.duration,
      price: booking.comboId.price,
    } : undefined,
  }}
  orders={orders}
  deskHourlyRate={booking.deskId.hourlyRate}
  className="w-full"
/>
```

## User Workflow

### From Booking Detail Page:
1. Navigate to a booking with `paymentStatus: 'paid'`
2. Click "In Hóa Đơn" (Print Bill) button in header
3. Browser print dialog opens
4. Select thermal printer or save as PDF
5. Click Print

### From Billing Page:
1. Complete payment for a booking
2. Payment status changes to "paid"
3. "In Hóa Đơn" button appears below "Payment Completed" message
4. Click button to open print dialog
5. Print or save

## Testing Checklist

- [ ] Print button appears only when `paymentStatus === 'paid'`
- [ ] All customer information displays correctly
- [ ] Desk number shows properly
- [ ] Combo package info displays (when applicable)
- [ ] Regular desk pricing calculates correctly
- [ ] All ordered items appear with correct quantities and prices
- [ ] Item totals calculate correctly
- [ ] Grand total matches booking.totalAmount
- [ ] Vietnamese text renders properly
- [ ] Line separators align correctly (32 characters)
- [ ] Price alignment is consistent (right-aligned)
- [ ] Print dialog shows only bill content (no navigation/UI)
- [ ] Print preview shows proper formatting
- [ ] Actual thermal print output is readable

## Customization Options

### Change Business Name
Edit line 147 in `PrintBill.tsx`:
```tsx
<div className="text-center font-bold text-lg">YOUR BUSINESS NAME</div>
```

### Adjust Paper Width
Modify the `.bill-container` width in print CSS (line 302):
```css
.bill-container {
  width: 302px; /* 80mm, adjust as needed */
}
```

### Change Line Width
Update `padLine()` calls with different `totalWidth`:
```tsx
padLine(leftText, rightText, 40) // 40 characters instead of 32
```

### Add Logo
Insert image before header:
```tsx
<div className="bill-header">
  <img src="/logo.png" alt="Logo" style={{width: '100px', margin: '0 auto'}} />
  <div className="text-center font-bold text-lg">BOOKINGCOO</div>
  ...
</div>
```

## Troubleshooting

### Issue: Text Misaligned
**Solution:** Ensure monospace font is used. Check printer supports Courier New.

### Issue: Bill Too Wide
**Solution:** Reduce character width in `padLine()` from 32 to 28-30.

### Issue: Print Shows Page Layout
**Solution:** Check `@media print` CSS is not being overridden by global styles.

### Issue: Button Not Appearing
**Solution:** Verify `booking.paymentStatus === 'paid'` and component is imported correctly.

### Issue: Missing Order Items
**Solution:** Ensure `orders` prop is passed and populated from API.

## Future Enhancements

- [ ] Add QR code to bill for customer access
- [ ] Support multiple payment methods display
- [ ] Add tax/service charge breakdown
- [ ] Multi-language support (English toggle)
- [ ] Email receipt option
- [ ] Print history tracking
- [ ] Custom templates per location
- [ ] Logo upload feature
- [ ] Discount/promo code display
- [ ] Barcode for inventory tracking

## Browser Compatibility

| Browser | Print Support | Notes |
|---------|---------------|-------|
| Chrome | ✅ Yes | Full support |
| Firefox | ✅ Yes | Full support |
| Safari | ✅ Yes | Full support |
| Edge | ✅ Yes | Full support |
| Mobile Browsers | ⚠️ Limited | Print dialog may vary |

## Dependencies

- React 18+
- Next.js 15+
- TypeScript
- shadcn/ui Button component
- Lucide React (Printer icon)

## Files Modified

1. **Created:**
   - `src/components/PrintBill.tsx` - Main component

2. **Modified:**
   - `src/app/admin/bookings/[id]/page.tsx` - Added import and button
   - `src/app/admin/billing/[bookingId]/page.tsx` - Added import and button

## Support

For issues or questions:
1. Check browser console for errors
2. Verify booking data structure matches interface
3. Test print preview before actual printing
4. Ensure thermal printer is properly configured

---

**Last Updated:** November 14, 2025
**Version:** 1.0.0
**Author:** BookingCoo Development Team
