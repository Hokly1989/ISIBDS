import fs from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("./docs");
const IMG_DIR = path.join(OUT, "assets", "img");

async function walkHtml(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(await walkHtml(full));
    else if (e.name.endsWith(".html")) files.push(full);
  }
  return files;
}

function htmlDecode(s) {
  return s.replace(/&amp;/g, "&").replace(/&#x27;/gi, "'").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function localImgPathFor(decodedUrl) {
  const u = new URL(decodedUrl);
  const parts = decodeURIComponent(u.pathname).split("/").filter(Boolean);
  const rest = parts.slice(1).join("/");
  return path.join(IMG_DIR, rest);
}

async function downloadImage(decodedUrl) {
  const dest = localImgPathFor(decodedUrl);
  const res = await fetch(decodedUrl, { headers: { "User-Agent": "Mozilla/5.0 (staticify-fixup2)" } });
  if (!res.ok) throw new Error(`${res.status} ${decodedUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  return dest;
}

async function main() {
  const files = await walkHtml(OUT);
  const re = /url\(&#x27;(https:\/\/storage\.koompi\.cloud[^&]*)&#x27;\)/gi;
  const rawMatches = new Set();
  const fileContents = new Map();
  for (const f of files) {
    const html = await fs.readFile(f, "utf8");
    fileContents.set(f, html);
    for (const m of html.matchAll(re)) rawMatches.add(m[1]);
  }
  console.log(`Found ${rawMatches.size} url(&#x27;...&#x27;) refs`);
  const rawToLocal = new Map();
  let done = 0, failed = 0;
  for (const raw of rawMatches) {
    const decoded = htmlDecode(raw);
    try {
      const dest = await downloadImage(decoded);
      const rel = "/" + path.relative(OUT, dest).split(path.sep).join("/");
      rawToLocal.set(raw, rel);
      done++;
    } catch (e) {
      failed++;
      console.error(`FAILED: ${decoded} :: ${e.message}`);
    }
  }
  console.log(`Downloaded ${done}, failed ${failed}`);
  for (const [f, html] of fileContents) {
    let out = html;
    for (const [raw, local] of rawToLocal) out = out.split(raw).join(local);
    if (out !== html) await fs.writeFile(f, out);
  }
  console.log("Done.");
}
main().catch((e) => { console.error(e); process.exit(1); });
