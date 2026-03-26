#!/usr/bin/env bash

set -euo pipefail

SCRIPT_NAME="$(basename "$0")"

usage() {
  cat <<EOF
Usage: ${SCRIPT_NAME} --dir <directory>

Options:
  --dir <directory>  Create and initialize the target optimization directory.
  --help             Show this help message.
EOF
}

# Validates that the required command is available in the current environment.
require_command() {
  local command_name="$1"

  if ! command -v "${command_name}" >/dev/null 2>&1; then
    printf 'Error: required command not found: %s\n' "${command_name}" >&2
    exit 1
  fi
}

# Writes the AGENT.md template only when the file does not already exist.
create_agent_file() {
  local file_path="$1"

  if [[ -e "${file_path}" ]]; then
    printf 'Skip: %s already exists\n' "${file_path}"
    return
  fi

  cat >"${file_path}" <<'EOF'
# Optimization Context

## Target

## Success

## Constraints

## Stop
EOF

  printf 'Created: %s\n' "${file_path}"
}

# Writes the optimization history template only when the file does not already exist.
create_history_file() {
  local file_path="$1"

  if [[ -e "${file_path}" ]]; then
    printf 'Skip: %s already exists\n' "${file_path}"
    return
  fi

  cat >"${file_path}" <<'EOF'
{
  "rounds": [],
  "status": "not_started",
  "best_round": null,
  "key_learnings": []
}
EOF

  printf 'Created: %s\n' "${file_path}"
}

# Ensures .gitignore contains the local-only optimization files.
ensure_gitignore_entries() {
  local file_path="$1"
  local agent_entry="AGENT.md"
  local history_entry="optimization_history.json"

  if [[ ! -e "${file_path}" ]]; then
    cat >"${file_path}" <<EOF
${agent_entry}
${history_entry}
EOF
    printf 'Created: %s\n' "${file_path}"
    return
  fi

  if ! grep -Fxq "${agent_entry}" "${file_path}"; then
    printf '%s\n' "${agent_entry}" >>"${file_path}"
  fi

  if ! grep -Fxq "${history_entry}" "${file_path}"; then
    printf '%s\n' "${history_entry}" >>"${file_path}"
  fi

  printf 'Updated: %s\n' "${file_path}"
}

main() {
  require_command git

  local target_dir=""

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --dir)
        if [[ $# -lt 2 || -z "${2}" ]]; then
          printf 'Error: --dir requires a non-empty value\n' >&2
          usage >&2
          exit 1
        fi
        target_dir="$2"
        shift 2
        ;;
      --help)
        usage
        exit 0
        ;;
      *)
        printf 'Error: unknown argument: %s\n' "$1" >&2
        usage >&2
        exit 1
        ;;
    esac
  done

  if [[ -z "${target_dir}" ]]; then
    printf 'Error: --dir is required\n' >&2
    usage >&2
    exit 1
  fi

  mkdir -p "${target_dir}"
  printf 'Directory ready: %s\n' "${target_dir}"

  if [[ ! -d "${target_dir}/.git" ]]; then
    git -C "${target_dir}" init >/dev/null
    printf 'Initialized git repository: %s\n' "${target_dir}"
  else
    printf 'Skip: git repository already exists in %s\n' "${target_dir}"
  fi

  create_agent_file "${target_dir}/AGENT.md"
  create_history_file "${target_dir}/optimization_history.json"
  ensure_gitignore_entries "${target_dir}/.gitignore"
}

main "$@"
