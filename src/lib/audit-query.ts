export const AUDIT_ENTITIES = [
  "security",
  "profiles",
  "user_roles",
  "roles",
  "role_permissions",
  "branches",
  "vehicles",
  "spareparts",
  "locations",
  "vendors",
  "reason_codes",
  "system_parameters",
];

export const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DEACTIVATE",
  "ACTIVATE",
  "DELETE",
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "ACCOUNT_LOCKED",
  "LOGOUT",
  "PASSWORD_CHANGED",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_DONE",
  "PASSWORD_RESET_BY_ADMIN",
  "ACCESS_DENIED",
];

export interface AuditFilters {
  entity?: string;
  action?: string;
  user?: string;
  from?: string; // YYYY-MM-DD (WIB)
  to?: string; // YYYY-MM-DD (WIB, inklusif)
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Zona waktu cabang belum dikonfigurasi per cabang; sementara memakai WIB (+07:00).
export function dayStartIso(d: string) {
  return new Date(`${d}T00:00:00+07:00`).toISOString();
}
export function dayEndExclusiveIso(d: string) {
  return new Date(new Date(`${d}T00:00:00+07:00`).getTime() + 86_400_000).toISOString();
}

type FilterableQuery<T> = {
  eq(col: string, v: string): T;
  gte(col: string, v: string): T;
  lt(col: string, v: string): T;
};

/** Menerapkan filter audit pada query Supabase (dipakai daftar dan ekspor agar hasilnya identik). */
export function applyAuditFilters<T extends FilterableQuery<T>>(query: T, f: AuditFilters): T {
  let q = query;
  if (f.entity && AUDIT_ENTITIES.includes(f.entity)) q = q.eq("entity", f.entity);
  if (f.action && AUDIT_ACTIONS.includes(f.action)) q = q.eq("action", f.action);
  if (f.user) q = q.eq("user_id", f.user);
  if (f.from && DATE_RE.test(f.from)) q = q.gte("at", dayStartIso(f.from));
  if (f.to && DATE_RE.test(f.to)) q = q.lt("at", dayEndExclusiveIso(f.to));
  return q;
}

export function changedKeys(before: Record<string, unknown> | null, after: Record<string, unknown> | null): string[] {
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  return [...keys].filter((k) => JSON.stringify(before?.[k]) !== JSON.stringify(after?.[k]));
}

export function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  // cegah formula injection di Excel
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
