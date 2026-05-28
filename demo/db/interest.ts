import { store } from "@/store";

export function applyInterestIfDue(): Promise<{ applied: boolean; credited: number }> {
  return store().applyInterestIfDue();
}

export function applyInterestNow(): Promise<{ credited: number }> {
  return store().applyInterestNow();
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function dayLabel(d: number): string {
  return DAY_LABELS[d] ?? "?";
}
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
