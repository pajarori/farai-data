import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { syncDirectory } from "../vendor/atomic-file";
import { ensurePrivateDirectory, ensurePrivateRegularFileIfExists, ensurePrivateSqlitePath } from "../vendor/private-path";
import { KnowledgeStore } from "./store";
import { legacyKnowledgeDbPath } from "./paths";
import { latestPacks, readEntities, readRecords, type NormalizedRecord } from "./pack";
import { embedPassage } from "./embedder";
import type { KnowledgeEntity } from "./types";

export type BuildResult = {
  path: string;
  packs: number;
  records: number;
  entities: number;
  embeddings: number;
  duplicateGroups: number;
};

export async function buildKnowledgeDb(options: { only?: string[]; path?: string } = {}): Promise<BuildResult> {
  const path = options.path ?? legacyKnowledgeDbPath();
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  if (options.path === undefined) ensurePrivateDirectory(dirname(path), "farai home directory");
  ensurePrivateRegularFileIfExists(path, "knowledge database");
  const store = new KnowledgeStore(temporary, true);
  const db = store.writable();
  const builtAt = new Date().toISOString();
  const packs = latestPacks().filter((pack) => !options.only?.length || options.only.includes(pack.meta.id));

  const loaded = packs.map((pack) => ({ pack, records: readRecords(pack.dir), entities: readEntities(pack.dir) }));
  const embeddings = new Map<string, Float32Array>();
  for (const entry of loaded) {
    for (const record of entry.records) {
      const vector = await embedPassage(passageText(record));
      if (vector) embeddings.set(record.id, vector);
    }
  }

  let recordCount = 0;
  let entityCount = 0;
  const contentGroups = new Map<string, string[]>();

  try {
    db.transaction(() => {
      for (const entry of loaded) {
        store.upsertPack(entry.pack.meta, builtAt);
        const byRecord = groupEntities(entry.entities);
        for (const record of entry.records) {
          store.insertRecord(entry.pack.meta.id, record);
          recordCount += 1;
          const recordEntities = byRecord.get(record.id);
          if (recordEntities?.length) {
            store.insertEntities(recordEntities);
            entityCount += recordEntities.length;
          }
          const vector = embeddings.get(record.id);
          if (vector) store.insertEmbedding(record.id, vector);
          trackDuplicate(contentGroups, record);
        }
      }
      persistDuplicates(db, contentGroups);
    })();

    store.finalizeIndexes();
    const integrity = store.verifyIntegrity();
    if (!integrity.ok) throw new Error(`knowledge integrity failed: ${integrity.issues.map((issue) => `${issue.kind}=${issue.count}`).join(", ")}`);
    const duplicateGroups = [...contentGroups.values()].filter((ids) => ids.length > 1).length;
    const actualRecords = rowCount(db, "kb_records");
    const actualEntities = rowCount(db, "kb_entities");
    const actualEmbeddings = rowCount(db, "kb_embeddings");
    store.close();
    ensurePrivateSqlitePath(temporary, "staged knowledge database");
    rmSync(`${temporary}-wal`, { force: true });
    rmSync(`${temporary}-shm`, { force: true });
    rmSync(`${temporary}-journal`, { force: true });
    renameSync(temporary, path);
    ensurePrivateRegularFileIfExists(path, "knowledge database");
    syncDirectory(dirname(path));
    return { path, packs: packs.length, records: actualRecords, entities: actualEntities, embeddings: actualEmbeddings, duplicateGroups };
  } catch (error) {
    try { store.close(); } catch {}
    rmSync(temporary, { force: true });
    rmSync(`${temporary}-wal`, { force: true });
    rmSync(`${temporary}-shm`, { force: true });
    rmSync(`${temporary}-journal`, { force: true });
    throw error;
  }
}

function passageText(record: NormalizedRecord): string {
  const heading = record.headingPath?.length ? record.headingPath.join(" > ") : record.query;
  return `${heading}\n${record.answer}`;
}

function rowCount(db: ReturnType<KnowledgeStore["writable"]>, table: string): number {
  if (!/^[a-z_]+$/.test(table)) throw new Error(`invalid table name: ${table}`);
  return Number((db.query(`select count(*) as c from ${table}`).get() as { c?: number } | null)?.c ?? 0);
}

function groupEntities(entities: KnowledgeEntity[]): Map<string, KnowledgeEntity[]> {
  const map = new Map<string, KnowledgeEntity[]>();
  for (const entity of entities) {
    const list = map.get(entity.recordId) ?? [];
    list.push(entity);
    map.set(entity.recordId, list);
  }
  return map;
}

function trackDuplicate(groups: Map<string, string[]>, record: NormalizedRecord): void {
  const normalized = record.answer.replace(/\s+/g, " ").trim().toLowerCase();
  if (normalized.length < 64) return;
  const key = createHash("sha256").update(normalized).digest("hex");
  const list = groups.get(key) ?? [];
  list.push(record.id);
  groups.set(key, list);
}

function persistDuplicates(db: ReturnType<KnowledgeStore["writable"]>, groups: Map<string, string[]>): void {
  db.query("delete from kb_dupe_groups").run();
  const insert = db.query("insert into kb_dupe_groups (group_id, record_id) values ($group_id, $record_id)");
  for (const [key, ids] of groups) {
    if (ids.length < 2) continue;
    const groupId = key.slice(0, 16);
    for (const id of ids) insert.run({ $group_id: groupId, $record_id: id });
  }
}
