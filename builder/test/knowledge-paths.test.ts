import { afterEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { knowledgeRoot } from "../knowledge/paths";

const originalHome = process.env.HOME;
const originalKnowledgeDir = process.env.FARAI_KNOWLEDGE_DIR;

afterEach(() => {
  restoreEnv("HOME", originalHome);
  restoreEnv("FARAI_KNOWLEDGE_DIR", originalKnowledgeDir);
});

describe("knowledge paths", () => {
  test("uses the Farai data directory by default", () => {
    process.env.HOME = "/tmp/farai-path-test-home";
    delete process.env.FARAI_KNOWLEDGE_DIR;

    expect(knowledgeRoot()).toBe(join("/tmp/farai-path-test-home", ".local", "pajarori", "farai", "knowledge"));
  });

  test("honors an explicit knowledge directory", () => {
    process.env.FARAI_KNOWLEDGE_DIR = "/tmp/custom-farai-knowledge";

    expect(knowledgeRoot()).toBe("/tmp/custom-farai-knowledge");
  });
});

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
