// GitHub Pages project sites are served from https://<user>.github.io/<repo>/,
// not the domain root. This site's HTML/CSS use root-absolute paths
// ("/assets/...", "/_next/...") which resolve against the domain root and
// 404 under a subpath. Prefix every internal root-absolute reference with
// the repo's Pages base path.
import fs from "node:fs/promises";
import path from "node:path";

const BASE = "/ISIBDS"; // no trailing slash
const DOCS = path.resolve("./docs");

async function walk(dir, exts) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  let files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(await walk(full, exts));
    else if (exts.some((ext) => e.name.endsWith(ext))) files.push(full);
  }
  return files;
}

function fixHtml(html) {
  // src="/..." / href="/..." but not "//" (protocol-relative) and not the
  // Cloudflare email-obfuscation placeholder href (not a real path; the
  // decoder script substring-matches it and doesn't need the prefix).
  html = html.replace(
    /(src|href)="\/(?!\/|cdn-cgi\/l\/email-protection)/g,
    `$1="${BASE}/`
  );
  // Tailwind arbitrary-value bg-[url('/...')] where the quotes are HTML-entity apostrophes
  html = html.replace(/url\(&#x27;\/(?!\/)/g, `url(&#x27;${BASE}/`);
  return html;
}

function fixCss(css) {
  return css.replace(/url\(\/(?!\/)/g, `url(${BASE}/`);
}

async function main() {
  const htmlFiles = await walk(DOCS, [".html"]);
  for (const f of htmlFiles) {
    const html = await fs.readFile(f, "utf8");
    const fixed = fixHtml(html);
    if (fixed !== html) await fs.writeFile(f, fixed);
  }
  console.log(`Fixed ${htmlFiles.length} HTML files`);

  const cssFiles = await walk(DOCS, [".css"]);
  for (const f of cssFiles) {
    const css = await fs.readFile(f, "utf8");
    const fixed = fixCss(css);
    if (fixed !== css) await fs.writeFile(f, fixed);
  }
  console.log(`Fixed ${cssFiles.length} CSS files`);
}

main().catch((e) => { console.error(e); process.exit(1); });
