# ADR-004: Static exercise illustrations (RepDB free tier, exact matches) + embedded YouTube

**Status:** Accepted (Phase 1 started 2026-11-01)
**Date:** 2026-11-01
**Feature:** transformation
**Author:** 10x-Team (Architect + Product Manager + CTO)

## Context
Original spec wanted RepDB-style looping animations. Verified: RepDB free tier is static start/peak WebP stills; animations are a $499 paid tier; free license requires attribution, forbids dataset redistribution, upscaling/background removal, and generative-AI derivation. A custom animation pipeline was planned, then cancelled by the owner. Current assets are PDF photos of unconfirmed rights and mixed style. Owner direction (final): consistent static illustrations, optional in-app YouTube, offline images, free assets, never a wrong variant.

## Decision
- Media = static illustration(s) per built-in exercise: RepDB free-tier `start`/`peak` (or `main`) WebP bundled unmodified (resize/crop/recolour only) **only where the exercise id is an exact match**; otherwise same-style alternative with recorded license, program substitution (owner), or labelled "No illustration".
- Generated `exercise-media.json` manifest with `source/license/attribution/sha256`; CI lint fails on unmapped built-in exercises.
- Attribution "Exercise data by RepDB (repdb.co)" on About/Credits (license condition). RepDB `exercises.json` metadata used with attribution (D2 default).
- Start/End two-position card in Library detail; `expo-image`.
- YouTube: curated `youtube_video_id` + `embeddable` + `checked_at`; `react-native-youtube-iframe` + `react-native-webview`; player ≥ 200×200, Referer set, no overlays, fullscreen where player permits; fallback card on error; never auto-redirect to the YouTube app.
- PDF photos removed from the bundle. Custom exercises: user photo via image picker or labelled fallback.

## Alternatives Considered
| Alternative | Pros | Cons | Why Not |
|---|---|---|---|
| Paid RepDB Standard animations | Turnkey, consistent | $499; owner: no paid media | Owner constraint |
| Procedural Blender animations | Free, original | Labour/quality risk; owner cancelled | Deferred by owner |
| Mixed free GIF repos | Many exercises | Media licenses absent or third-party (Gym visual, JEFIT) | Not legally usable |
| Keep PDF photos | Already present | Rights unconfirmed; inconsistent | Licensing risk |

## Consequences
### Positive
- Legally clean, offline, ~2 MB, consistent style, no production pipeline.
### Negative
- No motion demonstration; coverage gaps where RepDB has no exact match (currently ~17 nearest-only + 1 none of 38).
### Risks
- Wrong-variant substitution → exact-id mapping reviewed by owner; lint.
- Embed-disabled videos → fallback; curated list verified.

## Dependencies
- Program selection (D4) fixes the exercise list; mapping done then. Supersedes v2 §3 animation plan.
