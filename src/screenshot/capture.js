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
