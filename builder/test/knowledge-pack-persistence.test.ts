import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listPacks, readEntities, readRecords, writePack } from "../knowledge/pack";
import { listTaxonomies, readEdges, readNodes, writeTaxonomy } from "../knowledge/ingest/taxonomy-pack";
import type { KnowledgePackMeta } from "../knowledge/types";

const originalKnowledgeDir = process.env.FARAI_KNOWLEDGE_DIR;
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  if (originalKnowledgeDir === undefined) delete process.env.FARAI_KNOWLEDGE_DIR;
  else process.env.FARAI_KNOWLEDGE_DIR = originalKnowledgeDir;
});

test("knowledge packs stream private jsonl and round trip", () => {
  const root = temporaryDirectory("farai-pack-");
  process.env.FARAI_KNOWLEDGE_DIR = root;
  const dir = writePack(packMeta(), [{ id: "r1", query: "q", answer: "a" }], [{ recordId: "r1", type: "cve", value: "CVE-2026-0001" }]);
  expect(listPacks().map((pack) => pack.meta.id)).toEqual(["demo"]);
  expect(readRecords(dir)).toEqual([{ id: "r1", query: "q", answer: "a" }]);
  expect(readEntities(dir)).toEqual([{ recordId: "r1", type: "cve", value: "CVE-2026-0001" }]);
  if (process.platform !== "win32") expect(statSync(join(dir, "records.jsonl")).mode & 0o777).toBe(0o600);
});

test("knowledge taxonomy streams private jsonl and round trips", () => {
  const root = temporaryDirectory("farai-taxonomy-");
  process.env.FARAI_KNOWLEDGE_DIR = root;
  const dir = writeTaxonomy({
    id: "demo",
    sourceUrl: "https://example.test/demo",
    pin: "1.0",
    license: "MIT",
    attribution: "demo",
    retrievedAt: "2026-09-01T00:00:00.000Z"
  }, [{ id: "CWE-1", kind: "cwe", name: "demo", summary: "summary", pin: "1.0" }], [{ src: "CWE-1", rel: "related", dst: "CWE-2", authoritative: true }]);
  expect(listTaxonomies().map((taxonomy) => taxonomy.meta.id)).toEqual(["demo"]);
  expect(readNodes(dir).map((node) => node.id)).toEqual(["CWE-1"]);
  expect(readEdges(dir).map((edge) => edge.rel)).toEqual(["related"]);
});

test("knowledge persistence rejects a symlinked pack root", () => {
  if (process.platform === "win32") return;
  const root = temporaryDirectory("farai-pack-symlink-");
  const outside = temporaryDirectory("farai-pack-outside-");
  process.env.FARAI_KNOWLEDGE_DIR = root;
  symlinkSync(outside, join(root, "packs"));
  const marker = join(outside, "marker");
  writeFileSync(marker, "unchanged");
  expect(() => writePack(packMeta(), [], [])).toThrow("real directory");
  expect(existsSync(marker)).toBeTrue();
  expect(readFileSync(marker, "utf8")).toBe("unchanged");
});

function packMeta(): KnowledgePackMeta {
  return {
    id: "demo",
    sourceUrl: "https://example.test/demo",
    pin: "abc123",
    license: "MIT",
    attribution: "demo",
    signed: false,
    category: "technique",
    kind: "prose",
    builderVersion: 1,
    retrievedAt: "2026-09-01T00:00:00.000Z",
    fields: { query: "query", answer: "answer" }
  };
}

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}
