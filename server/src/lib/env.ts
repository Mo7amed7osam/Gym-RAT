import { z } from "zod";

/**
 * Server configuration (ADR-015). Everything secret comes from the
 * environment; nothing here has a default that would work in production.
 * `loadEnv()` throws at startup with a readable list of what is missing.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  /** ≥ 32 random bytes, base64 or hex. Signs access tokens and derives the TOTP seed key. */
  AUTH_SECRET: z.string().min(32),
  /** Public HTTPS origin of this deployment, e.g. https://auth.example.com. Used for CSRF checks and links. */
  PUBLIC_ORIGIN: z.string().url(),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  OFFLINE_LEASE_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  INVITE_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(72),
  RESET_TTL_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  ADMIN_SESSION_HOURS: z.coerce.number().int().min(1).max(72).default(12),
  ADMIN_IDLE_MINUTES: z.coerce.number().int().min(5).max(1440).default(60),
  /** Honour X-Forwarded-For from the reverse proxy (Caddy). Off when the app is reached directly. */
  TRUST_PROXY: z.enum(["0", "1"]).default("1"),
  /**
   * Outbound email (required to invite members; see README "Email (SMTP)").
   * Host of the SMTP relay; when unset, the dashboard refuses to create or
   * re-invite members instead of falling back to manual links.
   */
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  /** "1" = implicit TLS (port 465); "0" = STARTTLS, which is then required (port 587). */
  SMTP_SECURE: z.enum(["0", "1"]).default("0"),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASSWORD: z.string().min(1).optional(),
  /** Sender, e.g. "Gym RAT <no-reply@your-domain>". Must be an address the relay may send from. */
  SMTP_FROM: z.string().min(3).optional(),
  APP_NAME: z.string().default("Gym RAT"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid server configuration: ${issues}`);
  }
  const smtp = parsed.data;
  if (smtp.SMTP_HOST && !smtp.SMTP_FROM) throw new Error("Invalid server configuration: SMTP_FROM is required when SMTP_HOST is set");
  if (Boolean(smtp.SMTP_USER) !== Boolean(smtp.SMTP_PASSWORD)) throw new Error("Invalid server configuration: set both SMTP_USER and SMTP_PASSWORD, or neither");
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}

/** Test seam. */
export function setEnvForTests(value: Env | null): void {
  cached = value;
}

export const env = (): Env => loadEnv();
