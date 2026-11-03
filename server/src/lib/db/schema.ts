import { sql } from "drizzle-orm";
import { bigserial, boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

/**
 * PostgreSQL schema (ADR-015). Accounts and sessions only: workout data never
 * reaches the server (ADR-001/016). Every token is stored as a SHA-256 hash;
 * passwords as Argon2id. Migrations are generated into ../../drizzle by
 * drizzle-kit and applied by `npm run db:migrate` (or at container start).
 */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["member", "admin"] }).notNull().default("member"),
    status: text("status", { enum: ["invited", "active", "disabled"] }).notNull().default("invited"),
    passwordHash: text("password_hash"),
    passwordUpdatedAt: timestamp("password_updated_at", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    /** Language of the emails this account receives (invitation, reset, notices). Null = MAIL_DEFAULT_LOCALE. */
    emailLocale: text("email_locale", { enum: ["en", "ar"] }),
    createdBy: uuid("created_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_email_lower_idx").on(sql`lower(${table.email})`), index("users_status_idx").on(table.status)],
);

/** Admin TOTP enrolment. The seed is AES-256-GCM encrypted with a key derived from AUTH_SECRET. */
export const adminTotp = pgTable("admin_totp", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  secretEncrypted: text("secret_encrypted").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  /** SHA-256 of each unused recovery code. */
  recoveryCodeHashes: jsonb("recovery_code_hashes").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Admin dashboard sessions (cookie). `totpVerifiedAt` null = password step done, MFA pending. */
export const adminSessions = pgTable(
  "admin_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    idleExpiresAt: timestamp("idle_expires_at", { withTimezone: true }).notNull(),
    totpVerifiedAt: timestamp("totp_verified_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (table) => [uniqueIndex("admin_sessions_token_idx").on(table.tokenHash), index("admin_sessions_user_idx").on(table.userId)],
);

/**
 * Member (mobile) refresh tokens. One row per issued token; `familyId` ties a
 * device's chain together. A used token presented again revokes the family.
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    familyId: uuid("family_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    replacedBy: uuid("replaced_by"),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    deviceName: text("device_name"),
    ip: text("ip"),
    userAgent: text("user_agent"),
  },
  (table) => [
    uniqueIndex("refresh_tokens_token_idx").on(table.tokenHash),
    index("refresh_tokens_user_idx").on(table.userId),
    index("refresh_tokens_family_idx").on(table.familyId),
  ],
);

/** One-time links: invitations (set the first password) and password resets. */
export const actionTokens = pgTable(
  "action_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["invite", "reset", "admin_setup"] }).notNull(),
    tokenHash: text("token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdBy: uuid("created_by"),
    /** How the link left the server: emailed, or shown to the admin to share by hand (resets only; invitations are always emailed). */
    delivery: text("delivery", { enum: ["email", "manual"] }).notNull().default("manual"),
    /** Email outcome when delivery is "email": sending, sent or failed (with a credential-free reason). */
    emailStatus: text("email_status", { enum: ["sending", "sent", "failed"] }),
    emailError: text("email_error"),
    emailAttemptedAt: timestamp("email_attempted_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("action_tokens_token_idx").on(table.tokenHash), index("action_tokens_user_idx").on(table.userId, table.kind)],
);

/** "Forgot password" requests from the app; the admin sees and handles them. */
export const passwordResetRequests = pgTable(
  "password_reset_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    ip: text("ip"),
    /** Set when a reset link was emailed automatically or the admin issued one. */
    handledAt: timestamp("handled_at", { withTimezone: true }),
    handledBy: uuid("handled_by"),
  },
  (table) => [index("password_reset_requests_open_idx").on(table.handledAt, table.requestedAt)],
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    actorType: text("actor_type", { enum: ["admin", "member", "system", "anonymous"] }).notNull(),
    actorId: uuid("actor_id"),
    action: text("action").notNull(),
    targetUserId: uuid("target_user_id"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    /** Never contains secrets, tokens or passwords. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    success: boolean("success").notNull().default(true),
  },
  (table) => [index("audit_events_at_idx").on(table.at), index("audit_events_target_idx").on(table.targetUserId, table.at)],
);

/** Fixed-window counters for rate limiting; survives restarts and works for one app instance. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export type User = typeof users.$inferSelect;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type AdminSession = typeof adminSessions.$inferSelect;
export type ActionToken = typeof actionTokens.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
