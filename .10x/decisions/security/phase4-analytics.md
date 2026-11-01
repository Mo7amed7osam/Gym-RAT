# Security — phase4-analytics

Review: `reviews/2026-11-02-phase4-security-review.md`. No high or medium findings.
- Parameterised SQL only; bounded inputs; single-transaction writes with rollback.
- Deep links are read-only navigation inside the onboarding guard.
- Owner decision before TestFlight: file-protection class and iCloud backup exclusion for `gymrat.db` now that it holds body measurements.
