import { ColorAdjustmentOptions } from './types';

/**
 * Helper to convert RGB to HSL
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

/**
 * Helper to convert HSL to RGB
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return [r, g, b];
}

/**
 * Creates an in-memory binary mask array indicating which pixels are covered by a Path2D or canvas.
 */
function createMaskArray(
  width: number,
  height: number,
  maskPath?: Path2D | null
): Uint8Array | null {
  if (!maskPath) return null;

  const mCanvas = document.createElement('canvas');
  mCanvas.width = width;
  mCanvas.height = height;
  const mCtx = mCanvas.getContext('2d');
  if (!mCtx) return null;

  mCtx.fillStyle = '#ffffff';
  mCtx.fill(maskPath);

  const imgData = mCtx.getImageData(0, 0, width, height);
  const mask = new Uint8Array(width * height);
  const data = imgData.data;

  for (let i = 0; i < mask.length; i++) {
    mask[i] = data[i * 4 + 3] > 10 ? 1 : 0;
  }

  return mask;
}

/**
 * UV Seam Bleed / Island Margin Dilation:
 * Expands edge pixels outward into empty or transparent margins by N pixels.
 * Completely eliminates black seam artifacts when 3D models are rendered with mipmapping.
 */
export function dilateUVSeams(
  canvas: HTMLCanvasElement,
  padding = 8,
  uvMaskPath?: Path2D | null
): void {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx || width <= 0 || height <= 0) return;

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const totalPixels = width * height;

  const valid = new Uint8Array(totalPixels);
  const mask = createMaskArray(width, height, uvMaskPath);

  // Mark initially valid pixels
  for (let i = 0; i < totalPixels; i++) {
    const a = data[i * 4 + 3];
    if (mask) {
      valid[i] = mask[i] === 1 && a > 10 ? 1 : 0;
    } else {
      valid[i] = a > 10 ? 1 : 0;
    }
  }

  // Iterative dilation passes
  const maxPasses = Math.min(32, Math.max(1, padding));
  let frontier: number[] = [];

  // Find initial frontier (unfilled pixels bordering valid pixels)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (valid[idx]) continue;

      // Check 4-connected neighbors
      if (
        (x > 0 && valid[idx - 1]) ||
        (x < width - 1 && valid[idx + 1]) ||
        (y > 0 && valid[idx - width]) ||
        (y < height - 1 && valid[idx + width])
      ) {
        frontier.push(idx);
      }
    }
  }

  for (let pass = 0; pass < maxPasses && frontier.length > 0; pass++) {
    const nextFrontier: number[] = [];
    const updates: { idx: number; r: number; g: number; b: number; a: number }[] = [];

    for (let i = 0; i < frontier.length; i++) {
      const idx = frontier[i];
      if (valid[idx]) continue;

      const x = idx % width;
      const y = Math.floor(idx / width);

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;

      const neighbors = [
        x > 0 ? idx - 1 : -1,
        x < width - 1 ? idx + 1 : -1,
        y > 0 ? idx - width : -1,
        y < height - 1 ? idx + width : -1,
      ];

      for (const n of neighbors) {
        if (n >= 0 && valid[n]) {
          const off = n * 4;
          rSum += data[off];
          gSum += data[off + 1];
          bSum += data[off + 2];
          count++;
        }
      }

      if (count > 0) {
        updates.push({
          idx,
          r: Math.round(rSum / count),
          g: Math.round(gSum / count),
          b: Math.round(bSum / count),
          a: 255,
        });
      }
    }

    for (const u of updates) {
      const off = u.idx * 4;
      data[off] = u.r;
      data[off + 1] = u.g;
      data[off + 2] = u.b;
      data[off + 3] = u.a;
      valid[u.idx] = 1;

      const x = u.idx % width;
      const y = Math.floor(u.idx / width);

      const neighbors = [
        x > 0 ? u.idx - 1 : -1,
        x < width - 1 ? u.idx + 1 : -1,
        y > 0 ? u.idx - width : -1,
        y < height - 1 ? u.idx + width : -1,
      ];

      for (const n of neighbors) {
        if (n >= 0 && !valid[n]) {
          nextFrontier.push(n);
        }
      }
    }

    frontier = nextFrontier;
  }

  ctx.putImageData(imgData, 0, 0);
}

/**
 * Sharpen / Unsharp Mask Filter:
 * Enhances high-frequency texture details using a 3x3 unsharp convolution kernel.
 */
export function applySharpen(
  canvas: HTMLCanvasElement,
  strength = 1.0,
  maskPath?: Path2D | null
): void {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx || width <= 0 || height <= 0) return;

  const src = ctx.getImageData(0, 0, width, height);
  const dst = ctx.createImageData(width, height);
  const sData = src.data;
  const dData = dst.data;
  dData.set(sData);

  const mask = createMaskArray(width, height, maskPath);
  const k = Math.min(2.0, Math.max(0.1, strength * 0.35));
  const centerWeight = 1 + 4 * k;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (mask && mask[idx] === 0) continue;

      const off = idx * 4;
      const offUp = (idx - width) * 4;
      const offDown = (idx + width) * 4;
      const offLeft = (idx - 1) * 4;
      const offRight = (idx + 1) * 4;

      for (let c = 0; c < 3; c++) {
        const val =
          sData[off + c] * centerWeight -
          (sData[offUp + c] +
            sData[offDown + c] +
            sData[offLeft + c] +
            sData[offRight + c]) *
            k;
        dData[off + c] = Math.min(255, Math.max(0, Math.round(val)));
      }
    }
  }

  ctx.putImageData(dst, 0, 0);
}

/**
 * Fast 2-pass separable Box/Gaussian Blur Filter:
 * Smooths out artifacts and noise.
 */
export function applyBlur(
  canvas: HTMLCanvasElement,
  radius = 2,
  maskPath?: Path2D | null
): void {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx || width <= 0 || height <= 0) return;

  const r = Math.min(10, Math.max(1, Math.round(radius)));
  const src = ctx.getImageData(0, 0, width, height);
  const dst = ctx.createImageData(width, height);
  const sData = src.data;
  const dData = dst.data;
  dData.set(sData);

  const mask = createMaskArray(width, height, maskPath);
  const temp = new Float32Array(width * height * 4);

  // Horizontal Pass
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const tOff = idx * 4;

      if (mask && mask[idx] === 0) {
        temp[tOff] = sData[tOff];
        temp[tOff + 1] = sData[tOff + 1];
        temp[tOff + 2] = sData[tOff + 2];
        temp[tOff + 3] = sData[tOff + 3];
        continue;
      }

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      let count = 0;

      for (let dx = -r; dx <= r; dx++) {
        const nx = Math.min(width - 1, Math.max(0, x + dx));
        const nOff = (y * width + nx) * 4;
        rSum += sData[nOff];
        gSum += sData[nOff + 1];
        bSum += sData[nOff + 2];
        aSum += sData[nOff + 3];
        count++;
      }

      temp[tOff] = rSum / count;
      temp[tOff + 1] = gSum / count;
      temp[tOff + 2] = bSum / count;
      temp[tOff + 3] = aSum / count;
    }
  }

  // Vertical Pass
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const idx = y * width + x;
      const dOff = idx * 4;

      if (mask && mask[idx] === 0) continue;

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let aSum = 0;
      let count = 0;

      for (let dy = -r; dy <= r; dy++) {
        const ny = Math.min(height - 1, Math.max(0, y + dy));
        const nOff = (ny * width + x) * 4;
        rSum += temp[nOff];
        gSum += temp[nOff + 1];
        bSum += temp[nOff + 2];
        aSum += temp[nOff + 3];
        count++;
      }

      dData[dOff] = Math.round(rSum / count);
      dData[dOff + 1] = Math.round(gSum / count);
      dData[dOff + 2] = Math.round(bSum / count);
      dData[dOff + 3] = Math.round(aSum / count);
    }
  }

  ctx.putImageData(dst, 0, 0);
}

/**
 * Color Adjustments (Brightness, Contrast, Saturation, Hue, Invert):
 * Adjusts color properties globally or isolated to a selected UV island.
 */
export function applyColorAdjustments(
  canvas: HTMLCanvasElement,
  options: ColorAdjustmentOptions,
  maskPath?: Path2D | null
): void {
  const width = canvas.width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  if (!ctx || width <= 0 || height <= 0) return;

  const { brightness, contrast, saturation, hue, invert } = options;
  if (
    brightness === 0 &&
    contrast === 0 &&
    saturation === 0 &&
    hue === 0 &&
    !invert
  ) {
    return;
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  const mask = createMaskArray(width, height, maskPath);

  const bOffset = (brightness / 100) * 255;
  const contrastFactor =
    contrast === 0 ? 1 : (259 * (contrast + 255)) / (255 * (259 - contrast));
  const satScale = 1 + saturation / 100;

  for (let i = 0; i < width * height; i++) {
    if (mask && mask[i] === 0) continue;

    const off = i * 4;
    let r = data[off];
    let g = data[off + 1];
    let b = data[off + 2];

    // Invert
    if (invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    // Brightness
    if (brightness !== 0) {
      r += bOffset;
      g += bOffset;
      b += bOffset;
    }

    // Contrast
    if (contrast !== 0) {
      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;
    }

    // Clamp after basic adjustments
    r = Math.min(255, Math.max(0, r));
    g = Math.min(255, Math.max(0, g));
    b = Math.min(255, Math.max(0, b));

    // Hue and Saturation
    if (hue !== 0 || saturation !== 0) {
      const [h, s, l] = rgbToHsl(r, g, b);
      const newH = h + hue;
      const newS = Math.min(1, Math.max(0, s * satScale));
      const [nr, ng, nb] = hslToRgb(newH, newS, l);
      r = nr;
      g = ng;
      b = nb;
    }

    data[off] = Math.round(r);
    data[off + 1] = Math.round(g);
    data[off + 2] = Math.round(b);
  }

  ctx.putImageData(imgData, 0, 0);
}
