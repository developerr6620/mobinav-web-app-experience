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
