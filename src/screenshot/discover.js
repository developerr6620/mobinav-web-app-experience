'use strict';

const COLLECTION_SLUG = /\/(collections|collection|category|categories|product-category|product-categories|cat|c)\/[^/?#]+/i;
const COLLECTION_INDEX = /\/(shop|store|catalog|products|all-products)\/?$/i;
const PRODUCT_RE = /\/(products?|p|item|items|dp)\/[^/?#]+/i;

const stripWww = (host) => (host || '').replace(/^www\./i, '').toLowerCase();

function isSameStore(hostA, hostB) {
  const a = stripWww(hostA).toLowerCase();
  const b = stripWww(hostB).toLowerCase();
  if (a === b) return true;
  // Match subdomains or root domains: e.g. shop.mystore.com and mystore.com
  const partsA = a.split('.');
  const partsB = b.split('.');
  if (partsA.length >= 2 && partsB.length >= 2) {
    const rootA = partsA.slice(-2).join('.');
    const rootB = partsB.slice(-2).join('.');
    if (rootA === rootB && rootA.includes('.')) return true;
  }
  return false;
}

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
    if (!isSameStore(u.host, base.host)) continue;
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
    if (!isSameStore(u.host, base.host)) continue;
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

  const base = new URL(origin);
  const altHost = base.hostname.startsWith('www.')
    ? base.hostname.replace(/^www\./i, '')
    : `www.${base.hostname}`;
  const origins = [origin, `${base.protocol}//${altHost}`];

  for (const orig of origins) {
    for (const path of ['/sitemap.xml', '/sitemap_index.xml']) {
      let xml = await get(`${orig}${path}`);
      if (!xml) continue;
      let urls = locs(xml);
      if (/<sitemapindex/i.test(xml)) {
        const matchRegex = kind === 'collection' ? /collections?|categories?|category|cat|shop/i : /products?|items?/i;
        const child = urls.find((u) => matchRegex.test(u)) || urls.find((u) => u.toLowerCase().includes(kind));
        if (child) {
          const childXml = await get(child);
          if (childXml) urls = locs(childXml);
        }
      }
      for (const u of urls) {
        try {
          const parsed = new URL(u);
          if (isSameStore(parsed.host, base.host) && re.test(parsed.pathname)) return u;
        } catch { /* skip */ }
      }
    }
  }
  return null;
}

module.exports = { pickLink, collectionLinks, fromSitemap };
