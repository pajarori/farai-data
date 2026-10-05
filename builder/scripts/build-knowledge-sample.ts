import { rmSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { KnowledgeStore } from "../knowledge/store";
import { embedPassage } from "../knowledge/embedder";
import { extractEntities, sourceHash } from "../knowledge/pack";
import type { KnowledgePackMeta } from "../knowledge/types";

const argPath = process.argv[2];
const PATH = argPath
  ? (isAbsolute(argPath) ? argPath : resolve(process.cwd(), argPath))
  : resolve(import.meta.dir, "..", "..", "..", "farai", "test", "fixtures", "knowledge-sample.db");

function pack(id: string, license: string, kind: KnowledgePackMeta["kind"], builtAt: string): KnowledgePackMeta {
  return {
    id,
    sourceUrl: `https://example.test/${id}`,
    pin: "sample",
    license,
    attribution: `${id} contributors`,
    signed: false,
    category: id,
    kind,
    builderVersion: 1,
    retrievedAt: builtAt,
    fields: { query: "query", answer: "answer" }
  };
}

const RECORDS: Array<{ pack: string; id: string; query: string; answer: string; category: string }> = [
  {
    pack: "ctf-writeups",
    id: "ctf-padding-oracle",
    query: "Padding Oracle Attack",
    answer: "When dealing with AES-CBC encryption, a padding oracle lets you decrypt ciphertext without the key by observing whether the server reports valid or invalid padding. Flip bytes in the previous block and watch the oracle response to recover the plaintext block by block.",
    category: "ctf"
  },
  {
    pack: "ctf-writeups",
    id: "ctf-sandbox-escape",
    query: "Python Sandbox Escape",
    answer: "When encountering a restricted Python sandbox, reach builtins through object introspection such as ().__class__.__bases__ to rebuild import and run arbitrary commands even when direct calls are blocked.",
    category: "ctf"
  },
  {
    pack: "hacktricks",
    id: "ht-ssti-jinja2",
    query: "SSTI Jinja2 Bypass",
    answer: "Server-side template injection in Jinja2 can reach os.popen through the config object or subclasses, enabling remote command execution when user input is rendered as a template.",
    category: "technique"
  },
  {
    pack: "payloadsallthethings",
    id: "patt-sqli-union",
    query: "SQL Injection UNION Select",
    answer: "Use UNION SELECT to exfiltrate data when the query reflects columns. Match the column count and types, then read from information_schema. Relevant to CVE-2019-1234 style flaws.",
    category: "payload"
  }
];

const builtAt = new Date().toISOString();
for (const suffix of ["", "-wal", "-shm", "-journal"]) rmSync(`${PATH}${suffix}`, { force: true });

const store = new KnowledgeStore(PATH, true);
const db = store.writable();
const packs: KnowledgePackMeta[] = [
  pack("ctf-writeups", "MIT (CTFKnow dataset)", "qa", builtAt),
  pack("hacktricks", "CC-BY-NC-4.0", "prose", builtAt),
  pack("payloadsallthethings", "MIT", "prose", builtAt)
];

const vectors = new Map<string, Float32Array>();
for (const record of RECORDS) {
  const vector = await embedPassage(`${record.query}\n${record.answer}`);
  if (vector) vectors.set(record.id, vector);
}

db.transaction(() => {
  for (const meta of packs) store.upsertPack(meta, builtAt);
  for (const record of RECORDS) {
    store.insertRecord(record.pack, {
      id: record.id,
      query: record.query,
      answer: record.answer,
      category: record.category,
      sourceHash: sourceHash(record.answer)
    });
    const entities = extractEntities(record.id, `${record.query} ${record.answer}`);
    if (entities.length) store.insertEntities(entities);
    const vector = vectors.get(record.id);
    if (vector) store.insertEmbedding(record.id, vector);
  }
})();

store.finalizeIndexes();
const integrity = store.verifyIntegrity();
if (!integrity.ok) throw new Error(`fixture integrity failed: ${JSON.stringify(integrity.issues)}`);
console.log(`[+] wrote ${PATH}`);
console.log(store.status());
store.close();
