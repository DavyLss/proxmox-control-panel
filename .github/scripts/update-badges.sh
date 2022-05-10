#!/usr/bin/env bash
set -euo pipefail

REPO="${REPO:-DavyLss/proxmox-control-panel}"
OUT_DIR="docs/badges"
TOKEN="${GITHUB_TOKEN:-}"

if [[ -z "$TOKEN" ]]; then
  echo "GITHUB_TOKEN is required" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

encode() {
  python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"
}

badge() {
  local label="$1" message="$2" color="$3" output="$4" logo="${5:-}"
  local l m url
  l=$(encode "$label")
  m=$(encode "$message")
  url="https://img.shields.io/badge/${l}-${m}-${color}?style=for-the-badge"
  if [[ -n "$logo" ]]; then
    url+="&logo=${logo}"
  fi
  curl -fsSL "$url" -o "$output"
}

repo_json=$(curl -fsSL -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" "https://api.github.com/repos/${REPO}")

stars=$(jq -r '.stargazers_count' <<<"$repo_json")
forks=$(jq -r '.forks_count' <<<"$repo_json")
issues=$(jq -r '.open_issues_count' <<<"$repo_json")
default_branch=$(jq -r '.default_branch' <<<"$repo_json")

run_json=$(curl -fsSL -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/${REPO}/actions/workflows/docker-image.yml/runs?branch=${default_branch}&per_page=1")
run_status=$(jq -r '.workflow_runs[0].status // "unknown"' <<<"$run_json")
run_conclusion=$(jq -r '.workflow_runs[0].conclusion // "unknown"' <<<"$run_json")

if [[ "$run_status" != "completed" ]]; then
  docker_state="$run_status"
  docker_color="f59e0b"
else
  case "$run_conclusion" in
    success) docker_state="passing"; docker_color="22c55e" ;;
    failure) docker_state="failing"; docker_color="ef4444" ;;
    *) docker_state="$run_conclusion"; docker_color="6b7280" ;;
  esac
fi

badge "repository" "$REPO" "181717" "$OUT_DIR/repository.svg" "github"
badge "stars" "$stars" "f59e0b" "$OUT_DIR/stars.svg" "github"
badge "forks" "$forks" "8b5cf6" "$OUT_DIR/forks.svg" "git"
badge "open issues" "$issues" "0ea5e9" "$OUT_DIR/issues.svg" "github"
badge "docker build" "$docker_state" "$docker_color" "$OUT_DIR/docker-build.svg" "githubactions"
badge "default branch" "$default_branch" "2563eb" "$OUT_DIR/default-branch.svg" "git"
badge "runtime" "Docker | Node" "0ea5e9" "$OUT_DIR/runtime.svg"
badge "ui" "React + TanStack" "111827" "$OUT_DIR/ui-stack.svg"

echo "Badges updated in $OUT_DIR"