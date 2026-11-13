import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(projectRoot, 'public');
const logoPath = path.join(publicDir, 'logo.svg');
const logoSvg = await readFile(logoPath, 'utf8');
const defs = logoSvg.match(/<defs>[\s\S]*?<\/defs>/)?.[0];
const artwork = logoSvg.match(/<g id="logo-artwork">([\s\S]*?)<\/g>/)?.[1];

if (!defs || !artwork) {
  throw new Error('public/logo.svg must contain the shared gradient definitions and logo-artwork group.');
}

const maskableSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
${defs}
<rect width="512" height="512" fill="url(#bg)"/>
<g transform="translate(51.2 51.2) scale(0.8)">${artwork}</g>
</svg>`);

await mkdir(publicDir, { recursive: true });

const outputs = [
  { name: 'favicon-32.png', size: 32, input: Buffer.from(logoSvg) },
  { name: 'apple-touch-icon.png', size: 180, input: Buffer.from(logoSvg) },
  { name: 'pwa-192.png', size: 192, input: Buffer.from(logoSvg) },
  { name: 'pwa-512.png', size: 512, input: Buffer.from(logoSvg) },
  { name: 'pwa-maskable-512.png', size: 512, input: maskableSvg },
];

for (const { name, size, input } of outputs) {
  await sharp(input).resize(size, size).png({ compressionLevel: 9 }).toFile(path.join(publicDir, name));
  process.stdout.write(`Generated public/${name} (${size}×${size})\n`);
}
