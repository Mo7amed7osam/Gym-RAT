# Product Manager — phase7-private-auth
**Problem:** Gym RAT must become a private members app: only people the owner provisions can use it, with every feature.
**Users:** the owner (admin, one person) and their members (iPhone).
**Stories:** admin creates a member and shares a link → member sets a password and signs in → member trains offline for a week without thinking about it → admin disables/resets/revokes from the dashboard → member sees honest copy about where their data lives.
**Success:** sign-in < 10 s on a normal connection; zero workouts lost across sign-out, lease expiry, account switch; admin can do everything from one page per member; no password ever visible to the admin.
**Non-goals (this phase):** sync, tiers, payments, App Store submission.
**Copy decisions:** "Workouts live on this iPhone only. Signing in on another phone starts with an empty history." Revocation copy says "the next time it is online"; never "instantly".
