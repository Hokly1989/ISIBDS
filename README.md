# ISI Building Solutions — Editable Static Site

A plain, directly-editable static HTML/CSS copy of https://isibds.koompi.cloud/, captured 2026-08-21.

This started as a raw Next.js SSR mirror; it has since been converted into
plain static HTML so content and photos can be edited straight in the files
without touching a build system. Lives in `docs/` so it can be served
directly by GitHub Pages.

## Going live (GitHub Pages)

1. Push this repo to GitHub.
2. Repo **Settings → General → Danger Zone → Change visibility → Public** (Pages needs a public repo on the free plan).
3. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder: `/docs` → Save**.
4. After a minute, the site is live at `https://<your-username>.github.io/<repo-name>/`.

## Updating content once it's live

1. Edit files under `docs/` (see "How to edit" below).
2. `git add -A && git commit -m "..." && git push`
3. GitHub Pages rebuilds automatically within about a minute — no other steps needed.

## What's included

- All 19 page routes, in both locales (English + `/zh`) = 40 `index.html` files, with the real rendered text/markup you can edit directly.
- All CSS (`_next/static/css/...`) and fonts (`ABCGinto-*`), still wired up.
- **All 174 photos, downloaded locally** under `docs/assets/img/...` (mirrors the original folder names, e.g. `assets/img/isi-bds/PEB/Bonny Factory-5.jpg`) — replace a file in place (same name) to swap a photo, or edit an `<img src="...">` / `bg-[url('...')]` reference to point at a new file.
- `sitemap.xml` for reference.

## What was removed

- **All Next.js/React hydration JavaScript** (`_next/static/chunks/*.js`) — this is what let you edit HTML text safely: with the JS gone, there's no client-side re-render that would overwrite your edits with the original embedded data.
- Kept: the Cloudflare email de-obfuscation script (needed for `mailto:` links to display correctly) and `application/ld+json` structured-data blocks (plain JSON, safe to edit, good for SEO).

**Trade-off:** this means the site is now fully static — no scroll-triggered counter animations, no working mobile menu / language-switcher dropdown, no client-side page transitions. Every page still loads and looks right (each route has its own real HTML file), but anything that relied on React state won't respond to clicks. If you want some of that back, the mobile menu and language toggle could be reimplemented in a few lines of vanilla JS — just ask.

## How to edit

- **Text**: open any `docs/<page>/index.html` in an editor and change the text directly inside the relevant tag. (Tip: search for a distinctive phrase to find the right spot — the HTML is unminified-enough to read.)
- **Photos**: replace the file under `docs/assets/img/...` with a new image of the *same filename*, or update the `src="/assets/img/...jpg"` path in the HTML to point at a differently-named file you've added.
- Remember each page exists in two copies (English at `/…` and Chinese at `/zh/…`) — edit both if the change should apply to both languages.

## How to preview locally

```bash
node serve.mjs
```

Then open `http://localhost:4321/`.

## Known quirk (present on the live site too, not introduced by this copy)

The `/about` page's "Our Values & Beliefs" section shows raw translation keys (`about.values_01_title`, etc.) instead of real text — confirmed this is a bug in the *live* site's own server-rendered output (`curl https://isibds.koompi.cloud/about` shows the same thing), not something this conversion caused. Search for `about.values_01_title` in `docs/about/index.html` (and the `/zh` copy) to fix it directly, since the source Next.js app apparently isn't rendering that section's translations correctly either.

## Files

- `mirror.mjs` — original crawler that pulled the live Next.js SSR pages + same-origin assets.
- `staticify.mjs`, `staticify-fixup.mjs`, `staticify-fixup2.mjs` — the scripts that downloaded external CDN photos locally and stripped the hydration JS. Not needed again unless re-mirroring from scratch.
- `serve.mjs` — minimal static file server for local preview.
- `docs/` — the site itself. This is what GitHub Pages serves.
