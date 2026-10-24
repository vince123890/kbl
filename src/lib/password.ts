export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_RULE_MESSAGE = "Minimal 8 karakter, huruf dan angka";

/** Kebijakan password (spec authentication: Kebijakan password). Mengembalikan pesan galat atau null. */
export function validatePassword(next: string, current?: string): string | null {
  if (next.length < PASSWORD_MIN_LENGTH || !/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) {
    return PASSWORD_RULE_MESSAGE;
  }
  if (current !== undefined && next === current) return "Password baru harus berbeda";
  return null;
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Password sementara acak (selalu memenuhi kebijakan). */
export function generateTempPassword(length = 14): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const out = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  if (!/[0-9]/.test(out.join(""))) out[0] = "7";
  if (!/[A-Za-z]/.test(out.join(""))) out[1] = "k";
  return out.join("");
}
