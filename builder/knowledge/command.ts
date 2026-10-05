import { buildKnowledgeDb } from "./build";
import { listPacks } from "./pack";
import { KnowledgeStore } from "./store";
import { legacyKnowledgeDbPath } from "./paths";
import { ingestHacktricks } from "./ingest/hacktricks";
import { ingestPayloads } from "./ingest/payloads";
import { ingestCorpora } from "./ingest/corpora";

type IngestOutcome = { dir: string; records?: number; imported?: number; skipped?: number; packIds?: string[] };

const INGESTERS: Record<string, () => IngestOutcome | Promise<IngestOutcome>> = {
  hacktricks: ingestHacktricks,
  payloads: ingestPayloads,
  corpora: ingestCorpora
};

const DEFAULT_INGEST = ["hacktricks", "payloads", "corpora"];

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
  for (const id of Object.keys(INGESTERS)) console.log(`    - ${id}`);
  const packs = listPacks();
  console.log(`[*] ingested packs (${packs.length}):`);
  for (const pack of packs) console.log(`    - ${pack.meta.id}@${pack.meta.pin.slice(0, 12)} (${pack.meta.kind}, ${pack.meta.license})`);
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
        : result.imported !== undefined
          ? `${result.imported} skills imported, ${result.skipped} skipped`
          : "done";
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
    if (name === "all") out.push(...DEFAULT_INGEST);
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
    const result = await buildKnowledgeDb({ only });
    console.log(`[+] packs=${result.packs} records=${result.records} entities=${result.entities} embeddings=${result.embeddings} dupeGroups=${result.duplicateGroups}`);
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
  console.log(`[+] corpora: ${info.records} records, ${info.embeddings} embeddings`);
  for (const pack of info.packs) {
    const signature = pack.signed ? `signed${pack.signer ? ` by ${pack.signer}` : ""}` : "unsigned";
    console.log(`    - ${pack.id}@${pack.pin.slice(0, 12)}: ${pack.records} records (${pack.license}, ${signature}, retrieved ${pack.retrievedAt})`);
  }
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
  console.log("  build [sources... | all]   fetch sources and compile knowledge.db (default: everything)");
  console.log("  list | status | verify");
}
