// Site mirror script for isibds.koompi.cloud
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { URL } from "node:url";

const BASE = "https://isibds.koompi.cloud";
const OUT = path.resolve("./docs");
const MAX_PAGES = 200;

const seedPaths = [
  "/", "/about", "/about/team", "/careers", "/contact", "/portfolios",
  "/products-solutions", "/products-solutions/building-systems",
  "/products-solutions/isi-peb", "/products-solutions/isi-peb/multi-story-building-systems",
  "/products-solutions/isi-peb/pre-engineered-buildings",
  "/services", "/services/design-build", "/services/industry-specific",
  "/services/industry-specific/agriculture", "/services/industry-specific/food-beverage",
  "/services/industry-specific/logistics", "/services/industry-specific/manufacturing",
  "/services/industry-specific/residential", "/technology",
];
const locales = ["", "/zh"];
const pageQueue = [];
for (const loc of locales) for (const p of seedPaths) {
  const full = p === "/" ? (loc || "/") : loc + p;
  pageQueue.push(full);
}

const seenPages = new Set();
const seenAssets = new Set();
const failed = [];

function localPathForPage(urlPath) {
  let p = urlPath.split("?")[0].split("#")[0];
  if (p === "") p = "/";
  if (p.endsWith("/")) p += "index.html";
  else p += "/index.html";
  return path.join(OUT, p);
}

function localPathForAsset(urlPath) {
  let p = urlPath.split("?")[0].split("#")[0];
  return path.join(OUT, p);
}

async function ensureDirFor(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (mirror-tool)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return await res.text();
}

async function fetchBuffer(url) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (mirror-tool)" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function extractAssetUrls(html) {
  const urls = new Set();
  const patterns = [
    /(?:src|href)=["']([^"']+)["']/g,
    /srcset=["']([^"']+)["']/g,
    /url\(["']?([^"')]+)["']?\)/g,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html))) {
      if (re === patterns[1]) {
        for (const part of m[1].split(",")) {
          const u = part.trim().split(/\s+/)[0];
          if (u) urls.add(u);
        }
      } else {
        urls.add(m[1]);
      }
    }
  }
  return [...urls];
}

function extractInternalLinks(html) {
  const links = new Set();
  const re = /href=["'](\/[^"'#?]*)["']/g;
  let m;
  while ((m = re.exec(html))) links.add(m[1]);
  return [...links];
}

function isAssetPath(p) {
  return /\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|mp4|webm|json|txt|xml|avif)(\?.*)?$/i.test(p);
}

async function downloadAsset(urlPath) {
  if (seenAssets.has(urlPath)) return;
  seenAssets.add(urlPath);
  const abs = new URL(urlPath, BASE).toString();
  const dest = localPathForAsset(urlPath);
  try {
    const buf = await fetchBuffer(abs);
    await ensureDirFor(dest);
    await fs.writeFile(dest, buf);
    if (urlPath.endsWith(".css")) {
      const css = buf.toString("utf8");
      const re = /url\(["']?([^"')]+)["']?\)/g;
      let m;
      while ((m = re.exec(css))) {
        let ref = m[1];
        if (ref.startsWith("data:")) continue;
        if (ref.startsWith("http") && !ref.startsWith(BASE)) continue;
        const refPath = ref.startsWith("http") ? new URL(ref).pathname : new URL(ref, abs).pathname;
        await downloadAsset(refPath);
      }
    }
  } catch (e) {
    failed.push(`${abs} :: ${e.message}`);
  }
}

async function crawlPage(urlPath) {
  if (seenPages.has(urlPath) || seenPages.size >= MAX_PAGES) return;
  seenPages.add(urlPath);
  const abs = new URL(urlPath, BASE).toString();
  let html;
  try {
    html = await fetchText(abs);
  } catch (e) {
    failed.push(`${abs} :: ${e.message}`);
    return;
  }
  const dest = localPathForPage(urlPath);
  await ensureDirFor(dest);
  await fs.writeFile(dest, html);

  for (const u of extractAssetUrls(html)) {
    if (u.startsWith("data:") || u.startsWith("mailto:") || u.startsWith("tel:")) continue;
    let p;
    if (u.startsWith("http")) {
      if (!u.startsWith(BASE)) continue;
      p = new URL(u).pathname;
    } else if (u.startsWith("/")) {
      p = u;
    } else continue;
    if (isAssetPath(p)) await downloadAsset(p);
  }

  for (const link of extractInternalLinks(html)) {
    const p = link.split("?")[0].split("#")[0];
    if (!p || p.startsWith("/_next") || p.startsWith("/cdn-cgi")) continue;
    if (isAssetPath(p)) { await downloadAsset(p); continue; }
    if (!seenPages.has(p) && seenPages.size < MAX_PAGES) pageQueue.push(p);
  }
}

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  while (pageQueue.length) {
    const p = pageQueue.shift();
    if (seenPages.has(p)) continue;
    process.stdout.write(`page: ${p}\n`);
    await crawlPage(p);
  }
  console.log(`\nDone. Pages: ${seenPages.size}, Assets: ${seenAssets.size}, Failed: ${failed.length}`);
  if (failed.length) {
    await fs.writeFile(path.join(OUT, "_mirror-failed.txt"), failed.join("\n"));
    console.log("See _mirror-failed.txt");
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
