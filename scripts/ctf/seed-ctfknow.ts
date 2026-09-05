import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";

const REPO = "tszdanger/CTFKnow";
const KNOWLEDGE_FILES = ["dataset/list_knwoledge_question.json", "dataset/list_knwoledge_key.json"];
const OUT = join(dirname(new URL(import.meta.url).pathname), "..", "..", "data", "ctf-knowledge.jsonl");
const CATEGORIES = new Set(["web", "pwn", "rev", "crypto", "forensics", "misc"]);
const QUERY_MAX = 180;
const ANSWER_MAX = 32_000;
const ANSWER_MIN = 80;

type Entry = {
  name?: unknown;
  type?: unknown;
  competition?: unknown;
  knowledge?: unknown;
};

async function resolveSha(): Promise<string> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, {
      headers: { "user-agent": "farai-ctf-seed", accept: "application/vnd.github+json" }
    });
    if (res.ok) {
      const body = (await res.json()) as { sha?: string };
      if (typeof body.sha === "string") return body.sha;
    }
  } catch {}
  return "main";
}

async function main(): Promise<void> {
  const sha = await resolveSha();
  console.log(`[*] building ctfknow seed @ ${sha}`);
  mkdirSync(dirname(OUT), { recursive: true });
  const seen = new Set<string>();
  const buffer: string[] = [];
  let skipped = 0;
  for (const file of KNOWLEDGE_FILES) {
    const url = `https://raw.githubusercontent.com/${REPO}/${sha}/${file}`;
    let entries: Entry[];
    try {
      const res = await fetch(url, { headers: { "user-agent": "farai-ctf-seed" } });
      if (!res.ok) { console.error(`[!] skip ${file}: http ${res.status}`); continue; }
      const parsed = JSON.parse(await res.text());
      if (!Array.isArray(parsed)) { console.error(`[!] skip ${file}: not an array`); continue; }
      entries = parsed as Entry[];
    } catch (error) {
      console.error(`[!] skip ${file}: ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }
    let fileCards = 0;
    for (const entry of entries) {
      const category = normalizeCategory(entry.type);
      const event = eventLabel(entry.competition);
      const sourceUrl = eventUrl(entry.competition);
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      for (const raw of knowledgeStrings(entry.knowledge)) {
        const answer = raw.trim();
        if (answer.length < ANSWER_MIN || answer.length > ANSWER_MAX) { skipped++; continue; }
        const key = createHash("sha256").update(answer).digest("hex").slice(0, 32);
        if (seen.has(key)) { skipped++; continue; }
        seen.add(key);
        buffer.push(JSON.stringify({
          query: synthesizeQuery(answer, category, name),
          answer,
          context: `${category} · ${event}`.trim(),
          category,
          source_url: sourceUrl,
          attribution: `CTFKnow (MIT) — ${event}`,
          provenance: "ctfknow-mit"
        }));
        fileCards++;
      }
    }
    console.log(`[*] ${file}: +${fileCards} unique cards`);
  }
  writeFileSync(OUT, buffer.length ? `${buffer.join("\n")}\n` : "");
  console.log(`[+] seed: ${buffer.length} cards written, ${skipped} skipped/duplicate -> ${OUT}`);
}

function knowledgeStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}

function normalizeCategory(value: unknown): string {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (CATEGORIES.has(raw)) return raw;
  if (raw === "reverse" || raw === "reversing") return "rev";
  if (raw === "pwnable" || raw === "binary") return "pwn";
  if (raw === "cryptography") return "crypto";
  if (raw === "forensic") return "forensics";
  return "misc";
}

function eventLabel(competition: unknown): string {
  if (Array.isArray(competition) && typeof competition[0] === "string") return competition[0].replace(/\//g, " ").trim();
  return "unknown event";
}

function eventUrl(competition: unknown): string {
  if (Array.isArray(competition) && typeof competition[1] === "string" && /^https?:\/\//i.test(competition[1])) return competition[1];
  return "https://ctftime.org";
}

function synthesizeQuery(answer: string, category: string, name: string): string {
  const firstSentence = answer
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.:])\s/)[0] ?? "";
  const lead = firstSentence.length >= 24 ? firstSentence : `${category} technique from ${name}`;
  const clipped = lead.length <= QUERY_MAX ? lead : `${lead.slice(0, QUERY_MAX - 1).trimEnd()}…`;
  return clipped || `${category} technique`;
}

main().catch((error) => {
  console.error(`[!] seed failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
