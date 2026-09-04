#!/usr/bin/env bash
set -euo pipefail

version="${1:?content version is required}"
root="$(cd "$(dirname "$0")/.." && pwd)"
farai_root="${FARAI_SOURCE_DIR:-${root}/../farai}"
out="${root}/dist"
content_home="${FARAI_HOME:-$(mktemp -d)}"
mkdir -p "${out}"

if [[ ! -f "${farai_root}/package.json" ]]; then
  echo "farai source tree not found: ${farai_root}" >&2
  exit 1
fi

FARAI_HOME="${content_home}" bun run --cwd "${farai_root}" src/agent-knowledge/cli.ts build all
db="${content_home}/knowledge.db"
if [[ ! -f "${db}" ]]; then
  echo "knowledge database was not built at ${db}" >&2
  exit 1
fi
cp "${db}" "${out}/knowledge.db"
tar -czf "${out}/skills.tar.gz" -C "${farai_root}/src/agent-skills/library" .

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
  "knowledge": { "url": "https://github.com/pajarori/farai-data/releases/download/${version}/knowledge.db", "sha256": "${knowledge_sha}", "size": ${knowledge_size}, "schemaVersion": ${knowledge_schema} },
  "skills": { "url": "https://github.com/pajarori/farai-data/releases/download/${version}/skills.tar.gz", "sha256": "${skills_sha}", "size": ${skills_size} }
}
EOF
printf '%s  %s\n%s  %s\n' "${knowledge_sha}" "knowledge.db" "${skills_sha}" "skills.tar.gz" > "${out}/checksums.txt"
