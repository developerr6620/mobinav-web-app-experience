import { startTunnel } from 'untun';

async function run() {
  const port = process.env.PORT || 3001;
  const tunnel = await startTunnel({ port: Number(port) });
  const url = await tunnel.getURL();
  console.log('\n======================================================');
  console.log('🚀 LIVE PUBLIC URL (Works anywhere worldwide, 100% Free):');
  console.log(`   ${url}`);
  console.log(`\n👉 Direct Demo Link:`);
  console.log(`   ${url}/?url=demo`);
  console.log('======================================================\n');
}

run().catch(console.error);
