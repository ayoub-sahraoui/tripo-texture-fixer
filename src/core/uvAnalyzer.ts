import * as THREE from 'three';
import { UVAnalysis, UVIsland, UVPoint, UVTriangle } from './types';

// Helper for Disjoint-Set Union-Find
class DisjointSet {
  parent: Int32Array;
  rank: Int32Array;

  constructor(size: number) {
    this.parent = new Int32Array(size);
    this.rank = new Int32Array(size);
    for (let i = 0; i < size; i++) {
      this.parent[i] = i;
    }
  }

  find(i: number): number {
    let root = i;
    while (root !== this.parent[root]) {
      root = this.parent[root];
    }
    let curr = i;
    while (curr !== root) {
      const nxt = this.parent[curr];
      this.parent[curr] = root;
      curr = nxt;
    }
    return root;
  }

  union(i: number, j: number): void {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      if (this.rank[rootI] < this.rank[rootJ]) {
        this.parent[rootI] = rootJ;
      } else if (this.rank[rootI] > this.rank[rootJ]) {
        this.parent[rootJ] = rootI;
      } else {
        this.parent[rootJ] = rootI;
        this.rank[rootI]++;
      }
    }
  }
}

function coordKey(u: number, v: number): string {
  // Round to 4 decimal places to catch floating point edge matches
  return `${Math.round(u * 10000)}_${Math.round(v * 10000)}`;
}

function edgeKey(k1: string, k2: string): string {
  return k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;
}

export function analyzeUVs(
  geometry: THREE.BufferGeometry,
  textureWidth = 1024,
  textureHeight = 1024
): UVAnalysis {
  const uvAttr = geometry.attributes.uv;
  if (!uvAttr) {
    console.warn('Geometry has no UV coordinates');
    const emptyCanvas = document.createElement('canvas');
    emptyCanvas.width = textureWidth;
    emptyCanvas.height = textureHeight;
    return {
      islands: new Map(),
      triangles: [],
      wireframeCanvas: emptyCanvas,
      wireframeDirty: false,
      totalTriangles: 0,
      totalVertices: geometry.attributes.position ? geometry.attributes.position.count : 0,
    };
  }

  const indexAttr = geometry.index;
  const totalTriangles = indexAttr ? indexAttr.count / 3 : uvAttr.count / 3;
  const totalVertices = geometry.attributes.position ? geometry.attributes.position.count : uvAttr.count;

  const triangles: UVTriangle[] = [];
  const edgeToTriangle = new Map<string, number>();
  const ds = new DisjointSet(totalTriangles);

  // 1. Parse all triangles and build edge connectivity
  for (let t = 0; t < totalTriangles; t++) {
    let i0: number, i1: number, i2: number;
    if (indexAttr) {
      i0 = indexAttr.getX(t * 3);
      i1 = indexAttr.getX(t * 3 + 1);
      i2 = indexAttr.getX(t * 3 + 2);
    } else {
      i0 = t * 3;
      i1 = t * 3 + 1;
      i2 = t * 3 + 2;
    }

    const p0: UVPoint = { u: uvAttr.getX(i0), v: uvAttr.getY(i0) };
    const p1: UVPoint = { u: uvAttr.getX(i1), v: uvAttr.getY(i1) };
    const p2: UVPoint = { u: uvAttr.getX(i2), v: uvAttr.getY(i2) };

    const minU = Math.min(p0.u, p1.u, p2.u);
    const maxU = Math.max(p0.u, p1.u, p2.u);
    const minV = Math.min(p0.v, p1.v, p2.v);
    const maxV = Math.max(p0.v, p1.v, p2.v);

    triangles.push({
      triangleIndex: t,
      uvs: [p0, p1, p2],
      islandId: 0,
      minU,
      maxU,
      minV,
      maxV,
    });

    const k0 = coordKey(p0.u, p0.v);
    const k1 = coordKey(p1.u, p1.v);
    const k2 = coordKey(p2.u, p2.v);

    const edges = [
      edgeKey(k0, k1),
      edgeKey(k1, k2),
      edgeKey(k2, k0),
    ];

    for (const e of edges) {
      const existing = edgeToTriangle.get(e);
      if (existing !== undefined) {
        ds.union(existing, t);
      } else {
        edgeToTriangle.set(e, t);
      }
    }
  }

  // 2. Group into islands
  const islandMap = new Map<number, UVIsland>();
  const rootToIslandId = new Map<number, number>();
  let nextIslandId = 1;

  for (let t = 0; t < totalTriangles; t++) {
    const root = ds.find(t);
    let islandId = rootToIslandId.get(root);
    if (!islandId) {
      islandId = nextIslandId++;
      rootToIslandId.set(root, islandId);
      islandMap.set(islandId, {
        id: islandId,
        triangleIndices: [],
        minU: 1,
        maxU: 0,
        minV: 1,
        maxV: 0,
        pixelAreaEstimate: 0,
      });
    }

    const tri = triangles[t];
    tri.islandId = islandId;
    const island = islandMap.get(islandId)!;
    island.triangleIndices.push(t);
    island.minU = Math.min(island.minU, tri.minU);
    island.maxU = Math.max(island.maxU, tri.maxU);
    island.minV = Math.min(island.minV, tri.minV);
    island.maxV = Math.max(island.maxV, tri.maxV);

    // Approximate triangle area in UV space
    const ax = tri.uvs[1].u - tri.uvs[0].u;
    const ay = tri.uvs[1].v - tri.uvs[0].v;
    const bx = tri.uvs[2].u - tri.uvs[0].u;
    const by = tri.uvs[2].v - tri.uvs[0].v;
    const area = Math.abs(ax * by - ay * bx) * 0.5;
    island.pixelAreaEstimate = (island.pixelAreaEstimate || 0) + area * textureWidth * textureHeight;
  }

  // 3. Render initial Wireframe Canvas
  const wireframeCanvas = document.createElement('canvas');
  wireframeCanvas.width = textureWidth;
  wireframeCanvas.height = textureHeight;
  renderWireframe(wireframeCanvas, triangles, 'rgba(255, 255, 255, 0.75)', 1.0);

  return {
    islands: islandMap,
    triangles,
    wireframeCanvas,
    wireframeDirty: false,
    totalTriangles,
    totalVertices,
  };
}

export function renderWireframe(
  canvas: HTMLCanvasElement,
  triangles: UVTriangle[],
  strokeColor = 'rgba(255, 255, 255, 0.75)',
  lineWidth = 1.0
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();

  for (const tri of triangles) {
    const p0 = tri.uvs[0];
    const p1 = tri.uvs[1];
    const p2 = tri.uvs[2];

    const x0 = p0.u * w;
    const y0 = (1 - p0.v) * h;
    const x1 = p1.u * w;
    const y1 = (1 - p1.v) * h;
    const x2 = p2.u * w;
    const y2 = (1 - p2.v) * h;

    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x0, y0);
  }

  ctx.stroke();
}

function sign(p1x: number, p1y: number, p2x: number, p2y: number, p3x: number, p3y: number): number {
  return (p1x - p3x) * (p2y - p3y) - (p2x - p3x) * (p1y - p3y);
}

export function isPointInTriangle(
  px: number,
  py: number,
  tri: UVTriangle
): boolean {
  // Quick AABB check first
  if (px < tri.minU || px > tri.maxU || py < tri.minV || py > tri.maxV) {
    return false;
  }

  const [p0, p1, p2] = tri.uvs;
  const d1 = sign(px, py, p0.u, p0.v, p1.u, p1.v);
  const d2 = sign(px, py, p1.u, p1.v, p2.u, p2.v);
  const d3 = sign(px, py, p2.u, p2.v, p0.u, p0.v);

  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;

  return !(hasNeg && hasPos);
}

export function findIslandAtUV(
  u: number,
  v: number,
  analysis: UVAnalysis
): UVIsland | null {
  for (const tri of analysis.triangles) {
    if (isPointInTriangle(u, v, tri)) {
      return analysis.islands.get(tri.islandId) || null;
    }
  }
  return null;
}

export function createIslandPath2D(
  island: UVIsland,
  triangles: UVTriangle[],
  width: number,
  height: number
): Path2D {
  const path = new Path2D();
  for (const tIdx of island.triangleIndices) {
    const tri = triangles[tIdx];
    if (!tri) continue;
    const x0 = tri.uvs[0].u * width;
    const y0 = (1 - tri.uvs[0].v) * height;
    const x1 = tri.uvs[1].u * width;
    const y1 = (1 - tri.uvs[1].v) * height;
    const x2 = tri.uvs[2].u * width;
    const y2 = (1 - tri.uvs[2].v) * height;

    path.moveTo(x0, y0);
    path.lineTo(x1, y1);
    path.lineTo(x2, y2);
    path.closePath();
  }
  return path;
}

/**
 * Extracts and traces only the outer perimeter boundary edges of a UV island.
 * Boundary edges occur exactly once across the island's triangles, whereas interior
 * shared edges occur twice.
 */
export function createIslandBoundaryPath2D(
  island: UVIsland,
  triangles: UVTriangle[],
  width: number,
  height: number
): Path2D {
  const edgeCount = new Map<
    string,
    { x0: number; y0: number; x1: number; y1: number; count: number }
  >();

  for (const tIdx of island.triangleIndices) {
    const tri = triangles[tIdx];
    if (!tri) continue;
    const pts = tri.uvs;
    const pairs: [UVPoint, UVPoint][] = [
      [pts[0], pts[1]],
      [pts[1], pts[2]],
      [pts[2], pts[0]],
    ];
    for (const [pA, pB] of pairs) {
      const kA = coordKey(pA.u, pA.v);
      const kB = coordKey(pB.u, pB.v);
      const key = kA < kB ? `${kA}|${kB}` : `${kB}|${kA}`;
      const existing = edgeCount.get(key);
      if (existing) {
        existing.count++;
      } else {
        edgeCount.set(key, {
          x0: pA.u * width,
          y0: (1 - pA.v) * height,
          x1: pB.u * width,
          y1: (1 - pB.v) * height,
          count: 1,
        });
      }
    }
  }

  const boundaryPath = new Path2D();
  for (const edge of edgeCount.values()) {
    if (edge.count === 1) {
      boundaryPath.moveTo(edge.x0, edge.y0);
      boundaryPath.lineTo(edge.x1, edge.y1);
    }
  }
  return boundaryPath;
}

export function findTriangleAtUV(
  u: number,
  v: number,
  analysis: UVAnalysis
): UVTriangle | null {
  for (const tri of analysis.triangles) {
    if (isPointInTriangle(u, v, tri)) {
      return tri;
    }
  }
  return null;
}

export function createFacesPath2D(
  faceIndices: number[],
  triangles: UVTriangle[],
  width: number,
  height: number
): Path2D {
  const path = new Path2D();
  for (const tIdx of faceIndices) {
    const tri = triangles[tIdx];
    if (!tri) continue;
    const x0 = tri.uvs[0].u * width;
    const y0 = (1 - tri.uvs[0].v) * height;
    const x1 = tri.uvs[1].u * width;
    const y1 = (1 - tri.uvs[1].v) * height;
    const x2 = tri.uvs[2].u * width;
    const y2 = (1 - tri.uvs[2].v) * height;

    path.moveTo(x0, y0);
    path.lineTo(x1, y1);
    path.lineTo(x2, y2);
    path.closePath();
  }
  return path;
}

export function createFacesBoundaryPath2D(
  faceIndices: number[],
  triangles: UVTriangle[],
  width: number,
  height: number
): Path2D {
  const edgeCount = new Map<
    string,
    { x0: number; y0: number; x1: number; y1: number; count: number }
  >();

  for (const tIdx of faceIndices) {
    const tri = triangles[tIdx];
    if (!tri) continue;
    const pts = tri.uvs;
    const pairs: [UVPoint, UVPoint][] = [
      [pts[0], pts[1]],
      [pts[1], pts[2]],
      [pts[2], pts[0]],
    ];
    for (const [pA, pB] of pairs) {
      const kA = coordKey(pA.u, pA.v);
      const kB = coordKey(pB.u, pB.v);
      const key = kA < kB ? `${kA}|${kB}` : `${kB}|${kA}`;
      const existing = edgeCount.get(key);
      if (existing) {
        existing.count++;
      } else {
        edgeCount.set(key, {
          x0: pA.u * width,
          y0: (1 - pA.v) * height,
          x1: pB.u * width,
          y1: (1 - pB.v) * height,
          count: 1,
        });
      }
    }
  }

  const boundaryPath = new Path2D();
  for (const edge of edgeCount.values()) {
    if (edge.count === 1) {
      boundaryPath.moveTo(edge.x0, edge.y0);
      boundaryPath.lineTo(edge.x1, edge.y1);
    }
  }
  return boundaryPath;
}

