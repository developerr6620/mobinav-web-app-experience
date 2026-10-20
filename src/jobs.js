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
