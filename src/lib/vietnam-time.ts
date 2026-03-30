/**
 * Vietnam Time utilities (UTC+7)
 * All time calculations must use these functions to ensure consistency
 */

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds
const VIETNAM_TIMEZONE = "Asia/Ho_Chi_Minh";

/**
 * Get current time in Vietnam (UTC+7)
 */
export function getNowInVietnam(): Date {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utc + VIETNAM_OFFSET_MS);
}

/**
 * Convert any Date to Vietnam time (UTC+7)
 */
export function toVietnamTime(date: Date): Date {
  const utc = date.getTime() + date.getTimezoneOffset() * 60 * 1000;
  return new Date(utc + VIETNAM_OFFSET_MS);
}

/**
 * Get Vietnam date string (YYYY-MM-DD)
 */
export function getVietnamDateString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;

  if (!year || !month || !day) {
    // Fallback (should rarely happen)
    return new Date(date).toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Get Vietnam time in milliseconds (for comparisons)
 */
export function getNowInVietnamMs(): number {
  return getNowInVietnam().getTime();
}

/**
 * Format UTC Date as datetime-local input value (YYYY-MM-DDTHH:mm)
 * Converts to Vietnam time (UTC+7) for display
 */
export function formatDateTimeLocal(date: Date | string): string {
  const utcDate = typeof date === "string" ? new Date(date) : date;
  const vnDate = toVietnamTime(utcDate);
  
  // Format: YYYY-MM-DDTHH:mm
  const year = vnDate.getFullYear();
  const month = String(vnDate.getMonth() + 1).padStart(2, "0");
  const day = String(vnDate.getDate()).padStart(2, "0");
  const hours = String(vnDate.getHours()).padStart(2, "0");
  const minutes = String(vnDate.getMinutes()).padStart(2, "0");
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Convert datetime-local string (local Vietnam time) to UTC ISO string
 * Used when submitting datetime-local input to API
 */
export function dateTimeLocalToUTC(
  dateTimeLocalStr: string
): string {
  // Parse: "2026-03-30T08:00" as Vietnam time
  const [datePart, timePart] = dateTimeLocalStr.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  
  // Create date assuming it's in Vietnam time
  // Step 1: Create as UTC with Vietnam components
  const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  
  // Step 2: Subtract 7 hours to get actual UTC (since we want Vietnam local time)
  const actualUTC = new Date(utcDate.getTime() - 7 * 60 * 60 * 1000);
  
  return actualUTC.toISOString();
}
