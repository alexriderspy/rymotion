import { readFileSync } from "node:fs";
import { extname } from "node:path";

// Pixel size of an image file, read from its header so compiling stays
// synchronous and needs no image library. PNG, JPEG, GIF, WebP and SVG.

export interface Size { w: number; h: number }

export function imageSize(path: string): Size {
  const ext = extname(path).toLowerCase();
  const buf = readFileSync(path);
  if (ext === ".svg") {
    const text = buf.toString("utf8", 0, Math.min(buf.length, 4000));
    const vb = text.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    if (vb) return { w: Number(vb[1]), h: Number(vb[2]) };
    const w = text.match(/\swidth\s*=\s*["']([\d.]+)/), h = text.match(/\sheight\s*=\s*["']([\d.]+)/);
    if (w && h) return { w: Number(w[1]), h: Number(h[1]) };
    return { w: 1, h: 1 };
  }
  if (buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.toString("ascii", 0, 3) === "GIF") return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const kind = buf.toString("ascii", 12, 16);
    if (kind === "VP8X") return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
    if (kind === "VP8L") {
      const b = buf.readUInt32LE(21);
      return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff) };
    }
    return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      const len = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker))
        return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  throw new Error(`can't read the size of ${path}; use PNG, JPEG, GIF, WebP or SVG`);
}

export const MEDIA_EXT = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
