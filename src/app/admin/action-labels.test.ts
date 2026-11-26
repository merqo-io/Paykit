import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KNOWN_ACTIONS } from "./action-labels";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

// An action missing from the labels would not appear in the activity log's
// action filter, so a new `recordAudit` call must add its label.
describe("KNOWN_ACTIONS", () => {
  it("covers every action string passed to recordAudit", () => {
    const used = new Set<string>();
    for (const file of sourceFiles(join(process.cwd(), "src"))) {
      const text = readFileSync(file, "utf-8");
      for (const m of text.matchAll(/recordAudit\([\w.]+, "(\w+)"/g)) {
        used.add(m[1]);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    const missing = [...used].filter((a) => !KNOWN_ACTIONS.includes(a));
    expect(missing).toEqual([]);
  });
});
