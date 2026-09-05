import { afterEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchGitSource } from "../knowledge/ingest/git-source";

const originalFaraiHome = process.env.FARAI_HOME;
const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  if (originalFaraiHome === undefined) delete process.env.FARAI_HOME;
  else process.env.FARAI_HOME = originalFaraiHome;
});

test("git knowledge source clones atomically and refreshes a clean cache", async () => {
  const root = temporaryDirectory("farai-git-source-");
  const home = join(root, "home");
  const source = join(root, "source");
  process.env.FARAI_HOME = home;
  git(["init", "-b", "main", source]);
  git(["-C", source, "config", "user.email", "farai@example.invalid"]);
  git(["-C", source, "config", "user.name", "farai"]);
  writeFileSync(join(source, "record.md"), "first\n");
  git(["-C", source, "add", "record.md"]);
  git(["-C", source, "commit", "-m", "first"]);

  const first = await fetchGitSource({ id: "fixture", url: source, branch: "main" });
  expect(readFileSync(join(first.dir, "record.md"), "utf8")).toBe("first\n");
  writeFileSync(join(first.dir, "stale.md"), "stale\n");

  writeFileSync(join(source, "record.md"), "second\n");
  git(["-C", source, "add", "record.md"]);
  git(["-C", source, "commit", "-m", "second"]);

  const second = await fetchGitSource({ id: "fixture", url: source, branch: "main" });
  expect(second.pin).not.toBe(first.pin);
  expect(readFileSync(join(second.dir, "record.md"), "utf8")).toBe("second\n");
  expect(existsSync(join(second.dir, "stale.md"))).toBeFalse();
});

test("git knowledge source rejects cache path traversal", async () => {
  const root = temporaryDirectory("farai-git-source-invalid-");
  process.env.FARAI_HOME = join(root, "home");
  await expect(fetchGitSource({ id: "../escape", url: root, branch: "main" })).rejects.toThrow("invalid git source id");
});

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  directories.push(directory);
  return directory;
}

function git(args: string[]): void {
  execFileSync("git", args, { stdio: "ignore", timeout: 10_000 });
}
