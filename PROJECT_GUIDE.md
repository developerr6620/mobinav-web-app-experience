# Store Preview Demo: Complete Guide

An interactive marketing page for your app. A visitor enters their store URL and sees their own mobile site **Before** (left) and **After** (right) your app features, across three tabs: **Home, Collection, Product**.

> Status: all code below is written but **has not been run yet**. Follow "Run locally" first and fix anything that surfaces. Remaining unknowns are listed in "Known limits".

---

## 1. What we decided and why

| Question | Decision | Reason |
|---|---|---|
| Live iframe vs screenshots | **Screenshots** (headless Chromium) | Most stores block iframes (`X-Frame-Options` / CSP). A proxy needs a domain, link rewriting and is a security risk. Screenshots work for any platform. |
| Platforms | **Any ecommerce site** | Page discovery is generic (URL patterns, sitemap, manual override). |
| Features working or static? | **Static / visual only** | Bottom nav, sticky add-to-cart and story strip are for show. |
| Domain | **Not needed** | No proxy, so Render's free `onrender.com` address is enough. |
| Free Render sleeping | Uptime monitor pings `/health` every 5 min | Keeps the service awake. |

### Where each feature is drawn

| Feature | Drawn by | Why |
|---|---|---|
| Bottom navigation | Frontend (HTML/CSS inside the phone frame) | It floats over the page, so no screenshot change needed |
| Sticky add to cart | Frontend (Product tab only; replaces nav) | Same |
| Story-style collection + 1/2/3 grid switch | **Backend**: injected into the real page before the "After" screenshot | It sits *below the header* and pushes content down |

---

## 2. User flow (frontend)

1. Landing page: headline, URL box, "Preview my store" button, "Try the demo store" link.
2. User submits. URL is sent to the backend; a loading card shows 4 steps (Opening your store, Capturing collection page, Capturing product page, Applying app features).
3. Preview section scrolls into view: **Before** phone left, **After** phone right, tabs **Home | Collection | Product**.
4. Tab click switches both phones in sync. Scrolling one phone scrolls the other.
5. On narrow screens (phones) only one phone shows, with a Before/After toggle.
6. CTA buttons: "Try another store" and "Get the app".

### Always inside the viewport
The phone is built at a fixed design size (418 x 872 px) and scaled with CSS `transform: scale(s)`. JavaScript measures the free area (`#stage`) and picks `s = min(height fit, width fit, 1)`, on load, resize and rotation. The preview section is exactly `100svh` tall. So the full phone is always visible, on laptops, tablets and mobiles.

---

## 3. Backend flow

```
POST /api/preview { url, collectionUrl?, productUrl? }
  A. Validate and normalise URL, block private IPs (SSRF protection), rate limit
  B. Cache check (same store within 24h returns instantly)
  C. Create job, return { jobId } at once; job waits in a queue (1 browser at a time)
  D. Headless Chromium, 390x844 @2x, mobile user agent
  E. HOME        open, hide popups, scroll to load images, screenshot, read links/name/colour
  F. COLLECTION  find link (override, then link patterns, then sitemap), screenshot, read title + images
  G. PRODUCT     find link (override, then collection links, then home links, then sitemap), screenshot, read title + price
  H. APPLY       reopen collection, insert story strip under header, screenshot again
  I. Save images to data/<jobId>/, return result JSON

GET /api/preview/:id  -> { status, stepIndex, step, queuePosition, error, result }
GET /health           -> "ok"
GET /images/<id>/<file>.jpg   screenshots
GET /sample-store/            built-in demo store (type "demo" in the box)
```

### Finding the pages

| Page | Tries, in order |
|---|---|
| Collection | 1. URL pasted by user, 2. home links matching `/collections/x`, `/category/x`, `/product-category/x`, `/c/x`, then `/collections/all`, `/shop`, 3. `sitemap.xml` |
| Product | 1. URL pasted by user, 2. collection-page links matching `/products/x`, `/product/x`, `/p/x`, `/item/x`, 3. home links, 4. `sitemap.xml` |

If a page is not found the preview still opens; that tab shows "couldn't find this page" with a button to add the URL manually.

### Result JSON

```json
{
  "host": "mystore.com",
  "storeName": "My Store",
  "brandColor": "#5b3df5",
  "price": "$54.99",
  "productTitle": "12 Piece Cotton Towel Set - Blue",
  "collectionTitle": "Men's",
  "images": {
    "home": "/images/abc123/home.jpg",
    "collectionBefore": "/images/abc123/collection-before.jpg",
    "collectionAfter": "/images/abc123/collection-after.jpg",
    "product": "/images/abc123/product.jpg"
  },
  "urls": { "home": "...", "collection": "...", "product": "..." },
  "missing": []
}
```

---

## 4. Folder structure

```
store-preview-demo/
├── package.json
├── server.js
├── Dockerfile
├── render.yaml
├── .gitignore
├── PROJECT_GUIDE.md
├── scripts/
│   └── test-demo.js
├── src/
│   ├── config.js
│   ├── security.js
│   ├── jobs.js
│   └── screenshot/
│       ├── capture.js
│       ├── clean.js
│       ├── discover.js
│       ├── extract.js
│       └── storyStrip.js
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/app.js
└── sample-store/
    ├── style.css
    ├── index.html
    ├── collections/mens/index.html
    └── products/towel-set-blue/index.html
```

---

## 5. Run locally (VS Code / Antigravity)

```bash
cd store-preview-demo
npm install                      # also downloads Chromium (postinstall)
npx playwright install chromium  # only if the line above failed
npm start
```

Open http://localhost:3000, type **demo** in the box and press Preview. Then try a real store, for example `allbirds.com`.

Check the backend alone: `npm run test:demo` (server must be running).

---

## 6. Deploy on Render

1. Push the folder to GitHub.
2. Render, New, Web Service, pick the repo. It reads `render.yaml` and builds the `Dockerfile` (the Playwright base image already contains Chromium).
3. Set `NODE_ENV=production`.
4. Add an uptime monitor (UptimeRobot / Better Stack) on `https://<your-service>.onrender.com/health` every 5 minutes.

Notes:
- Chromium needs memory. A 512 MB free instance may crash on heavy stores. Use a paid instance (1 GB+) for launch.
- Free instances have a disk that is wiped on restart. Screenshots are cached 24h and re-created when missing, so this is fine.
- Pin the Playwright version in `package.json` to match the Docker image tag (see Dockerfile).

### Environment variables

| Name | Default | Meaning |
|---|---|---|
| `PORT` | 3000 | Server port |
| `NODE_ENV` | | `production` enables the rate limit |
| `DATA_DIR` | `./data` | Where screenshots are stored |
| `CONCURRENCY` | 1 | Browsers running at once |
| `MAX_SHOT_HEIGHT` | 2500 | Max screenshot height (CSS px) |
| `JOB_TIMEOUT_MS` | 75000 | Time limit per preview |
| `CACHE_TTL_HOURS` | 24 | How long previews are reused |
| `RATE_LIMIT_PER_HOUR` | 10 | Previews per visitor per hour |

---

## 7. Security and safety built in

- Only public `http(s)` URLs; localhost / private / link-local IPs blocked (also for every request the browser makes, and after redirects).
- Per-IP rate limit in production; 1 browser at a time with a queue; 75 s job timeout.
- Screenshots served with `X-Robots-Tag: noindex`; deleted after 24 h.
- No cookies or checkout flows: the visitor only receives images.
- Add a visible note: "Preview only, not affiliated with the store shown." (already in the page footer).

## 8. Known limits (honest list)

- **Static images**: the visitor cannot click inside the phones. Scrolling works. Header scrolls away with the page (it is part of the image).
- **Bot protection**: stores behind Cloudflare / Akamai challenges may block the headless browser. The user sees a clear error. Fallback idea: let them upload their own screenshots.
- **Story strip position**: placed after `<header>`. Very custom themes may place it slightly off.
- **Price / brand colour** are read from JSON-LD, meta tags or visible text; fallbacks are a placeholder price and a purple brand colour.
- Long pages are cut at 2500 px.
- Not tested yet against real stores: please test 20 to 30 across platforms (Shopify, WooCommerce, BigCommerce, Wix, custom).

---

# 9. Full source code

## package.json

```json
{
  "name": "store-preview-demo",
  "version": "1.0.0",
  "description": "Interactive before/after mobile preview for any ecommerce store (screenshot based)",
  "main": "server.js",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "postinstall": "playwright install chromium || echo 'Run: npx playwright install chromium'",
    "test:demo": "node scripts/test-demo.js"
  },
  "engines": { "node": ">=18" },
  "dependencies": {
    "express": "^4.21.0",
    "express-rate-limit": "^7.4.0",
    "playwright": "^1.48.0"
  }
}
```

## server.js

```js
'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');

const config = require('./src/config');
const { normalizeUrl, assertPublicUrl } = require('./src/security');
const jobs = require('./src/jobs');
const { closeBrowser } = require('./src/screenshot/capture');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '10kb' }));

fs.mkdirSync(config.DATA_DIR, { recursive: true });

app.get('/health', (req, res) => res.type('text').send('ok'));
app.use('/sample-store', express.static(path.join(__dirname, 'sample-store')));
app.use('/images', express.static(config.DATA_DIR, {
  index: false,
  maxAge: '1h',
  setHeaders: (res) => res.setHeader('X-Robots-Tag', 'noindex'),
}));
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: config.RATE_LIMIT_PER_HOUR,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !config.IS_PROD,
  message: { error: 'Too many previews from your connection. Please try again in a little while.' },
});

async function optionalUrl(value) {
  if (!value || !String(value).trim()) return '';
  const url = normalizeUrl(value);
  await assertPublicUrl(url);
  return url;
}

app.post('/api/preview', limiter, async (req, res) => {
  try {
    const body = req.body || {};
    const raw = String(body.url || '').trim();
    let input;

    if (raw.toLowerCase() === 'demo') {
      input = {
        demo: true,
        key: 'demo',
        homeUrl: `http://127.0.0.1:${config.PORT}/sample-store/`,
        collectionUrl: '',
        productUrl: '',
      };
    } else {
      const homeUrl = normalizeUrl(raw);
      await assertPublicUrl(homeUrl);
      input = {
        demo: false,
        homeUrl,
        collectionUrl: await optionalUrl(body.collectionUrl),
        productUrl: await optionalUrl(body.productUrl),
      };
    }

    const { job, cached } = await jobs.submit(input);
    res.status(202).json({ jobId: job.id, cached });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Something went wrong.' });
  }
});

app.get('/api/preview/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Preview not found. Please start again.' });
  res.set('Cache-Control', 'no-store');
  res.json(jobs.view(job));
});

const server = app.listen(config.PORT, () => {
  console.log(`\n  Store preview running at http://localhost:${config.PORT}`);
  console.log('  Tip: type "demo" in the URL box to test with the built-in sample store.\n');
});

setInterval(() => jobs.cleanup(), 30 * 60 * 1000).unref();

async function shutdown() {
  server.close();
  await closeBrowser().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## src/config.js

```js
'use strict';
const path = require('path');

const num = (value, fallback) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

module.exports = {
  PORT: num(process.env.PORT, 3000),
  IS_PROD: process.env.NODE_ENV === 'production',
  DATA_DIR: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),

  VIEWPORT_W: 390,
  VIEWPORT_H: 844,
  DEVICE_SCALE: 2,

  MAX_SHOT_HEIGHT: num(process.env.MAX_SHOT_HEIGHT, 2500),
  CONCURRENCY: num(process.env.CONCURRENCY, 1),
  JOB_TIMEOUT_MS: num(process.env.JOB_TIMEOUT_MS, 75000),
  CACHE_TTL_MS: num(process.env.CACHE_TTL_HOURS, 24) * 60 * 60 * 1000,
  RATE_LIMIT_PER_HOUR: num(process.env.RATE_LIMIT_PER_HOUR, 10),

  USER_AGENT:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
};
```

## src/security.js

```js
'use strict';
const dns = require('dns').promises;
const net = require('net');

function httpError(message, status = 400, code = 'BAD_URL') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s) throw httpError('Please enter your store URL.');
  if (s.length > 2000) throw httpError('That URL is too long.');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s;

  let u;
  try { u = new URL(s); } catch { throw httpError('That does not look like a valid URL.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw httpError('Only http and https URLs are supported.');
  if (u.username || u.password) throw httpError('URLs with a username or password are not allowed.');
  if (!u.hostname.includes('.') && !net.isIP(u.hostname)) {
    throw httpError('Please enter a full domain, for example mystore.com');
  }
  u.hash = '';
  return u.toString();
}

function isPrivateIPv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  const [a, b] = p;
  return (
    a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) return isPrivateIPv4(ip);
  const v6 = ip.toLowerCase();
  if (v6 === '::' || v6 === '::1') return true;
  if (v6.startsWith('::ffff:')) return isPrivateIPv4(v6.slice(7));
  return v6.startsWith('fc') || v6.startsWith('fd') || v6.startsWith('fe8') || v6.startsWith('fe9') ||
    v6.startsWith('fea') || v6.startsWith('feb') || v6.startsWith('ff');
}

const hostCache = new Map();

async function assertPublicUrl(url, { allowLocal = false } = {}) {
  let u;
  try { u = new URL(url); } catch { throw httpError('Invalid URL.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw httpError('Only http and https URLs are supported.');
  if (allowLocal) return;

  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (hostCache.get(host) > Date.now()) return;

  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw httpError('That address is not allowed.', 400, 'PRIVATE');
  } else {
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal')) {
      throw httpError('That address is not allowed.', 400, 'PRIVATE');
    }
    let addrs;
    try { addrs = await dns.lookup(host, { all: true }); }
    catch { throw httpError(`We could not find "${host}". Please check the URL.`, 400, 'DNS'); }
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
      throw httpError('That address is not allowed.', 400, 'PRIVATE');
    }
  }
  hostCache.set(host, Date.now() + 5 * 60 * 1000);
}

module.exports = { normalizeUrl, assertPublicUrl, httpError };
```

## src/jobs.js

```js
'use strict';
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const config = require('./config');
const { capturePreview } = require('./screenshot/capture');

const jobs = new Map();
const cache = new Map();
const queue = [];
let running = 0;

function friendlyError(err) {
  const code = err && err.code;
  const msg = (err && err.message) || '';
  if (code === 'BLOCKED') {
    return { code, message: 'This store blocks automated browsers (bot protection), so we could not take screenshots. You can try again later or contact us for a custom preview.' };
  }
  if (code === 'TIMEOUT' || /timeout/i.test(msg)) {
    return { code: 'TIMEOUT', message: 'The store took too long to load. Please try again.' };
  }
  if (code === 'PRIVATE' || code === 'DNS') return { code, message: msg };
  if (code === 'NO_BROWSER') {
    return { code, message: 'The screenshot browser is not installed on the server. Run: npx playwright install chromium' };
  }
  return { code: 'FAILED', message: 'We could not open that store. Please check the URL and try again.' };
}

function view(job) {
  const queuePosition = job.status === 'queued' ? queue.indexOf(job) + 1 : 0;
  return {
    id: job.id,
    status: job.status,
    stepIndex: job.stepIndex,
    step: job.step,
    queuePosition,
    error: job.error || null,
    result: job.status === 'done' ? job.result : null,
  };
}

async function filesStillExist(job) {
  try { await fs.access(path.join(config.DATA_DIR, job.id, 'home.jpg')); return true; }
  catch { return false; }
}

async function submit(input) {
  const key = input.key || [new URL(input.homeUrl).host, input.collectionUrl, input.productUrl].join('|');
  const cachedId = cache.get(key);
  const cached = cachedId && jobs.get(cachedId);
  if (cached && ['queued', 'running'].includes(cached.status)) return { job: cached, cached: true };
  if (cached && cached.status === 'done' && Date.now() - cached.finishedAt < config.CACHE_TTL_MS && (await filesStillExist(cached))) {
    return { job: cached, cached: true };
  }

  const job = {
    id: crypto.randomBytes(6).toString('hex'),
    key, input,
    demo: !!input.demo,
    status: 'queued',
    stepIndex: -1,
    step: 'Waiting in line',
    createdAt: Date.now(),
    finishedAt: 0,
    result: null,
    error: null,
    ctx: null,
  };
  jobs.set(job.id, job);
  cache.set(key, job.id);
  queue.push(job);
  pump();
  return { job, cached: false };
}

function get(id) { return jobs.get(id) || null; }

function pump() {
  while (running < config.CONCURRENCY && queue.length) {
    const job = queue.shift();
    running += 1;
    run(job).finally(() => { running -= 1; pump(); });
  }
}

async function run(job) {
  job.status = 'running';
  const setStep = (index, text) => { job.stepIndex = index; job.step = text; };
  setStep(0, 'Opening your store');

  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('Job timed out');
      err.code = 'TIMEOUT';
      reject(err);
    }, config.JOB_TIMEOUT_MS);
  });

  try {
    job.result = await Promise.race([capturePreview(job, setStep), timeout]);
    job.status = 'done';
    job.stepIndex = 4;
    job.step = 'Done';
  } catch (err) {
    console.error(`[job ${job.id}] failed:`, err.code || '', err.message);
    job.status = 'error';
    job.error = friendlyError(err);
    cache.delete(job.key);
    if (job.ctx) job.ctx.close().catch(() => {});
  } finally {
    clearTimeout(timer);
    job.finishedAt = Date.now();
  }
}

async function cleanup() {
  const cutoff = Date.now() - config.CACHE_TTL_MS;
  for (const [id, job] of jobs) {
    if (job.finishedAt && job.finishedAt < cutoff) {
      jobs.delete(id);
      if (cache.get(job.key) === id) cache.delete(job.key);
    }
  }
  try {
    const entries = await fs.readdir(config.DATA_DIR, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const dir = path.join(config.DATA_DIR, e.name);
      const stat = await fs.stat(dir);
      if (stat.mtimeMs < cutoff) await fs.rm(dir, { recursive: true, force: true });
    }
  } catch { /* data dir may not exist yet */ }
}

module.exports = { submit, get, view, cleanup };
```

## src/screenshot/capture.js

```js
'use strict';
const fs = require('fs/promises');
const path = require('path');
const { chromium } = require('playwright');

const config = require('../config');
const { assertPublicUrl } = require('../security');
const { cleanPage } = require('./clean');
const { pickLink, collectionLinks, fromSitemap } = require('./discover');
const { extractHome, extractCollection, extractProduct, formatPrice, usableBrandColor } = require('./extract');
const { injectStoryStrip } = require('./storyStrip');

const W = config.VIEWPORT_W;
const H = config.VIEWPORT_H;
const LOCAL_HOST = `127.0.0.1:${config.PORT}`;

let browserPromise = null;

async function getBrowser() {
  if (browserPromise) {
    try { const b = await browserPromise; if (b.isConnected()) return b; } catch { /* relaunch */ }
    browserPromise = null;
  }
  browserPromise = chromium
    .launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    .catch((err) => {
      browserPromise = null;
      if (/Executable doesn't exist|browserType\.launch/i.test(err.message)) {
        const e = new Error('Chromium is not installed');
        e.code = 'NO_BROWSER';
        throw e;
      }
      throw err;
    });
  return browserPromise;
}

async function closeBrowser() {
  if (!browserPromise) return;
  const b = await browserPromise.catch(() => null);
  browserPromise = null;
  if (b) await b.close();
}

const BOT_TITLE = /just a moment|attention required|access denied|are you a robot|captcha|verify you are human|403 forbidden|blocked/i;

async function open(page, url) {
  let response;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
  } catch (err) {
    const e = new Error(err.message);
    e.code = /timeout/i.test(err.message) ? 'TIMEOUT' : 'NAV';
    throw e;
  }
  await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});
  const status = response ? response.status() : 200;
  const title = await page.title().catch(() => '');
  if (status === 403 || status === 429 || status === 503 || BOT_TITLE.test(title)) {
    const e = new Error(`Blocked (${status}) ${title}`);
    e.code = 'BLOCKED';
    throw e;
  }
  if (status >= 400) {
    const e = new Error(`HTTP ${status}`);
    e.code = 'NAV';
    throw e;
  }
  await cleanPage(page);
  await page.waitForTimeout(400);
}

async function autoScroll(page) {
  await page.evaluate(async (maxH) => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => (i.loading = 'eager'));
    await new Promise((resolve) => {
      let y = 0;
      const timer = setInterval(() => {
        window.scrollTo(0, y);
        y += 500;
        const limit = Math.min(document.documentElement.scrollHeight, maxH + 800);
        if (y >= limit) {
          clearInterval(timer);
          window.scrollTo(0, 0);
          setTimeout(resolve, 300);
        }
      }, 140);
    });
    await Promise.all(
      [...document.images].filter((i) => !i.complete).slice(0, 40)
        .map((i) => new Promise((r) => { i.onload = i.onerror = r; setTimeout(r, 2500); }))
    );
  }, config.MAX_SHOT_HEIGHT).catch(() => {});
}

async function shot(page, file) {
  await autoScroll(page);
  await cleanPage(page);
  const full = await page
    .evaluate(() => Math.ceil(Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)))
    .catch(() => H);
  const height = Math.max(H, Math.min(full, config.MAX_SHOT_HEIGHT));
  await page.screenshot({
    path: file, type: 'jpeg', quality: 85, fullPage: true,
    clip: { x: 0, y: 0, width: W, height },
    animations: 'disabled', timeout: 20000,
  });
  return height;
}

const FALLBACK_LABELS = ['New', 'Women', 'Men', 'Sale', 'Best sellers', 'Gifts'];

async function capturePreview(job, setStep) {
  const dir = path.join(config.DATA_DIR, job.id);
  await fs.mkdir(dir, { recursive: true });
  const file = (name) => path.join(dir, name);
  const urlOf = (name) => `/images/${job.id}/${name}`;

  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: config.DEVICE_SCALE,
    isMobile: true,
    hasTouch: true,
    userAgent: config.USER_AGENT,
    locale: 'en-US',
    serviceWorkers: 'block',
  });
  job.ctx = context;

  await context.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    if (!/^https?:/i.test(url)) return route.continue();
    if (req.resourceType() === 'media') return route.abort();
    try {
      const allowLocal = job.demo && new URL(url).host === LOCAL_HOST;
      await assertPublicUrl(url, { allowLocal });
    } catch {
      return route.abort('blockedbyclient');
    }
    return route.continue();
  });

  const page = await context.newPage();
  const missing = [];
  const images = { home: null, collectionBefore: null, collectionAfter: null, product: null };
  const urls = { home: job.input.homeUrl, collection: null, product: null };

  try {
    // 1) HOME
    setStep(0, 'Opening your store');
    await open(page, job.input.homeUrl);
    await shot(page, file('home.jpg'));
    images.home = urlOf('home.jpg');
    const homeUrl = page.url();
    urls.home = homeUrl;
    const origin = new URL(homeUrl).origin;
    const home = await extractHome(page);

    // 2) COLLECTION
    setStep(1, 'Capturing collection page');
    const collectionUrl =
      job.input.collectionUrl ||
      pickLink(home.links, 'collection', homeUrl, [homeUrl]) ||
      (await fromSitemap(context.request, origin, 'collection'));
    let collection = null;
    if (collectionUrl) {
      try {
        await open(page, collectionUrl);
        await shot(page, file('collection-before.jpg'));
        images.collectionBefore = urlOf('collection-before.jpg');
        urls.collection = collectionUrl;
        collection = await extractCollection(page);
      } catch (err) {
        if (err.code === 'TIMEOUT') throw err;
        console.warn(`[job ${job.id}] collection failed: ${err.message}`);
      }
    }
    if (!images.collectionBefore) missing.push('collection');

    // 3) PRODUCT
    setStep(2, 'Capturing product page');
    const productUrl =
      job.input.productUrl ||
      (collection && pickLink(collection.links, 'product', homeUrl)) ||
      pickLink(home.links, 'product', homeUrl) ||
      (await fromSitemap(context.request, origin, 'product'));
    let product = null;
    if (productUrl) {
      try {
        await open(page, productUrl);
        await shot(page, file('product.jpg'));
        images.product = urlOf('product.jpg');
        urls.product = productUrl;
        product = await extractProduct(page);
      } catch (err) {
        if (err.code === 'TIMEOUT') throw err;
        console.warn(`[job ${job.id}] product failed: ${err.message}`);
      }
    }
    if (!images.product) missing.push('product');

    // 4) APPLY APP FEATURES (story strip)
    setStep(3, 'Applying app features');
    const brandColor = usableBrandColor(home.themeColor);
    const brand = brandColor || '#5b3df5';
    if (images.collectionBefore) {
      const homeCols = collectionLinks(home.links, homeUrl);
      let items = homeCols.concat(collectionLinks(collection.links, homeUrl));
      const seen = new Set();
      items = items.filter((i) => !seen.has(i.label.toLowerCase()) && seen.add(i.label.toLowerCase())).slice(0, 8);
      for (const l of FALLBACK_LABELS) {
        if (items.length >= 5) break;
        if (!seen.has(l.toLowerCase())) items.push({ href: '', label: l, img: '' });
      }
      const pool = (collection.images || []).slice();
      items = items.map((it, i) => ({ label: it.label, img: it.img || pool[i] || '' }));
      const here = new URL(collectionUrl).pathname.replace(/\/$/, '');
      let activeIndex = homeCols.findIndex((c) => new URL(c.href).pathname.replace(/\/$/, '') === here);
      if (activeIndex < 0 || activeIndex >= items.length) activeIndex = 0;

      try {
        await open(page, collectionUrl);
        await injectStoryStrip(page, {
          items, activeIndex,
          title: collection.title || items[activeIndex].label,
          brand,
        });
        await shot(page, file('collection-after.jpg'));
        images.collectionAfter = urlOf('collection-after.jpg');
      } catch (err) {
        if (err.code === 'TIMEOUT') throw err;
        console.warn(`[job ${job.id}] story strip failed: ${err.message}`);
        images.collectionAfter = images.collectionBefore;
      }
    }

    return {
      host: new URL(homeUrl).host.replace(/^127\.0\.0\.1:\d+$/, 'demo-store.myshop.com'),
      storeName: (home.storeName || new URL(homeUrl).host).slice(0, 60),
      brandColor,
      price: product ? formatPrice(product.price, product.currency) : '',
      productTitle: product ? product.title : '',
      collectionTitle: collection ? collection.title : '',
      images, urls, missing,
    };
  } finally {
    await context.close().catch(() => {});
    job.ctx = null;
  }
}

module.exports = { capturePreview, closeBrowser };
```

## src/screenshot/clean.js

```js
'use strict';

async function cleanPage(page) {
  await page.evaluate(() => {
    const kw = /(cookie|consent|gdpr|onetrust|cc-window|popup|modal|newsletter|klaviyo|privy)/i;

    const accept = /^(accept( all)?( cookies)?|allow( all)?|i agree|agree|got it|ok(ay)?|close|no thanks|dismiss|×|x)$/i;
    document.querySelectorAll('button, a[role=button], [role=button], input[type=button]').forEach((b) => {
      const text = (b.innerText || b.value || b.getAttribute('aria-label') || '').trim();
      if (!accept.test(text)) return;
      const host = b.closest('[id],[class],[role=dialog],[aria-modal=true]');
      const ctx = host ? `${host.id || ''} ${typeof host.className === 'string' ? host.className : ''}` : '';
      if (kw.test(ctx) || b.closest('[role=dialog],[aria-modal=true]')) {
        try { b.click(); } catch (e) { /* ignore */ }
      }
    });

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    document.querySelectorAll('body *').forEach((el) => {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') return;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const idc = `${el.id || ''} ${typeof el.className === 'string' ? el.className : ''}`;
      const atBottom = r.bottom >= vh - 4 && r.top > vh * 0.45;
      const cover = r.width >= vw * 0.9 && r.height >= vh * 0.5;
      const bubble = cs.position === 'fixed' && r.width < vw * 0.5 && r.top > vh * 0.4 && r.left > vw * 0.4;
      const named = cs.position === 'fixed' && kw.test(idc);
      if (atBottom || cover || bubble || named) el.style.setProperty('display', 'none', 'important');
    });

    document.documentElement.style.setProperty('overflow', 'auto', 'important');
    if (document.body) document.body.style.setProperty('overflow', 'auto', 'important');
    document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
  }).catch(() => {});
}

module.exports = { cleanPage };
```

## src/screenshot/discover.js

```js
'use strict';

const COLLECTION_SLUG = /\/(collections|collection|category|categories|product-category|product-categories|cat|c)\/[^/?#]+/i;
const COLLECTION_INDEX = /\/(shop|store|catalog|products|all-products)\/?$/i;
const PRODUCT_RE = /\/(products?|p|item|items|dp)\/[^/?#]+/i;

const stripWww = (host) => host.replace(/^www\./i, '').toLowerCase();

function scoreOf(kind, pathname) {
  if (kind === 'collection') {
    if (/\/collections\/all\/?$/i.test(pathname)) return 2;
    if (COLLECTION_SLUG.test(pathname)) return 3;
    if (COLLECTION_INDEX.test(pathname)) return 1;
    return 0;
  }
  return PRODUCT_RE.test(pathname) ? 3 : 0;
}

function pickLink(links, kind, baseUrl, excludeUrls = []) {
  const base = new URL(baseUrl);
  const key = (u) => stripWww(u.host) + u.pathname.replace(/\/$/, '');
  const excluded = new Set(excludeUrls.map((x) => key(new URL(x))));
  let best = null;
  let bestScore = 0;
  for (const l of links) {
    let u;
    try { u = new URL(l.href); } catch { continue; }
    if (stripWww(u.host) !== stripWww(base.host)) continue;
    if (excluded.has(key(u))) continue;
    const s = scoreOf(kind, u.pathname);
    if (s > bestScore) {
      best = u.origin + u.pathname + u.search;
      bestScore = s;
      if (s === 3) break;
    }
  }
  return best;
}

function collectionLinks(links, baseUrl) {
  const base = new URL(baseUrl);
  const seen = new Set();
  const out = [];
  for (const l of links) {
    let u;
    try { u = new URL(l.href); } catch { continue; }
    if (stripWww(u.host) !== stripWww(base.host)) continue;
    if (scoreOf('collection', u.pathname) !== 3) continue;
    if (/\/products?\//i.test(u.pathname)) continue;
    const text = (l.text || '').replace(/\s+/g, ' ').trim();
    if (text.length < 2 || text.length > 24 || /^(all|shop all|view all|see all)$/i.test(text)) continue;
    const k = text.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ href: u.origin + u.pathname, label: text, img: l.img || '' });
  }
  return out;
}

async function fromSitemap(request, origin, kind) {
  const re = kind === 'collection' ? COLLECTION_SLUG : PRODUCT_RE;
  const get = async (url) => {
    try {
      const res = await request.get(url, { timeout: 8000 });
      return res.ok() ? await res.text() : '';
    } catch { return ''; }
  };
  const locs = (xml) => [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&'));

  let xml = await get(`${origin}/sitemap.xml`);
  if (!xml) return null;
  let urls = locs(xml);
  if (/<sitemapindex/i.test(xml)) {
    const child = urls.find((u) => u.toLowerCase().includes(kind));
    if (!child) return null;
    xml = await get(child);
    urls = locs(xml);
  }
  const base = new URL(origin);
  for (const u of urls) {
    try {
      const parsed = new URL(u);
      if (stripWww(parsed.host) === stripWww(base.host) && re.test(parsed.pathname)) return u;
    } catch { /* skip */ }
  }
  return null;
}

module.exports = { pickLink, collectionLinks, fromSitemap };
```

## src/screenshot/extract.js

```js
'use strict';

async function extractHome(page) {
  return page.evaluate(() => {
    const meta = (...names) => {
      for (const n of names) {
        const e = document.querySelector(`meta[name="${n}"],meta[property="${n}"]`);
        if (e && e.content) return e.content.trim();
      }
      return '';
    };
    const links = [...document.querySelectorAll('a[href]')]
      .map((a) => {
        const img = a.querySelector('img');
        return {
          href: a.href,
          text: (a.innerText || a.textContent || a.getAttribute('aria-label') || (img && img.alt) || '').replace(/\s+/g, ' ').trim(),
          img: img ? img.currentSrc || img.src || '' : '',
        };
      })
      .filter((l) => /^https?:/i.test(l.href));
    const title = (document.title || '').split(/\s[|\-–—]\s/)[0].trim();
    return {
      storeName: meta('og:site_name', 'application-name') || title,
      themeColor: meta('theme-color', 'msapplication-TileColor'),
      links: links.slice(0, 800),
    };
  });
}

async function extractCollection(page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const meta = document.querySelector('meta[property="og:title"]');
    const title = ((h1 && h1.innerText) || (meta && meta.content) || document.title || '')
      .replace(/\s+/g, ' ').trim().split(/\s[|\-–—]\s/)[0];
    const images = [];
    for (const img of document.images) {
      const r = img.getBoundingClientRect();
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith('data:') || img.naturalWidth < 150 || r.width < 90) continue;
      if (!images.includes(src)) images.push(src);
      if (images.length >= 12) break;
    }
    const links = [...document.querySelectorAll('a[href]')]
      .map((a) => {
        const img = a.querySelector('img');
        return {
          href: a.href,
          text: (a.innerText || a.textContent || '').replace(/\s+/g, ' ').trim(),
          img: img ? img.currentSrc || img.src || '' : '',
        };
      })
      .filter((l) => /^https?:/i.test(l.href));
    return { title, images, links: links.slice(0, 800) };
  });
}

async function extractProduct(page) {
  return page.evaluate(() => {
    const out = { title: '', price: '', currency: '' };
    const h1 = document.querySelector('h1');
    out.title = ((h1 && h1.innerText) || document.title || '').replace(/\s+/g, ' ').trim();

    const flatten = (node, acc) => {
      if (!node) return acc;
      if (Array.isArray(node)) node.forEach((n) => flatten(n, acc));
      else if (typeof node === 'object') {
        acc.push(node);
        if (node['@graph']) flatten(node['@graph'], acc);
      }
      return acc;
    };
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const nodes = flatten(JSON.parse(s.textContent), []);
        const product = nodes.find((n) => [].concat(n['@type'] || []).includes('Product'));
        if (!product) continue;
        if (product.name) out.title = String(product.name);
        let offers = product.offers;
        if (Array.isArray(offers)) offers = offers[0];
        if (offers) {
          const p = offers.price || offers.lowPrice || (offers.priceSpecification && offers.priceSpecification.price);
          if (p) { out.price = String(p); out.currency = offers.priceCurrency || ''; break; }
        }
      } catch (e) { /* ignore bad JSON */ }
    }
    if (!out.price) {
      const m = (n) => {
        const e = document.querySelector(`meta[property="${n}"],meta[name="${n}"]`);
        return e ? e.content : '';
      };
      out.price = m('product:price:amount') || m('og:price:amount') || '';
      out.currency = m('product:price:currency') || m('og:price:currency') || '';
    }
    if (!out.price) {
      const el = document.querySelector('[class*="price" i], [id*="price" i], [itemprop="price"]');
      const t = el ? (el.getAttribute('content') || el.innerText || '') : '';
      const match = t.match(/[\p{Sc}]\s?\d[\d.,]*|\d[\d.,]*\s?[\p{Sc}]/u);
      if (match) out.price = match[0].trim();
    }
    return out;
  });
}

function formatPrice(price, currency) {
  if (!price) return '';
  const num = Number(String(price).replace(/,/g, ''));
  if (Number.isFinite(num) && /^[A-Za-z]{3}$/.test(currency || '')) {
    try {
      return new Intl.NumberFormat('en', { style: 'currency', currency: currency.toUpperCase() }).format(num);
    } catch { /* fall through */ }
  }
  return String(price);
}

function usableBrandColor(value) {
  const m = /^#?([0-9a-f]{6})$/i.exec((value || '').trim());
  if (!m) return '';
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (lum > 0.88 || lum < 0.1 || max - min < 25) return '';
  return `#${m[1].toLowerCase()}`;
}

module.exports = { extractHome, extractCollection, extractProduct, formatPrice, usableBrandColor };
```

## src/screenshot/storyStrip.js

```js
'use strict';

async function injectStoryStrip(page, { items, activeIndex, title, brand }) {
  await page.evaluate(
    async ({ items, activeIndex, title, brand }) => {
      const h = (tag, css, text) => {
        const e = document.createElement(tag);
        if (css) e.style.cssText = css;
        if (text != null) e.textContent = text;
        return e;
      };
      const font = getComputedStyle(document.body).fontFamily;

      const wrap = h('div', `all:initial;display:block;box-sizing:border-box;width:100%;background:#fff;font-family:${font};border-bottom:1px solid #ececec;`);
      wrap.setAttribute('data-app-story-strip', '1');

      const row = h('div', 'display:flex;gap:14px;overflow:hidden;padding:14px 14px 8px;box-sizing:border-box;');
      items.forEach((it, i) => {
        const active = i === activeIndex;
        const cell = h('div', 'flex:0 0 66px;width:66px;text-align:center;');
        const ring = h('div', `width:58px;height:58px;margin:0 auto;border-radius:50%;box-sizing:border-box;padding:3px;border:2px solid ${active ? brand : '#dcdde4'};`);
        const inner = h('div',
          `width:100%;height:100%;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;background:${brand}22;color:${brand};font:700 18px ${font};` +
          (it.img ? `background-image:url("${it.img.replace(/"/g, '%22')}");background-size:cover;background-position:center;` : ''));
        if (!it.img) inner.textContent = it.label.trim().charAt(0).toUpperCase();
        ring.appendChild(inner);
        const label = h('div',
          `margin-top:6px;font:700 9.5px/1.2 ${font};color:${active ? '#111' : '#5b6275'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`,
          it.label);
        cell.append(ring, label);
        if (active) cell.appendChild(h('div', 'height:2px;background:#111;width:70%;margin:5px auto 0;border-radius:2px;'));
        row.appendChild(cell);
      });

      const bar = h('div', 'display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:1px solid #efefef;box-sizing:border-box;');
      bar.appendChild(h('div', `font:800 12px/1.2 ${font};letter-spacing:.08em;text-transform:uppercase;color:#222;`, title));
      const sw = h('div', 'display:flex;gap:2px;padding:3px;border-radius:8px;background:#eef0f6;');
      ['1', '2', '3'].forEach((n) => {
        const on = n === '2';
        sw.appendChild(h('span',
          `width:26px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font:600 12px ${font};` +
          (on ? 'background:#fff;color:#111;box-shadow:0 1px 2px rgba(0,0,0,.12);' : 'color:#6b7280;'), n));
      });
      bar.appendChild(sw);
      wrap.append(row, bar);

      const header = document.querySelector('header, [role="banner"], .header, #header, #shopify-section-header');
      if (header) {
        let el = header;
        while (el.parentElement && el.parentElement !== document.body && el.parentElement.getBoundingClientRect().height < 220) {
          el = el.parentElement;
        }
        el.after(wrap);
      } else {
        document.body.prepend(wrap);
      }

      await Promise.all(items.filter((i) => i.img).map((i) => new Promise((resolve) => {
        const im = new Image();
        im.onload = im.onerror = resolve;
        im.src = i.img;
        setTimeout(resolve, 3000);
      })));
      window.scrollTo(0, 0);
    },
    { items, activeIndex, title, brand }
  );
  await page.waitForTimeout(250);
}

module.exports = { injectStoryStrip };
```

## scripts/test-demo.js

```js
'use strict';
// Usage: start the server (npm start), then: npm run test:demo
const base = `http://localhost:${process.env.PORT || 3000}`;

(async () => {
  const start = await fetch(`${base}/api/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: process.argv[2] || 'demo' }),
  }).then((r) => r.json());
  console.log('Started job', start);

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const s = await fetch(`${base}/api/preview/${start.jobId}`).then((r) => r.json());
    console.log(s.status, s.step);
    if (s.status === 'done') { console.log(JSON.stringify(s.result, null, 2)); return; }
    if (s.status === 'error') { console.error(s.error); process.exit(1); }
  }
  console.error('Timed out');
  process.exit(1);
})();
```

## public/index.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>See your store as a mobile app</title>
  <meta name="robots" content="index,follow">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body id="top">

<header class="nav">
  <div class="wrap nav-in">
    <!-- Replace "YourApp" with your app name / logo -->
    <a class="brand" href="#top"><span class="dot"></span>YourApp</a>
    <a class="btn small primary" href="#cta">Get the app</a>
  </div>
</header>

<main>
  <section class="hero">
    <div class="wrap">
      <p class="eyebrow">Works with any ecommerce store</p>
      <h1>Make your mobile store feel like a <span class="grad">real app</span></h1>
      <p class="sub">Enter your store URL and see your own site before and after: bottom navigation, story-style collections and a sticky add to cart.</p>

      <form id="form" class="form" novalidate>
        <div class="field">
          <input id="url" type="text" inputmode="url" autocomplete="url" autocapitalize="off" spellcheck="false"
                 placeholder="yourstore.com" aria-label="Your store URL" required>
          <button id="go" class="btn primary" type="submit">Preview my store</button>
        </div>
        <p id="error" class="error" role="alert" hidden></p>
        <p class="hint">No store handy? <a href="#" id="demoLink">Try the demo store</a></p>

        <details id="adv" class="adv">
          <summary>Page not found? Add page URLs manually</summary>
          <div class="adv-grid">
            <input id="collUrl" type="text" placeholder="Collection page URL (optional)" autocapitalize="off" spellcheck="false">
            <input id="prodUrl" type="text" placeholder="Product page URL (optional)" autocapitalize="off" spellcheck="false">
          </div>
        </details>
      </form>
    </div>
  </section>

  <section class="features wrap" id="features">
    <article><h3>Bottom navigation</h3><p>Account, search, home, shop and cart always one thumb away.</p></article>
    <article><h3>Story collections</h3><p>Round, swipeable collection shortcuts right under the header.</p></article>
    <article><h3>1 / 2 / 3 grid</h3><p>Shoppers choose how many products they see per row.</p></article>
    <article><h3>Sticky add to cart</h3><p>Price and button stay visible while shoppers read the product page.</p></article>
  </section>

  <!-- Preview (hidden until a store is loaded) -->
  <section id="preview" class="preview" hidden>
    <div class="preview-head">
      <div class="preview-title">
        <h2>Your store, before &amp; after</h2>
        <p id="previewHost"></p>
      </div>
      <div class="tabs" role="tablist" aria-label="Page">
        <button class="tab active" role="tab" data-tab="home">Home</button>
        <button class="tab" role="tab" data-tab="collection">Collection</button>
        <button class="tab" role="tab" data-tab="product">Product</button>
      </div>
    </div>

    <div class="side-toggle" id="sideToggle">
      <button data-side="before">Before</button>
      <button data-side="after" class="active">After</button>
    </div>

    <div class="stage" id="stage"></div>

    <div class="preview-foot">
      <span class="note">Preview only. Not affiliated with the store shown.</span>
      <span class="foot-btns">
        <a class="btn small" href="#top" id="again">Try another store</a>
        <a class="btn small primary" href="#cta">Get the app</a>
      </span>
    </div>
  </section>

  <section class="cta wrap" id="cta">
    <h2>Ready to turn your store into an app?</h2>
    <!-- Replace # with your app install link -->
    <a class="btn primary big" href="#">Install the app</a>
  </section>
</main>

<footer class="foot wrap">
  <small>Screenshots are generated on request and deleted after 24 hours.</small>
</footer>

<!-- Loading -->
<div id="loading" class="loading" hidden>
  <div class="card">
    <div class="spinner" aria-hidden="true"></div>
    <h3>Building your preview</h3>
    <ol id="steps">
      <li>Opening your store</li>
      <li>Capturing collection page</li>
      <li>Capturing product page</li>
      <li>Applying app features</li>
    </ol>
    <p id="queueNote" class="queue" hidden></p>
  </div>
</div>

<script src="/js/app.js"></script>
</body>
</html>
```

## public/css/style.css

```css
:root{
  --bg:#0e0e12; --panel:#17171d; --line:#2a2a33; --text:#f4f4f7; --muted:#a2a2b0;
  --accent:#5b3df5; --brand:#5b3df5; --atc:#ea580c;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{width:min(1080px,100% - 32px);margin-inline:auto}
a{color:inherit}
h1,h2,h3{line-height:1.15;margin:0}

/* nav */
.nav{position:absolute;inset:0 0 auto 0;z-index:5}
.nav-in{display:flex;align-items:center;justify-content:space-between;height:64px}
.brand{display:flex;align-items:center;gap:10px;font-weight:800;text-decoration:none;letter-spacing:-.01em}
.dot{width:14px;height:14px;border-radius:5px;background:linear-gradient(135deg,#8b6cff,var(--accent))}

/* buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid var(--line);background:var(--panel);color:var(--text);padding:12px 20px;border-radius:12px;font:600 15px/1 inherit;text-decoration:none;cursor:pointer;transition:transform .15s,background .15s}
.btn:hover{transform:translateY(-1px)}
.btn.primary{background:var(--accent);border-color:transparent;color:#fff}
.btn.small{padding:9px 14px;font-size:14px;border-radius:10px}
.btn.big{padding:16px 28px;font-size:17px}
.btn[disabled]{opacity:.6;cursor:wait}

/* hero */
.hero{padding:120px 0 56px;text-align:center;background:radial-gradient(60% 60% at 50% 0%,rgba(91,61,245,.28),transparent 70%)}
.eyebrow{display:inline-block;margin:0 0 16px;padding:6px 12px;border:1px solid var(--line);border-radius:999px;color:var(--muted);font-size:13px}
.hero h1{font-size:clamp(32px,6vw,60px);letter-spacing:-.03em;max-width:15ch;margin-inline:auto}
.grad{background:linear-gradient(90deg,#9d86ff,#5b3df5 60%,#ff7a59);-webkit-background-clip:text;background-clip:text;color:transparent}
.sub{max-width:56ch;margin:18px auto 30px;color:var(--muted);font-size:clamp(16px,2vw,19px)}
.form{max-width:640px;margin-inline:auto}
.field{display:flex;gap:10px;padding:8px;border:1px solid var(--line);background:var(--panel);border-radius:16px}
.field input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--text);font-size:17px;padding:10px 12px}
.field:focus-within{border-color:var(--accent);box-shadow:0 0 0 4px rgba(91,61,245,.2)}
.hint{color:var(--muted);font-size:14px;margin:14px 0 0}
.hint a{color:#b9a8ff}
.error{margin:12px 0 0;color:#ff8f8f;font-size:14px}
.adv{margin-top:14px;color:var(--muted);font-size:14px;text-align:left}
.adv summary{cursor:pointer;text-align:center}
.adv-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
.adv-grid input{padding:12px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--text);font-size:14px}

/* features */
.features{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:24px 0 72px}
.features article{padding:20px;border:1px solid var(--line);border-radius:16px;background:var(--panel)}
.features h3{font-size:16px;margin-bottom:6px}
.features p{margin:0;color:var(--muted);font-size:14px}

/* preview section: exactly one screen tall so the phones always fit */
.preview{height:100vh;height:100svh;min-height:560px;display:flex;flex-direction:column;padding:16px 16px 12px;background:#141418;border-block:1px solid var(--line)}
.preview[hidden]{display:none}
.preview-head{display:flex;align-items:center;justify-content:space-between;gap:12px 24px;flex-wrap:wrap;width:min(1080px,100%);margin-inline:auto}
.preview-title h2{font-size:clamp(17px,2.2vw,22px)}
.preview-title p{margin:2px 0 0;color:var(--muted);font-size:13px}
.tabs{display:flex;gap:4px;padding:4px;border-radius:12px;background:var(--panel);border:1px solid var(--line)}
.tab{border:0;background:transparent;color:var(--muted);padding:9px 16px;border-radius:9px;font:600 14px/1 inherit;cursor:pointer}
.tab.active{background:var(--accent);color:#fff}
.side-toggle{display:none;align-self:center;margin-top:10px;padding:3px;border-radius:10px;background:var(--panel);border:1px solid var(--line)}
.side-toggle button{border:0;background:transparent;color:var(--muted);padding:7px 18px;border-radius:8px;font:600 13px/1 inherit;cursor:pointer}
.side-toggle button.active{background:#2c2c36;color:#fff}
.stage{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;gap:40px;margin-top:6px}
.stage.single ~ .x{}
.preview-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;width:min(1080px,100%);margin-inline:auto;padding-top:8px}
.note{color:var(--muted);font-size:12px}
.foot-btns{display:flex;gap:8px}

.slot{display:flex;flex-direction:column;align-items:center;gap:10px}
.slot-label{height:34px;display:flex;align-items:center;gap:10px;font-size:13px;color:var(--muted)}
.pill{padding:5px 12px;border-radius:999px;font-weight:700;font-size:12px;letter-spacing:.04em;text-transform:uppercase}
.pill.before{background:#2c2c36;color:#d7d7e0}
.pill.after{background:var(--accent);color:#fff}
.stage.single .slot{display:none}
.stage.single .slot.active{display:flex}
.holder{position:relative;width:calc(418px * var(--s,1));height:calc(872px * var(--s,1))}

/* phone (designed at 418 x 872, scaled by JS) */
.phone{position:absolute;left:0;top:0;width:418px;height:872px;padding:14px;border-radius:62px;background:#07070a;
  transform:scale(var(--s,1));transform-origin:0 0;
  box-shadow:0 0 0 3px #9db1c9,0 0 0 5px #596579,0 40px 80px -20px rgba(0,0,0,.7)}
.phone::before{content:"";position:absolute;left:-8px;top:150px;width:4px;height:56px;background:#596579;border-radius:3px 0 0 3px;box-shadow:0 78px 0 #596579}
.phone::after{content:"";position:absolute;right:-8px;top:210px;width:4px;height:92px;background:#596579;border-radius:0 3px 3px 0}
.screen{position:relative;width:390px;height:844px;border-radius:48px;overflow:hidden;background:#fff}
.status{position:absolute;inset:0 0 auto 0;height:47px;background:#000;color:#fff;z-index:6;display:flex;align-items:flex-end;justify-content:space-between;padding:0 30px 7px 36px;font:600 15px/1 system-ui,sans-serif}
.status .sys{display:flex;gap:6px;align-items:center}
.notch{position:absolute;z-index:7;top:0;left:50%;transform:translateX(-50%);width:126px;height:34px;background:#000;border-radius:0 0 20px 20px}
.viewport{position:absolute;top:47px;left:0;right:0;height:685px;overflow:hidden;background:#fff}
.scroller{height:100%;overflow-y:auto;overflow-x:hidden;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.scroller::-webkit-scrollbar{display:none}
.shot{display:block;width:390px;height:auto;opacity:0;transition:opacity .25s}
.shot.ready{opacity:1}
.spacer{height:0}
.after .spacer{height:76px}
.missing{display:none;padding:80px 28px;text-align:center;color:#555;font:500 15px/1.5 system-ui,sans-serif}
.missing button{margin-top:14px;padding:10px 16px;border-radius:10px;border:0;background:var(--accent);color:#fff;font:600 14px/1 system-ui;cursor:pointer}
.is-missing .shot,.is-missing .spacer{display:none}
.is-missing .missing{display:block}

/* bottom navigation (After) */
.overlay{position:absolute;inset:auto 0 0 0;pointer-events:none}
.bnav{position:relative;height:68px;background:#fff;box-shadow:0 -2px 12px rgba(0,0,0,.09);display:grid;grid-template-columns:repeat(5,1fr);align-items:end;padding-bottom:9px}
.bnav .it{display:flex;flex-direction:column;align-items:center;gap:3px;font:500 10px/1 system-ui,sans-serif;color:#8f9bff;color:color-mix(in srgb,var(--brand) 50%,#fff)}
.bnav svg{width:22px;height:22px}
.bnav .home{position:relative;height:100%}
.bnav .home i{position:absolute;left:50%;top:-24px;transform:translateX(-50%);width:54px;height:54px;border-radius:50%;background:var(--brand);box-shadow:0 0 0 5px #fff,0 6px 14px rgba(0,0,0,.2);display:grid;place-items:center}
.bnav .home svg{stroke:#fff;width:24px;height:24px}
.badge{position:absolute;top:-6px;right:-9px;min-width:16px;height:16px;border-radius:8px;background:#ef3b3b;color:#fff;font:700 10px/16px system-ui;text-align:center;padding:0 3px}
.cart{position:relative}

/* sticky add to cart (After, product tab) */
.atc{height:64px;background:#fff;border-top:1px solid #e6e6ea;display:flex;align-items:center;justify-content:space-between;padding:0 16px}
.atc b{font:800 18px system-ui,sans-serif;color:#0b1b3a}
.atc span{background:var(--atc);color:#fff;padding:13px 26px;border-radius:12px;font:700 14px/1 system-ui,sans-serif}

/* safari-like bottom chrome */
.chrome{position:absolute;inset:auto 0 0 0;height:112px;background:#2b2b2d;color:#e9e9ee}
.urlbar{margin:8px 16px 0;height:40px;border-radius:12px;background:#454548;display:flex;align-items:center;justify-content:center;gap:10px;font:500 13px/1 system-ui,sans-serif}
.urlbar em{font-style:normal;font-weight:700;opacity:.9}
.toolbar{display:flex;justify-content:space-around;align-items:center;height:48px;margin-top:6px}
.toolbar svg{width:24px;height:24px;stroke:#e9e9ee}
.home-ind{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:134px;height:5px;border-radius:3px;background:#f2f2f2}

/* cta + footer */
.cta{text-align:center;padding:80px 0}
.cta h2{font-size:clamp(24px,4vw,36px);margin-bottom:22px}
.foot{padding:0 0 40px;text-align:center;color:var(--muted)}

/* loading */
.loading{position:fixed;inset:0;z-index:50;display:grid;place-items:center;background:rgba(8,8,12,.78);backdrop-filter:blur(6px)}
.loading[hidden]{display:none}
.card{width:min(380px,100% - 32px);padding:28px;border-radius:20px;background:var(--panel);border:1px solid var(--line)}
.card h3{margin:14px 0 14px;font-size:20px}
.spinner{width:34px;height:34px;border-radius:50%;border:3px solid #33333d;border-top-color:var(--accent);animation:spin .8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.card ol{list-style:none;margin:0;padding:0;display:grid;gap:10px;color:var(--muted);font-size:15px}
.card li{display:flex;align-items:center;gap:10px}
.card li::before{content:"";width:10px;height:10px;border-radius:50%;border:2px solid #444452}
.card li.done{color:var(--text)}
.card li.done::before{background:#3ccf7c;border-color:#3ccf7c}
.card li.now{color:var(--text)}
.card li.now::before{border-color:var(--accent);background:var(--accent)}
.queue{margin:14px 0 0;color:var(--muted);font-size:13px}

@media (max-width:820px){
  .features{grid-template-columns:1fr 1fr}
  .adv-grid{grid-template-columns:1fr}
  .side-toggle{display:flex}
  .foot-btns{width:100%}
  .foot-btns .btn{flex:1}
  .note{display:none}
}
@media (max-width:520px){
  .field{flex-direction:column}
  .features{grid-template-columns:1fr}
  .hero{padding-top:96px}
}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
```

## public/js/app.js

```js
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const PHONE_W = 418, PHONE_H = 872, LABEL_H = 44, GAP = 40;
  const state = { result: null, tab: 'home', side: 'after', single: false };

  const ICON = {
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11h10.2L20 7H6"/><circle cx="9" cy="19.5" r="1.5"/><circle cx="17" cy="19.5" r="1.5"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
    fwd: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V4M8 8l4-4 4 4M6 12H5v8h14v-8h-1"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linejoin="round"><path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6zM12 6v13"/></svg>',
    tabs: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linejoin="round"><rect x="8" y="3" width="13" height="13" rx="2.5"/><path d="M16 19.5H6A2.5 2.5 0 013.5 17V8"/></svg>',
    wifi: '<svg width="17" height="12" viewBox="0 0 17 12" fill="#fff"><path d="M8.5 2.4c2.2 0 4.2.9 5.7 2.3l1-1.1A9.6 9.6 0 008.5.9 9.6 9.6 0 002.3 3.6l1 1.1A8.1 8.1 0 018.5 2.4zm0 3.3c1.3 0 2.5.5 3.4 1.3l1-1.1a6.4 6.4 0 00-8.8 0l1 1.1c.9-.8 2.1-1.3 3.4-1.3zM8.5 9l2-2.1a3 3 0 00-4 0z"/></svg>',
    batt: '<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="21" height="11" rx="3" fill="none" stroke="#fff" opacity=".5"/><rect x="2" y="2" width="18" height="8" rx="2" fill="#fff"/><rect x="23" y="4" width="2" height="4" rx="1" fill="#fff" opacity=".5"/></svg>',
  };

  // ---------- phone markup ----------
  function phoneHTML(side) {
    const label = side === 'before' ? 'Your current mobile site' : 'With app features';
    return `
    <div class="slot" data-side="${side}">
      <div class="slot-label"><span class="pill ${side}">${side}</span><span>${label}</span></div>
      <div class="holder"><div class="phone ${side}">
        <div class="screen ${side}">
          <div class="status"><span class="time"></span><span class="sys">${ICON.wifi}${ICON.batt}</span></div>
          <div class="notch"></div>
          <div class="viewport">
            <div class="scroller">
              <img class="shot" alt="${side} preview" draggable="false">
              <div class="missing"><p></p><button type="button">Add URL manually</button></div>
              <div class="spacer"></div>
            </div>
            <div class="overlay"></div>
          </div>
          <div class="chrome">
            <div class="urlbar"><span>AA</span><em class="host"></em></div>
            <div class="toolbar">${ICON.back}${ICON.fwd}${ICON.share}${ICON.book}${ICON.tabs}</div>
            <div class="home-ind"></div>
          </div>
        </div>
      </div></div>
    </div>`;
  }

  const NAV = `<div class="bnav">
    <div class="it">${ICON.user}<span>Account</span></div>
    <div class="it">${ICON.search}<span>Search</span></div>
    <div class="it home"><i>${ICON.home}</i></div>
    <div class="it">${ICON.grid}<span>Shop</span></div>
    <div class="it cart">${ICON.cart}<span class="badge">2</span><span>Cart</span></div>
  </div>`;
  const atc = (price) => `<div class="atc"><b>${price}</b><span>Add to cart</span></div>`;

  // ---------- render ----------
  function currentImages() {
    const im = state.result.images;
    if (state.tab === 'home') return { before: im.home, after: im.home };
    if (state.tab === 'collection') return { before: im.collectionBefore, after: im.collectionAfter };
    return { before: im.product, after: im.product };
  }

  function render() {
    if (!state.result) return;
    const r = state.result;
    const imgs = currentImages();
    $('#previewHost').textContent = `${r.storeName} · ${r.host}`;

    ['before', 'after'].forEach((side) => {
      const slot = $(`.slot[data-side="${side}"]`);
      const src = imgs[side];
      const screen = $('.screen', slot);
      const img = $('.shot', slot);
      const scroller = $('.scroller', slot);
      const overlay = $('.overlay', slot);

      $('.host', slot).textContent = r.host;
      screen.classList.toggle('is-missing', !src);
      $('.missing p', slot).textContent = `We couldn't find a ${state.tab} page automatically.`;

      img.classList.remove('ready');
      if (src) {
        img.onload = () => img.classList.add('ready');
        if (img.getAttribute('src') !== src) img.src = src; else img.classList.add('ready');
      }
      scroller.scrollTop = 0;

      overlay.innerHTML = '';
      if (side === 'after' && src) {
        overlay.innerHTML = state.tab === 'product' ? atc(r.price || '$49.99') : NAV;
      }
    });
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === state.tab));
    $$('.slot').forEach((s) => s.classList.toggle('active', s.dataset.side === state.side));
    $$('#sideToggle button').forEach((b) => b.classList.toggle('active', b.dataset.side === state.side));
  }

  // ---------- fit the phones inside the viewport ----------
  function fit() {
    const stage = $('#stage');
    if (!stage || $('#preview').hidden) return;
    const w = stage.clientWidth, h = stage.clientHeight;
    const sH = (h - LABEL_H) / PHONE_H;
    const two = Math.min(sH, (w - GAP) / (2 * PHONE_W));
    const one = Math.min(sH, w / PHONE_W);
    state.single = two < 0.52;
    const s = Math.max(0.25, Math.min(1, state.single ? one : two));
    stage.classList.toggle('single', state.single);
    stage.style.setProperty('--s', s.toFixed(4));
    $('#sideToggle').style.display = state.single ? 'flex' : 'none';
  }

  function tickClock() {
    const t = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    $$('.time').forEach((e) => (e.textContent = t));
  }

  // ---------- init preview UI ----------
  function buildStage() {
    $('#stage').innerHTML = phoneHTML('before') + phoneHTML('after');
    tickClock();
    // keep both phones scrolled to the same place
    let lock = false;
    $$('.scroller').forEach((sc) =>
      sc.addEventListener('scroll', () => {
        if (lock) return;
        lock = true;
        $$('.scroller').forEach((o) => { if (o !== sc) o.scrollTop = sc.scrollTop; });
        requestAnimationFrame(() => (lock = false));
      }, { passive: true })
    );
    $$('.missing button').forEach((b) =>
      b.addEventListener('click', () => {
        $('#adv').open = true;
        $('#top').scrollIntoView();
        (state.tab === 'product' ? $('#prodUrl') : $('#collUrl')).focus();
      })
    );
  }

  $$('.tab').forEach((t) => t.addEventListener('click', () => { state.tab = t.dataset.tab; render(); }));
  $$('#sideToggle button').forEach((b) => b.addEventListener('click', () => { state.side = b.dataset.side; render(); }));
  new ResizeObserver(fit).observe($('#stage'));
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  buildStage();

  // ---------- form + polling ----------
  const form = $('#form'), input = $('#url'), errorEl = $('#error'), go = $('#go');
  const loading = $('#loading'), steps = $$('#steps li'), queueNote = $('#queueNote');

  function setError(msg) { errorEl.hidden = !msg; errorEl.textContent = msg || ''; }
  function setLoading(on) { loading.hidden = !on; go.disabled = on; if (on) updateSteps(-1, 0); }
  function updateSteps(idx, queuePos) {
    steps.forEach((li, i) => { li.className = i < idx ? 'done' : i === idx ? 'now' : ''; });
    queueNote.hidden = !(queuePos > 0);
    queueNote.textContent = queuePos > 0 ? `Waiting in line (position ${queuePos})...` : '';
  }

  async function startPreview(url, extra = {}) {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...extra }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
      await poll(data.jobId);
    } catch (err) {
      setLoading(false);
      setError(err.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  async function poll(id) {
    const deadline = Date.now() + 130000;
    while (Date.now() < deadline) {
      const res = await fetch(`/api/preview/${id}`);
      const job = await res.json();
      if (!res.ok) throw new Error(job.error || 'Preview not found.');
      if (job.status === 'done') return show(job.result);
      if (job.status === 'error') throw new Error(job.error.message);
      updateSteps(job.stepIndex, job.queuePosition);
      await new Promise((r) => setTimeout(r, 900));
    }
    throw new Error('This is taking too long. Please try again.');
  }

  function show(result) {
    state.result = result;
    state.tab = 'home';
    state.side = 'after';
    const prev = $('#preview');
    prev.style.setProperty('--brand', result.brandColor || '#5b3df5');
    prev.style.setProperty('--atc', result.brandColor || '#ea580c');
    prev.hidden = false;
    render();
    fit();
    setLoading(false);
    requestAnimationFrame(() => {
      fit();
      prev.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const url = input.value.trim();
    if (!url) { setError('Please enter your store URL.'); input.focus(); return; }
    startPreview(url, { collectionUrl: $('#collUrl').value.trim(), productUrl: $('#prodUrl').value.trim() });
  });
  $('#demoLink').addEventListener('click', (e) => { e.preventDefault(); input.value = 'demo'; form.requestSubmit(); });

  // ?url=mystore.com opens a preview directly
  const qs = new URLSearchParams(location.search).get('url');
  if (qs) { input.value = qs; startPreview(qs); }
})();
```

---

## Demo store (built-in, no internet needed)

## sample-store/style.css

```css
*{box-sizing:border-box}
body{margin:0;font:15px/1.5 system-ui,sans-serif;color:#222;background:#fff}
a{color:inherit;text-decoration:none}
.announce{text-align:center;font-size:11px;letter-spacing:.06em;padding:12px;border-bottom:1px solid #eee}
.site-header{display:flex;align-items:center;justify-content:space-between;padding:18px 20px;border-bottom:1px solid #eee}
.logo{font-size:20px;color:#555}
.drawer{display:none}
.hero{height:380px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;color:#fff;text-align:center;background:linear-gradient(160deg,#d8b898,#8a6a52)}
.hero h2{font-size:34px;font-weight:400;margin:0;max-width:11ch}
.hero a{border:1px solid #fff;padding:12px 22px;font-size:13px;letter-spacing:.08em}
.section{padding:28px 18px}
.section h3{font-weight:400;font-size:20px;margin:0 0 18px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.card .img{position:relative;aspect-ratio:1;background:#f4f4f4;display:flex;align-items:center;justify-content:center;overflow:hidden}
.towels{width:56%;display:flex;flex-direction:column;gap:6px}
.towels i{display:block;height:20px;border-radius:5px;background:var(--c,#7cc7d6)}
.towels i:nth-child(n+5){width:80%;margin:0 auto}
.sale{position:absolute;left:10px;bottom:10px;background:#111;color:#fff;font-size:12px;padding:6px 14px;border-radius:999px}
.card h4{font-weight:400;font-size:12.5px;margin:12px 0 6px;color:#333}
.old{color:#777;text-decoration:line-through;font-size:12px}
.price{font-size:15px}
.pdp .gallery{margin:24px;background:#f6f6f6;aspect-ratio:1;display:flex;align-items:center;justify-content:center}
.pdp .gallery .towels{width:50%}
.pdp .info{padding:0 20px 40px}
.pdp small{color:#888;letter-spacing:.1em;font-size:10px}
.pdp h1{font-weight:400;font-size:30px;line-height:1.2;margin:6px 0 10px}
.pdp .p{font-size:20px;margin:0 0 16px}
.pdp .btn{display:block;text-align:center;border:1px solid #222;padding:14px;margin:10px 0}
.pdp .btn.dark{background:#222;color:#fff}
.pdp p.d{color:#555}
```

## sample-store/index.html (home)

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Demo Store</title>
<meta name="theme-color" content="#5b3df5">
<meta property="og:site_name" content="Demo Store">
<link rel="stylesheet" href="/sample-store/style.css">
</head><body>
<div class="announce">Welcome to our store</div>
<header class="site-header" role="banner">
  <span>&#9776;</span><a class="logo" href="/sample-store/">Demo Store</a><span>&#9786; &nbsp; &#128717;</span>
</header>
<nav class="drawer">
  <a href="/sample-store/collections/womens/">Women's</a>
  <a href="/sample-store/collections/mens/">Men's</a>
  <a href="/sample-store/collections/premium-pendant/">Premium pendant</a>
  <a href="/sample-store/collections/collection/">Collection</a>
  <a href="/sample-store/collections/bottle/">Bottle</a>
</nav>
<section class="hero"><h2>Browse our latest products</h2><a href="/sample-store/collections/mens/">Shop all</a></section>
<section class="section"><h3>Featured products</h3>
  <div class="grid">
    <a class="card" href="/sample-store/products/towel-set-blue/"><div class="img"><div class="towels"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><h4>12 Piece Cotton Towel Set - Blue</h4><span class="price">$54.99 USD</span></a>
    <a class="card" href="/sample-store/products/towel-set-blue/"><div class="img"><div class="towels" style="--c:#8f8f8f"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><h4>12 Piece Cotton Towel Set - Grey</h4><span class="price">$29.99 USD</span></a>
  </div>
</section>
</body></html>
```

## sample-store/collections/mens/index.html

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Men's | Demo Store</title>
<meta name="theme-color" content="#5b3df5">
<link rel="stylesheet" href="/sample-store/style.css">
</head><body>
<div class="announce">Welcome to our store</div>
<header class="site-header" role="banner">
  <span>&#9776;</span><a class="logo" href="/sample-store/">Demo Store</a><span>&#9786; &nbsp; &#128717;</span>
</header>
<nav class="drawer">
  <a href="/sample-store/collections/womens/">Women's</a>
  <a href="/sample-store/collections/mens/">Men's</a>
  <a href="/sample-store/collections/premium-pendant/">Premium pendant</a>
  <a href="/sample-store/collections/collection/">Collection</a>
  <a href="/sample-store/collections/bottle/">Bottle</a>
</nav>
<section class="section"><h1 style="font-size:13px;letter-spacing:.08em;margin:0 0 16px">MEN'S</h1>
  <div class="grid">
    <a class="card" href="/sample-store/products/towel-set-blue/"><div class="img"><div class="towels"><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="sale">Sale</span></div><h4>12 Piece Cotton Towel Set - Blue</h4><span class="old">$68.39 USD</span><br><span class="price">$54.99 USD</span></a>
    <a class="card" href="/sample-store/products/towel-set-blue/"><div class="img"><div class="towels" style="--c:#8f8f8f"><i></i><i></i><i></i><i></i><i></i><i></i></div><span class="sale">Sale</span></div><h4>12 Piece Cotton Towel Set - Space Grey</h4><span class="old">$68.39 USD</span><br><span class="price">$29.99 USD</span></a>
    <a class="card" href="/sample-store/products/towel-set-blue/"><div class="img"><div class="towels" style="--c:#e6e6e6"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><h4>12 Piece Cotton Towel Set - White</h4><span class="price">$44.99 USD</span></a>
    <a class="card" href="/sample-store/products/towel-set-blue/"><div class="img"><div class="towels" style="--c:#cdb59f"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><h4>12 Piece Cotton Towel Set - Beige</h4><span class="price">$44.99 USD</span></a>
  </div>
</section>
</body></html>
```

To create the other collection pages the home links point to (`womens`, `premium-pendant`, `collection`, `bottle`), copy the `mens` folder under those names. They are only needed if you want those links to open; the story circles only need the links to exist.

## sample-store/products/towel-set-blue/index.html

```html
<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>12 Piece Cotton Towel Set - Blue | Demo Store</title>
<meta name="theme-color" content="#5b3df5">
<link rel="stylesheet" href="/sample-store/style.css">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"12 Piece Cotton Towel Set - Blue",
 "offers":{"@type":"Offer","price":"54.99","priceCurrency":"USD"}}
</script>
</head><body class="pdp">
<div class="announce">Welcome to our store</div>
<header class="site-header" role="banner">
  <span>&#9776;</span><a class="logo" href="/sample-store/">Demo Store</a><span>&#9786; &nbsp; &#128717;</span>
</header>
<div class="gallery"><div class="towels"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
<div class="info">
  <small>MY STORE</small>
  <h1>12 Piece Cotton Towel Set - Blue</h1>
  <p class="p">$54.99 USD</p>
  <a class="btn" href="#">Add to cart</a>
  <a class="btn dark" href="#">Buy it now</a>
  <p class="d">Soft, absorbent 100% cotton towels. Includes 4 bath towels, 4 hand towels and 4 washcloths. Machine washable and quick drying.</p>
  <p class="d">Free shipping on orders over $50. 30 day returns.</p>
</div>
</body></html>
```

---

## Dockerfile

Use the Playwright image tag that matches the version in `package.json` (check with `npm ls playwright` and pin it to an exact version).

```dockerfile
FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /app
COPY package*.json ./
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN npm install --omit=dev --ignore-scripts
COPY . .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.js"]
```

## render.yaml

```yaml
services:
  - type: web
    name: store-preview-demo
    runtime: docker
    plan: free        # use "starter" or higher for launch (Chromium needs memory)
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
```

## .gitignore

```
node_modules
data
.env
```

---

## 10. Next steps

1. Run locally with `demo`, then 5 to 10 real stores.
2. Replace "YourApp" and the `#` install links in `public/index.html`.
3. Deploy to Render, add the uptime monitor.
4. Test 20 to 30 stores across platforms; tune `clean.js` and `discover.js` for any that fail.
5. Optional later: upload-your-own-screenshots fallback, email capture, analytics on which URLs people try.
