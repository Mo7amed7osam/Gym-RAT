/**
 * Compile-time contract between this API and the separate dashboard app
 * (ADR-018). The dashboard declares the JSON it reads in
 * admin/src/lib/api-types.ts; `tsc --noEmit` here fails if a server type and
 * the dashboard's copy stop matching in either direction. Nothing runs.
 */
import type * as Dashboard from "../../admin/src/lib/api-types";
import type { IssuedLink } from "@/lib/auth/action-tokens";
import type { InvitationState, MemberDetail, MemberSummary, SessionRow, Stats } from "@/lib/members";

/** Exact type identity (also catches added optional fields), not mere assignability. */
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const same = <A, B>(proof: Same<A, B>): Same<A, B> => proof;

export const contract = [
  same<InvitationState, Dashboard.InvitationState>(true),
  same<MemberSummary, Dashboard.MemberSummary>(true),
  same<Stats, Dashboard.Stats>(true),
  same<MemberDetail, Dashboard.MemberDetail>(true),
  same<SessionRow, Dashboard.SessionRow>(true),
  same<IssuedLink, Dashboard.IssuedLink>(true),
];
