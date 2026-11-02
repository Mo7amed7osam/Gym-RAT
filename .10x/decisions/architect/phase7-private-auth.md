# Architect — phase7-private-auth (ADR-015, ADR-016)
**Components:** `services/auth/*` (api client, lease policy, secure storage, session manager) · `store/useAuthStore` · `data/db/boot.ts` scopes · `screens/auth/*` · server `lib/auth/*`, `lib/members.ts`, route handlers, admin UI.
**Boundaries:** the session manager never touches workout data; boot never touches credentials; the server never sees workout rows. Pure modules (`lease.ts`, `password.ts`, `jwt.ts`) have no I/O.
**Failure modes:** server down → lease governs for ≤ 7 days, then sign-in wall with data intact · token theft → family revocation on reuse · clock rollback → high-water mark · admin lockout → recovery codes, then CLI · copy failure during legacy claim → legacy file untouched (rename only after verified copy).
**Trade-offs accepted:** HS256 with one server secret (single service, simplest rotation) over asymmetric keys; file-per-account over a column (no migration risk) at the cost of a claim screen.
