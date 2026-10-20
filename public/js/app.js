(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const PHONE_W = 418, PHONE_H = 872, LABEL_H = 44, GAP = 40;
  const state = { result: null, tab: 'home', side: 'after', single: false, navStyle: 'default' };

  const ICON = {
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>',
    cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
    fwd: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
    book: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
    tabs: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linejoin="round"><rect x="8" y="3" width="13" height="13" rx="2.5"/><path d="M16 19.5H6A2.5 2.5 0 0 1 3.5 17V8"/></svg>',
    wifi: '<svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor"><path d="M8.5 2.4c2.2 0 4.2.9 5.7 2.3l1-1.1A9.6 9.6 0 008.5.9 9.6 9.6 0 002.3 3.6l1 1.1A8.1 8.1 0 018.5 2.4zm0 3.3c1.3 0 2.5.5 3.4 1.3l1-1.1a6.4 6.4 0 00-8.8 0l1 1.1c.9-.8 2.1-1.3 3.4-1.3zM8.5 9l2-2.1a3 3 0 00-4 0z"/></svg>',
    batt: '<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="21" height="11" rx="3" fill="none" stroke="currentColor" opacity=".5"/><rect x="2" y="2" width="18" height="8" rx="2" fill="currentColor"/><rect x="23" y="4" width="2" height="4" rx="1" fill="currentColor" opacity=".5"/></svg>',
  };

  // ---------- Navigation Styles Presets ----------
  const NAV_STYLES = [
    {
      id: 'default',
      name: 'Default',
      mini: `
        <div class="mini-bar mini-bar-default">
          <div class="mini-it active"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span>Home</span></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg><span>Search</span></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><span>Shop</span></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg><span>Cart</span></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg><span>Account</span></div>
        </div>
      `
    },
    {
      id: 'pill',
      name: 'Pill Tabs',
      mini: `
        <div class="mini-bar mini-bar-pill">
          <div class="mini-pill-badge"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span>Home</span></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></div>
        </div>
      `
    },
    {
      id: 'circle',
      name: 'Circle Highlight',
      mini: `
        <div class="mini-bar mini-bar-circle">
          <div class="mini-circle-badge"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></div>
        </div>
      `
    },
    {
      id: 'capsule',
      name: 'Floating Capsule',
      mini: `
        <div class="mini-bar mini-bar-capsule">
          <div class="mini-pill-badge"><svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg><span>Home</span></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M16 10a4 4 0 0 1-8 0"/></svg></div>
          <div class="mini-it"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></div>
        </div>
      `
    }
  ];

  // Phone Bottom Navigation Generator
  function renderNav(style = 'default') {
    switch (style) {
      case 'pill':
        return `
        <div class="bnav bnav-floating bnav-pill">
          <div class="bnav-bar">
            <div class="it pill-active"><i>${ICON.home}</i><span>Home</span></div>
            <div class="it">${ICON.search}</div>
            <div class="it">${ICON.grid}</div>
            <div class="it cart"><div class="cart-icon-wrap">${ICON.cart}<span class="badge">2</span></div></div>
            <div class="it">${ICON.user}</div>
          </div>
        </div>`;

      case 'circle':
        return `
        <div class="bnav bnav-floating bnav-circle">
          <div class="bnav-bar">
            <div class="it circle-active"><i>${ICON.home}</i></div>
            <div class="it">${ICON.search}</div>
            <div class="it">${ICON.grid}</div>
            <div class="it cart"><div class="cart-icon-wrap">${ICON.cart}<span class="badge">2</span></div></div>
            <div class="it">${ICON.user}</div>
          </div>
        </div>`;

      case 'capsule':
        return `
        <div class="bnav bnav-floating bnav-capsule">
          <div class="bnav-bar">
            <div class="it pill-active"><i>${ICON.home}</i><span>Home</span></div>
            <div class="it">${ICON.search}</div>
            <div class="it">${ICON.grid}</div>
            <div class="it cart"><div class="cart-icon-wrap">${ICON.cart}<span class="badge">2</span></div></div>
            <div class="it">${ICON.user}</div>
          </div>
        </div>`;

      case 'default':
      default:
        return `
        <div class="bnav bnav-default">
          <div class="it active">${ICON.home}<span>Home</span></div>
          <div class="it">${ICON.search}<span>Search</span></div>
          <div class="it">${ICON.grid}<span>Shop</span></div>
          <div class="it cart"><div class="cart-icon-wrap">${ICON.cart}<span class="badge">2</span></div><span>Cart</span></div>
          <div class="it">${ICON.user}<span>Account</span></div>
        </div>`;
    }
  }

  // ---------- phone markup ----------
  function phoneHTML(side) {
    const isAfter = side === 'after';
    const label = isAfter ? 'With App Features' : 'Standard Mobile Store';
    const badgeText = isAfter ? 'After' : 'Before';

    return `
    <div class="slot" data-side="${side}">
      <div class="slot-label">
        <span class="pill ${side}">${badgeText}</span>
        <span>${label}</span>
      </div>
      <div class="holder">
        <div class="phone ${side}">
          <div class="screen ${side}">
            <div class="status">
              <span class="time">9:41</span>
              <span class="sys">${ICON.wifi}${ICON.batt}</span>
            </div>
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
        </div>
      </div>
    </div>`;
  }

  const atc = (price) => `
    <div class="atc">
      <div class="atc-price-wrap">
        <small>Total</small>
        <b>${price}</b>
      </div>
      <span>Add to cart &rarr;</span>
    </div>`;

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
    if ($('#previewStoreHeading')) {
      $('#previewStoreHeading').textContent = `${r.storeName}: Before & After`;
    }

    // Toggle side panels according to active tab
    const navPanel = $('#navStylesPanel');
    const homeBefore = $('#homeBeforeFeatures');
    const collBefore = $('#collectionBeforeFeatures');
    const collAfter = $('#collectionAfterFeatures');
    const prodBefore = $('#productBeforeFeatures');
    const prodAfter = $('#productAfterFeatures');
    const sideLeft = $('#stageSideLeft');
    const sideRight = $('#stageSideRight');

    if (state.tab === 'home') {
      if (sideLeft) sideLeft.style.display = 'flex';
      if (sideRight) sideRight.style.display = 'flex';
      if (homeBefore) homeBefore.style.display = 'flex';
      if (collBefore) collBefore.style.display = 'none';
      if (collAfter) collAfter.style.display = 'none';
      if (prodBefore) prodBefore.style.display = 'none';
      if (prodAfter) prodAfter.style.display = 'none';
      if (navPanel) navPanel.style.display = 'flex';
    } else if (state.tab === 'collection') {
      if (sideLeft) sideLeft.style.display = 'flex';
      if (sideRight) sideRight.style.display = 'flex';
      if (homeBefore) homeBefore.style.display = 'none';
      if (collBefore) collBefore.style.display = 'flex';
      if (collAfter) collAfter.style.display = 'flex';
      if (prodBefore) prodBefore.style.display = 'none';
      if (prodAfter) prodAfter.style.display = 'none';
      if (navPanel) navPanel.style.display = 'none';
    } else { // product tab
      if (sideLeft) sideLeft.style.display = 'flex';
      if (sideRight) sideRight.style.display = 'flex';
      if (homeBefore) homeBefore.style.display = 'none';
      if (collBefore) collBefore.style.display = 'none';
      if (collAfter) collAfter.style.display = 'none';
      if (prodBefore) prodBefore.style.display = 'flex';
      if (prodAfter) prodAfter.style.display = 'flex';
      if (navPanel) navPanel.style.display = 'none';
    }

    ['before', 'after'].forEach((side) => {
      const slot = $(`.slot[data-side="${side}"]`);
      if (!slot) return;
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
        overlay.innerHTML = state.tab === 'product' ? atc(r.price || '$148.00') : renderNav(state.navStyle);
      }
    });
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === state.tab));
    $$('.slot').forEach((s) => s.classList.toggle('active', s.dataset.side === state.side));
    $$('#sideToggle button').forEach((b) => b.classList.toggle('active', b.dataset.side === state.side));
  }

  // ---------- Auto-fit phone scale calculation based on BOTH width and height ----------
  function computeScale() {
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    if (winW < 560) {
      // Single phone on mobile screens
      const availW = Math.max(260, winW - 32);
      const availH = Math.max(340, winH - 180);
      const sW = availW / PHONE_W;
      const sH = availH / PHONE_H;
      return Math.max(0.48, Math.min(0.78, Math.min(sW, sH)));
    }

    // Dual phones mode:
    // Vertical constraint: nav (72px) + preview-head (~50px) + slot labels (~36px) + bottom margin (~52px) = ~210px
    const reservedH = 210;
    const availH = Math.max(300, winH - reservedH);
    const scaleH = availH / PHONE_H;

    // Horizontal constraint:
    // Desktop layout (winW >= 960): side panels flank the phones
    // Tablet layout (560 <= winW < 960): side panels stack below the phones
    let scaleW;
    if (winW >= 960) {
      const isHome = state.tab === 'home';
      const sidePanelsW = isHome ? 640 : 540;
      const availWForPhones = Math.max(320, winW - sidePanelsW);
      scaleW = (availWForPhones - 28) / (PHONE_W * 2);
    } else {
      const availWForPhones = Math.max(320, winW - 40);
      scaleW = (availWForPhones - 20) / (PHONE_W * 2);
    }

    const s = Math.min(scaleH, scaleW);
    return Math.max(0.42, Math.min(0.76, s));
  }

  function fit() {
    const stage = $('#stage');
    if (!stage) return;
    const stageWrapper = $('#stageWrapper');
    const winW = window.innerWidth;
    state.single = winW < 560;
    const s = computeScale();

    stage.classList.toggle('single', state.single);
    stage.style.setProperty('--s', s.toFixed(4));
    document.documentElement.style.setProperty('--s', s.toFixed(4));

    // Compute exact stage half-width so side panels flank precisely on desktop
    const gap = 32;
    const stageW = state.single ? (PHONE_W * s) : (PHONE_W * s * 2 + gap);
    if (stageWrapper) {
      stageWrapper.style.setProperty('--stage-half-width', `${Math.round(stageW / 2)}px`);
    }

    const sideToggle = $('#sideToggle');
    if (sideToggle) sideToggle.style.display = state.single ? 'flex' : 'none';

    const wPx = `${Math.round(PHONE_W * s)}px`;
    const hPx = `${Math.round(PHONE_H * s)}px`;
    $$('.holder').forEach((holder) => {
      holder.style.width = wPx;
      holder.style.height = hPx;
    });
  }

  function tickClock() {
    const d = new Date();
    const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
    $$('.time').forEach((e) => (e.textContent = t));
  }

  // ---------- Navigation Styles Panel Generator ----------
  function buildNavStylesPanel() {
    const grid = $('#navStylesGrid');
    if (!grid) return;
    grid.innerHTML = NAV_STYLES.map((st) => {
      const isSel = state.navStyle === st.id;
      return `
      <div class="nav-style-card ${isSel ? 'selected' : ''}" data-style="${st.id}">
        <div class="style-card-header">
          <span class="style-radio ${isSel ? 'checked' : ''}"></span>
          <span class="style-name">${st.name}</span>
        </div>
        <div class="style-preview-box">
          ${st.mini}
        </div>
      </div>`;
    }).join('');

    $$('.nav-style-card', grid).forEach((card) => {
      card.addEventListener('click', () => {
        selectNavStyle(card.dataset.style);
      });
    });
  }

  function selectNavStyle(styleId) {
    state.navStyle = styleId;
    $$('.nav-style-card').forEach((card) => {
      const isSelected = card.dataset.style === styleId;
      card.classList.toggle('selected', isSelected);
      const radio = card.querySelector('.style-radio');
      if (radio) radio.classList.toggle('checked', isSelected);
    });

    // Instantly replace bottom navigation inside the After phone
    const slot = $('.slot[data-side="after"]');
    if (slot) {
      const overlay = $('.overlay', slot);
      if (overlay && state.tab !== 'product') {
        overlay.innerHTML = renderNav(state.navStyle);
      }
    }
  }

  // ---------- init preview UI ----------
  function buildStage() {
    $('#stage').innerHTML = phoneHTML('before') + phoneHTML('after');
    buildNavStylesPanel();
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
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 200));
  buildStage();
  fit();

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
    prev.style.setProperty('--brand', result.brandColor || '#4f46e5');
    prev.style.setProperty('--atc', result.brandColor || '#0f172a');
    prev.hidden = false;
    render();
    setLoading(false);
    // Jump instantly to preview with no scroll animation or transition
    const navH = 76;
    const topPos = Math.max(0, prev.getBoundingClientRect().top + window.pageYOffset - navH);
    window.scrollTo(0, topPos);
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
