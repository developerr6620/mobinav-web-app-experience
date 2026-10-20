'use strict';
// Usage: start the server (npm start), then: npm run test:demo
const port = String(process.env.PORT || 3000).trim();
const base = `http://localhost:${port}`;

(async () => {
  const start = await fetch(`${base}/api/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: process.argv[2] || 'demo' }),
  }).then((r) => r.json());
  console.log('Started job', start);

  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const s = await fetch(`${base}/api/preview/${start.jobId}`).then((r) => r.json());
    console.log(s.status, s.step);
    if (s.status === 'done') { console.log(JSON.stringify(s.result, null, 2)); return; }
    if (s.status === 'error') { console.error(s.error); process.exit(1); }
  }
  console.error('Timed out');
  process.exit(1);
})();
