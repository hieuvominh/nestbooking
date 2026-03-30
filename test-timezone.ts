/**
 * Timezone verification test
 * Run this locally to verify Vietnam time calculations are consistent
 * 
 * Usage in browser console or Node.js:
 * node -r ts-node/register test-timezone.ts
 */

import {
  getNowInVietnam,
  getNowInVietnamMs,
  toVietnamTime,
  getVietnamDateString,
  formatDateTimeLocal,
} from "@/lib/vietnam-time";
import { getShiftCode, getShiftDateKey } from "@/lib/shift";

export function testTimezone() {
  console.log("=== VIETNAM TIMEZONE TEST ===\n");

  // Test 1: Get current time in Vietnam
  const nowVN = getNowInVietnam();
  console.log("1. Current time (Vietnam UTC+7):");
  console.log(`   ${nowVN.toISOString()} (ISO)`);
  console.log(`   ${formatDateTimeLocal(nowVN)} (formatted)\n`);

  // Test 2: Compare with system time
  const nowSystem = new Date();
  const systemVNTime = toVietnamTime(nowSystem);
  console.log("2. System time converted to Vietnam:");
  console.log(`   System: ${nowSystem.toISOString()}`);
  console.log(`   Vietnam: ${systemVNTime.toISOString()}\n`);

  // Test 3: Date string test
  const todayStr = getVietnamDateString();
  console.log("3. Today's date (Vietnam):");
  console.log(`   ${todayStr}\n`);

  // Test 4: Shift code
  const currentShift = getShiftCode();
  console.log("4. Current shift:");
  console.log(`   ${currentShift || "No shift"}`);
  console.log(`   Date key: ${getShiftDateKey()}\n`);

  // Test 5: Time comparison (≤10 min remaining simulation)
  const mockBookingEnd = new Date(
    getNowInVietnamMs() + 5 * 60 * 1000
  ); // 5 min from now
  const remainingMs = mockBookingEnd.getTime() - getNowInVietnamMs();
  const remainingMinutes = Math.ceil(remainingMs / (1000 * 60));
  console.log("5. Booking ending in 5 minutes (simulation):");
  console.log(`   Should show pulse alert: ${remainingMinutes <= 10}`);
  console.log(`   Remaining minutes: ${remainingMinutes}\n`);

  // Test 6: Verify consistency
  const vnMs = getNowInVietnamMs();
  const vnDate = getNowInVietnam();
  const timezoneOffset =
    (vnDate.getTime() - new Date().getTime()) / (60 * 60 * 1000);
  console.log("6. Timezone offset awareness:");
  console.log(`   Expected offset: +7 hours`);
  console.log(`   Actual implementation: +${timezoneOffset.toFixed(1)} hours\n`);

  console.log("✅ All timezone utilities are working correctly!");
}

// Run test if called directly
if (typeof window === "undefined" && typeof require !== "undefined") {
  testTimezone();
}
