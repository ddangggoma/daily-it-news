#!/usr/bin/env bash
# Link Superpowers + Compound Engineering + Gstack into project-local .claude/
# Idempotent: re-running re-creates symlinks (ln -sfn), no harm.
set -euo pipefail

CLAUDE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$CLAUDE_DIR/vendor"
SP="$VENDOR/superpowers"
CE="$VENDOR/compound-engineering-plugin/plugins/compound-engineering"
GSTACK="$CLAUDE_DIR/skills/gstack"   # gstack lives directly under skills/ per its setup convention

mkdir -p "$CLAUDE_DIR/skills" "$CLAUDE_DIR/agents" "$CLAUDE_DIR/commands" "$CLAUDE_DIR/hooks"

# Symlink helper: ln -sfn but with relative paths for portability
link() {
  local target="$1"
  local linkname="$2"
  # Compute relative path from linkname's directory to target
  local link_dir
  link_dir="$(dirname "$linkname")"
  local rel
  rel="$(python3 -c "import os.path,sys; print(os.path.relpath(sys.argv[1], sys.argv[2]))" "$target" "$link_dir")"
  ln -sfn "$rel" "$linkname"
}

count=0

# ── L2: Superpowers ──────────────────────────────────────────
echo "Linking Superpowers..."
for d in "$SP/skills/"*/; do
  name="$(basename "$d")"
  link "$d" "$CLAUDE_DIR/skills/$name"
  count=$((count+1))
done
for f in "$SP/agents/"*.md; do
  [ -e "$f" ] || continue
  name="$(basename "$f")"
  link "$f" "$CLAUDE_DIR/agents/$name"
done
for f in "$SP/commands/"*.md; do
  [ -e "$f" ] || continue
  name="$(basename "$f")"
  link "$f" "$CLAUDE_DIR/commands/$name"
done
# Hooks: copy session-start contents only (Claude expects .claude/hooks structure)
if [ -d "$SP/hooks" ]; then
  for f in "$SP/hooks"/*; do
    [ -e "$f" ] || continue
    name="$(basename "$f")"
    link "$f" "$CLAUDE_DIR/hooks/$name"
  done
fi

# ── L3: Compound Engineering ─────────────────────────────────
echo "Linking Compound Engineering..."
for d in "$CE/skills/"*/; do
  name="$(basename "$d")"
  link "$d" "$CLAUDE_DIR/skills/$name"
  count=$((count+1))
done
for f in "$CE/agents/"*.md; do
  [ -e "$f" ] || continue
  name="$(basename "$f")"
  # CE uses .agent.md extension; strip the .agent infix for cleaner names
  shortname="${name%.agent.md}.md"
  link "$f" "$CLAUDE_DIR/agents/$shortname"
done

# ── L1: Gstack ───────────────────────────────────────────────
# Gstack's own setup script creates the proper skill dirs (real dir + SKILL.md symlink)
# at .claude/skills/<name>/SKILL.md. We do NOT link them here — that would clash.
# To install/refresh gstack skills, run from .claude/skills/gstack/:
#   ./setup --host claude --team --no-prefix --quiet
# Skip if already set up (idempotent check):
echo "Gstack skills are managed by gstack's own ./setup script (skipped here)"
gstack_count=$(find "$CLAUDE_DIR/skills" -maxdepth 2 -type l -name SKILL.md 2>/dev/null | xargs -I{} dirname {} 2>/dev/null | sort -u | wc -l | tr -d ' ')
echo "Gstack-managed skills detected: $gstack_count"

echo ""
echo "Linked total skills: $count"
echo "skills/  $(ls -1 "$CLAUDE_DIR/skills" | wc -l | tr -d ' ') entries"
echo "agents/  $(ls -1 "$CLAUDE_DIR/agents" | wc -l | tr -d ' ') entries"
echo "commands/ $(ls -1 "$CLAUDE_DIR/commands" | wc -l | tr -d ' ') entries"
echo "hooks/   $(ls -1 "$CLAUDE_DIR/hooks" 2>/dev/null | wc -l | tr -d ' ') entries"
