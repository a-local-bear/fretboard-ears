#!/usr/bin/env node
// Draws the app icon (the mascot on an amber tile) and writes
//   public/img/icon.svg            favicon / manifest icon
//   public/img/icon-{180,192,512}.png   home-screen icons
// The PNGs are rasterised with the small SVG renderer from the test suite, so
// no image tools need to be installed.
//
// Usage: node tools/build-app-icons.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFakeDom, serialize } from '../tests/support/fake-dom.mjs';
import { renderSvg, encodePng } from '../tests/support/raster.mjs';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'img');
installFakeDom();
const { s } = await import('../public/js/dom.js');
const { PICK_PATH } = await import('../public/js/ui.js');

function icon({ rounded }) {
  return s('svg', { viewBox: '0 0 512 512' },
    s('rect', { width: 512, height: 512, rx: rounded ? 112 : 0, fill: '#f6a431' }),
    s('g', { transform: 'translate(96 62) scale(3.2)' },
      s('path', { d: PICK_PATH, fill: '#c97a0a', transform: 'translate(0 6)' }),
      s('path', { d: PICK_PATH, fill: '#fff7e8' }),
      s('ellipse', { cx: 36, cy: 44, rx: 8, ry: 10, fill: '#2a251f' }),
      s('ellipse', { cx: 64, cy: 44, rx: 8, ry: 10, fill: '#2a251f' }),
      s('circle', { cx: 38, cy: 41, r: 3, fill: '#fff7e8' }),
      s('circle', { cx: 66, cy: 41, r: 3, fill: '#fff7e8' }),
      s('path', { d: 'M38 66Q50 78 62 66', fill: 'none', stroke: '#2a251f', 'stroke-width': 5, 'stroke-linecap': 'round' })));
}

fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'icon.svg'), serialize(icon({ rounded: true })) + '\n');
for (const size of [180, 192, 512]) {
  // home-screen icons are full-bleed squares; the operating system rounds the corners itself
  const png = encodePng(renderSvg(icon({ rounded: false }), { scale: size / 512, background: '#f6a431' }));
  fs.writeFileSync(path.join(out, `icon-${size}.png`), png);
  console.log(`icon-${size}.png  ${png.length} bytes`);
}
console.log('icon.svg written');
