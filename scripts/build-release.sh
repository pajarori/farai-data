#!/usr/bin/env bash
set -euo pipefail

source_commit="${1:-${CONTENT_SOURCE_COMMIT:-${GITHUB_SHA:-}}}"
if [[ -z "${source_commit}" ]]; then
  source_commit="$(git rev-parse HEAD)"
fi
if [[ ! "${source_commit}" =~ ^[a-f0-9]{40}$ ]]; then
  echo "source commit must be a full 40-character git sha: ${source_commit}" >&2
  exit 1
fi
version="${2:-${CONTENT_VERSION:-git-${source_commit}}}"
if [[ ! "${version}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$ ]]; then
  echo "content version contains unsupported characters: ${version}" >&2
  exit 1
fi
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${root}/dist"
content_home="${FARAI_HOME:-$(mktemp -d)}"
mkdir -p "${out}"

checked_out_commit="$(git -C "${root}" rev-parse HEAD)"
if [[ "${source_commit}" != "${checked_out_commit}" ]]; then
  echo "source commit does not match the checked-out farai-data commit: ${source_commit} != ${checked_out_commit}" >&2
  exit 1
fi

if [[ ! -f "${root}/builder/knowledge/cli.ts" ]]; then
  echo "knowledge builder not found: ${root}/builder" >&2
  exit 1
fi

if [[ -f "${root}/data/corpora.json" ]]; then
  export FARAI_CORPORA_MANIFEST="${root}/data/corpora.json"
fi
FARAI_HOME="${content_home}" bun run --cwd "${root}/builder" knowledge/cli.ts build all
db="${content_home}/knowledge.db"
if [[ ! -f "${db}" ]]; then
  echo "knowledge database was not built at ${db}" >&2
  exit 1
fi
cp "${db}" "${out}/knowledge.db"
if [[ ! -d "${root}/skills" ]]; then
  echo "content skills directory not found: ${root}/skills" >&2
  exit 1
fi
if ! find "${root}/skills" -type f -name SKILL.md -print -quit | grep -q .; then
  echo "content skills directory has no SKILL.md files" >&2
  exit 1
fi
tar -czf "${out}/skills.tar.gz" -C "${root}/skills" .

if command -v sha256sum >/dev/null 2>&1; then
  sha256() { sha256sum "$1" | awk '{print $1}'; }
else
  sha256() { shasum -a 256 "$1" | awk '{print $1}'; }
fi
file_size() {
  if stat -c '%s' "$1" >/dev/null 2>&1; then
    stat -c '%s' "$1"
  else
    stat -f '%z' "$1"
  fi
}
knowledge_sha="$(sha256 "${out}/knowledge.db")"
skills_sha="$(sha256 "${out}/skills.tar.gz")"
knowledge_size="$(file_size "${out}/knowledge.db")"
skills_size="$(file_size "${out}/skills.tar.gz")"
knowledge_schema="$(bun -e 'import { Database } from "bun:sqlite"; const db = new Database(process.argv[1], { readonly: true }); const row = db.query("pragma user_version").get(); console.log(row.user_version); db.close();' "${out}/knowledge.db")"
cat > "${out}/manifest.json" <<EOF
{
  "schemaVersion": 1,
  "contentVersion": "${version}",
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "sourceCommit": "${source_commit}",
  "knowledge": { "url": "https://github.com/pajarori/farai-data/releases/download/${version}/knowledge.db", "sha256": "${knowledge_sha}", "size": ${knowledge_size}, "schemaVersion": ${knowledge_schema} },
  "skills": { "url": "https://github.com/pajarori/farai-data/releases/download/${version}/skills.tar.gz", "sha256": "${skills_sha}", "size": ${skills_size} }
}
EOF
printf '%s  %s\n%s  %s\n' "${knowledge_sha}" "knowledge.db" "${skills_sha}" "skills.tar.gz" > "${out}/checksums.txt"
