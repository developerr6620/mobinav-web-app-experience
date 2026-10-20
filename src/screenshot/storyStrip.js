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
