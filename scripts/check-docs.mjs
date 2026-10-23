// Check local file targets in repository prose without a network dependency.
// This intentionally does not validate remote URLs or heading fragments.
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const documents = [];
const failures = [];
let checked = 0;

async function collect(directory, recursive) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory() && recursive) await collect(file, true);
    if (entry.isFile() && /\.(md|html)$/.test(entry.name)) documents.push(file);
  }
}

await collect(root, false);
for (const directory of ["docs", ".github", "public/fixtures"]) {
  await collect(path.join(root, directory), true);
}

for (const file of documents.sort()) {
  const source = (await readFile(file, "utf8")).replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
  const targets = [
    ...source.matchAll(/\]\(\s*(?:<([^>]+)>|([^\s)]+))(?:\s+["'][^\n]*?["'])?\s*\)/g),
    ...source.matchAll(/\b(?:href|src)\s*=\s*["']([^"']+)["']/g),
    ...source.matchAll(/^\s*\[[^\]]+\]:\s*(?:<([^>]+)>|([^\s]+))/gm),
  ];
  for (const match of targets) {
    const target = match[1] ?? match[2];
    if (!target || /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(target)) continue;
    const localPath = target.split(/[?#]/, 1)[0];
    if (!localPath) continue;
    const relative = path.relative(root, file);
    try {
      if (path.isAbsolute(localPath)) throw new Error("use a repository-relative path");
      const resolved = path.resolve(path.dirname(file), decodeURIComponent(localPath));
      if (!resolved.startsWith(root)) throw new Error("target is outside the repository");
      await stat(resolved);
      checked++;
    } catch (error) {
      failures.push(`${relative}: ${target} (${error.code ?? error.message})`);
    }
  }
}

if (failures.length) {
  console.error(`Broken local documentation targets:\n${failures.join("\n")}`);
  process.exitCode = 1;
} else {
  console.log(`Checked ${checked} local file references in ${documents.length} documents. Remote URLs and heading fragments were not checked.`);
}
