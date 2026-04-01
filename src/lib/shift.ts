import { toVietnamTime, getVietnamDateString } from "@/lib/vietnam-time";

export type ShiftCode = "S1";

export interface ShiftDefinition {
  code: ShiftCode;
  startHour: number;
  endHour: number;
}

export const SHIFT_DEFINITIONS: ShiftDefinition[] = [
  { code: "S1", startHour: 8, endHour: 22 },
];

export function getShiftCode(date: Date = new Date()): ShiftCode | null {
  const local = toVietnamTime(date);
  const hour = local.getHours();
  const shift = SHIFT_DEFINITIONS.find(
    (s) => hour >= s.startHour && hour < s.endHour
  );
  return shift ? shift.code : null;
}

export function getShiftDateKey(date: Date = new Date()): string {
  return getVietnamDateString(date);
}

export function isWithinShift(
  shiftCode: ShiftCode,
  date: Date = new Date()
): boolean {
  const local = toVietnamTime(date);
  const hour = local.getHours();
  const shift = SHIFT_DEFINITIONS.find((s) => s.code === shiftCode);
  if (!shift) return false;
  return hour >= shift.startHour && hour < shift.endHour;
}
