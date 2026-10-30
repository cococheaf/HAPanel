import { readFile, writeFile, rename } from 'node:fs/promises';
await rename('dist/demo/demo.html', 'dist/demo/index.html');
const manifest = JSON.parse(await readFile('dist/demo/manifest.webmanifest', 'utf8'));
manifest.id = './';
manifest.start_url = './';
await writeFile('dist/demo/manifest.webmanifest', JSON.stringify(manifest, null, 2));
// The static demo has no API, credentials, pairing data, or backend bundle.
