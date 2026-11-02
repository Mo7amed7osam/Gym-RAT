import { SignJWT, jwtVerify, type JWTPayload } from "jose";

import { env } from "@/lib/env";

/** Short-lived member access tokens (ADR-015): HS256 with AUTH_SECRET. */
export interface AccessClaimsInput {
  sub: string;
  /** Refresh-token family the token was minted for; revoking the family revokes the token at the next `me`. */
  fam: string;
  role: "member" | "admin";
}

export type AccessClaims = JWTPayload & AccessClaimsInput;

const ISSUER = "gymrat-auth";
const AUDIENCE = "gymrat-app";

const key = () => new TextEncoder().encode(env().AUTH_SECRET);

export async function signAccessToken(claims: AccessClaimsInput, now = new Date()): Promise<{ token: string; expiresIn: number }> {
  const expiresIn = env().ACCESS_TOKEN_TTL_SECONDS;
  const iat = Math.floor(now.getTime() / 1000);
  const token = await new SignJWT({ fam: claims.fam, role: claims.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(claims.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(iat)
    .setExpirationTime(iat + expiresIn)
    .sign(key());
  return { token, expiresIn };
}

export type AccessVerification = { ok: true; claims: AccessClaims } | { ok: false; reason: "expired" | "invalid" };

export async function verifyAccessToken(token: string, now = new Date()): Promise<AccessVerification> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: ISSUER, audience: AUDIENCE, currentDate: now, clockTolerance: 5 });
    if (typeof payload.sub !== "string" || typeof payload.fam !== "string") return { ok: false, reason: "invalid" };
    return { ok: true, claims: payload as AccessClaims };
  } catch (error) {
    const code = (error as { code?: string }).code;
    return { ok: false, reason: code === "ERR_JWT_EXPIRED" ? "expired" : "invalid" };
  }
}
