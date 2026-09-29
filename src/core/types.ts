import * as THREE from 'three';

export type ToolType =
  | 'brush'
  | 'eraser'
  | 'eyedropper'
  | 'bucket'
  | 'clone-stamp'
  | 'smudge'
  | 'blur'
  | 'sharpen'
  | 'island-select'
  | 'pan';

export type BlendMode =
  | 'source-over'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'lighter'
  | 'darken'
  | 'color-dodge';

export type ShadingMode = 'textured' | 'wireframe-textured' | 'wireframe-only' | 'unlit';

export type LightingPreset = 'studio' | 'sunlight' | 'soft-ambient';

export interface UVPoint {
  u: number;
  v: number;
}

export interface UVTriangle {
  triangleIndex: number;
  uvs: [UVPoint, UVPoint, UVPoint];
  islandId: number;
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
}

export interface UVIsland {
  id: number;
  triangleIndices: number[];
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
  pixelAreaEstimate?: number;
}

export interface UVAnalysis {
  islands: Map<number, UVIsland>;
  triangles: UVTriangle[];
  wireframeCanvas: HTMLCanvasElement;
  wireframeDirty: boolean;
  totalTriangles: number;
  totalVertices: number;
}

export interface BrushSettings {
  size: number; // in pixels, e.g. 1 - 200
  opacity: number; // 0 - 1
  hardness: number; // 0 - 1 (0 = airbrush, 1 = hard edge)
  color: string; // hex string e.g. #ff0055
  blendMode?: BlendMode; // globalCompositeOperation
  brushType?: 'soft-round' | 'freehand-ink'; // soft-round or perfect-freehand outline
  spacing?: number; // dab distance ratio (0.05 - 0.5, default 0.15)
  smoothing?: number; // 0 - 1 (stabilization)
  cloneSource?: { x: number; y: number } | null;
}

export interface ColorAdjustmentOptions {
  brightness: number; // -100 to 100 (0 = normal)
  contrast: number;   // -100 to 100 (0 = normal)
  saturation: number; // -100 to 100 (0 = normal)
  hue: number;        // -180 to 180 (0 = normal)
  invert?: boolean;
}

export type TextureFilterType = 'sharpen' | 'blur' | 'seam-bleed' | 'color-adjust';

export interface ModelData {
  root: THREE.Group;
  mesh: THREE.Mesh;
  geometry: THREE.BufferGeometry;
  material: THREE.MeshStandardMaterial | THREE.MeshBasicMaterial;
  textureCanvas: HTMLCanvasElement;
  textureCtx: CanvasRenderingContext2D;
  canvasTexture: THREE.CanvasTexture;
  uvAnalysis: UVAnalysis;
  modelName: string;
  hasTextureMap?: boolean;
  textureDimensions?: { width: number; height: number };
}
