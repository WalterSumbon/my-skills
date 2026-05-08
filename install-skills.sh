#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  ./install-skills.sh <skills-directory>

Creates symlinks for every skill directory in this repository into the target
skills directory. A skill directory is any directory containing SKILL.md.
EOF
}

absolute_dir() {
  local path="$1"
  mkdir -p "$path"
  (cd "$path" && pwd -P)
}

main() {
  if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
    usage
    return 0
  fi

  if [[ $# -ne 1 ]]; then
    usage >&2
    return 2
  fi

  local repo_dir
  repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"

  local skills_dir
  skills_dir="$(absolute_dir "$1")"

  local installed=0
  local skipped=0
  local failed=0

  while IFS= read -r -d '' skill_file; do
    local skill_dir
    skill_dir="$(cd "$(dirname "$skill_file")" && pwd -P)"

    local skill_name
    skill_name="$(basename "$skill_dir")"

    local link_path
    link_path="$skills_dir/$skill_name"

    if [[ -L "$link_path" ]]; then
      local current_target
      current_target="$(readlink "$link_path")"
      if [[ "$current_target" != /* ]]; then
        current_target="$(cd "$(dirname "$link_path")" && cd "$(dirname "$current_target")" && pwd -P)/$(basename "$current_target")"
      fi

      if [[ "$current_target" == "$skill_dir" ]]; then
        printf 'skip: %s already links to %s\n' "$skill_name" "$skill_dir"
        skipped=$((skipped + 1))
        continue
      fi

      printf 'error: %s already exists as a symlink to %s\n' "$link_path" "$current_target" >&2
      failed=$((failed + 1))
      continue
    fi

    if [[ -e "$link_path" ]]; then
      printf 'error: %s already exists and is not a symlink\n' "$link_path" >&2
      failed=$((failed + 1))
      continue
    fi

    ln -s "$skill_dir" "$link_path"
    printf 'install: %s -> %s\n' "$link_path" "$skill_dir"
    installed=$((installed + 1))
  done < <(find "$repo_dir" -path "$repo_dir/.git" -prune -o -name SKILL.md -type f -print0 | sort -z)

  printf 'done: installed=%d skipped=%d failed=%d target=%s\n' "$installed" "$skipped" "$failed" "$skills_dir"

  if [[ "$failed" -gt 0 ]]; then
    return 1
  fi
}

main "$@"
