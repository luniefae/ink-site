#!/usr/bin/env node
/**
 * build.js — zero-dependency static site generator for ink.faelian.net
 *
 * Reads:
 *   site.json                     site-wide settings
 *   stories/<slug>/story.md      story metadata + description
 *   stories/<slug>/*.md          one file per chapter (any name except story.md)
 *
 * Writes:
 *   dist/index.html
 *   dist/stories/<slug>/index.html
 *   dist/assets/*
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const STORIES_DIR = path.join(ROOT, "stories");
const ASSETS_DIR = path.join(ROOT, "assets");
const DIST = path.join(ROOT, "dist");

// ---------------------------------------------------------------- utilities

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseFrontmatter(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) return { data: {}, body: src.trim() };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    const key = line.slice(0, i).trim().toLowerCase();
    let val = line.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return { data, body: m[2].trim() };
}

// Tiny markdown: paragraphs, **bold**, *italic*, [links](url). Enough for blurbs.
function md(src) {
  if (!src) return "";
  return src
    .split(/\r?\n\s*\r?\n/)
    .map((p) => {
      let h = esc(p.trim());
      h = h.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
      h = h.replace(/\*([^*]+)\*/g, "<em>$1</em>");
      h = h.replace(
        /\[([^\]]+)\]\(([^)\s]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>'
      );
      return `<p>${h.replace(/\r?\n/g, "<br>")}</p>`;
    })
    .join("\n");
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parseDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], key: `${m[1]}${m[2]}${m[3]}` };
}

function fmtDate(dt) {
  if (!dt) return "undated";
  return `${MONTHS[dt.mo - 1]} ${dt.d}, ${dt.y}`;
}

function fmtNum(n) {
  return n.toLocaleString("en-US");
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function roman(n) {
  if (!n || n < 1) return "•";
  const table = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"],
    [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"],
    [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  for (const [v, sym] of table) while (n >= v) { out += sym; n -= v; }
  return out;
}

const SUITS = {
  hearts: { glyph: "♥", color: "magenta" },
  diamonds: { glyph: "♦", color: "magenta" },
  spades: { glyph: "♠", color: "teal" },
  clubs: { glyph: "♣", color: "teal" },
};
const SUIT_CYCLE = ["hearts", "spades", "diamonds", "clubs"];

const STATUS_LABELS = {
  ongoing: "Ongoing",
  complete: "Complete",
  hiatus: "On hiatus",
  oneshot: "One-shot",
};

// ------------------------------------------------------------------ loading

function loadStories() {
  if (!fs.existsSync(STORIES_DIR)) return [];
  const slugs = fs
    .readdirSync(STORIES_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  return slugs.map((slug, idx) => {
    const dir = path.join(STORIES_DIR, slug);
    const storyFile = path.join(dir, "story.md");
    let meta = { data: {}, body: "" };
    if (fs.existsSync(storyFile)) {
      meta = parseFrontmatter(fs.readFileSync(storyFile, "utf8"));
    } else {
      console.warn(`! ${slug}: missing story.md, using defaults`);
    }

    const chapterFiles = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".md") && f !== "story.md")
      .sort();

    const chapters = chapterFiles.map((file, i) => {
      const { data, body } = parseFrontmatter(
        fs.readFileSync(path.join(dir, file), "utf8")
      );
      const date = parseDate(data.date);
      if (!data.link) console.warn(`! ${slug}/${file}: no link set`);
      if (!date) console.warn(`! ${slug}/${file}: missing/invalid date (want YYYY-MM-DD)`);
      return {
        file,
        number: i + 1,
        title: data.title || file.replace(/\.md$/, ""),
        date,
        words: Math.max(0, parseInt(data.words, 10) || 0),
        link: data.link || "#",
        notes: body,
      };
    });

    const suitName = SUITS[meta.data.suit] ? meta.data.suit : SUIT_CYCLE[idx % SUIT_CYCLE.length];
    const latest = chapters.reduce(
      (a, c) => (c.date && (!a || c.date.key > a.date.key) ? c : a),
      null
    );

    return {
      slug,
      title: meta.data.title || slug,
      status: (meta.data.status || "ongoing").toLowerCase(),
      summary: meta.data.summary || "",
      description: meta.body,
      suit: { name: suitName, ...SUITS[suitName] },
      seriesName: meta.data.series || null,
      part: parseInt(meta.data.part, 10) || null,
      seriesGroup: null,
      chapters,
      words: chapters.reduce((s, c) => s + c.words, 0),
      latest,
    };
  });
}

// Stories sharing a `series:` name are grouped and ordered by `part:`.
function attachSeries(stories) {
  const map = new Map();
  for (const st of stories) {
    if (!st.seriesName) continue;
    if (!map.has(st.seriesName)) map.set(st.seriesName, []);
    map.get(st.seriesName).push(st);
  }
  for (const [name, parts] of map) {
    parts.sort((a, b) => (a.part || 0) - (b.part || 0));
    parts.forEach((p, i) => {
      if (!p.part) console.warn(`! ${p.slug}: in series "${name}" but missing part number`);
      p.seriesGroup = { name, anchor: "series-" + slugify(name), parts, index: i };
    });
  }
}

// ---------------------------------------------------------------- templates

function pageShell({ site, title, depth, body }) {
  const p = "../".repeat(depth); // path prefix back to dist root
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700;9..144,900&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${p}assets/style.css">
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="80" font-size="80">♥</text></svg>'
  )}">
</head>
<body>
<div class="table-edge" aria-hidden="true"></div>
<div class="page">
${body}
<footer class="site-footer">
  <div class="suit-row" aria-hidden="true"><span class="teal">♠</span><span class="magenta">♥</span><span class="teal">♣</span><span class="magenta">♦</span></div>
  <p>${esc(site.footer)}</p>
</footer>
</div>
</body>
</html>`;
}

function statusBadge(status) {
  const label = STATUS_LABELS[status] || status;
  return `<span class="badge badge--${esc(status)}">${esc(label)}</span>`;
}

function chapterRow(ch, { showStory } = {}) {
  const storyBit = showStory
    ? `<span class="row-story">${esc(showStory)}</span><span class="row-sep" aria-hidden="true">·</span>`
    : `<span class="row-num">${String(ch.number).padStart(2, "0")}</span>`;
  return `<a class="chapter-row" href="${esc(ch.link)}" target="_blank" rel="noopener">
  ${storyBit}
  <span class="row-title">${esc(ch.title)}</span>
  <span class="row-meta">
    ${ch.words ? `<span class="row-words">${fmtNum(ch.words)} words</span>` : ""}
    <span class="row-date">${esc(fmtDate(ch.date))}</span>
    <span class="row-out" aria-hidden="true">↗</span>
  </span>
</a>`;
}

function seriesCard(group) {
  const totalCh = group.parts.reduce((s, p) => s + p.chapters.length, 0);
  const totalW = group.parts.reduce((s, p) => s + p.words, 0);
  return `<div class="series-card" id="${esc(group.anchor)}">
      <p class="series-kicker"><span class="magenta" aria-hidden="true">♥</span> Series — read in order</p>
      <h3 class="series-title">${esc(group.name)}</h3>
      <p class="series-stats">${group.parts.length} stories<span class="dot" aria-hidden="true">·</span>${fmtNum(totalCh)} chapters<span class="dot" aria-hidden="true">·</span>${fmtNum(totalW)} words</p>
      <ol class="series-parts">
        ${group.parts
          .map(
            (p) => `<li><a class="series-part" href="stories/${esc(p.slug)}/">
          <span class="part-num ${p.suit.color}">${roman(p.part)}</span>
          <span class="part-title">${esc(p.title)}</span>
          <span class="part-meta">
            ${statusBadge(p.status)}
            <span>${fmtNum(p.chapters.length)} ch</span>
            <span class="dot" aria-hidden="true">·</span>
            <span>${fmtNum(p.words)} words</span>
          </span>
        </a></li>`
          )
          .join("\n")}
      </ol>
    </div>`;
}

function buildIndex(site, stories) {
  const totalChapters = stories.reduce((s, st) => s + st.chapters.length, 0);
  const totalWords = stories.reduce((s, st) => s + st.words, 0);

  const recent = stories
    .filter((st) => st.latest)
    .sort((a, b) => (b.latest.date.key > a.latest.date.key ? 1 : -1))
    .slice(0, 6);

  const byRecency = [...stories].sort((a, b) => {
    const ak = a.latest ? a.latest.date.key : "0";
    const bk = b.latest ? b.latest.date.key : "0";
    return bk > ak ? 1 : bk < ak ? -1 : 0;
  });

  const body = `
<header class="hero">
  <div class="suit-row hero-suits" aria-hidden="true"><span class="teal">♠</span><span class="magenta">♥</span><span class="teal">♣</span><span class="magenta">♦</span></div>
  <h1 class="hero-title">${esc(site.title)}</h1>
  <p class="hero-tagline">${esc(site.tagline)}</p>
</header>

<section class="stats" aria-label="Writing statistics">
  <div class="chip chip--magenta">
    <span class="chip-num">${fmtNum(stories.length)}</span>
    <span class="chip-label">${stories.length === 1 ? "story" : "stories"}</span>
  </div>
  <div class="chip chip--gold">
    <span class="chip-num">${fmtNum(totalChapters)}</span>
    <span class="chip-label">${totalChapters === 1 ? "chapter" : "chapters"}</span>
  </div>
  <div class="chip chip--turq">
    <span class="chip-num">${fmtNum(totalWords)}</span>
    <span class="chip-label">words</span>
  </div>
</section>

<section class="section" aria-labelledby="recent-h">
  <h2 class="section-title" id="recent-h"><span class="magenta" aria-hidden="true">♦</span> Recently updated</h2>
  <div class="card list-card">
    ${
      recent.length
        ? recent.map((st) => chapterRow(st.latest, { showStory: st.title })).join("\n")
        : '<p class="empty">Nothing on the table yet — deal a first chapter!</p>'
    }
  </div>
</section>

<section class="section" aria-labelledby="stories-h">
  <h2 class="section-title" id="stories-h"><span class="teal" aria-hidden="true">♠</span> Stories</h2>
  <div class="story-flow">
    ${(() => {
      // Series render as full-width blocks between grids of standalone
      // cards, preserving overall recency order.
      const seenSeries = new Set();
      const blocks = [];
      let gridBuf = [];
      const flush = () => {
        if (gridBuf.length) blocks.push(`<div class="story-grid">\n${gridBuf.join("\n")}\n</div>`);
        gridBuf = [];
      };
      for (const st of byRecency) {
        if (st.seriesGroup) {
          if (seenSeries.has(st.seriesGroup.name)) continue;
          seenSeries.add(st.seriesGroup.name);
          flush();
          blocks.push(seriesCard(st.seriesGroup));
          continue;
        }
        gridBuf.push(`<a class="story-card" href="stories/${esc(st.slug)}/">
      <span class="pip pip--tl ${st.suit.color}" aria-hidden="true">${st.suit.glyph}</span>
      <span class="pip pip--br ${st.suit.color}" aria-hidden="true">${st.suit.glyph}</span>
      <h3 class="story-card-title">${esc(st.title)}</h3>
      ${st.summary ? `<p class="story-card-summary">${esc(st.summary)}</p>` : ""}
      <p class="story-card-meta">
        ${statusBadge(st.status)}
        <span>${fmtNum(st.chapters.length)} ${st.chapters.length === 1 ? "chapter" : "chapters"}</span>
        <span class="dot" aria-hidden="true">·</span>
        <span>${fmtNum(st.words)} words</span>
      </p>
      ${st.latest ? `<p class="story-card-updated">updated ${esc(fmtDate(st.latest.date))}</p>` : ""}
    </a>`);
      }
      flush();
      return blocks.join("\n");
    })()}
  </div>
</section>`;

  return pageShell({ site, title: site.title, depth: 0, body });
}

function buildStoryPage(site, st) {
  const g = st.seriesGroup;
  const prev = g && g.index > 0 ? g.parts[g.index - 1] : null;
  const next = g && g.index < g.parts.length - 1 ? g.parts[g.index + 1] : null;

  const body = `
<nav class="crumbs"><a href="../../">← back to the table</a></nav>

<header class="story-header">
  <div class="story-suit ${st.suit.color}" aria-hidden="true">${st.suit.glyph}</div>
  ${g ? `<p class="series-line">Part ${roman(st.part)} of <a href="../../#${esc(g.anchor)}">${esc(g.name)}</a></p>` : ""}
  <h1 class="story-title">${esc(st.title)}</h1>
  <div class="token-row">
    ${statusBadge(st.status)}
    <span class="token token--gold"><span class="token-ico" aria-hidden="true">♣</span>${fmtNum(st.chapters.length)} ${st.chapters.length === 1 ? "chapter" : "chapters"}</span>
    <span class="token token--turq"><span class="token-ico" aria-hidden="true">⚄</span>${fmtNum(st.words)} words</span>
    ${st.latest ? `<span class="token token--magenta"><span class="token-ico" aria-hidden="true">♦</span>updated ${esc(fmtDate(st.latest.date))}</span>` : ""}
  </div>
  ${st.description ? `<div class="story-desc">${md(st.description)}</div>` : ""}
</header>

<section class="section" aria-labelledby="chapters-h">
  <h2 class="section-title" id="chapters-h"><span class="${st.suit.color}" aria-hidden="true">${st.suit.glyph}</span> Chapters</h2>
  <div class="card list-card">
    ${
      st.chapters.length
        ? st.chapters.map((ch) => chapterRow(ch)).join("\n")
        : '<p class="empty">No chapters yet.</p>'
    }
  </div>
  <p class="aside-note">Chapters open on Ellipsus in a new tab.</p>
  ${
    g
      ? `<nav class="part-nav" aria-label="Series navigation">
    ${prev ? `<a class="part-link prev" href="../${esc(prev.slug)}/"><span class="part-dir">← Part ${roman(prev.part)}</span>${esc(prev.title)}</a>` : '<span class="part-spacer"></span>'}
    ${next ? `<a class="part-link next" href="../${esc(next.slug)}/"><span class="part-dir">Part ${roman(next.part)} →</span>${esc(next.title)}</a>` : '<span class="part-spacer"></span>'}
  </nav>`
      : ""
  }
</section>`;

  return pageShell({
    site,
    title: `${st.title} — ${site.title}`,
    depth: 2,
    body,
  });
}

// ------------------------------------------------------- password gate

// Password comes from the SITE_PASSWORD env var (CI) or a git-ignored
// .sitepassword file (local). No password = site builds unprotected.
function getPassword() {
  if (process.env.SITE_PASSWORD) return process.env.SITE_PASSWORD.trim();
  const f = path.join(ROOT, ".sitepassword");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8").trim();
  return null;
}

const PBKDF2_ITERATIONS = 100000;

// AES-256-GCM encrypt a full page: the original <head> is kept (so fonts,
// styles and relative paths still work) and the <body> is replaced with the
// "ante up" gate. Web Crypto in the browser reverses it with the password.
function gateWrap(html, password, salt) {
  const crypto = require("crypto");
  const inner = /<body>([\s\S]*)<\/body>/.exec(html)[1];
  const head = /<head>([\s\S]*?)<\/head>/.exec(html)[1];
  const key = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 32, "sha256");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(inner, "utf8"), cipher.final(), cipher.getAuthTag()]);

  // The input is a masked text field with no surrounding <form>, so browser
  // password managers never offer to save or autofill it.
  return `<!DOCTYPE html>
<html lang="en">
<head>${head}<meta name="robots" content="noindex"></head>
<body class="gate-body">
<div class="table-edge" aria-hidden="true"></div>
<div class="gate">
  <div class="gate-card">
    <div class="suit-row" aria-hidden="true"><span class="teal">♠</span><span class="magenta">♥</span><span class="teal">♣</span><span class="magenta">♦</span></div>
    <h1 class="gate-title">Private table</h1>
    <p class="gate-sub">Friends only — ante up to take a seat.</p>
    <div class="gate-row">
      <input id="ante" class="gate-input" type="text" name="table-code" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Table password" placeholder="the magic word">
      <button id="deal" class="gate-btn" type="button">Ante up</button>
    </div>
    <p id="gate-err" class="gate-err" hidden>The house says no. Try again?</p>
  </div>
</div>
<script>
(function () {
  var SALT = "${salt.toString("base64")}";
  var IV = "${iv.toString("base64")}";
  var DATA = "${ct.toString("base64")}";
  function b(s) { var x = atob(s), a = new Uint8Array(x.length); for (var i = 0; i < x.length; i++) a[i] = x.charCodeAt(i); return a; }
  function hex2buf(h) { var a = new Uint8Array(h.length / 2); for (var i = 0; i < a.length; i++) a[i] = parseInt(h.substr(i * 2, 2), 16); return a; }
  function buf2hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (x) { return x.toString(16).padStart(2, "0"); }).join(""); }
  async function open(key) {
    var pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b(IV) }, key, b(DATA));
    var raw = await crypto.subtle.exportKey("raw", key);
    sessionStorage.setItem("fae-table", buf2hex(raw));
    document.body.className = "";
    document.body.innerHTML = new TextDecoder().decode(pt);
  }
  async function tryPw() {
    var pw = document.getElementById("ante").value;
    if (!pw) return;
    try {
      var km = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
      var key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: b(SALT), iterations: ${PBKDF2_ITERATIONS}, hash: "SHA-256" },
        km, { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
      await open(key);
    } catch (e) {
      document.getElementById("gate-err").hidden = false;
      var card = document.querySelector(".gate-card");
      card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
    }
  }
  document.getElementById("deal").addEventListener("click", tryPw);
  document.getElementById("ante").addEventListener("keydown", function (e) { if (e.key === "Enter") tryPw(); });
  var saved = sessionStorage.getItem("fae-table");
  if (saved) {
    crypto.subtle.importKey("raw", hex2buf(saved), { name: "AES-GCM" }, true, ["decrypt"])
      .then(open)
      .catch(function () { sessionStorage.removeItem("fae-table"); });
  }
})();
</script>
</body>
</html>`;
}

// ------------------------------------------------------------------- build

function main() {
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, "site.json"), "utf8"));
  const stories = loadStories();
  attachSeries(stories);
  const password = getPassword();
  const salt = password ? require("crypto").randomBytes(16) : null;
  const writePage = (file, html) =>
    fs.writeFileSync(file, password ? gateWrap(html, password, salt) : html);

  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, "assets"), { recursive: true });

  for (const f of fs.readdirSync(ASSETS_DIR)) {
    fs.copyFileSync(path.join(ASSETS_DIR, f), path.join(DIST, "assets", f));
  }

  writePage(path.join(DIST, "index.html"), buildIndex(site, stories));

  // GitHub Pages keeps the custom domain via a CNAME file in the output
  if (site.domain) {
    fs.writeFileSync(path.join(DIST, "CNAME"), site.domain + "\n");
  }

  for (const st of stories) {
    const dir = path.join(DIST, "stories", st.slug);
    fs.mkdirSync(dir, { recursive: true });
    writePage(path.join(dir, "index.html"), buildStoryPage(site, st));
  }

  const totalCh = stories.reduce((s, st) => s + st.chapters.length, 0);
  const totalW = stories.reduce((s, st) => s + st.words, 0);
  console.log(
    `✓ built ${stories.length} stories, ${totalCh} chapters, ${fmtNum(totalW)} words → dist/` +
      (password ? " 🔒 password protection ON" : " (no password set — site is open)")
  );
}

main();
