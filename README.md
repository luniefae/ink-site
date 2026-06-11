# ♥ ink.faelian.net

A bright little static site for tracking your stories. Chapters live as
markdown files; the site computes all the stats and links every chapter
out to Ellipsus.

## Quick start

```
node build.js     # generates the site into dist/
node serve.js     # preview at http://localhost:4173
```

(or `npm run dev` to do both)

Deploy by uploading the contents of `dist/` anywhere static —
Netlify, Cloudflare Pages, GitHub Pages, Neocities, etc.

## Adding a story

Make a folder under `stories/` (the folder name becomes the URL slug)
with a `story.md` inside:

```markdown
---
title: The House Always Wins
status: ongoing        # ongoing | complete | hiatus | oneshot
suit: hearts           # hearts | spades | diamonds | clubs (decorative)
summary: One-liner shown on the story card on the homepage.
---

Optional longer description shown on the story page.
Supports **bold**, *italics*, and [links](https://example.com).
```

## Adding a chapter

Drop a new `.md` file in the story's folder (any name except `story.md`).
Files are listed in filename order, so a `001-`, `002-`, … prefix keeps
chapters sorted:

```markdown
---
title: The Buy-In
date: 2026-03-14
words: 3120
link: https://ellipsus.com/your-chapter-link
---
```

- `date` — `YYYY-MM-DD`, drives the "Recently updated" section
- `words` — word count for that chapter (stats are summed from these)
- `link` — your Ellipsus URL; the chapter row links straight there

Then run `node build.js` again. That's it!

## Site settings

Edit `site.json` to change the site title, tagline, and footer text.

## Layout

```
site.json          site title / tagline / footer
build.js           the generator (zero dependencies)
serve.js           local preview server
assets/style.css   all the styling
stories/           your content (markdown)
dist/              generated site — never edit by hand
```
