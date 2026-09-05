import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { extractEntities, recordId, sourceHash, writePack, type NormalizedRecord } from "../pack";
import { forEachFileLineSync } from "../../vendor/file-read";
import type { KnowledgeEntity, KnowledgePackKind, KnowledgePackMeta } from "../types";

const MANIFEST_MAX_BYTES = 4 * 1024 * 1024;
const CORPUS_MAX_BYTES = 512 * 1024 * 1024;
const CORPUS_LINE_MAX_BYTES = 1 * 1024 * 1024;
const RECORD_MAX_COUNT = 2_000_000;
const QUERY_MAX_CHARS = 2_000;
const ANSWER_MAX_CHARS = 32_000;
const CONTEXT_MAX_CHARS = 1_000;
const SOURCE_MAX_CHARS = 2_048;
const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

type CorpusEntry = {
  id: string;
  file: string;
  kind: KnowledgePackKind;
  category: string;
  license: string;
  attribution: string;
  sourceUrl: string;
};

type Card = { query: string; answer: string; context?: string; category?: string; sourceUrl?: string };

export function manifestPath(): string | undefined {
  const configured = process.env.FARAI_CORPORA_MANIFEST?.trim();
  if (configured) return configured;
  const fallback = resolve(dirname(new URL(import.meta.url).pathname), "..", "..", "..", "data", "corpora.json");
  return existsSync(fallback) ? fallback : undefined;
}

export function ingestCorpora(): { dir: string; records: number; packIds: string[] } {
  const path = manifestPath();
  if (!path || !existsSync(path)) {
    console.log("[i] corpora: no manifest (set FARAI_CORPORA_MANIFEST); skipping");
    return { dir: "", records: 0, packIds: [] };
  }
  const entries = parseManifest(path);
  const baseDir = dirname(resolve(path));
  let total = 0;
  let lastDir = "";
  const packIds: string[] = [];
  for (const entry of entries) {
    const file = isAbsolute(entry.file) ? entry.file : join(baseDir, entry.file);
    if (!existsSync(file)) {
      console.log(`[i] corpora ${entry.id}: file missing (${entry.file}); skipping`);
      continue;
    }
    const outcome = ingestOne(entry, file);
    if (outcome.records > 0) {
      total += outcome.records;
      lastDir = outcome.dir;
      packIds.push(entry.id);
      console.log(`[+] corpora ${entry.id}: ${outcome.records} records`);
    }
  }
  return { dir: lastDir, records: total, packIds };
}

function ingestOne(entry: CorpusEntry, file: string): { dir: string; records: number } {
  const cards: Card[] = [];
  const hash = createHash("sha256");
  forEachFileLineSync(file, { label: `corpus ${entry.id}`, maxBytes: CORPUS_MAX_BYTES, maxLineBytes: CORPUS_LINE_MAX_BYTES, noFollow: true }, (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (cards.length >= RECORD_MAX_COUNT) throw new Error(`corpus ${entry.id} exceeded ${RECORD_MAX_COUNT} records`);
    const card = parseCard(trimmed);
    if (!card) return;
    hash.update(`${card.query}\0${card.answer}\0${card.context ?? ""}\0${card.category ?? ""}\0${card.sourceUrl ?? ""}\n`);
    cards.push(card);
  });
  if (!cards.length) return { dir: "", records: 0 };
  const meta: KnowledgePackMeta = {
    id: entry.id,
    sourceUrl: entry.sourceUrl,
    pin: hash.digest("hex"),
    license: entry.license,
    attribution: entry.attribution,
    signed: false,
    category: entry.category,
    kind: entry.kind,
    builderVersion: 1,
    retrievedAt: new Date().toISOString(),
    fields: { query: "query", answer: "answer", context: "context" }
  };
  const records: NormalizedRecord[] = [];
  const entities: KnowledgeEntity[] = [];
  let ordinal = 0;
  for (const card of cards) {
    const id = recordId(meta.id, meta.pin, `${card.sourceUrl ?? "card"}#${ordinal++}`);
    const domain = card.category ?? "misc";
    records.push({
      id,
      query: card.query,
      answer: card.answer,
      context: card.context ?? domain,
      category: entry.category,
      ...(card.sourceUrl ? { source: card.sourceUrl, docPath: card.sourceUrl } : {}),
      sourceHash: sourceHash(`${card.query}\n${card.answer}`)
    });
    for (const entity of extractEntities(id, `${card.query}\n${card.answer}`)) entities.push(entity);
  }
  const dir = writePack(meta, records, entities);
  return { dir, records: records.length };
}

function parseManifest(path: string): CorpusEntry[] {
  const raw = readFileSync(path, "utf8");
  if (Buffer.byteLength(raw, "utf8") > MANIFEST_MAX_BYTES) throw new Error("corpora manifest too large");
  const parsed: unknown = JSON.parse(raw);
  const list = Array.isArray(parsed) ? parsed : (parsed as { corpora?: unknown })?.corpora;
  if (!Array.isArray(list)) throw new Error("corpora manifest must be an array or { corpora: [...] }");
  const out: CorpusEntry[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const fileValue = typeof record.file === "string" ? record.file.trim() : "";
    if (!ID_PATTERN.test(id) || !fileValue) continue;
    const kind: KnowledgePackKind = record.kind === "prose" ? "prose" : "qa";
    out.push({
      id,
      file: fileValue,
      kind,
      category: typeof record.category === "string" && record.category.trim() ? record.category.trim() : id,
      license: typeof record.license === "string" ? record.license : "unknown",
      attribution: typeof record.attribution === "string" ? record.attribution : id,
      sourceUrl: typeof record.sourceUrl === "string" ? record.sourceUrl : ""
    });
  }
  return out;
}

function parseCard(line: string): Card | undefined {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const query = clip(record.query, QUERY_MAX_CHARS);
  const answer = clip(record.answer, ANSWER_MAX_CHARS);
  if (!query || !answer) return undefined;
  const context = clip(record.context, CONTEXT_MAX_CHARS);
  const category = typeof record.category === "string" ? record.category.trim().toLowerCase() || undefined : undefined;
  const sourceUrl = clip(record.source_url, SOURCE_MAX_CHARS);
  return {
    query,
    answer,
    ...(context ? { context } : {}),
    ...(category ? { category } : {}),
    ...(sourceUrl && /^https?:\/\//i.test(sourceUrl) ? { sourceUrl } : {})
  };
}

function clip(value: unknown, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}
