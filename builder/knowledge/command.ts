import { buildKnowledgeDb } from "./build";
import { listPacks } from "./pack";
import { listTaxonomies } from "./ingest/taxonomy-pack";
import { KnowledgeStore } from "./store";
import { legacyKnowledgeDbPath } from "./paths";
import { ingestHacktricks } from "./ingest/hacktricks";
import { ingestPayloads } from "./ingest/payloads";
import { ingestAttack } from "./ingest/attack";
import { ingestCwe } from "./ingest/cwe";
import { ingestCapec } from "./ingest/capec";
import { ingestEnrichment } from "./ingest/enrichment";
import { ingestCorpora } from "./ingest/corpora";

type IngestOutcome = { dir: string; records?: number; nodes?: number; edges?: number; rows?: number; imported?: number; skipped?: number; packIds?: string[] };

const INGESTERS: Record<string, () => IngestOutcome | Promise<IngestOutcome>> = {
  hacktricks: ingestHacktricks,
  payloads: ingestPayloads,
  attack: ingestAttack,
  cwe: ingestCwe,
  capec: ingestCapec,
  enrichment: ingestEnrichment,
  corpora: ingestCorpora
};

const DEFAULT_INGEST = ["hacktricks", "payloads", "corpora"];
const TAXONOMY_INGEST = ["attack", "cwe", "capec", "enrichment"];

export async function runKbCommand(argv: string[]): Promise<number> {
  const [command, ...args] = argv;
  switch (command) {
    case "list":
      list();
      return 0;
    case "build":
      return await build(args);
    case "status":
      status();
      return 0;
    case "verify":
      return verify();
    default:
      usage();
      return command ? 1 : 0;
  }
}

function list(): void {
  console.log("[*] available ingesters:");
  for (const id of Object.keys(INGESTERS)) console.log(`    - ${id}${TAXONOMY_INGEST.includes(id) ? " (graph)" : ""}`);
  const packs = listPacks();
  console.log(`[*] ingested packs (${packs.length}):`);
  for (const pack of packs) console.log(`    - ${pack.meta.id}@${pack.meta.pin.slice(0, 12)} (${pack.meta.kind}, ${pack.meta.license})`);
  const taxonomies = listTaxonomies();
  console.log(`[*] ingested taxonomies (${taxonomies.length}):`);
  for (const tax of taxonomies) console.log(`    - ${tax.meta.id}@${tax.meta.pin} (${tax.meta.license})`);
}

async function ingest(names: string[]): Promise<{ code: number; only: string[] }> {
  const targets = names.length ? expandTargets(names) : DEFAULT_INGEST;
  let code = 0;
  const only: string[] = [];
  for (const name of targets) {
    const ingester = INGESTERS[name];
    if (!ingester) {
      console.error(`unknown source: ${name}`);
      code = 1;
      continue;
    }
    console.log(`[*] ingesting ${name}...`);
    try {
      const result = await ingester();
      const detail = result.records !== undefined
        ? `${result.records} records`
        : result.rows !== undefined
          ? `${result.rows} enrichment rows`
          : result.imported !== undefined
            ? `${result.imported} skills imported, ${result.skipped} skipped`
            : `${result.nodes ?? 0} nodes, ${result.edges ?? 0} edges`;
      console.log(`[+] ${name}: ${detail} -> ${result.dir}`);
      if (result.packIds?.length) only.push(...result.packIds);
      else only.push(name);
    } catch (error) {
      console.error(`[!] ${name}: ${error instanceof Error ? error.message : String(error)}`);
      code = 1;
    }
  }
  return { code, only: [...new Set(only)] };
}

function expandTargets(names: string[]): string[] {
  const out: string[] = [];
  for (const name of names) {
    if (name === "all") out.push(...DEFAULT_INGEST, ...TAXONOMY_INGEST);
    else if (name === "taxonomy") out.push(...TAXONOMY_INGEST);
    else out.push(name);
  }
  return [...new Set(out)];
}

async function build(args: string[]): Promise<number> {
  const positional = args.filter((value) => !value.startsWith("--"));
  const sources = expandTargets(positional.length ? positional : ["all"]);
  const { code, only } = await ingest(sources);
  if (only.length) {
    console.log("[*] compiling knowledge.db...");
    const result = buildKnowledgeDb({ only });
    console.log(`[+] packs=${result.packs} records=${result.records} entities=${result.entities} nodes=${result.nodes} edges=${result.edges} prunedEdges=${result.prunedEdges} dupeGroups=${result.duplicateGroups}`);
    console.log(`[+] -> ${result.path}`);
  }
  return code;
}

function status(): void {
  const store = KnowledgeStore.openIfExists(legacyKnowledgeDbPath());
  if (!store) {
    console.log("[!] knowledge.db not built yet");
    return;
  }
  const info = store.status();
  console.log(`[*] knowledge.db: ${info.path} (schema ${info.schemaVersion})`);
  console.log(`[+] corpora: ${info.records} records`);
  for (const pack of info.packs) {
    const signature = pack.signed ? `signed${pack.signer ? ` by ${pack.signer}` : ""}` : "unsigned";
    console.log(`    - ${pack.id}@${pack.pin.slice(0, 12)}: ${pack.records} records (${pack.license}, ${signature}, retrieved ${pack.retrievedAt})`);
  }
  console.log(`[+] taxonomy graph: ${info.nodes} nodes, ${info.edges} unique edges`);
  for (const taxonomy of info.taxonomies) console.log(`    - ${taxonomy.kind}@${taxonomy.pin}: ${taxonomy.nodes} nodes`);
  console.log(`[+] enrichment: ${info.enrichment.records} CVEs, ${info.enrichment.kevListed} KEV, ${info.enrichment.epssScored} EPSS${info.enrichment.asOf ? ` (as of ${info.enrichment.asOf})` : ""}`);
  store.close();
}

function verify(): number {
  const store = KnowledgeStore.openIfExists(legacyKnowledgeDbPath());
  if (!store) {
    console.error("[!] knowledge.db not built");
    return 1;
  }
  const integrity = store.verifyIntegrity();
  store.close();
  if (!integrity.ok) {
    console.error(`[!] verify failed: ${integrity.issues.map((issue) => `${issue.kind}=${issue.count}`).join(", ")}`);
    return 1;
  }
  console.log("[+] verify ok");
  return 0;
}

function usage(): void {
  console.log("farai-data knowledge builder");
  console.log("  build [sources... | all | taxonomy]   fetch sources and compile knowledge.db (default: everything)");
  console.log("  list | status | verify");
}
