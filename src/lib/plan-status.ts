import { todayWib } from "@/lib/format";

export type PlanState = "SAFE" | "NEAR" | "DUE" | "INACTIVE";

export const PLAN_STATE = {
  SAFE: { label: "Aman", tone: "good" as const },
  NEAR: { label: "Mendekati", tone: "warn" as const },
  DUE: { label: "Jatuh Tempo", tone: "bad" as const },
  INACTIVE: { label: "Nonaktif", tone: "neutral" as const },
};

export interface PlanLike {
  is_active: boolean;
  next_due_at: string | null;
  next_due_km: string | number | null;
  lead_days: number | null;
  lead_km: number | null;
}

/** Sisa hari dan km menuju jatuh tempo (negatif = terlewat). */
export function remaining(p: PlanLike, odometer: number): { days: number | null; km: number | null } {
  const today = new Date(`${todayWib()}T00:00:00+07:00`).getTime();
  const days = p.next_due_at ? Math.round((new Date(`${p.next_due_at}T00:00:00+07:00`).getTime() - today) / 86_400_000) : null;
  const km = p.next_due_km !== null && p.next_due_km !== undefined ? Number(p.next_due_km) - odometer : null;
  return { days, km };
}

export function planState(p: PlanLike, odometer: number, defaults: { leadDays: number; leadKm: number }): PlanState {
  if (!p.is_active) return "INACTIVE";
  const { days, km } = remaining(p, odometer);
  if ((days !== null && days <= 0) || (km !== null && km <= 0)) return "DUE";
  const ld = p.lead_days ?? defaults.leadDays;
  const lk = p.lead_km ?? defaults.leadKm;
  if ((days !== null && days <= ld) || (km !== null && km <= lk)) return "NEAR";
  return "SAFE";
}

export function remainingText(p: PlanLike, odometer: number): string {
  const { days, km } = remaining(p, odometer);
  const parts: string[] = [];
  if (days !== null) parts.push(days < 0 ? `terlambat ${-days} hari` : `${days} hari`);
  if (km !== null) parts.push(km < 0 ? `lewat ${Math.round(-km).toLocaleString("id-ID")} km` : `${Math.round(km).toLocaleString("id-ID")} km`);
  return parts.join(" / ") || "-";
}
