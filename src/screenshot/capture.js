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
    .launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    })
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

  const getPage = async () => {
    const ctx = await browser.newContext({
      viewport: { width: W, height: H },
      deviceScaleFactor: config.DEVICE_SCALE,
      isMobile: true,
      hasTouch: true,
      userAgent: config.USER_AGENT,
      locale: 'en-US',
    });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    job.ctx = ctx;
    const p = await ctx.newPage();
    return { ctx, p };
  };

  const missing = [];
  const images = { home: null, collectionBefore: null, collectionAfter: null, product: null };
  const urls = { home: job.input.homeUrl, collection: null, product: null };

  try {
    // 1) HOME
    setStep(0, 'Opening your store');
    let homeUrl = job.input.homeUrl;
    let home = { links: [], storeName: '', themeColor: '' };
    {
      const { ctx, p } = await getPage();
      try {
        try {
          await open(p, homeUrl);
        } catch (err) {
          const u = new URL(homeUrl);
          const altHost = u.hostname.startsWith('www.') ? u.hostname.replace(/^www\./i, '') : `www.${u.hostname}`;
          const altUrl = `${u.protocol}//${altHost}${u.pathname}${u.search}`;
          try {
            await open(p, altUrl);
            homeUrl = altUrl;
          } catch {
            throw err;
          }
        }
        await shot(p, file('home.jpg'));
        images.home = urlOf('home.jpg');
        homeUrl = p.url();
        urls.home = homeUrl;
        home = await extractHome(p);
      } finally {
        await ctx.close().catch(() => {});
        job.ctx = null;
      }
    }

    const origin = new URL(homeUrl).origin;

    // 2) COLLECTION
    setStep(1, 'Capturing collection page');
    let collectionUrl = job.input.collectionUrl;

    if (!collectionUrl) {
      collectionUrl = pickLink(home.links, 'collection', homeUrl, [homeUrl]);
    }

    if (!collectionUrl) {
      const { ctx: reqCtx } = await getPage();
      try {
        collectionUrl = await fromSitemap(reqCtx.request, origin, 'collection');
      } finally {
        await reqCtx.close().catch(() => {});
        job.ctx = null;
      }
    }

    // Intelligent fallback for collection page if not found in links or sitemap
    if (!collectionUrl) {
      const candidates = [
        `${origin}/collections/all`,
        `${origin}/collections`,
        `${origin}/shop`,
        `${origin}/products`,
        `${origin}/catalog`
      ];
      const { ctx: testCtx } = await getPage();
      try {
        for (const cand of candidates) {
          try {
            const testRes = await testCtx.request.get(cand, { timeout: 6000 });
            if (testRes.ok() && testRes.status() === 200) {
              collectionUrl = cand;
              break;
            }
          } catch { /* continue */ }
        }
      } finally {
        await testCtx.close().catch(() => {});
        job.ctx = null;
      }
    }

    let collection = null;
    if (collectionUrl) {
      const { ctx, p } = await getPage();
      try {
        await open(p, collectionUrl);
        await shot(p, file('collection-before.jpg'));
        images.collectionBefore = urlOf('collection-before.jpg');
        urls.collection = collectionUrl;
        collection = await extractCollection(p);
      } catch (err) {
        if (err.code === 'TIMEOUT') throw err;
        console.warn(`[job ${job.id}] collection failed: ${err.message}`);
      } finally {
        await ctx.close().catch(() => {});
        job.ctx = null;
      }
    }
    if (!images.collectionBefore) missing.push('collection');

    // 3) PRODUCT
    setStep(2, 'Capturing product page');
    let productUrl = job.input.productUrl;

    if (!productUrl && collection && collection.links) {
      productUrl = pickLink(collection.links, 'product', homeUrl);
    }
    if (!productUrl && home.links) {
      productUrl = pickLink(home.links, 'product', homeUrl);
    }
    if (!productUrl) {
      const { ctx: reqCtx } = await getPage();
      try {
        productUrl = await fromSitemap(reqCtx.request, origin, 'product');
      } finally {
        await reqCtx.close().catch(() => {});
        job.ctx = null;
      }
    }

    // Intelligent fallback for product page: inspect collection links for product URLs
    if (!productUrl && collection && collection.links) {
      const cand = collection.links.find((l) => /\/products?\/[^/?#]+/i.test(l.href) || /\/p\/[^/?#]+/i.test(l.href));
      if (cand) productUrl = cand.href;
    }

    let product = null;
    if (productUrl) {
      const { ctx, p } = await getPage();
      try {
        await open(p, productUrl);
        await shot(p, file('product.jpg'));
        images.product = urlOf('product.jpg');
        urls.product = productUrl;
        product = await extractProduct(p);
      } catch (err) {
        if (err.code === 'TIMEOUT') throw err;
        console.warn(`[job ${job.id}] product failed: ${err.message}`);
      } finally {
        await ctx.close().catch(() => {});
        job.ctx = null;
      }
    }
    if (!images.product) missing.push('product');

    // 4) APPLY APP FEATURES (story strip)
    setStep(3, 'Applying app features');
    const brandColor = usableBrandColor(home.themeColor);
    const brand = brandColor || '#5b3df5';
    if (images.collectionBefore) {
      const homeCols = collectionLinks(home.links, homeUrl);
      let items = homeCols.concat(collection ? collectionLinks(collection.links, homeUrl) : []);
      const seen = new Set();
      items = items.filter((i) => !seen.has(i.label.toLowerCase()) && seen.add(i.label.toLowerCase())).slice(0, 8);
      for (const l of FALLBACK_LABELS) {
        if (items.length >= 5) break;
        if (!seen.has(l.toLowerCase())) items.push({ href: '', label: l, img: '' });
      }
      const pool = collection && collection.images ? collection.images.slice() : [];
      items = items.map((it, i) => ({ label: it.label, img: it.img || pool[i] || '' }));
      const here = new URL(collectionUrl).pathname.replace(/\/$/, '');
      let activeIndex = homeCols.findIndex((c) => new URL(c.href).pathname.replace(/\/$/, '') === here);
      if (activeIndex < 0 || activeIndex >= items.length) activeIndex = 0;

      const { ctx, p } = await getPage();
      try {
        await open(p, collectionUrl);
        await injectStoryStrip(p, {
          items,
          activeIndex,
          title: (collection && collection.title) || items[activeIndex].label,
          brand,
        });
        await shot(p, file('collection-after.jpg'));
        images.collectionAfter = urlOf('collection-after.jpg');
      } catch (err) {
        if (err.code === 'TIMEOUT') throw err;
        console.warn(`[job ${job.id}] story strip failed: ${err.message}`);
        images.collectionAfter = images.collectionBefore;
      } finally {
        await ctx.close().catch(() => {});
        job.ctx = null;
      }
    }

    return {
      host: new URL(homeUrl).host.replace(/^127\.0\.0\.1:\d+$/, 'demo-store.myshop.com'),
      storeName: (home.storeName || new URL(homeUrl).host).slice(0, 60),
      brandColor,
      price: product ? formatPrice(product.price, product.currency) : '',
      productTitle: product ? product.title : '',
      collectionTitle: collection ? collection.title : '',
      images,
      urls,
      missing,
    };
  } finally {
    if (job.ctx) {
      await job.ctx.close().catch(() => {});
      job.ctx = null;
    }
  }
}

module.exports = { capturePreview, closeBrowser };
