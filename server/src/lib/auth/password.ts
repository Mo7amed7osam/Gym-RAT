import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id (OWASP 2024 guidance: 64 MiB, t=3, p=1). Policy: 12+ characters,
 * at most 128, no known-terrible passwords, not equal to the email.
 */
/** `algorithm: 2` is Argon2id in @node-rs/argon2 (a const enum, so it cannot be imported under isolatedModules). */
const OPTIONS = { algorithm: 2, memoryCost: 65536, timeCost: 3, parallelism: 1 } as const;

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

const DENY = new Set([
  "password1234",
  "123456789012",
  "qwertyuiop12",
  "gymratgymrat",
  "letmeinletmein",
  "iloveyou1234",
  "adminadmin12",
  "passwordpassword",
]);

export type PasswordProblem = "too_short" | "too_long" | "too_common" | "matches_email" | "low_variety";

export function passwordProblems(password: string, email?: string): PasswordProblem[] {
  const problems: PasswordProblem[] = [];
  if (password.length < PASSWORD_MIN_LENGTH) problems.push("too_short");
  if (password.length > PASSWORD_MAX_LENGTH) problems.push("too_long");
  const lower = password.toLowerCase();
  if (DENY.has(lower) || /^(.)\1+$/.test(password) || /^(0123456789|1234567890|abcdefghij)/.test(lower)) problems.push("too_common");
  if (email && lower === email.toLowerCase()) problems.push("matches_email");
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z\d]/].filter((re) => re.test(password)).length;
  if (classes < 2 && password.length < 20) problems.push("low_variety");
  return problems;
}

export const hashPassword = (password: string): Promise<string> => hash(password, OPTIONS);

export async function verifyPassword(stored: string | null, password: string): Promise<boolean> {
  if (!stored) {
    // Burn comparable time so a missing password cannot be told apart by latency.
    await hash(password, OPTIONS);
    return false;
  }
  try {
    return await verify(stored, password, OPTIONS);
  } catch {
    return false;
  }
}
