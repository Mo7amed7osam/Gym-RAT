# Engineering Manager — phase7-private-auth
| # | Task | Status |
|---|---|---|
| T1 | Worktree, ADR-015/016, SecureStore install, prebuild | Done |
| T2 | Lease policy, session manager, API client, auth store | Done (`603d946`) |
| T3 | Boot scopes, legacy probe/claim, media scope | Done (`603d946`) |
| T4 | Login / forgot / legacy screens, root layout gating, Settings account | Done (`603d946`) |
| T5 | App tests (session, isolation, screens) + full suite | Done, 345/345 |
| T6 | Server schema, migrations, auth libs, routes | Done (`64f4b3c`) |
| T7 | Server integration tests (PGlite) | Done, 30/30 |
| T8 | Admin UI + public pages + Docker/Caddy | Done (`e39542a`) |
| T9 | Dashboard walk-through + screenshots | Done |
| T10 | Release simulator build, archive ladder, IPA | see report |
| T11 | State files, security review, report | see report |
**Sequencing rationale:** app-side isolation first (riskiest for existing data), server next (contract fixed by `services/auth/types.ts`), UI last.
