import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";

function homeDir(): string {
  const configured = process.env.HOME?.trim();
  if (configured) return configured;
  const systemHome = homedir().trim();
  if (!systemHome) throw new Error("unable to resolve the user home directory.");
  return systemHome;
}

export function localFaraiDir(): string {
  const explicit = process.env.FARAI_HOME?.trim();
  if (explicit) {
    if (!isAbsolute(explicit)) throw new Error("farai_home must be an absolute path.");
    return explicit;
  }
  return join(homeDir(), ".local", "pajarori", "farai");
}

export function legacyKnowledgeDbPath(): string {
  return join(localFaraiDir(), "knowledge.db");
}

export function knowledgeRoot(): string {
  return process.env.FARAI_KNOWLEDGE_DIR ?? join(localFaraiDir(), "knowledge");
}

export function packsDir(): string {
  return join(knowledgeRoot(), "packs");
}

export function taxonomyDir(): string {
  return join(knowledgeRoot(), "taxonomy");
}

export function cacheDir(): string {
  return join(localFaraiDir(), "knowledge-cache");
}
