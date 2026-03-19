#!/usr/bin/env bash
# Applies gerbidigm patches to upstream-owned files.
# Safe to run multiple times — already-applied hunks are skipped.
# Called automatically by the post-rebase hook after syncing with upstream.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
PATCHES_DIR="$REPO_ROOT/gerbidigm/patches"

if [ ! -d "$PATCHES_DIR" ]; then
  echo "No patches directory found at $PATCHES_DIR; nothing to apply."
  exit 0
fi

shopt -s nullglob
patches=("$PATCHES_DIR"/*.patch)

if [ "${#patches[@]}" -eq 0 ]; then
  echo "No patches to apply."
  exit 0
fi

failed=0

for patch in "${patches[@]}"; do
  name="$(basename "$patch")"

  # If the reverse applies cleanly, the patch is already present — skip.
  if git -C "$REPO_ROOT" apply --reverse --check "$patch" 2>/dev/null; then
    echo "✔  $name already applied (skipped)"
    continue
  fi

  # Check whether the patch applies cleanly going forward.
  if ! git -C "$REPO_ROOT" apply --check "$patch" 2>/dev/null; then
    echo "✘  Failed to apply $name — upstream may have changed the target file."
    echo "   Review and update: $patch"
    git -C "$REPO_ROOT" apply --check "$patch" 2>&1 || true
    failed=1
    continue
  fi

  git -C "$REPO_ROOT" apply "$patch"
  echo "✔  Applied $name"
done

if [ "$failed" -ne 0 ]; then
  echo ""
  echo "One or more patches failed. Review the output above, update the"
  echo "affected patch files in gerbidigm/patches/, and re-run:"
  echo "  bash gerbidigm/apply-patches.sh"
  exit 1
fi
