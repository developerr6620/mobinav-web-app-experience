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
