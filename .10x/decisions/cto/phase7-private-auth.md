# CTO — phase7-private-auth
**Verdict:** build. The owner's requirement (private member list, self-hosted, no third-party identity provider) rules out managed auth; the auth surface is small enough (one admin, tens of members) that a composed Next.js + Postgres service is cheaper to own than any SaaS.
**Build vs buy:** buy the primitives (Argon2id, jose, otpauth, Drizzle, Caddy), build the flows. No Supabase/Firebase/Clerk/Auth.js (ADR-015 alternatives).
**Direction:** workouts stay local (ADR-001 unchanged). The backend knows only accounts. Cloud sync is a separate, later decision.
**Cost of ownership:** one small VPS, one `docker compose up`, nightly `pg_dump`. No paid cloud provider.
