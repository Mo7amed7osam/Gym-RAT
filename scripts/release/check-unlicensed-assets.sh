#!/bin/sh
# Fails (exit 1) when a build product contains media whose redistribution
# rights are unverified (assets/exercises/UNLICENSED.sha1). Matches by content
# hash and by file name, so renamed or re-hashed copies are both caught.
#
#   scripts/release/check-unlicensed-assets.sh <path to .app, .ipa or export dir>
#
# Runs automatically as the last build phase of every Release Xcode build
# (plugins/withUnlicensedAssetGuard.js), so an EAS build or local archive that
# would ship the poster fails instead.
set -eu

TARGET=${1:?usage: check-unlicensed-assets.sh <.app | .ipa | directory>}
HERE=$(cd "$(dirname "$0")" && pwd)
LIST=${UNLICENSED_LIST:-"$HERE/../../assets/exercises/UNLICENSED.sha1"}

if [ ! -f "$LIST" ]; then
  echo "error: unlicensed asset list not found at $LIST" >&2
  exit 1
fi

WORK=""
cleanup() { if [ -n "$WORK" ]; then rm -rf "$WORK"; fi; }
trap cleanup EXIT

case "$TARGET" in
  *.ipa)
    WORK=$(mktemp -d)
    unzip -q "$TARGET" -d "$WORK"
    ROOT="$WORK"
    ;;
  *)
    ROOT="$TARGET"
    ;;
esac

if [ ! -d "$ROOT" ]; then
  echo "error: $TARGET is not a directory or .ipa" >&2
  exit 1
fi

found=0
while read -r hash name _rest; do
  case "$hash" in ''|'#'*) continue ;; esac
  stem=${name%.*}
  # By name (any extension, any folder; Metro may add @2x/hashes to the name).
  hits=$(find "$ROOT" -type f -name "${stem}*" 2>/dev/null || true)
  # By content, every file regardless of name or extension (exports name assets by hash).
  byhash=$(find "$ROOT" -type f -size +1k -exec shasum {} + 2>/dev/null \
    | awk -v h="$hash" '$1 == h { sub(/^[0-9a-f]+  /, ""); print }' || true)
  hits="$hits
$byhash"
  hits=$(printf '%s\n' "$hits" | sed '/^$/d' | sort -u)
  if [ -n "$hits" ]; then
    found=1
    echo "error: unlicensed asset '$name' found in $TARGET:" >&2
    printf '%s\n' "$hits" | sed 's/^/  /' >&2
  fi
done < "$LIST"

if [ "$found" -ne 0 ]; then
  echo "error: this build contains media without verified redistribution rights; do not distribute it." >&2
  exit 1
fi
echo "Unlicensed asset check passed: none of $(grep -cv '^#' "$LIST") listed file(s) in $TARGET"
