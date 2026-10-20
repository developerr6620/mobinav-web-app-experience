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
