import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public/vendor', { recursive: true });
for (const file of ['essentia-wasm.es.js', 'essentia.js-core.es.js'])
  await copyFile(`node_modules/essentia.js/dist/${file}`, `public/vendor/${file}`);
await copyFile('node_modules/essentia.js/LICENSE', 'public/vendor/ESSENTIA-LICENSE.txt');
