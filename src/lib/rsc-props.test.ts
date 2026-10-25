import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Komponen server tidak boleh mengoper fungsi anonim ke komponen client (galat baru muncul saat halaman dirender,
// bukan saat build). Pakai server action yang di-`.bind(...)`, atau pindahkan logikanya ke komponen client.
const ROOT = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const INLINE_FN = /\s(action|onDone|onSuccess|onClick|onChange|onSubmit|render|children)=\{\s*(async\s*)?(\([^)]*\)|\w+)\s*=>/;

describe("komponen server", () => {
  it("tidak mengoper fungsi anonim sebagai props", () => {
    const offenders: string[] = [];
    for (const file of walk(ROOT)) {
      const src = readFileSync(file, "utf8");
      if (/^\s*["']use client["']/.test(src)) continue; // komponen client boleh memakai fungsi anonim
      src.split(/\r?\n/).forEach((line, i) => {
        if (INLINE_FN.test(line)) offenders.push(`${file.replace(ROOT, "src")}:${i + 1}  ${line.trim().slice(0, 110)}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
