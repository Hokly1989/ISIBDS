// Second pass: catch external image URLs that staticify.mjs's regex mangled
// (raw spaces, HTML-entity-encoded apostrophes/ampersands in filenames).
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
  if (u.hostname === "storage.koompi.cloud") {
    const parts = decodeURIComponent(u.pathname).split("/").filter(Boolean);
    const rest = parts.slice(1).join("/");
    return path.join(IMG_DIR, rest);
  }
  const base = path.basename(u.pathname) || "unsplash-image";
  const hash = Buffer.from(u.search).toString("hex").slice(0, 8);
  return path.join(IMG_DIR, "unsplash", `${base}-${hash}.jpg`);
}

async function downloadImage(decodedUrl) {
  const dest = localImgPathFor(decodedUrl);
  const res = await fetch(decodedUrl, { headers: { "User-Agent": "Mozilla/5.0 (staticify-fixup)" } });
  if (!res.ok) throw new Error(`${res.status} ${decodedUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  return dest;
}

async function main() {
  const files = await walkHtml(OUT);
  // quote-bounded / paren-bounded capture, allows spaces and entities inside
  const patterns = [
    /"(https:\/\/(?:storage\.koompi\.cloud|images\.unsplash\.com)[^"]*)"/g,
    /'(https:\/\/(?:storage\.koompi\.cloud|images\.unsplash\.com)[^']*)'/g,
    /url\((https:\/\/(?:storage\.koompi\.cloud|images\.unsplash\.com)[^)"']*)\)/g,
  ];

  const rawMatches = new Set(); // literal substrings as they appear in the file
  const fileContents = new Map();
  for (const f of files) {
    const html = await fs.readFile(f, "utf8");
    fileContents.set(f, html);
    for (const re of patterns) for (const m of html.matchAll(re)) rawMatches.add(m[1]);
  }
  console.log(`Found ${rawMatches.size} remaining external URL occurrences`);

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
  console.log("Done rewriting.");
}

main().catch((e) => { console.error(e); process.exit(1); });
