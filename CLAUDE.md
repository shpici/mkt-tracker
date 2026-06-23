# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MKT Sales Pro — KPI tracker / POS system for Macedonian Telekom store in Kičevo. Deployed as a PWA on GitHub Pages. UI language is Macedonian (MK).

## Deployment

**No build step.** Edit files, commit, push to `main` — GitHub Pages serves them directly.

```bash
git add <files>
git commit -m "description"
git push origin main
```

After pushing, bump the service worker cache version in `sw.js` (`CACHE = 'mkt-kicevo-vN'`) to force clients to pick up the new files.

## Architecture

### Single-file SPA (`index.html` — ~8 000 lines)

Everything lives in one file: all HTML, CSS, and JavaScript inside a single `<script type="module">`. There is no framework, no bundler, no npm. All logic is global functions and `let`/`const` globals.

**Key global state:**
| Variable | Purpose |
|----------|---------|
| `AS` | All daily sales data `{year: {month: {dateKey: {memberId: {kpi: value}}}}}` |
| `TS` | Monthly targets (local overrides) |
| `CS` | Config store (misc settings) |
| `VAC` | Vacation ranges `{memberId: {from:'YYYY-MM-DD', to:'YYYY-MM-DD'}}` |
| `OFI_PRODUCTS` / `OFI_PRODUCTS2` | Warehouse inventory (accessories / phones) |
| `ORDERS` | Phone orders array |
| `GAME_SCORES` | Snake/Tetris high scores |
| `cY`, `cM` | Currently viewed year/month |
| `mID` | Logged-in member ID (null if manager) |
| `isMgr` | Boolean — manager vs employee view |

**KPI system:**
```js
const KKEYS = ['fmc','post','bb','iptv','loy','prep','cc','equip','loybus','ict','fmcbus','postbus','bbbus'];
const KLBLS = ['FMC Cons.','Postpaid','BB Cons.',...]; // display labels, same order
const SCORE_EXCLUDED = new Set([...]);   // KPIs excluded from perfScore()
```

Targets live in `DTGT` (hardcoded per year/month) and can be overridden via Firebase `config/targets`.

**Members:**
```js
const MEMBERS = [
  {id:'IN', name:'Ивона Начева',        ini:'ИН', bg:'#fce7f3', tc:'#9d174d'},
  {id:'KM', name:'Катерина Митревска',  ini:'КМ', bg:'#dcfce7', tc:'#14532d'},
  {id:'HS', name:'Хане Садику',         ini:'ХС', bg:'#fee2e2', tc:'#7f1d1d'},
  {id:'FM', name:'Флутриме Муслиу',     ini:'ФМ', bg:'#fef3c7', tc:'#78350f'},
  {id:'MS', name:'Мелихан Сулковска',   ini:'МС', bg:'#ede9fe', tc:'#5b21b6'},
];
```

### Firebase (`mkt-kicevo-tracker` project)

Firestore collections:
- `days/{YYYY-MM-DD}` — daily KPI entries per member
- `config/{key}` — all config: `targets`, `vacations`, `ofi_products`, `ofi_products2`, `game_scores`, `boost_config`, `orders` (sub-collection), etc.
- `orders/` — phone order documents
- `messages/` — info board messages

All day documents are subscribed via `onSnapshot` for the current month (`subToDay()`). On data change, the active panel auto-rerenders.

**Save pattern:**
```js
await svDay(y, m, dk);          // save one day's data
await svCfg('key', data);       // save a config document
```

**Load pattern:**
```js
await ldAllCfg();               // loads all config docs on login
```

### Service Worker (`sw.js`)

- HTML files are always fetched from network (never cached).
- Everything else: network-first, cache fallback.
- Push notifications supported.
- **Always bump `CACHE` version** when deploying changes to JS/CSS assets.

### Auth flow

Firebase Email/Password auth. Manager email: `ilir.murati@telekom.mk`. All other emails map to an employee via `MEMBERS`. `isMgr` and `mID` are set after `onAuthStateChanged` resolves.

### Tab / panel routing

```js
function gotoTab(name, el) { ... }   // switches active panel, calls render fn
```
Each tab has a `#tp-<name>` div. The active one gets class `act`. Render functions are called lazily on tab switch.

**Manager tabs:** `info`, `tarif`, `tvint`, `roaming`, `realizacija`, `inventory`, `inventory2`, `orders`, `boost`, `schedule`, `executive`, `fullreport`, `compare`, `calc`

**Employee tabs:** `daily`, `weekly`, `monthly`, `yearly`, `targets`, `pro`, `games`, `schedule`

### Key computed functions

| Function | Purpose |
|----------|---------|
| `perfScore(mid, y, m)` | Employee monthly % score — uses `getMT()`, targets never adjusted for vacation |
| `mMoSum(mid, k, y, m)` | Sum a KPI for a member across a month |
| `mWDs(mid, y, m)` | Count worked days, skipping vacation days and future dates |
| `isVacDay(mid, dk)` | Returns true if `dk` (`YYYY-MM-DD`) is within that member's vacation range |
| `getWDs(y, m)` | All working days (Mon–Sat) in a month |
| `getMT(y, m)` | Returns per-KPI targets for that month |
| `pct(v, t)` | `Math.round(v/t*100)` — avoids division-by-zero |

### Vacation system

Stored in `VAC[memberId] = {from:'YYYY-MM-DD', to:'YYYY-MM-DD'}`. Persisted in `config/vacations` on Firebase and mirrored to `localStorage('mkt_vac')` for `raspored.html`. **Targets are never reduced during vacation.**

### Executive dashboard (`rndExecutive`)

- **Command KPI cards** rotate through all score-eligible KPIs (4 at a time, every 60s). State: `_cmdKOffset`, `_cmdInterval`, `_cmdTeamTotals`, `_cmdMt`.
- Color rules: `<70%` red, `70–99%` blue, `≥100%` green.
- Team ring + individual employee rings use SVG `stroke-dasharray` animation.
- `_execInsights()` generates bullet-point analysis text.

### AI Аналитичар (Groq)

API key stored in `localStorage('mkt_groq_key')`. Primary model: `llama-3.3-70b-versatile` with 3 fallbacks. Key stored per-user, entered via UI prompt.

### Auxiliary files

| File | Purpose |
|------|---------|
| `raspored.html` | Standalone employee schedule page — loads vacations from Firebase via its own module script, falls back to `localStorage('mkt_vac')` |
| `tarif.html` | Tariff advisor (static reference) |
| `roaming.html` | Roaming packages reference |
| `internet-tv.html` | Internet + TV packages reference |
| `magacin_uvoz.js` | **Console script** — paste into browser console while logged in as manager to bulk-import warehouse inventory into Firebase |

## Common Patterns

**Adding a new manager tab:**
1. Add `<div class="tab" onclick="gotoTab('name',this)">` in `#mgrTabs`
2. Add `<div id="tp-name" class="tp">` panel div
3. Add `else if(name==='name') renderFn();` in `gotoTab()`

**Date keys** always use `YYYY-MM-DD` format (zero-padded). Use `dK(y, m, {date})` helper.

**Score colors** (light theme): `pc(p)` returns CSS color. `barcl(p)` returns `background:` rule. Use `col()` local function inside `rndExecutive` for dark-theme colors.

**Saving day data:** Mutate `AS[y][m][dk][memberId][kpiKey]`, then call `svDay(y, m, dk)`.
