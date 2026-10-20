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
