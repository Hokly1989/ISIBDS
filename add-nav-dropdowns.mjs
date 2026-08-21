// The "Products & Solutions" and "Industry Specific" nav buttons had no
// dropdown menu at all in the SSR HTML -- the submenu only ever existed as
// client-rendered React output, which never made it into this static mirror.
// This injects real static dropdown panels + a small vanilla-JS
// hover/click/outside-click handler, so the menus actually work with no
// framework involved.
import fs from "node:fs/promises";
import path from "node:path";

const DOCS = path.resolve("./docs");

const EN = {
  base: "/ISIBDS",
  products: {
    label: "Products &amp; Solutions",
    items: [
      ["Overview", "/products-solutions"],
      ["Building Systems", "/products-solutions/building-systems"],
      ["ISI PEB", "/products-solutions/isi-peb"],
      ["Multi-Story Building Systems", "/products-solutions/isi-peb/multi-story-building-systems"],
      ["Pre-Engineered Building Systems", "/products-solutions/isi-peb/pre-engineered-buildings"],
    ],
  },
  industry: {
    label: "Industry Specific",
    items: [
      ["Overview", "/services/industry-specific"],
      ["Agriculture", "/services/industry-specific/agriculture"],
      ["Food &amp; Beverage", "/services/industry-specific/food-beverage"],
      ["Logistics", "/services/industry-specific/logistics"],
      ["Manufacturing", "/services/industry-specific/manufacturing"],
      ["Residential", "/services/industry-specific/residential"],
    ],
  },
};

const ZH = {
  base: "/ISIBDS/zh",
  products: {
    label: "产品与解决方案",
    items: [
      ["概览", "/products-solutions"],
      ["建筑系统概览", "/products-solutions/building-systems"],
      ["ISI预制建筑", "/products-solutions/isi-peb"],
      ["ISI多层建筑系统", "/products-solutions/isi-peb/multi-story-building-systems"],
      ["ISI预制建筑系统", "/products-solutions/isi-peb/pre-engineered-buildings"],
    ],
  },
  industry: {
    label: "行业解决方案",
    items: [
      ["概览", "/services/industry-specific"],
      ["农业解决方案", "/services/industry-specific/agriculture"],
      ["食品与饮料解决方案", "/services/industry-specific/food-beverage"],
      ["物流解决方案", "/services/industry-specific/logistics"],
      ["制造业解决方案", "/services/industry-specific/manufacturing"],
      ["住宅解决方案", "/services/industry-specific/residential"],
    ],
  },
};

function panelHtml(base, items) {
  const links = items
    .map(([label, href]) => `<a href="${base}${href}">${label}</a>`)
    .join("");
  return `<div class="isi-dropdown-panel">${links}</div>`;
}

function injectFor(html, label, base, items) {
  const re = new RegExp(
    `<div class="relative"><button class="([^"]*)">${label}(<svg[\\s\\S]*?<\\/svg>)<\\/button><\\/div>`
  );
  return html.replace(
    re,
    (_m, cls, svg) =>
      `<div class="relative isi-dropdown"><button class="${cls}">${label}${svg}</button>${panelHtml(base, items)}</div>`
  );
}

const STYLE = `<style>
.isi-dropdown-panel{position:absolute;top:100%;left:0;margin-top:8px;background:#fff;border-radius:8px;box-shadow:0 12px 32px rgba(0,0,0,.18);padding:8px;min-width:260px;z-index:60;opacity:0;visibility:hidden;transform:translateY(-6px);transition:opacity .15s ease,transform .15s ease,visibility .15s}
.isi-dropdown.open .isi-dropdown-panel{opacity:1;visibility:visible;transform:translateY(0)}
.isi-dropdown-panel a{display:block;padding:10px 14px;border-radius:6px;font-size:13px;font-weight:600;color:#1b2d4f;text-decoration:none;white-space:nowrap}
.isi-dropdown-panel a:hover{background:#f3f4f6;color:#d4622b}
</style>`;

const SCRIPT = `<script>
(function(){
  document.querySelectorAll('.isi-dropdown').forEach(function(container){
    var closeTimer;
    var btn = container.querySelector(':scope > button');
    function openMenu(){
      clearTimeout(closeTimer);
      document.querySelectorAll('.isi-dropdown.open').forEach(function(el){ if (el !== container) el.classList.remove('open'); });
      container.classList.add('open');
    }
    function scheduleClose(){
      closeTimer = setTimeout(function(){ container.classList.remove('open'); }, 150);
    }
    container.addEventListener('mouseenter', openMenu);
    container.addEventListener('mouseleave', scheduleClose);
    if (btn) {
      btn.addEventListener('click', function(e){
        e.stopPropagation();
        if (container.classList.contains('open')) container.classList.remove('open');
        else openMenu();
      });
    }
  });
  document.addEventListener('click', function(){
    document.querySelectorAll('.isi-dropdown.open').forEach(function(el){ el.classList.remove('open'); });
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') document.querySelectorAll('.isi-dropdown.open').forEach(function(el){ el.classList.remove('open'); });
  });
})();
</script>`;

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
  let changed = 0;
  for (const f of files) {
    const isZh = path.relative(DOCS, f).split(path.sep)[0] === "zh";
    const dict = isZh ? ZH : EN;
    let html = await fs.readFile(f, "utf8");
    const before = html;

    html = injectFor(html, dict.products.label, dict.base, dict.products.items);
    html = injectFor(html, dict.industry.label, dict.base, dict.industry.items);

    if (html.includes("isi-dropdown-panel") && !html.includes("</head>".replace("</head>", ""))) {
      // no-op guard, real insertion happens below
    }
    if (html !== before) {
      html = html.replace("</head>", `${STYLE}</head>`);
      html = html.replace("</body>", `${SCRIPT}</body>`);
      await fs.writeFile(f, html);
      changed++;
    }
  }
  console.log(`Injected dropdown menus into ${changed} / ${files.length} files`);
}

main().catch((e) => { console.error(e); process.exit(1); });
