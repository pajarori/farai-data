import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "bun:test";
import { KnowledgeStore } from "../knowledge/store";
import { chunkMarkdownByHeading } from "../knowledge/ingest/markdown-chunk";
import { extractEntities, recordId } from "../knowledge/pack";

function seedStore(): KnowledgeStore {
  const dir = mkdtempSync(join(tmpdir(), "farai-kb-"));
  const store = new KnowledgeStore(join(dir, "knowledge.db"), true);
  store.upsertPack({ id: "hacktricks", sourceUrl: "https://x", pin: "abc123def456", license: "CC-BY-NC-4.0", attribution: "Carlos", signed: true, category: "technique", kind: "prose", builderVersion: 1, retrievedAt: "now", fields: { query: "heading_path", answer: "body" } }, "now");
  store.insertRecord("hacktricks", { id: "r1", query: "SQL Injection", answer: "use UNION SELECT to extract data from spring.cloud.function.routing-expression header for CVE-2021-44228", docPath: "web/sqli.md", headingPath: ["SQL Injection", "UNION"], charStart: 0, charEnd: 100, sourceHash: "sha256:x" });
  store.insertRecord("hacktricks", { id: "r2", query: "SSRF", answer: "reach 169.254.169.254 cloud metadata endpoint", docPath: "web/ssrf.md", headingPath: ["SSRF"], charStart: 0, charEnd: 50, sourceHash: "sha256:y" });
  store.insertEntities([{ recordId: "r1", type: "cve", value: "CVE-2021-44228" }]);
  store.upsertNode({ id: "CVE-2021-44228", kind: "cve", name: "Log4Shell", summary: "log4j rce", pin: "v1" });
  store.upsertNode({ id: "CWE-502", kind: "cwe", name: "Deserialization", summary: "unsafe deserialization", pin: "4.x" });
  store.insertEdge({ src: "CVE-2021-44228", rel: "has_weakness", dst: "CWE-502", authoritative: true });
  store.upsertEnrichment({ cve: "CVE-2021-44228", kevListed: true, epss: 0.97, epssPct: 0.99, asOf: "2026-08-27" });
  store.finalizeIndexes();
  return store;
}

test("knowledge store ranks bm25 hits with provenance", () => {
  const store = seedStore();
  const hits = store.search("union select injection", { limit: 3 });
  expect(hits.length).toBe(1);
  expect(hits[0]?.recordId).toBe("r1");
  expect(hits[0]?.license).toBe("CC-BY-NC-4.0");
  expect(hits[0]?.pack).toBe("hacktricks");
  store.close();
});

test("knowledge store trigram matches exact identifiers", () => {
  const store = seedStore();
  const hits = store.search("routing-expression", { limit: 3 });
  expect(hits.some((hit) => hit.recordId === "r1")).toBe(true);
  const meta = store.search("169.254.169.254", { limit: 3 });
  expect(meta.some((hit) => hit.recordId === "r2")).toBe(true);
  store.close();
});

test("knowledge store gives exact identifiers a visible ranking reason", () => {
  const store = seedStore();
  const hits = store.search("CVE-2021-44228", { limit: 3 });
  expect(hits[0]?.recordId).toBe("r1");
  expect(hits[0]?.matchedBy).toContain("exact identifier");
  expect(hits[0]?.pin).toBe("abc123def456");
  expect(hits[0]?.sourceHash).toBe("sha256:x");
  store.close();
});

test("knowledge store must_terms filters against full record", () => {
  const store = seedStore();
  const withTerm = store.search("injection metadata", { mustTerms: ["ssrf"], limit: 5 });
  expect(withTerm.every((hit) => hit.recordId === "r2")).toBe(true);
  const headingTerm = store.search("extract data metadata", { mustTerms: ["union"], limit: 5 });
  expect(headingTerm.some((hit) => hit.recordId === "r1")).toBe(true);
  const impossible = store.search("injection", { mustTerms: ["nonexistentterm"], limit: 5 });
  expect(impossible.length).toBe(0);
  store.close();
});

test("knowledge store read returns full body and attribution", () => {
  const store = seedStore();
  const record = store.read("r1");
  expect(record?.attribution).toBe("Carlos");
  expect(record?.body).toContain("UNION SELECT");
  expect(store.read("missing")).toBeUndefined();
  store.close();
});

test("knowledge store resolves nodes by id and name", () => {
  const store = seedStore();
  expect(store.resolve("CVE-2021-44228").map((n) => n.name)).toEqual(["Log4Shell"]);
  expect(store.resolve("log4shell").map((n) => n.id)).toEqual(["CVE-2021-44228"]);
  store.close();
});

test("knowledge store traverses authoritative edges deterministically", () => {
  const store = seedStore();
  const out = store.neighbors("CVE-2021-44228");
  expect(out).toEqual([{ node: { id: "CWE-502", kind: "cwe", name: "Deserialization", summary: "unsafe deserialization", pin: "4.x" }, rel: "has_weakness", direction: "out", authoritative: true }]);
  const back = store.neighbors("CWE-502", { direction: "in" });
  expect(back[0]?.node.id).toBe("CVE-2021-44228");
  store.close();
});

test("knowledge status separates corpora, taxonomy graph, and enrichment", () => {
  const store = seedStore();
  const status = store.status();
  expect(status.packs.map((pack) => pack.id)).toEqual(["hacktricks"]);
  expect(status.taxonomies).toEqual([
    { kind: "cve", pin: "v1", nodes: 1 },
    { kind: "cwe", pin: "4.x", nodes: 1 }
  ]);
  expect(status.enrichment).toEqual({ records: 1, kevListed: 1, epssScored: 1, asOf: "2026-08-27" });
  store.close();
});

test("knowledge store publishes a standalone private database", () => {
  if (process.platform === "win32") return;
  const dir = mkdtempSync(join(tmpdir(), "farai-kb-private-"));
  const path = join(dir, "knowledge.db");
  const store = new KnowledgeStore(path, true);
  try {
    store.writable();
    store.finalizeIndexes();
    const journal = store.writable().query("pragma journal_mode").get() as Record<string, unknown>;
    expect(String(Object.values(journal)[0]).toLowerCase()).toBe("delete");
    store.close();
    expect(statSync(path).mode & 0o777).toBe(0o600);
    expect(existsSync(`${path}-wal`)).toBe(false);
    if (existsSync(`${path}-shm`)) expect(statSync(`${path}-shm`).mode & 0o777).toBe(0o600);
  } finally {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("knowledge store closes while prepared statements are still referenced", () => {
  const dir = mkdtempSync(join(tmpdir(), "farai-kb-close-"));
  const store = new KnowledgeStore(join(dir, "knowledge.db"), true);
  const statement = store.writable().prepare("select 1");
  try {
    expect(() => store.close()).not.toThrow();
  } finally {
    statement.finalize();
    store.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("knowledge store refuses symlinked database paths", () => {
  if (process.platform === "win32") return;
  const dir = mkdtempSync(join(tmpdir(), "farai-kb-symlink-"));
  const target = join(dir, "outside.db");
  const path = join(dir, "knowledge.db");
  try {
    writeFileSync(target, "unchanged");
    symlinkSync(target, path);
    expect(KnowledgeStore.openIfExists(path)).toBeUndefined();
    expect(() => new KnowledgeStore(path, true).writable()).toThrow("regular file");
    expect(readFileSync(target, "utf8")).toBe("unchanged");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("markdown chunker splits on headings and drops include banners", () => {
  const md = "# Title\n\n{{#include ../banners/x.md}}\n\nintro text here that is long enough to matter.\n\n## Section A\n\nbody of section a with enough content to form a chunk of its own here.\n\n## Section B\n\nbody b.";
  const chunks = chunkMarkdownByHeading(md);
  expect(chunks.length).toBeGreaterThanOrEqual(2);
  expect(chunks.some((c) => c.body.includes("#include"))).toBe(false);
  expect(chunks.some((c) => c.headingPath.includes("Section A"))).toBe(true);
});

test("entity extraction captures cve/cwe/attack identifiers", () => {
  const entities = extractEntities("r", "exploit CVE-2021-44228 mapped to CWE-502 via T1059.001 technique");
  const values = entities.map((e) => `${e.type}:${e.value}`);
  expect(values).toContain("cve:CVE-2021-44228");
  expect(values).toContain("cwe:CWE-502");
  expect(values).toContain("attack:T1059.001");
});

test("oversized section splits into multiple chunks under one heading", () => {
  const paragraph = "payload example line with enough words to be a meaningful paragraph here.\n\n";
  const big = `# Big Section\n\n${paragraph.repeat(120)}`;
  const chunks = chunkMarkdownByHeading(big, { maxBytes: 1000 });
  expect(chunks.length).toBeGreaterThan(1);
  for (const chunk of chunks) expect(Buffer.byteLength(chunk.body, "utf8")).toBeLessThanOrEqual(1400);
});

test("record ids stay unique when a heading yields several chunks", () => {
  const store = new KnowledgeStore(join(mkdtempSync(join(tmpdir(), "farai-kb-")), "k.db"), true);
  store.upsertPack({ id: "demo", sourceUrl: "https://x", pin: "pin123456789", license: "MIT", attribution: "d", signed: false, category: "technique", kind: "prose", builderVersion: 1, retrievedAt: "now", fields: { query: "heading_path", answer: "body" } }, "now");
  const paragraph = "payload example line with enough words to be a meaningful paragraph here.\n\n";
  const big = `# Big Section\n\n${paragraph.repeat(120)}`;
  const chunks = chunkMarkdownByHeading(big, { maxBytes: 1000 });
  const seen = new Set<string>();
  let ordinal = 0;
  for (const chunk of chunks) {
    const id = recordId("demo", "pin123456789", `doc.md#${chunk.charStart}:${ordinal++}`);
    expect(seen.has(id)).toBe(false);
    seen.add(id);
    store.insertRecord("demo", { id, query: "Big Section", answer: chunk.body, docPath: "doc.md", headingPath: ["Big Section"], charStart: chunk.charStart, charEnd: chunk.charEnd, sourceHash: "sha256:x" });
  }
  expect(store.status().records).toBe(chunks.length);
  store.close();
});
