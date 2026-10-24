export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const SESSION_MAX_HOURS = 8;
export const LOGIN_AT_COOKIE = "kbl_login_at";

export interface LockState {
  failed_attempts: number;
  locked_until: string | null;
}

export function isLocked(state: LockState, now: Date): boolean {
  return state.locked_until !== null && new Date(state.locked_until).getTime() > now.getTime();
}

export function minutesLeft(state: LockState, now: Date): number {
  if (!state.locked_until) return 0;
  return Math.max(0, Math.ceil((new Date(state.locked_until).getTime() - now.getTime()) / 60_000));
}

/** Status baru setelah satu kegagalan login. Kunci yang sudah berakhir dihitung dari 0. */
export function afterFailure(state: LockState, now: Date): LockState & { justLocked: boolean } {
  const base = state.locked_until && !isLocked(state, now) ? 0 : state.failed_attempts;
  const failed = base + 1;
  if (failed >= MAX_FAILED_ATTEMPTS) {
    return {
      failed_attempts: failed,
      locked_until: new Date(now.getTime() + LOCK_MINUTES * 60_000).toISOString(),
      justLocked: true,
    };
  }
  return { failed_attempts: failed, locked_until: null, justLocked: false };
}

export const CLEAN_LOCK_STATE: LockState = { failed_attempts: 0, locked_until: null };

export function sessionExpired(loginAtMs: number, nowMs: number): boolean {
  return nowMs - loginAtMs > SESSION_MAX_HOURS * 3_600_000;
}
