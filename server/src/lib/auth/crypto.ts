import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";

/**
 * Small, standard primitives only (ADR-015): random opaque tokens, SHA-256
 * for storing them, AES-256-GCM for the TOTP seed. No home-grown schemes.
 */

/** 256-bit URL-safe random token; the raw value goes to the user, only its hash is stored. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

function seedKey(): Buffer {
  return Buffer.from(hkdfSync("sha256", env().AUTH_SECRET, "gymrat-totp", "totp-seed-key", 32));
}

/** `iv.ciphertext.tag`, all base64url. */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", seedKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, encrypted, cipher.getAuthTag()].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, encrypted, tag] = stored.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", seedKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Recovery codes: 10 groups of 8 lowercase alphanumerics, shown once. */
export function generateRecoveryCodes(count = 10): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    let code = "";
    for (const byte of bytes) code += alphabet[byte % alphabet.length];
    return `${code.slice(0, 4)}-${code.slice(4)}`;
  });
}
