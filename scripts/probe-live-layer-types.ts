import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { bridgeClient } from '../src/bridge/client.js';

async function main() {
  const res: any = await bridgeClient.send('layer_types', { includeExperimental: true });
  const types = (res.result?.layerTypes || []).map((t: any) => t.type || t.name || t).sort();
  const out = { generatedAt: new Date().toISOString(), count: types.length, types };
  await writeFile(resolve('coverage/live-layer-types.json'), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`Wrote ${types.length} live layer types to coverage/live-layer-types.json`);
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
