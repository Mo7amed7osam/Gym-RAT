#!/bin/sh
# Re-runs the date-sensitive analytics tests under several time zones (Jest
# cannot change TZ inside a run). Usage: sh scripts/test-timezones.sh
set -e
for zone in Africa/Cairo Europe/London America/Los_Angeles Pacific/Auckland Asia/Riyadh UTC; do
  echo "── TZ=$zone"
  TZ=$zone npx jest __tests__/analytics.test.ts __tests__/analytics.edge.test.ts __tests__/history.edit.test.ts __tests__/progress.body-goals.test.ts --silent
done
