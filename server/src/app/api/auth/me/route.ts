import { authenticateMember, issueLease, publicUser } from "@/lib/auth/member-sessions";
import { handler, json } from "@/lib/http";

/** Revalidation: confirms the account is still active and renews the offline lease (ADR-015). */
export const GET = handler(async (request: Request) => {
  const { user } = await authenticateMember(request);
  const now = new Date();
  return json({ user: publicUser(user), lease: issueLease(user.id, now), serverTime: now.toISOString() });
});
