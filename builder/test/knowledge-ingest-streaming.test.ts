import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { readBoundedResponseBytes, writeBoundedResponseToFile } from "../vendor/http-response";
import { fetchZippedXml } from "../knowledge/ingest/zip-fetch";
import { ingestEnrichment } from "../knowledge/ingest/enrichment";

const originalFetch = globalThis.fetch;
const originalFaraiHome = process.env.FARAI_HOME;
const originalKnowledgeDir = process.env.FARAI_KNOWLEDGE_DIR;
const directories: string[] = [];

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalFaraiHome === undefined) delete process.env.FARAI_HOME;
  else process.env.FARAI_HOME = originalFaraiHome;
  if (originalKnowledgeDir === undefined) delete process.env.FARAI_KNOWLEDGE_DIR;
  else process.env.FARAI_KNOWLEDGE_DIR = originalKnowledgeDir;
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}

test("bounded response file writes stream data and remove an oversized partial file", async () => {
  const directory = temporaryDirectory("farai-response-file-");
  const valid = join(directory, "valid.bin");
  const invalid = join(directory, "invalid.bin");
  expect(await writeBoundedResponseToFile(new Response("abcdef"), valid, 6)).toBe(6);
  expect(readFileSync(valid, "utf8")).toBe("abcdef");
  await expect(writeBoundedResponseToFile(new Response("abcdef"), invalid, 5)).rejects.toThrow("response exceeded");
  expect(existsSync(invalid)).toBe(false);
});

test("bounded response reads cancel declared oversized bodies", async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream<Uint8Array>({
    pull() {},
    cancel() { cancelled = true; }
  }), { headers: { "content-length": "100" } });
  await expect(readBoundedResponseBytes(response, 10)).rejects.toThrow("response exceeded");
  expect(cancelled).toBe(true);
});

test("zipped xml ingestion streams the archive, validates metadata, and publishes a stable cache file", async () => {
  const directory = temporaryDirectory("farai-zip-ingest-");
  const source = join(directory, "source");
  const home = join(directory, "home");
  writeFileSync(join(directory, "cwec_fixture.xml"), "<Weakness_Catalog Version=\"1.0\"></Weakness_Catalog>");
  const zip = Bun.spawnSync(["zip", "-q", source, "cwec_fixture.xml"], { cwd: directory });
  expect(zip.exitCode).toBe(0);
  const bytes = readFileSync(`${source}.zip`);
  process.env.FARAI_HOME = home;
  globalThis.fetch = (async () => new Response(bytes)) as unknown as typeof fetch;
  const result = await fetchZippedXml("cwe-test", "https://example.test/cwe.zip", /cwec.*\.xml$/i);
  expect(result.xml).toContain("Weakness_Catalog");
  expect(result.path).toBe(join(home, "knowledge-cache", "cwe-test", "cwe-test.xml"));
  expect(existsSync(result.path)).toBe(true);
});

test("enrichment ingestion streams gzip input and writes jsonl without retaining the csv source", async () => {
  const directory = temporaryDirectory("farai-enrichment-");
  process.env.FARAI_KNOWLEDGE_DIR = directory;
  const kev = {
    dateReleased: "2026-01-01",
    vulnerabilities: [{ cveID: "CVE-2026-0001", dateAdded: "2026-01-01", knownRansomwareCampaignUse: "Known" }]
  };
  const epss = gzipSync("#model_version:v1\ncve,epss,percentile\nCVE-2026-0001,0.75,0.98\nCVE-2026-0002,0.10,0.50\n");
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    return url.includes("known_exploited") ? Response.json(kev) : new Response(epss);
  }) as unknown as typeof fetch;
  const result = await ingestEnrichment();
  expect(result.rows).toBe(2);
  const output = readFileSync(join(directory, "enrichment", "enrichment.jsonl"), "utf8");
  expect(output).toContain('"cve":"CVE-2026-0001"');
  expect(output).toContain('"epss":0.75');
  expect(output).toContain('"kevListed":false');
  expect(readdirSync(join(directory, "enrichment")).some((entry) => entry.startsWith(".epss-"))).toBe(false);
});
