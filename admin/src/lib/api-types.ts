/**
 * JSON shapes of the admin API responses the dashboard reads (ADR-018). The
 * server owns them (server/src/lib/members.ts, server/src/lib/auth/action-tokens.ts);
 * server/tests/admin-contract.ts fails the server typecheck if they drift.
 * Types only: nothing here runs.
 */

export type UserStatus = "invited" | "active" | "disabled";
export type UserRole = "member" | "admin";

export interface InvitationState {
  emailStatus: "sending" | "sent" | "failed" | null;
  emailError: string | null;
  sentAt: string;
  expiresAt: string;
  expired: boolean;
}

export interface MemberSummary {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  role: UserRole;
  lastLoginAt: string | null;
  createdAt: string;
  activeSessions: number;
  /** Latest unused invitation of an invited member: was the email accepted by the mail server? */
  invitation: InvitationState | null;
}

export interface Stats {
  total: number;
  active: number;
  invited: number;
  disabled: number;
  admins: number;
  activeSessions: number;
  openResetRequests: number;
  recent: MemberSummary[];
  loginsLast7Days: number;
}

export interface MemberDetail {
  member: MemberSummary;
  sessions: { familyId: string; deviceName: string | null; ip: string | null; createdAt: string; lastSeenAt: string; expiresAt: string }[];
  pendingLinks: { kind: string; expiresAt: string; delivery: string; createdAt: string; emailStatus: string | null; emailError: string | null }[];
  audit: { id: number; at: string; action: string; actorType: string; ip: string | null; success: boolean; metadata: Record<string, unknown> }[];
  openResetRequests: number;
}

export interface SessionRow {
  familyId: string;
  userId: string;
  email: string;
  displayName: string;
  deviceName: string | null;
  ip: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
}

export interface IssuedLink {
  /** Present only for manual delivery (reset links without working email). Never for invitations. */
  url?: string;
  expiresAt: string;
  delivery: "email" | "manual";
  kind: "invite" | "reset" | "admin_setup";
  /** For emailed links: whether the SMTP server accepted the message. */
  emailStatus: "sent" | "failed" | null;
  emailError: string | null;
}
