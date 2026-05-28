import { todayKey } from "./index";
import {
  addTransaction,
  getAllBalances,
  getInterestConfig,
  setInterestConfig,
} from "./operations";

/**
 * Apply interest if today qualifies and we haven't already applied today.
 *
 * Rules:
 *  - interest.enabled must be true
 *  - today's day-of-week must be in interest.days
 *  - interest.last_applied !== todayKey()
 *  - balance must be > 0 (no interest on zero/negative)
 *
 * Each qualifying kid gets ONE 'interest' transaction. Returns the count of
 * kids credited so the caller can show a toast or whatever.
 */
export async function applyInterestIfDue(): Promise<{ applied: boolean; credited: number }> {
  const cfg = await getInterestConfig();
  if (!cfg.enabled) return { applied: false, credited: 0 };

  const today = todayKey();
  if (cfg.last_applied === today) return { applied: false, credited: 0 };

  const dow = new Date().getDay();
  if (!cfg.days.includes(dow)) return { applied: false, credited: 0 };

  const balances = await getAllBalances();
  let credited = 0;
  for (const [kidIdStr, balance] of Object.entries(balances)) {
    if (balance <= 0) continue;
    const interest = Math.round((balance * cfg.rate_pct) / 100);
    if (interest <= 0) continue;
    await addTransaction(
      Number(kidIdStr),
      interest,
      `Interest (${cfg.rate_pct}%)`,
      "interest"
    );
    credited++;
  }

  await setInterestConfig({ last_applied: today });
  return { applied: true, credited };
}

/**
 * Apply interest unconditionally — no enabled / day-of-week / last-applied checks.
 * Used by the Settings "Apply interest now" button. Still updates last_applied so
 * the automatic pass won't double-credit today.
 */
export async function applyInterestNow(): Promise<{ credited: number }> {
  const cfg = await getInterestConfig();
  const balances = await getAllBalances();
  let credited = 0;
  for (const [kidIdStr, balance] of Object.entries(balances)) {
    if (balance <= 0) continue;
    const interest = Math.round((balance * cfg.rate_pct) / 100);
    if (interest <= 0) continue;
    await addTransaction(
      Number(kidIdStr),
      interest,
      `Interest (${cfg.rate_pct}%)`,
      "interest"
    );
    credited++;
  }
  await setInterestConfig({ last_applied: todayKey() });
  return { credited };
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export function dayLabel(d: number): string {
  return DAY_LABELS[d] ?? "?";
}
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
