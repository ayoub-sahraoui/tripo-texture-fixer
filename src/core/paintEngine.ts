import { BrushSettings, ToolType, ColorAdjustmentOptions } from './types';
import { getStroke } from 'perfect-freehand';
import {
  dilateUVSeams,
  applySharpen,
  applyBlur,
  applyColorAdjustments,
} from './textureFilters';

function hexToRgba(hex: string, alpha: number): string {
  try {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(255, 255, 255, ${alpha})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return `rgba(255, 255, 255, ${alpha})`;
  }
}

function getSvgPathFromStroke(stroke: number[][]): string {
  if (!stroke.length) return '';
  const d: string[] = [];
  const [p0, ...rest] = stroke;
  d.push(`M ${p0[0].toFixed(2)} ${p0[1].toFixed(2)}`);
  for (let i = 0; i < rest.length; i++) {
    const [x, y] = rest[i];
    d.push(`L ${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  d.push('Z');
  return d.join(' ');
}

interface CachedStamp {
  canvas: HTMLCanvasElement;
  radius: number;
}

export class PaintEngine {
  private baseCanvas: HTMLCanvasElement;
  private baseCtx: CanvasRenderingContext2D;

  private paintCanvas: HTMLCanvasElement;
  private paintCtx: CanvasRenderingContext2D;

  // Active stroke buffer - solves opacity stacking and enables blend modes
  private strokeCanvas: HTMLCanvasElement;
  private strokeCtx: CanvasRenderingContext2D;

  private outputCanvas: HTMLCanvasElement;
  private outputCtx: CanvasRenderingContext2D;

  private width: number;
  private height: number;

  private isDrawing = false;
  private lastX = 0;
  private lastY = 0;
  private strokeStartPos: { x: number; y: number } | null = null;
  private currentTool: ToolType = 'brush';
  private currentSettings: BrushSettings | null = null;

  // Freehand points buffer: [x, y, pressure]
  private freehandPoints: [number, number, number][] = [];

  // Cached dab stamps for 120 FPS high-precision drawing
  private stampCache = new Map<string, CachedStamp>();

  // Smudge buffer
  private smudgeCanvas: HTMLCanvasElement;
  private smudgeCtx: CanvasRenderingContext2D;

  // History stack for Undo/Redo (stored as ImageData of paint layer and base layer)
  private undoStack: { paint: ImageData; base: ImageData }[] = [];
  private redoStack: { paint: ImageData; base: ImageData }[] = [];
  private maxHistory = 30;

  private activeMaskPath: Path2D | null = null;
  private onTextureUpdate?: (canvas: HTMLCanvasElement) => void;

  constructor(
    width: number,
    height: number,
    initialImage?: CanvasImageSource,
    onTextureUpdate?: (canvas: HTMLCanvasElement) => void
  ) {
    this.width = width;
    this.height = height;
    this.onTextureUpdate = onTextureUpdate;

    this.baseCanvas = document.createElement('canvas');
    this.baseCanvas.width = width;
    this.baseCanvas.height = height;
    this.baseCtx = this.baseCanvas.getContext('2d', { willReadFrequently: true })!;

    this.paintCanvas = document.createElement('canvas');
    this.paintCanvas.width = width;
    this.paintCanvas.height = height;
    this.paintCtx = this.paintCanvas.getContext('2d', { willReadFrequently: true })!;

    this.strokeCanvas = document.createElement('canvas');
    this.strokeCanvas.width = width;
    this.strokeCanvas.height = height;
    this.strokeCtx = this.strokeCanvas.getContext('2d', { willReadFrequently: true })!;

    this.outputCanvas = document.createElement('canvas');
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;
    this.outputCtx = this.outputCanvas.getContext('2d', { willReadFrequently: true })!;

    this.smudgeCanvas = document.createElement('canvas');
    this.smudgeCanvas.width = 128;
    this.smudgeCanvas.height = 128;
    this.smudgeCtx = this.smudgeCanvas.getContext('2d', { willReadFrequently: true })!;

    if (initialImage) {
      this.setBaseImage(initialImage);
    } else {
      this.clearBaseWithColor('#808080');
    }

    this.saveState();
  }

  public getOutputCanvas(): HTMLCanvasElement {
    return this.outputCanvas;
  }

  public getWidth(): number {
    return this.width;
  }

  public getHeight(): number {
    return this.height;
  }

  public resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;

    this.baseCanvas.width = width;
    this.baseCanvas.height = height;
    this.paintCanvas.width = width;
    this.paintCanvas.height = height;
    this.strokeCanvas.width = width;
    this.strokeCanvas.height = height;
    this.outputCanvas.width = width;
    this.outputCanvas.height = height;

    this.stampCache.clear();
    this.undoStack = [];
    this.redoStack = [];
    this.updateOutput();
  }

  public setBaseImage(source: CanvasImageSource): void {
    this.baseCtx.clearRect(0, 0, this.width, this.height);
    this.baseCtx.drawImage(source, 0, 0, this.width, this.height);
    this.clearPaintLayer();
    this.updateOutput();
  }

  public clearBaseWithColor(color: string): void {
    this.baseCtx.fillStyle = color;
    this.baseCtx.fillRect(0, 0, this.width, this.height);
    this.clearPaintLayer();
    this.updateOutput();
  }

  public clearPaintLayer(): void {
    this.saveState();
    this.paintCtx.clearRect(0, 0, this.width, this.height);
    this.strokeCtx.clearRect(0, 0, this.width, this.height);
    this.updateOutput();
  }

  public setActiveMask(mask: Path2D | null): void {
    this.activeMaskPath = mask;
  }

  public getActiveMask(): Path2D | null {
    return this.activeMaskPath;
  }

  private updateOutput(includeActiveStroke = false): void {
    this.outputCtx.clearRect(0, 0, this.width, this.height);
    this.outputCtx.drawImage(this.baseCanvas, 0, 0);
    this.outputCtx.drawImage(this.paintCanvas, 0, 0);

    if (includeActiveStroke && this.currentSettings && this.isDrawing) {
      this.outputCtx.save();
      if (this.currentTool === 'eraser') {
        this.outputCtx.globalCompositeOperation = 'destination-out';
        this.outputCtx.globalAlpha = this.currentSettings.opacity;
      } else {
        this.outputCtx.globalCompositeOperation =
          this.currentSettings.blendMode || 'source-over';
        this.outputCtx.globalAlpha = this.currentSettings.opacity;
      }
      this.outputCtx.drawImage(this.strokeCanvas, 0, 0);
      this.outputCtx.restore();
    }

    if (this.onTextureUpdate) {
      this.onTextureUpdate(this.outputCanvas);
    }
  }

  private saveState(): void {
    const paintData = this.paintCtx.getImageData(0, 0, this.width, this.height);
    const baseData = this.baseCtx.getImageData(0, 0, this.width, this.height);
    this.undoStack.push({ paint: paintData, base: baseData });
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  public canUndo(): boolean {
    return this.undoStack.length > 1;
  }

  public canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  public undo(): void {
    if (!this.canUndo()) return;
    const current = this.undoStack.pop()!;
    this.redoStack.push(current);

    const prev = this.undoStack[this.undoStack.length - 1];
    if (prev) {
      this.paintCtx.putImageData(prev.paint, 0, 0);
      this.baseCtx.putImageData(prev.base, 0, 0);
      this.strokeCtx.clearRect(0, 0, this.width, this.height);
      this.updateOutput();
    }
  }

  public redo(): void {
    if (!this.canRedo()) return;
    const next = this.redoStack.pop()!;
    this.undoStack.push(next);
    this.paintCtx.putImageData(next.paint, 0, 0);
    this.baseCtx.putImageData(next.base, 0, 0);
    this.strokeCtx.clearRect(0, 0, this.width, this.height);
    this.updateOutput();
  }

  /**
   * Retrieves or creates an offscreen cached brush dab stamp for 120 FPS blitting
   */
  private getOrCreateStamp(
    radius: number,
    hardness: number,
    color: string,
    isEraser: boolean
  ): CachedStamp {
    const rInt = Math.max(1, Math.round(radius));
    const hKey = Math.round(hardness * 20);
    const key = `${color}_${rInt}_${hKey}_${isEraser ? 1 : 0}`;

    let stamp = this.stampCache.get(key);
    if (stamp) return stamp;

    const diameter = rInt * 2;
    const pad = 4;
    const sCanvas = document.createElement('canvas');
    sCanvas.width = diameter + pad * 2;
    sCanvas.height = diameter + pad * 2;
    const sCtx = sCanvas.getContext('2d')!;

    const cx = rInt + pad;
    const cy = rInt + pad;

    if (hardness >= 0.95) {
      sCtx.beginPath();
      sCtx.arc(cx, cy, rInt, 0, Math.PI * 2);
      sCtx.fillStyle = isEraser ? '#000000' : color;
      sCtx.fill();
    } else {
      const grad = sCtx.createRadialGradient(
        cx,
        cy,
        rInt * Math.max(0.01, hardness),
        cx,
        cy,
        rInt
      );
      if (isEraser) {
        grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      } else {
        grad.addColorStop(0, hexToRgba(color, 1));
        grad.addColorStop(1, hexToRgba(color, 0));
      }
      sCtx.beginPath();
      sCtx.arc(cx, cy, rInt, 0, Math.PI * 2);
      sCtx.fillStyle = grad;
      sCtx.fill();
    }

    stamp = { canvas: sCanvas, radius: rInt };
    this.stampCache.set(key, stamp);
    return stamp;
  }

  public startStroke(
    x: number,
    y: number,
    settings: BrushSettings,
    toolOrEraser: boolean | ToolType = 'brush',
    pressure = 0.5
  ): void {
    this.isDrawing = true;
    this.lastX = x;
    this.lastY = y;
    this.strokeStartPos = { x, y };
    this.currentSettings = { ...settings };

    if (typeof toolOrEraser === 'boolean') {
      this.currentTool = toolOrEraser ? 'eraser' : 'brush';
    } else {
      this.currentTool = toolOrEraser;
    }

    this.strokeCtx.clearRect(0, 0, this.width, this.height);

    if (this.currentSettings.brushType === 'freehand-ink') {
      this.freehandPoints = [[x, y, pressure]];
      this.renderFreehandPolygon();
    } else if (this.currentTool === 'smudge') {
      this.sampleSmudge(x, y, settings.size / 2);
    } else if (this.currentTool === 'blur' || this.currentTool === 'sharpen') {
      this.applyLocalFilter(x, y, settings.size / 2, this.currentTool);
    } else {
      this.drawDab(x, y, settings, this.currentTool === 'eraser', pressure);
    }

    this.updateOutput(true);
  }

  public continueStroke(
    x: number,
    y: number,
    settings: BrushSettings,
    toolOrEraser: boolean | ToolType = 'brush',
    pressure = 0.5
  ): void {
    if (!this.isDrawing) return;

    if (typeof toolOrEraser === 'boolean') {
      this.currentTool = toolOrEraser ? 'eraser' : 'brush';
    } else {
      this.currentTool = toolOrEraser;
    }

    if (this.currentSettings?.brushType === 'freehand-ink') {
      this.freehandPoints.push([x, y, pressure]);
      this.renderFreehandPolygon();
      this.updateOutput(true);
      this.lastX = x;
      this.lastY = y;
      return;
    }

    const dx = x - this.lastX;
    const dy = y - this.lastY;
    const dist = Math.hypot(dx, dy);

    // Spacing ratio: default 0.15 * brush size
    const spacingRatio = Math.max(0.05, Math.min(0.5, settings.spacing ?? 0.15));
    const step = Math.max(1, settings.size * spacingRatio);

    if (dist >= step) {
      const count = Math.ceil(dist / step);
      for (let i = 1; i <= count; i++) {
        const t = i / count;
        const curX = this.lastX + dx * t;
        const curY = this.lastY + dy * t;

        if (this.currentTool === 'clone-stamp') {
          this.drawCloneDab(curX, curY, settings);
        } else if (this.currentTool === 'smudge') {
          this.applySmudgeStep(curX, curY, settings.size / 2);
        } else if (this.currentTool === 'blur' || this.currentTool === 'sharpen') {
          this.applyLocalFilter(curX, curY, settings.size / 2, this.currentTool);
        } else {
          this.drawDab(curX, curY, settings, this.currentTool === 'eraser', pressure);
        }
      }
      this.lastX = x;
      this.lastY = y;
      this.updateOutput(true);
    }
  }

  public endStroke(): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    // Save previous state for undo before committing
    this.saveState();

    // Commit active stroke buffer to paintCanvas
    const settings = this.currentSettings;
    if (settings) {
      this.paintCtx.save();
      if (this.activeMaskPath) {
        this.paintCtx.clip(this.activeMaskPath);
      }

      if (this.currentTool === 'eraser') {
        this.paintCtx.globalCompositeOperation = 'destination-out';
        this.paintCtx.globalAlpha = settings.opacity;
      } else {
        this.paintCtx.globalCompositeOperation =
          settings.blendMode || 'source-over';
        this.paintCtx.globalAlpha = settings.opacity;
      }

      this.paintCtx.drawImage(this.strokeCanvas, 0, 0);
      this.paintCtx.restore();
    }

    this.strokeCtx.clearRect(0, 0, this.width, this.height);
    this.freehandPoints = [];
    this.strokeStartPos = null;
    this.updateOutput(false);
  }

  private drawDab(
    x: number,
    y: number,
    settings: BrushSettings,
    isEraser = false,
    pressure = 0.5
  ): void {
    const ctx = this.strokeCtx;
    ctx.save();

    if (this.activeMaskPath) {
      ctx.clip(this.activeMaskPath);
    }

    // Dynamic radius with pressure scaling if available
    let radius = Math.max(1, settings.size / 2);
    if (pressure > 0) {
      radius = radius * (0.6 + pressure * 0.8);
    }

    const stamp = this.getOrCreateStamp(
      radius,
      settings.hardness,
      settings.color,
      isEraser
    );

    const pad = 4;
    ctx.drawImage(stamp.canvas, x - stamp.radius - pad, y - stamp.radius - pad);
    ctx.restore();
  }

  /**
   * Renders smooth polygon outline using perfect-freehand
   */
  private renderFreehandPolygon(): void {
    if (!this.currentSettings || this.freehandPoints.length < 2) return;

    const stroke = getStroke(this.freehandPoints, {
      size: this.currentSettings.size,
      thinning: 0.5,
      smoothing: this.currentSettings.smoothing ?? 0.5,
      streamline: 0.5,
    });

    const pathData = getSvgPathFromStroke(stroke);
    if (!pathData) return;

    const ctx = this.strokeCtx;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.save();

    if (this.activeMaskPath) {
      ctx.clip(this.activeMaskPath);
    }

    const path = new Path2D(pathData);
    ctx.fillStyle = this.currentTool === 'eraser' ? '#000000' : this.currentSettings.color;
    ctx.fill(path);
    ctx.restore();
  }

  /**
   * Clone Stamp: transfers pixels from cloneSource offset to destination dab
   */
  private drawCloneDab(x: number, y: number, settings: BrushSettings): void {
    if (!settings.cloneSource || !this.strokeStartPos) return;

    const deltaX = settings.cloneSource.x - this.strokeStartPos.x;
    const deltaY = settings.cloneSource.y - this.strokeStartPos.y;
    const srcX = x + deltaX;
    const srcY = y + deltaY;

    const radius = Math.max(1, Math.round(settings.size / 2));
    const ctx = this.strokeCtx;
    ctx.save();

    if (this.activeMaskPath) {
      ctx.clip(this.activeMaskPath);
    }

    // Circular clip
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(
      this.outputCanvas,
      srcX - radius,
      srcY - radius,
      radius * 2,
      radius * 2,
      x - radius,
      y - radius,
      radius * 2,
      radius * 2
    );

    ctx.restore();
  }

  /**
   * Smudge: samples and pulls colors forward along stroke path
   */
  private sampleSmudge(x: number, y: number, radius: number): void {
    const r = Math.max(2, Math.round(radius));
    const d = r * 2;
    if (this.smudgeCanvas.width !== d) {
      this.smudgeCanvas.width = d;
      this.smudgeCanvas.height = d;
    }
    this.smudgeCtx.clearRect(0, 0, d, d);
    this.smudgeCtx.drawImage(
      this.outputCanvas,
      x - r,
      y - r,
      d,
      d,
      0,
      0,
      d,
      d
    );
  }

  private applySmudgeStep(x: number, y: number, radius: number): void {
    const r = Math.max(2, Math.round(radius));

    const ctx = this.strokeCtx;
    ctx.save();
    if (this.activeMaskPath) {
      ctx.clip(this.activeMaskPath);
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = 0.45;
    ctx.drawImage(this.smudgeCanvas, x - r, y - r);
    ctx.restore();

    // Re-sample at new location for continuous pulling
    this.sampleSmudge(x, y, radius);
  }

  /**
   * Localized Blur / Sharpen Brush Step
   */
  private applyLocalFilter(
    x: number,
    y: number,
    radius: number,
    filter: 'blur' | 'sharpen'
  ): void {
    const r = Math.max(3, Math.round(radius));
    const minX = Math.max(0, Math.floor(x - r));
    const minY = Math.max(0, Math.floor(y - r));
    const maxX = Math.min(this.width, Math.ceil(x + r));
    const maxY = Math.min(this.height, Math.ceil(y + r));
    const w = maxX - minX;
    const h = maxY - minY;
    if (w <= 2 || h <= 2) return;

    // Temporary patch canvas
    const pCanvas = document.createElement('canvas');
    pCanvas.width = w;
    pCanvas.height = h;
    const pCtx = pCanvas.getContext('2d')!;
    pCtx.drawImage(this.paintCanvas, minX, minY, w, h, 0, 0, w, h);

    if (filter === 'blur') {
      applyBlur(pCanvas, 2);
    } else {
      applySharpen(pCanvas, 1.2);
    }

    this.paintCtx.save();
    if (this.activeMaskPath) {
      this.paintCtx.clip(this.activeMaskPath);
    }
    this.paintCtx.beginPath();
    this.paintCtx.arc(x, y, r, 0, Math.PI * 2);
    this.paintCtx.clip();
    this.paintCtx.drawImage(pCanvas, minX, minY);
    this.paintCtx.restore();
  }

  public pickColor(x: number, y: number): string {
    const ix = Math.floor(Math.max(0, Math.min(this.width - 1, x)));
    const iy = Math.floor(Math.max(0, Math.min(this.height - 1, y)));
    const pixel = this.outputCtx.getImageData(ix, iy, 1, 1).data;
    const r = pixel[0].toString(16).padStart(2, '0');
    const g = pixel[1].toString(16).padStart(2, '0');
    const b = pixel[2].toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  public fillIsland(color: string, opacity = 1): void {
    if (!this.activeMaskPath) return;
    this.saveState();

    this.paintCtx.save();
    this.paintCtx.clip(this.activeMaskPath);
    this.paintCtx.globalAlpha = opacity;
    this.paintCtx.fillStyle = color;
    this.paintCtx.fillRect(0, 0, this.width, this.height);
    this.paintCtx.restore();

    this.updateOutput();
  }

  // Texture Enhancement Operations (All fully undoable)
  public bleedUVSeams(padding = 8): void {
    this.saveState();
    dilateUVSeams(this.baseCanvas, padding, this.activeMaskPath);
    this.updateOutput();
  }

  public sharpenTexture(strength = 1.0): void {
    this.saveState();
    applySharpen(this.baseCanvas, strength, this.activeMaskPath);
    this.updateOutput();
  }

  public blurTexture(radius = 2): void {
    this.saveState();
    applyBlur(this.baseCanvas, radius, this.activeMaskPath);
    this.updateOutput();
  }

  public adjustColors(options: ColorAdjustmentOptions): void {
    this.saveState();
    applyColorAdjustments(this.baseCanvas, options, this.activeMaskPath);
    this.updateOutput();
  }

  public exportImage(format: 'image/png' | 'image/jpeg' = 'image/png'): string {
    return this.outputCanvas.toDataURL(format, 0.95);
  }
}
