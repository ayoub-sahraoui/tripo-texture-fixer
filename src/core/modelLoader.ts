import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { unzipSync } from 'fflate';
import { analyzeUVs } from './uvAnalyzer';
import { ModelData } from './types';

export function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;

  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIndices += g.index ? g.index.count : g.attributes.position.count;
  }

  const positions = new Float32Array(totalVerts * 3);
  const uvs = new Float32Array(totalVerts * 2);
  const normals = new Float32Array(totalVerts * 3);
  const indices = new Uint32Array(totalIndices);

  let vertOffset = 0;
  let indexOffset = 0;

  for (const g of geos) {
    const pos = g.attributes.position;
    const uv = g.attributes.uv;
    const norm = g.attributes.normal;
    const count = pos.count;

    for (let i = 0; i < count; i++) {
      positions[(vertOffset + i) * 3] = pos.getX(i);
      positions[(vertOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertOffset + i) * 3 + 2] = pos.getZ(i);

      if (uv) {
        uvs[(vertOffset + i) * 2] = uv.getX(i);
        uvs[(vertOffset + i) * 2 + 1] = uv.getY(i);
      }

      if (norm) {
        normals[(vertOffset + i) * 3] = norm.getX(i);
        normals[(vertOffset + i) * 3 + 1] = norm.getY(i);
        normals[(vertOffset + i) * 3 + 2] = norm.getZ(i);
      }
    }

    if (g.index) {
      const idx = g.index;
      for (let i = 0; i < idx.count; i++) {
        indices[indexOffset + i] = vertOffset + idx.getX(i);
      }
      indexOffset += idx.count;
    } else {
      for (let i = 0; i < count; i++) {
        indices[indexOffset + i] = vertOffset + i;
      }
      indexOffset += count;
    }

    vertOffset += count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  return merged;
}

export async function loadZipFile(file: File): Promise<ModelData> {
  const buffer = await file.arrayBuffer();
  const unzipped = unzipSync(new Uint8Array(buffer));

  let modelEntry: { name: string; bytes: Uint8Array } | null = null;
  let textureEntry: { name: string; bytes: Uint8Array } | null = null;

  for (const path in unzipped) {
    const lower = path.toLowerCase();
    if (lower.startsWith('__macosx') || lower.endsWith('/')) continue;

    if (
      lower.endsWith('.glb') ||
      lower.endsWith('.gltf') ||
      lower.endsWith('.fbx') ||
      lower.endsWith('.obj')
    ) {
      if (!modelEntry || lower.endsWith('.glb') || lower.endsWith('.fbx')) {
        modelEntry = { name: path.split('/').pop() || path, bytes: unzipped[path] };
      }
    }
    if (
      lower.endsWith('.png') ||
      lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.webp')
    ) {
      if (
        !textureEntry ||
        lower.includes('diffuse') ||
        lower.includes('base') ||
        lower.includes('texture') ||
        lower.includes('color') ||
        lower.includes('albedo')
      ) {
        textureEntry = { name: path.split('/').pop() || path, bytes: unzipped[path] };
      }
    }
  }

  if (!modelEntry) {
    throw new Error('No 3D model (.fbx, .glb, .gltf, or .obj) found inside the ZIP archive.');
  }

  // Decode texture image if included in the zip
  let externalImg: HTMLImageElement | undefined = undefined;
  if (textureEntry) {
    const mime = textureEntry.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
    const texBlob = new Blob([textureEntry.bytes.slice().buffer as ArrayBuffer], { type: mime });
    const texUrl = URL.createObjectURL(texBlob);
    try {
      const img = new Image();
      img.src = texUrl;
      await img.decode();
      externalImg = img;
    } catch (e) {
      console.warn('Failed to decode texture from zip:', e);
    }
  }

  const modelBlob = new Blob([modelEntry.bytes.slice().buffer as ArrayBuffer]);
  const modelUrl = URL.createObjectURL(modelBlob);
  const modelLower = modelEntry.name.toLowerCase();

  try {
    if (modelLower.endsWith('.glb') || modelLower.endsWith('.gltf')) {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(modelUrl);
      return await processLoadedScene(gltf.scene, modelEntry.name, externalImg);
    } else if (modelLower.endsWith('.obj')) {
      const loader = new OBJLoader();
      const obj = await loader.loadAsync(modelUrl);
      return await processLoadedScene(obj, modelEntry.name, externalImg);
    } else if (modelLower.endsWith('.fbx')) {
      const loader = new FBXLoader();
      const fbx = await loader.loadAsync(modelUrl);
      return await processLoadedScene(fbx, modelEntry.name, externalImg);
    } else {
      throw new Error('Unsupported 3D format found in ZIP');
    }
  } finally {
    URL.revokeObjectURL(modelUrl);
  }
}

export async function loadModelFile(file: File, textureFile?: File): Promise<ModelData> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip')) {
    return loadZipFile(file);
  }

  let externalImg: HTMLImageElement | undefined = undefined;
  if (textureFile) {
    const texUrl = URL.createObjectURL(textureFile);
    try {
      const img = new Image();
      img.src = texUrl;
      await img.decode();
      externalImg = img;
    } catch (e) {
      console.warn('Failed to decode accompanying texture file:', e);
    }
  }

  const url = URL.createObjectURL(file);

  try {
    if (name.endsWith('.glb') || name.endsWith('.gltf')) {
      const loader = new GLTFLoader();
      const gltf = await loader.loadAsync(url);
      return await processLoadedScene(gltf.scene, file.name, externalImg);
    } else if (name.endsWith('.obj')) {
      const loader = new OBJLoader();
      const obj = await loader.loadAsync(url);
      return await processLoadedScene(obj, file.name, externalImg);
    } else if (name.endsWith('.fbx')) {
      const loader = new FBXLoader();
      const fbx = await loader.loadAsync(url);
      return await processLoadedScene(fbx, file.name, externalImg);
    } else {
      throw new Error(
        'Unsupported 3D model format. Please load a .glb, .gltf, .obj, .fbx, or .zip file.'
      );
    }
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function processLoadedScene(
  scene: THREE.Group,
  modelName: string,
  externalTextureImage?: CanvasImageSource
): Promise<ModelData> {
  let primaryMesh: THREE.Mesh | null = null;
  const meshes: THREE.Mesh[] = [];
  let extractedTexture: THREE.Texture | null = null;

  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      const m = child as THREE.Mesh;
      meshes.push(m);
      if (!primaryMesh) {
        primaryMesh = m;
      }
      const materials = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of materials) {
        if (mat && (mat as any).map && !extractedTexture) {
          extractedTexture = (mat as any).map;
          primaryMesh = m;
          break;
        }
      }
    }
  });

  if (!primaryMesh) {
    throw new Error('No 3D mesh with geometry found in this model file.');
  }

  const activeMesh: THREE.Mesh = primaryMesh;

  let textureSource: CanvasImageSource | null = externalTextureImage || null;
  if (!textureSource && extractedTexture) {
    textureSource = (extractedTexture as THREE.Texture).image as CanvasImageSource;
  }

  // Await image decoding if it's an HTMLImageElement
  if (textureSource instanceof HTMLImageElement) {
    if (!textureSource.complete) {
      try {
        await textureSource.decode();
      } catch {
        await new Promise<void>((resolve) => {
          (textureSource as HTMLImageElement).onload = () => resolve();
          (textureSource as HTMLImageElement).onerror = () => resolve();
          setTimeout(resolve, 2500);
        });
      }
    }
  }

  const textureWidth =
    (textureSource as HTMLImageElement)?.naturalWidth ||
    (textureSource as HTMLImageElement)?.width ||
    1024;
  const textureHeight =
    (textureSource as HTMLImageElement)?.naturalHeight ||
    (textureSource as HTMLImageElement)?.height ||
    1024;

  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = textureWidth;
  textureCanvas.height = textureHeight;
  const ctx = textureCanvas.getContext('2d', { willReadFrequently: true })!;

  let hasTextureMap = false;
  let defaultBgColor = '#d4d4d8';
  const originalMat = Array.isArray(activeMesh.material) ? activeMesh.material[0] : activeMesh.material;
  if (originalMat && (originalMat as any).color && (originalMat as any).color.isColor) {
    const c = (originalMat as any).color;
    if (c.r > 0.08 || c.g > 0.08 || c.b > 0.08) {
      defaultBgColor = `#${c.getHexString()}`;
    }
  }

  if (textureSource) {
    try {
      ctx.drawImage(textureSource, 0, 0, textureWidth, textureHeight);
      hasTextureMap = true;
    } catch (e) {
      console.warn('Error drawing texture source:', e);
      ctx.fillStyle = defaultBgColor;
      ctx.fillRect(0, 0, textureWidth, textureHeight);
    }
  } else {
    ctx.fillStyle = defaultBgColor;
    ctx.fillRect(0, 0, textureWidth, textureHeight);
  }

  const canvasTexture = new THREE.CanvasTexture(textureCanvas);
  canvasTexture.colorSpace = THREE.SRGBColorSpace;
  canvasTexture.wrapS = THREE.ClampToEdgeWrapping;
  canvasTexture.wrapT = THREE.ClampToEdgeWrapping;

  const newMat = new THREE.MeshStandardMaterial({
    map: canvasTexture,
    roughness: 0.8,
    metalness: 0.1,
  });

  // Assign synced canvas material to all meshes in the scene
  meshes.forEach((m) => {
    m.material = newMat;
  });

  // Center and normalize model bounds
  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 0) {
    const scale = 2.0 / maxDim;
    scene.scale.set(scale, scale, scale);
  }
  const center = new THREE.Vector3();
  box.getCenter(center);
  scene.position.sub(center.clone().multiplyScalar(scene.scale.x));

  // If there are multiple meshes, merge their geometries for complete UV analysis
  let finalGeometry = activeMesh.geometry;
  if (meshes.length > 1) {
    try {
      scene.updateMatrixWorld(true);
      const transformedGeos: THREE.BufferGeometry[] = [];
      for (const m of meshes) {
        if (m.geometry) {
          const cloneGeo = m.geometry.clone();
          cloneGeo.applyMatrix4(m.matrixWorld);
          transformedGeos.push(cloneGeo);
        }
      }
      if (transformedGeos.length > 0) {
        finalGeometry = mergeGeometries(transformedGeos);
      }
    } catch (e) {
      console.warn('Could not merge sub-meshes, using primary mesh geometry:', e);
      finalGeometry = activeMesh.geometry;
    }
  }

  const uvAnalysis = analyzeUVs(finalGeometry, textureWidth, textureHeight);

  return {
    root: scene,
    mesh: activeMesh,
    geometry: finalGeometry,
    material: newMat,
    textureCanvas,
    textureCtx: ctx,
    canvasTexture,
    uvAnalysis,
    modelName,
    hasTextureMap,
    textureDimensions: { width: textureWidth, height: textureHeight },
  };
}

export async function exportGLB(modelData: ModelData): Promise<Blob> {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    // Clone scene to avoid modifying the active view
    const clonedScene = modelData.root.clone();

    // Ensure material has the updated texture
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const mat = new THREE.MeshStandardMaterial({
          map: modelData.canvasTexture,
        });
        mesh.material = mat;
      }
    });

    exporter.parse(
      clonedScene,
      (gltf) => {
        if (gltf instanceof ArrayBuffer) {
          resolve(new Blob([gltf], { type: 'model/gltf-binary' }));
        } else {
          const str = JSON.stringify(gltf);
          resolve(new Blob([str], { type: 'model/gltf+json' }));
        }
      },
      (error) => {
        reject(error);
      },
      { binary: true }
    );
  });
}
