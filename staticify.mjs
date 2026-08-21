// Convert the Next.js SSR mirror in ./docs into a plain, directly-editable
// static HTML/CSS site: download externally-hosted images locally and
// rewrite references, then strip Next.js hydration <script> tags.
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

function localImgPathFor(url) {
  const u = new URL(url);
  if (u.hostname === "storage.koompi.cloud") {
    // /org_XXXX/<project>/<rest...>  -> assets/img/<project>/<rest...>
    const parts = u.pathname.split("/").filter(Boolean);
    const rest = parts.slice(1).join("/"); // drop org_XXXX
    return path.join(IMG_DIR, decodeURIComponent(rest));
  }
  if (u.hostname === "images.unsplash.com") {
    const base = path.basename(u.pathname) || "unsplash-image";
    const hash = Buffer.from(u.search).toString("hex").slice(0, 8);
    return path.join(IMG_DIR, "unsplash", `${base}-${hash}.jpg`);
  }
  const base = path.basename(u.pathname);
  return path.join(IMG_DIR, "external", base);
}

async function downloadImage(url) {
  const dest = localImgPathFor(url);
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (staticify-tool)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buf);
  return dest;
}

function stripScripts(html) {
  // Remove every <script ...>...</script> or self-closing <script .../>
  // EXCEPT type="application/ld+json" blocks. Keep the Cloudflare email
  // de-obfuscation script since it's small, self-contained, and needed
  // for mailto links to render correctly without JS-based hydration.
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (tag) => {
    if (/type=["']application\/ld\+json["']/i.test(tag)) return tag;
    if (/cloudflare-static\/email-decode/i.test(tag)) return tag;
    return "";
  }).replace(/<link[^>]*rel=["'](preload|modulepreload)["'][^>]*as=["']script["'][^>]*>/gi, "")
    .replace(/<link[^>]*rel=["']modulepreload["'][^>]*>/gi, "");
}

async function main() {
  const files = await walkHtml(OUT);
  console.log(`Found ${files.length} HTML files`);

  const urlRe = /https:\/\/(storage\.koompi\.cloud|images\.unsplash\.com)\/[^\s"'()<>\\]+/g;
  const allUrls = new Set();
  const fileContents = new Map();

  for (const f of files) {
    const html = await fs.readFile(f, "utf8");
    fileContents.set(f, html);
    for (const m of html.matchAll(urlRe)) allUrls.add(m[0]);
  }
  console.log(`Found ${allUrls.size} unique external image URLs`);

  const urlToLocal = new Map();
  let done = 0, failed = 0;
  for (const url of allUrls) {
    try {
      const dest = await downloadImage(url);
      const rel = "/" + path.relative(OUT, dest).split(path.sep).join("/");
      urlToLocal.set(url, rel);
      done++;
    } catch (e) {
      failed++;
      console.error(`FAILED: ${url} :: ${e.message}`);
    }
    if ((done + failed) % 50 === 0) console.log(`  ...${done + failed}/${allUrls.size}`);
  }
  console.log(`Downloaded ${done}, failed ${failed}`);

  for (const [f, html] of fileContents) {
    let out = html;
    for (const [url, local] of urlToLocal) {
      out = out.split(url).join(local);
    }
    out = stripScripts(out);
    await fs.writeFile(f, out);
  }
  console.log("Rewrote references and stripped hydration scripts in all HTML files.");
}

main().catch((e) => { console.error(e); process.exit(1); });
