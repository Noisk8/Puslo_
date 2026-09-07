import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const files = [];
async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) await walk(path);
    else if (entry.name !== 'sw.js') files.push(path);
  }
}
await walk('dist');
const hash = createHash('sha256');
for (const file of files) hash.update(await readFile(file));
const cache = `pulso-${hash.digest('hex').slice(0, 12)}`;
await writeFile(
  'dist/sw.js',
  `const CACHE=${JSON.stringify(cache)};
const ASSETS=${JSON.stringify(['/', ...files.map((p) => p.slice(4))])};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS))));
// Updates wait for existing tabs to close: never swap DSP/WASM underneath an active session.
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('pulso-')&&key!==CACHE)await caches.delete(key);await self.clients.claim();for(const client of await self.clients.matchAll())client.postMessage('OFFLINE_READY');})()));
self.addEventListener('message',event=>{if(event.data==='STATUS')event.source?.postMessage('OFFLINE_READY');});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin)return;event.respondWith((async()=>{const cache=await caches.open(CACHE);return (await cache.match(event.request,{ignoreSearch:true,ignoreVary:true}))||(event.request.mode==='navigate'?await cache.match('/index.html'):null)||fetch(event.request);})());});
`,
);
