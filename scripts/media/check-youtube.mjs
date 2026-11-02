#!/usr/bin/env node
/**
 * Verifies curated YouTube tutorials (Master Plan v3 §3.4 step 5, decision D11).
 *
 *   node scripts/media/check-youtube.mjs
 *
 * Reads scripts/media/youtube-candidates.json ({ exerciseId: { videoId, reviewed } })
 * and asks YouTube's public oEmbed endpoint about each id:
 *   200 → the video exists, is public and allows embedding (title/channel recorded)
 *   401 → embedding disabled by the owner        → rejected
 *   400/403/404 → missing, private or invalid    → rejected
 * Only 200s whose title was reviewed as the exact movement (`reviewed: true`)
 * are written to data/youtubeVideos.json with `checkedAt`. Nothing else is
 * ever written there by hand. Playback in the in-app player is checked
 * separately on a simulator/device (onReady), see the Phase 5 report.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const candidates = JSON.parse(readFileSync(join(root, 'scripts/media/youtube-candidates.json'), 'utf8'));
const ID = /^[A-Za-z0-9_-]{11}$/;

const verified = {};
const rejected = [];
for (const [exerciseId, candidate] of Object.entries(candidates)) {
  if (!candidate) continue;
  const { videoId, reviewed } = candidate;
  if (!ID.test(videoId)) {
    rejected.push([exerciseId, videoId, 'invalid id']);
    continue;
  }
  const url = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}`;
  const response = await fetch(url);
  if (response.status !== 200) {
    rejected.push([exerciseId, videoId, response.status === 401 ? 'embedding disabled (401)' : `HTTP ${response.status}`]);
    continue;
  }
  const body = await response.json();
  if (reviewed !== true) {
    rejected.push([exerciseId, videoId, `not reviewed: "${body.title}" — ${body.author_name}`]);
    continue;
  }
  // Only the id ships: YouTube's policies limit how long API data such as titles may be stored, and the
  // embedded player shows its own title and attribution. Titles are printed here for the review.
  verified[exerciseId] = { videoId, checkedAt: new Date().toISOString() };
  console.log(`  ✓ ${exerciseId} ${videoId}: "${body.title}" — ${body.author_name}`);
}

writeFileSync(join(root, 'data/youtubeVideos.json'), `${JSON.stringify(verified, null, 2)}\n`);
console.log(`verified ${Object.keys(verified).length}, rejected ${rejected.length}`);
for (const [exerciseId, videoId, reason] of rejected) console.log(`  ✗ ${exerciseId} ${videoId}: ${reason}`);
