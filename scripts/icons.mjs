import { readFile, writeFile } from 'node:fs/promises';
import { Resvg } from '@resvg/resvg-js';
const source = await readFile('public/mark.svg', 'utf8');
for (const [path, size] of [
  ['public/favicon-32.png', 32],
  ['public/apple-touch-icon.png', 180],
  ['public/icon-192.png', 192],
  ['public/icon-512.png', 512],
  ['icon.png', 256],
  ['logo.png', 256],
]) {
  const image = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(path, image);
}
// A maskable icon keeps the monogram inside the central 80% safe zone.
const maskable = source
  .replace(
    /<svg[^>]*>/,
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#142e3c"/><g transform="translate(51.2 51.2) scale(.8)">',
  )
  .replace('</svg>', '</g></svg>');
await writeFile('public/icon-maskable-512.png', new Resvg(maskable).render().asPng());
console.log('HAPanel icons rendered from public/mark.svg');
