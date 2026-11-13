#!/usr/bin/env node
// Extracts the handful of music glyph outlines the app needs from the Bravura
// font (SIL OFL 1.1) and writes them to public/js/glyphs.js as SVG path data.
//
// The font is treated purely as data: this file contains its own tiny
// OpenType/CFF reader (no third-party code is executed).  Every extracted
// outline is cross-checked against the bounding boxes published in the
// official SMuFL metadata that ships with the font.
//
// Usage: node tools/build-glyphs.mjs <dir containing Bravura.otf, bravura_metadata.json, glyphnames.json>
//
// Sources:
//   https://github.com/steinbergmedia/bravura  (redist/otf/Bravura.otf, redist/Bravura.json)
//   https://github.com/w3c/smufl               (metadata/glyphnames.json)

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = process.argv[2];
if (!srcDir) {
  console.error('usage: node tools/build-glyphs.mjs <font-data-dir>');
  process.exit(2);
}

const WANTED = [
  'gClef',
  'timeSig0', 'timeSig1', 'timeSig2', 'timeSig3', 'timeSig4', 'timeSig5',
  'timeSig6', 'timeSig7', 'timeSig8', 'timeSig9', 'timeSigCommon',
  'noteheadWhole', 'noteheadHalf', 'noteheadBlack',
  'flag8thUp', 'flag8thDown', 'flag16thUp', 'flag16thDown',
  'accidentalFlat', 'accidentalNatural', 'accidentalSharp',
  'restWhole', 'restHalf', 'restQuarter', 'rest8th', 'rest16th',
  'augmentationDot',
];

// ---------------------------------------------------------------------------
// Minimal OpenType reader
// ---------------------------------------------------------------------------
const buf = readFileSync(join(srcDir, 'Bravura.otf'));
const u8 = (o) => buf.readUInt8(o);
const u16 = (o) => buf.readUInt16BE(o);
const i16 = (o) => buf.readInt16BE(o);
const u32 = (o) => buf.readUInt32BE(o);

const sfnt = buf.toString('latin1', 0, 4);
if (sfnt !== 'OTTO') throw new Error('expected a CFF-flavoured OpenType font, got ' + JSON.stringify(sfnt));
const numTables = u16(4);
const tables = {};
for (let i = 0; i < numTables; i++) {
  const rec = 12 + i * 16;
  tables[buf.toString('latin1', rec, rec + 4)] = { offset: u32(rec + 8), length: u32(rec + 12) };
}
for (const t of ['cmap', 'CFF ', 'head']) if (!tables[t]) throw new Error('missing table ' + t);

const unitsPerEm = u16(tables.head.offset + 18);

// ---- cmap: code point -> glyph id -----------------------------------------
function readCmap() {
  const base = tables.cmap.offset;
  const n = u16(base + 2);
  let best = null;
  for (let i = 0; i < n; i++) {
    const rec = base + 4 + i * 8;
    const platform = u16(rec), encoding = u16(rec + 2), off = base + u32(rec + 4);
    const format = u16(off);
    const unicode = platform === 0 || (platform === 3 && (encoding === 1 || encoding === 10));
    if (!unicode) continue;
    if (format === 12) { best = { format, off }; break; }
    if (format === 4 && !best) best = { format, off };
  }
  if (!best) throw new Error('no usable unicode cmap subtable');
  const { format, off } = best;
  if (format === 12) {
    const nGroups = u32(off + 12);
    const groups = [];
    for (let g = 0; g < nGroups; g++) {
      const p = off + 16 + g * 12;
      groups.push([u32(p), u32(p + 4), u32(p + 8)]);
    }
    return (cp) => {
      for (const [start, end, gid] of groups) if (cp >= start && cp <= end) return gid + (cp - start);
      return 0;
    };
  }
  // format 4
  const segCount = u16(off + 6) / 2;
  const endAt = off + 14, startAt = endAt + segCount * 2 + 2;
  const deltaAt = startAt + segCount * 2, rangeAt = deltaAt + segCount * 2;
  return (cp) => {
    for (let s = 0; s < segCount; s++) {
      const end = u16(endAt + s * 2), start = u16(startAt + s * 2);
      if (cp > end || cp < start) continue;
      const delta = i16(deltaAt + s * 2), ro = u16(rangeAt + s * 2);
      if (ro === 0) return (cp + delta) & 0xffff;
      const g = u16(rangeAt + s * 2 + ro + (cp - start) * 2);
      return g === 0 ? 0 : (g + delta) & 0xffff;
    }
    return 0;
  };
}
const glyphIdFor = readCmap();

// ---- CFF ------------------------------------------------------------------
const cff = tables['CFF '].offset;

function readIndex(at) {
  const count = u16(at);
  if (count === 0) return { items: [], end: at + 2 };
  const offSize = u8(at + 2);
  const readOff = (p) => {
    let v = 0;
    for (let i = 0; i < offSize; i++) v = v * 256 + u8(p + i);
    return v;
  };
  const offsArr = at + 3;
  const dataBase = offsArr + (count + 1) * offSize - 1;
  const items = [];
  let prev = readOff(offsArr);
  for (let i = 1; i <= count; i++) {
    const next = readOff(offsArr + i * offSize);
    items.push([dataBase + prev, dataBase + next]);
    prev = next;
  }
  return { items, end: dataBase + prev };
}

function readDict(start, end) {
  const dict = {};
  let operands = [];
  let p = start;
  while (p < end) {
    const b0 = u8(p++);
    if (b0 <= 21) {
      let op = b0;
      if (b0 === 12) op = 1200 + u8(p++);
      dict[op] = operands;
      operands = [];
    } else if (b0 === 28) { operands.push(i16(p)); p += 2; }
    else if (b0 === 29) { operands.push(buf.readInt32BE(p)); p += 4; }
    else if (b0 === 30) {
      let s = '';
      for (let done = false; !done;) {
        const b = u8(p++);
        for (const nib of [b >> 4, b & 15]) {
          if (nib === 15) { done = true; break; }
          s += ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', 'E', 'E-', '', '-'][nib];
        }
      }
      operands.push(parseFloat(s));
    } else if (b0 >= 32 && b0 <= 246) operands.push(b0 - 139);
    else if (b0 >= 247 && b0 <= 250) operands.push((b0 - 247) * 256 + u8(p++) + 108);
    else if (b0 >= 251 && b0 <= 254) operands.push(-(b0 - 251) * 256 - u8(p++) - 108);
    else throw new Error('bad DICT byte ' + b0);
  }
  return dict;
}

const hdrSize = u8(cff + 2);
const nameIndex = readIndex(cff + hdrSize);
const topIndex = readIndex(nameIndex.end);
const stringIndex = readIndex(topIndex.end);
const gsubrIndex = readIndex(stringIndex.end);
const top = readDict(...topIndex.items[0]);
if (top[1230]) throw new Error('CID-keyed CFF fonts are not supported by this tool');
if ((top[1206] ?? [2])[0] !== 2) throw new Error('only Type 2 charstrings are supported');
const charStrings = readIndex(cff + top[17][0]);
const [privSize, privOff] = top[18];
const priv = readDict(cff + privOff, cff + privOff + privSize);
const lsubrIndex = priv[19] ? readIndex(cff + privOff + priv[19][0]) : { items: [] };

const bias = (n) => (n < 1240 ? 107 : n < 33900 ? 1131 : 32768);
const gBias = bias(gsubrIndex.items.length);
const lBias = bias(lsubrIndex.items.length);

// ---- Type 2 charstring interpreter ----------------------------------------
function outline(gid) {
  const segs = []; // ['M',x,y] ['L',x,y] ['C',x1,y1,x2,y2,x,y] ['Z']
  let stack = [];
  let x = 0, y = 0, nStems = 0, haveWidth = false, open = false, depth = 0, done = false;

  const moveTo = (nx, ny) => { if (open) segs.push(['Z']); x = nx; y = ny; segs.push(['M', x, y]); open = true; };
  const lineTo = (nx, ny) => { x = nx; y = ny; segs.push(['L', x, y]); };
  const curveTo = (x1, y1, x2, y2, nx, ny) => { x = nx; y = ny; segs.push(['C', x1, y1, x2, y2, x, y]); };
  const takeWidth = (extra) => { if (!haveWidth) { if (extra) stack.shift(); haveWidth = true; } };
  const stems = () => { takeWidth(stack.length % 2 === 1); nStems += stack.length >> 1; stack = []; };

  function run(start, end) {
    if (++depth > 10) throw new Error('subr recursion too deep');
    let p = start;
    while (p < end && !done) {
      const b0 = u8(p++);
      if (b0 === 28) { stack.push(i16(p)); p += 2; continue; }
      if (b0 >= 32 && b0 <= 246) { stack.push(b0 - 139); continue; }
      if (b0 >= 247 && b0 <= 250) { stack.push((b0 - 247) * 256 + u8(p++) + 108); continue; }
      if (b0 >= 251 && b0 <= 254) { stack.push(-(b0 - 251) * 256 - u8(p++) - 108); continue; }
      if (b0 === 255) { stack.push(buf.readInt32BE(p) / 65536); p += 4; continue; }
      switch (b0) {
        case 1: case 3: case 18: case 23: stems(); break;
        case 19: case 20: stems(); p += (nStems + 7) >> 3; break;
        case 21: takeWidth(stack.length > 2); moveTo(x + stack[0], y + stack[1]); stack = []; break;
        case 22: takeWidth(stack.length > 1); moveTo(x + stack[0], y); stack = []; break;
        case 4: takeWidth(stack.length > 1); moveTo(x, y + stack[0]); stack = []; break;
        case 5:
          for (let i = 0; i + 1 < stack.length; i += 2) lineTo(x + stack[i], y + stack[i + 1]);
          stack = []; break;
        case 6: case 7: {
          let horiz = b0 === 6;
          for (const d of stack) { if (horiz) lineTo(x + d, y); else lineTo(x, y + d); horiz = !horiz; }
          stack = []; break;
        }
        case 8:
          for (let i = 0; i + 5 < stack.length; i += 6) {
            const x1 = x + stack[i], y1 = y + stack[i + 1], x2 = x1 + stack[i + 2], y2 = y1 + stack[i + 3];
            curveTo(x1, y1, x2, y2, x2 + stack[i + 4], y2 + stack[i + 5]);
          }
          stack = []; break;
        case 24: {
          let i = 0;
          for (; i + 7 < stack.length; i += 6) {
            const x1 = x + stack[i], y1 = y + stack[i + 1], x2 = x1 + stack[i + 2], y2 = y1 + stack[i + 3];
            curveTo(x1, y1, x2, y2, x2 + stack[i + 4], y2 + stack[i + 5]);
          }
          lineTo(x + stack[i], y + stack[i + 1]);
          stack = []; break;
        }
        case 25: {
          let i = 0;
          for (; i + 7 < stack.length; i += 2) lineTo(x + stack[i], y + stack[i + 1]);
          const x1 = x + stack[i], y1 = y + stack[i + 1], x2 = x1 + stack[i + 2], y2 = y1 + stack[i + 3];
          curveTo(x1, y1, x2, y2, x2 + stack[i + 4], y2 + stack[i + 5]);
          stack = []; break;
        }
        case 26: {
          const s = stack; stack = [];
          if (s.length % 2) x += s.shift();
          while (s.length >= 4) {
            const x1 = x, y1 = y + s.shift(), x2 = x1 + s.shift(), y2 = y1 + s.shift();
            curveTo(x1, y1, x2, y2, x2, y2 + s.shift());
          }
          break;
        }
        case 27: {
          const s = stack; stack = [];
          if (s.length % 2) y += s.shift();
          while (s.length >= 4) {
            const x1 = x + s.shift(), y1 = y, x2 = x1 + s.shift(), y2 = y1 + s.shift();
            curveTo(x1, y1, x2, y2, x2 + s.shift(), y2);
          }
          break;
        }
        case 30: case 31: {
          const s = stack; stack = [];
          let vertical = b0 === 30;
          while (s.length >= 4) {
            if (vertical) {
              const x1 = x, y1 = y + s.shift(), x2 = x1 + s.shift(), y2 = y1 + s.shift();
              const nx = x2 + s.shift(), ny = y2 + (s.length === 1 ? s.shift() : 0);
              curveTo(x1, y1, x2, y2, nx, ny);
            } else {
              const x1 = x + s.shift(), y1 = y, x2 = x1 + s.shift(), y2 = y1 + s.shift();
              const ny = y2 + s.shift(), nx = x2 + (s.length === 1 ? s.shift() : 0);
              curveTo(x1, y1, x2, y2, nx, ny);
            }
            vertical = !vertical;
          }
          break;
        }
        case 10: case 29: {
          const local = b0 === 10;
          const idx = stack.pop() + (local ? lBias : gBias);
          const item = (local ? lsubrIndex : gsubrIndex).items[idx];
          if (!item) throw new Error('bad subr index ' + idx);
          run(item[0], item[1]);
          break;
        }
        case 11: depth--; return;
        case 14: takeWidth(stack.length === 1 || stack.length === 5); done = true; break;
        case 12: {
          const b1 = u8(p++);
          const s = stack; stack = [];
          if (b1 === 35) {
            const x1 = x + s[0], y1 = y + s[1], x2 = x1 + s[2], y2 = y1 + s[3], x3 = x2 + s[4], y3 = y2 + s[5];
            curveTo(x1, y1, x2, y2, x3, y3);
            const x4 = x3 + s[6], y4 = y3 + s[7], x5 = x4 + s[8], y5 = y4 + s[9];
            curveTo(x4, y4, x5, y5, x5 + s[10], y5 + s[11]);
          } else if (b1 === 34) {
            const y0 = y;
            const x1 = x + s[0], x2 = x1 + s[1], y2 = y0 + s[2], x3 = x2 + s[3];
            curveTo(x1, y0, x2, y2, x3, y2);
            const x4 = x3 + s[4], x5 = x4 + s[5];
            curveTo(x4, y2, x5, y0, x5 + s[6], y0);
          } else if (b1 === 36) {
            const y0 = y;
            const x1 = x + s[0], y1 = y0 + s[1], x2 = x1 + s[2], y2 = y1 + s[3], x3 = x2 + s[4];
            curveTo(x1, y1, x2, y2, x3, y2);
            const x4 = x3 + s[5], x5 = x4 + s[6], y5 = y2 + s[7];
            curveTo(x4, y2, x5, y5, x5 + s[8], y0);
          } else if (b1 === 37) {
            const x0 = x, y0 = y;
            const x1 = x + s[0], y1 = y + s[1], x2 = x1 + s[2], y2 = y1 + s[3], x3 = x2 + s[4], y3 = y2 + s[5];
            curveTo(x1, y1, x2, y2, x3, y3);
            const x4 = x3 + s[6], y4 = y3 + s[7], x5 = x4 + s[8], y5 = y4 + s[9];
            if (Math.abs(x5 - x0) > Math.abs(y5 - y0)) curveTo(x4, y4, x5, y5, x5 + s[10], y0);
            else curveTo(x4, y4, x5, y5, x0, y5 + s[10]);
          } else {
            throw new Error('unsupported charstring operator 12 ' + b1);
          }
          break;
        }
        default: throw new Error('unsupported charstring operator ' + b0);
      }
    }
    depth--;
  }

  const [s, e] = charStrings.items[gid];
  run(s, e);
  if (open) segs.push(['Z']);
  return segs;
}

// ---- geometry helpers -----------------------------------------------------
function cubicExtrema(p0, p1, p2, p3) {
  // parameter values in (0,1) where the derivative of one coordinate is zero
  const a = -p0 + 3 * p1 - 3 * p2 + p3, b = 2 * (p0 - 2 * p1 + p2), c = p1 - p0;
  const ts = [];
  if (Math.abs(a) < 1e-9) { if (Math.abs(b) > 1e-9) ts.push(-c / b); }
  else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) { const r = Math.sqrt(disc); ts.push((-b + r) / (2 * a), (-b - r) / (2 * a)); }
  }
  return ts.filter((t) => t > 0 && t < 1);
}
const cubicAt = (p0, p1, p2, p3, t) => {
  const m = 1 - t;
  return m * m * m * p0 + 3 * m * m * t * p1 + 3 * m * t * t * p2 + t * t * t * p3;
};
function bboxOf(segs) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, cx = 0, cy = 0;
  const add = (px, py) => { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); };
  for (const s of segs) {
    if (s[0] === 'M' || s[0] === 'L') { add(s[1], s[2]); cx = s[1]; cy = s[2]; }
    else if (s[0] === 'C') {
      for (const t of cubicExtrema(cx, s[1], s[3], s[5])) add(cubicAt(cx, s[1], s[3], s[5], t), cubicAt(cy, s[2], s[4], s[6], t));
      for (const t of cubicExtrema(cy, s[2], s[4], s[6])) add(cubicAt(cx, s[1], s[3], s[5], t), cubicAt(cy, s[2], s[4], s[6], t));
      add(s[5], s[6]); cx = s[5]; cy = s[6];
    }
  }
  return [x0, y0, x1, y1];
}
const fmt = (n) => { const r = Math.round(n * 10) / 10; return Object.is(r, -0) ? '0' : String(r); };
// SVG path data with the y axis flipped (font units are y-up, SVG is y-down)
function toPathData(segs) {
  return segs.map((s) => {
    if (s[0] === 'Z') return 'Z';
    const out = [];
    for (let i = 1; i < s.length; i += 2) out.push(fmt(s[i]) + ' ' + fmt(-s[i + 1]));
    return s[0] + out.join(' ');
  }).join('');
}

// ---------------------------------------------------------------------------
const meta = JSON.parse(readFileSync(join(srcDir, 'bravura_metadata.json'), 'utf8'));
const names = JSON.parse(readFileSync(join(srcDir, 'glyphnames.json'), 'utf8'));
const unitsPerSpace = unitsPerEm / 4; // SMuFL: 1 em = 4 staff spaces

const out = {};
let worst = 0;
for (const name of WANTED) {
  const cp = parseInt(names[name].codepoint.slice(2), 16);
  const gid = glyphIdFor(cp);
  if (!gid) throw new Error(`glyph ${name} (U+${cp.toString(16)}) not found in cmap`);
  const segs = outline(gid);
  const bb = bboxOf(segs).map((v) => v / unitsPerSpace);
  const ref = meta.glyphBBoxes[name];
  const dev = Math.max(
    Math.abs(bb[0] - ref.bBoxSW[0]), Math.abs(bb[1] - ref.bBoxSW[1]),
    Math.abs(bb[2] - ref.bBoxNE[0]), Math.abs(bb[3] - ref.bBoxNE[1]),
  );
  worst = Math.max(worst, dev);
  const flag = dev > 0.01 ? '  <-- MISMATCH' : '';
  console.log(`${name.padEnd(18)} gid ${String(gid).padStart(5)}  segs ${String(segs.length).padStart(3)}  bbox dev ${dev.toFixed(4)} sp${flag}`);
  out[name] = {
    d: toPathData(segs),
    // bounding box in staff spaces, SMuFL orientation (y up): [west, south, east, north]
    box: [ref.bBoxSW[0], ref.bBoxSW[1], ref.bBoxNE[0], ref.bBoxNE[1]],
  };
  const anchors = meta.glyphsWithAnchors[name];
  if (anchors) {
    const keep = {};
    for (const k of ['stemUpSE', 'stemDownNW', 'stemUpNW', 'stemDownSW']) if (anchors[k]) keep[k] = anchors[k];
    if (Object.keys(keep).length) out[name].anchors = keep;
  }
}
if (worst > 0.01) {
  console.error(`\nFAILED: outlines deviate from the published SMuFL bounding boxes (worst ${worst.toFixed(4)} staff spaces).`);
  process.exit(1);
}

const ed = meta.engravingDefaults;
const engraving = {
  staffLine: ed.staffLineThickness, stem: ed.stemThickness, beam: ed.beamThickness, beamGap: ed.beamSpacing,
  ledger: ed.legerLineThickness, ledgerExt: ed.legerLineExtension, thinBar: ed.thinBarlineThickness,
  thickBar: ed.thickBarlineThickness, barGap: ed.thinThickBarlineSeparation,
};

const banner = `// GENERATED by tools/build-glyphs.mjs — do not edit by hand.
//
// Music glyph outlines derived from the Bravura font, version ${meta.fontVersion}.
// Copyright (c) Steinberg Media Technologies GmbH, with Reserved Font Name "Bravura".
// Licensed under the SIL Open Font License 1.1 — see licenses/Bravura-OFL.txt.
//
// Path data is in font units (${unitsPerSpace} units = 1 staff space) with the y axis
// already flipped for SVG; the glyph origin follows the SMuFL registration rules.
`;
const body = `export const UNITS_PER_SPACE = ${unitsPerSpace};\n\n` +
  `export const ENGRAVING = ${JSON.stringify(engraving)};\n\n` +
  `export const GLYPHS = {\n` +
  Object.entries(out).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n') + '\n};\n';
const target = join(here, '..', 'public', 'js', 'glyphs.js');
writeFileSync(target, banner + '\n' + body);
console.log(`\nAll ${WANTED.length} outlines match the SMuFL metadata (worst deviation ${worst.toFixed(4)} sp).`);
console.log('wrote ' + target + ` (${(banner.length + body.length)} bytes)`);
