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

## Series (connected stories)

To group stories that should be read in order, add `series` and `part`
to each story's `story.md`:

```markdown
---
title: Ace of Hollow Stars
series: The Hollow Wager
part: 1
...
---
```

Stories sharing the same `series` name are pulled out of the regular
grid and shown together in a full-width series card on the homepage,
ordered by `part` (displayed as roman numerals). Their story pages get
a "Part II of …" heading and previous/next-part navigation.

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

## Password protection

The whole site sits behind an "ante up" gate. Page content is
AES-encrypted at build time and decrypted in the browser, so view-source
shows only ciphertext. Friends enter the password once per browser tab
session.

The password lives in two places (never in git):

- **Locally:** the `.sitepassword` file (git-ignored) — used by `node build.js`
- **On GitHub:** the `SITE_PASSWORD` repository secret — used by the deploy workflow

To change the password, update both:

```
gh secret set SITE_PASSWORD --repo luniefae/ink-site --body "new-password"
```

…and put the same text in `.sitepassword`. The next push deploys with
the new password. Delete the secret and the file to make the site open.

Heads-up on what this does and doesn't hide: the *rendered site* is
locked, but this repo is public, so the markdown sources (story titles,
dates, word counts, Ellipsus links — never your prose) are visible to
anyone who finds the repo.

## Layout

```
site.json          site title / tagline / footer
build.js           the generator (zero dependencies)
serve.js           local preview server
assets/style.css   all the styling
stories/           your content (markdown)
dist/              generated site — never edit by hand
```
