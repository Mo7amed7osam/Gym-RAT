# Architect — Index
## Principles
- DB (SQLite) is the source of truth; Zustand holds runtime state only.
- Pure `domain/` modules with no React Native imports; exhaustively tested.
- Sessions snapshot prescriptions; metadata edits never rewrite history.
- Integrations isolated in `services/*`; app fully functional when any integration is denied.
## ADRs
001 local-only · 002 sqlite · 003 rotation · 004 static media + YouTube · 005 theme + i18n
## Active features
- [transformation](transformation.md)
