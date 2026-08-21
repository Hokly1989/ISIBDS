// Framer Motion left inline style="opacity:0;transform:..." on elements meant
// to be animated into view by the (now-removed) hydration JS. With no JS left
// to trigger the animation, they're permanently invisible. Strip these
// initial-state inline styles so content renders at its final state.
import fs from "node:fs/promises";
import path from "node:path";

const DOCS = path.resolve("./docs");

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(await walk(full));
    else if (e.name.endsWith(".html")) files.push(full);
  }
  return files;
}

async function main() {
  const files = await walk(DOCS);
  let totalRemoved = 0;
  for (const f of files) {
    const html = await fs.readFile(f, "utf8");
    const fixed = html.replace(/\s*style="opacity:0[^"]*"/g, (m) => {
      totalRemoved++;
      return "";
    });
    if (fixed !== html) await fs.writeFile(f, fixed);
  }
  console.log(`Removed ${totalRemoved} hidden-animation inline styles across ${files.length} files`);
}
main().catch((e) => { console.error(e); process.exit(1); });
