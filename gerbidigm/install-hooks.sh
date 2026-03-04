#!/usr/bin/env bash
# Installs gerbidigm hooks into .git/hooks/.
# Run once after a fresh clone.

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_SRC="$REPO_ROOT/gerbidigm/hooks"
HOOKS_DST="$REPO_ROOT/.git/hooks"

for hook in "$HOOKS_SRC"/*; do
  name="$(basename "$hook")"
  ln -sf "$hook" "$HOOKS_DST/$name"
  echo "Installed $name"
done

echo "Done."
