import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  ShadingMode,
  LightingPreset,
  ModelData,
  ToolType,
  BrushSettings,
  UVIsland,
} from '../../core/types';
import { PaintEngine } from '../../core/paintEngine';
import { findIslandAtUV } from '../../core/uvAnalyzer';
import {
  Sun,
  Eye,
  RotateCw,
  Compass,
  Layers,
  Sparkles,
  Box,
  Hand,
} from 'lucide-react';
import { Button, IconButton, Tooltip, Badge } from '@/components/ui';

export interface ThreeViewportProps {
  modelData: ModelData | null;
  paintEngine?: PaintEngine | null;
  activeTool?: ToolType;
  brushSettings?: BrushSettings;
  selectedIsland: UVIsland | null;
  onPickUV: (u: number, v: number) => void;
  onPickColor?: (color: string) => void;
  statusCallback?: (msg: string) => void;
  onOpenModelDialog?: () => void;
  lightingPreset?: LightingPreset;
  autoRotate?: boolean;
  onStrokeEnd?: () => void;
  paintConstraintMode?: 'free' | 'selection';
  wireframeLineWidth?: number;
}

export const ThreeViewport: React.FC<ThreeViewportProps> = ({
  modelData,
  paintEngine,
  activeTool,
  selectedIsland,
  onPickUV,
  onPickColor,
  statusCallback,
  onOpenModelDialog,
  lightingPreset: propLighting,
  autoRotate: propAutoRotate,
  wireframeLineWidth = 1.0,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [shadingMode, setShadingMode] = useState<ShadingMode>('textured');
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('studio');
  const [autoRotate, setAutoRotate] = useState(false);
  const [wireframeMesh, setWireframeMesh] = useState<THREE.Mesh | null>(null);
  const [isPanActive, setIsPanActive] = useState(false);
  const isPanActiveRef = useRef(false);
  isPanActiveRef.current = isPanActive;

  const activeLighting = propLighting ?? lightingPreset;
  const activeAutoRotate = propAutoRotate ?? autoRotate;

  const lightsGroupRef = useRef<THREE.Group | null>(null);
  const modelRadiusRef = useRef<number>(1.0);
  const pointerDownPosRef = useRef<{ x: number; y: number; time: number } | null>(null);

  // Persistent raycasting resources for 60-120 FPS performance
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseVecRef = useRef(new THREE.Vector2());
  const lastRaycastTime = useRef(0);

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth || 500;
    const height = container.clientHeight || 500;

    // 1. Scene with clean neutral dark background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x18181b);
    sceneRef.current = scene;

    // Minimal dark grid
    const grid = new THREE.GridHelper(10, 20, 0x3f3f46, 0x27272a);
    grid.position.y = -0.01;
    scene.add(grid);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(2.5, 2.0, 3.5);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. OrbitControls (Smooth 3D orbit, pan, and zoom)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxDistance = 25;
    controls.minDistance = 0.5;
    controls.screenSpacePanning = true;
    controls.mouseButtons = {
      LEFT: isPanActiveRef.current ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };
    controlsRef.current = controls;

    // 5. Studio Lighting
    const lightsGroup = new THREE.Group();
    scene.add(lightsGroup);
    lightsGroupRef.current = lightsGroup;
    setupLighting(lightsGroup, lightingPreset);

    // 6. Animation loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (controlsRef.current) {
        controlsRef.current.autoRotate = autoRotateRef.current;
        controlsRef.current.autoRotateSpeed = 2.0;
        controlsRef.current.update();
      }
      renderer.render(scene, camera);
    };
    animate();

    // 7. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Keyboard listener for Alt / Shift Camera Move (Pan)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.altKey || e.shiftKey) && controlsRef.current) {
        controlsRef.current.mouseButtons.LEFT = THREE.MOUSE.PAN;
        if (containerRef.current && !containerRef.current.style.cursor.includes('grabbing')) {
          containerRef.current.style.cursor = 'grab';
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.altKey && !e.shiftKey && controlsRef.current) {
        controlsRef.current.mouseButtons.LEFT = isPanActiveRef.current
          ? THREE.MOUSE.PAN
          : THREE.MOUSE.ROTATE;
        if (containerRef.current && !containerRef.current.style.cursor.includes('grabbing')) {
          containerRef.current.style.cursor = isPanActiveRef.current ? 'grab' : 'default';
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const autoRotateRef = useRef(activeAutoRotate);
  autoRotateRef.current = activeAutoRotate;

  // Bright, clean studio lighting
  const setupLighting = (group: THREE.Group, preset: LightingPreset) => {
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    if (preset === 'studio') {
      const ambient = new THREE.AmbientLight(0xffffff, 1.3);
      const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
      keyLight.position.set(3, 6, 6);
      const fillLight = new THREE.DirectionalLight(0xffffff, 0.8);
      fillLight.position.set(-5, 3, 4);
      const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
      rimLight.position.set(0, 4, -4);
      group.add(ambient, keyLight, fillLight, rimLight);
    } else if (preset === 'sunlight') {
      const ambient = new THREE.AmbientLight(0xffffff, 0.8);
      const sun = new THREE.DirectionalLight(0xfffaed, 2.0);
      sun.position.set(5, 10, 4);
      group.add(ambient, sun);
    } else {
      const ambient = new THREE.AmbientLight(0xffffff, 1.8);
      group.add(ambient);
    }
  };

  useEffect(() => {
    if (lightsGroupRef.current) {
      setupLighting(lightsGroupRef.current, activeLighting);
    }
  }, [activeLighting]);

  // Sync model with scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !modelData) return;

    scene.children.forEach((c) => {
      if (c.name === 'USER_MODEL_ROOT') {
        scene.remove(c);
      }
    });

    modelData.root.name = 'USER_MODEL_ROOT';
    scene.add(modelData.root);

    // Wireframe overlay mesh
    const wfMat = new THREE.MeshBasicMaterial({
      color: 0x71717a,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    const wfMesh = new THREE.Mesh(modelData.geometry, wfMat);
    wfMesh.name = 'USER_MODEL_WIREFRAME';
    wfMesh.visible = shadingMode === 'wireframe-textured';
    modelData.root.add(wfMesh);
    setWireframeMesh(wfMesh);

    // Frame camera on model & record model radius
    if (controlsRef.current && cameraRef.current) {
      const box = new THREE.Box3().setFromObject(modelData.root);
      const sphere = new THREE.Sphere();
      box.getBoundingSphere(sphere);
      modelRadiusRef.current = Math.max(0.5, sphere.radius);
      const dist = Math.max(2.0, sphere.radius * 2.8);
      cameraRef.current.position.set(dist * 0.8, dist * 0.6, dist);
      controlsRef.current.target.copy(sphere.center);
      controlsRef.current.update();
    }
  }, [modelData]);

  // Update shading mode
  useEffect(() => {
    if (!modelData) return;
    const mesh = modelData.mesh;

    if (shadingMode === 'unlit') {
      const basicMat = new THREE.MeshBasicMaterial({
        map: modelData.canvasTexture,
      });
      mesh.material = basicMat;
      if (wireframeMesh) wireframeMesh.visible = false;
    } else if (shadingMode === 'wireframe-only') {
      const wfOnlyMat = new THREE.MeshBasicMaterial({
        wireframe: true,
        color: 0xd4d4d8,
      });
      mesh.material = wfOnlyMat;
      if (wireframeMesh) wireframeMesh.visible = false;
    } else if (shadingMode === 'wireframe-textured') {
      mesh.material = modelData.material;
      if (wireframeMesh) wireframeMesh.visible = true;
    } else {
      mesh.material = modelData.material;
      if (wireframeMesh) wireframeMesh.visible = false;
    }
  }, [shadingMode, modelData, wireframeMesh]);

  // Synchronize 3D Island Highlight Mesh with selectedIsland
  useEffect(() => {
    if (!modelData) return;

    const cleanupHighlight = () => {
      const existing =
        modelData.mesh.getObjectByName('USER_ISLAND_HIGHLIGHT') ||
        modelData.root.getObjectByName('USER_ISLAND_HIGHLIGHT');
      if (existing) {
        existing.parent?.remove(existing);
        existing.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.geometry?.dispose();
            if (Array.isArray(m.material)) {
              m.material.forEach((mat) => mat.dispose());
            } else {
              m.material?.dispose();
            }
          }
        });
      }
    };

    cleanupHighlight();

    if (!selectedIsland || !selectedIsland.triangleIndices || selectedIsland.triangleIndices.length === 0) {
      return;
    }

    const { geometry } = modelData;
    const posAttr = geometry.attributes.position;
    if (!posAttr) return;

    const indexAttr = geometry.index;
    const normAttr = geometry.attributes.normal;
    const triangleIndices = selectedIsland.triangleIndices;
    const triCount = triangleIndices.length;

    const positions = new Float32Array(triCount * 9);
    const normals = normAttr ? new Float32Array(triCount * 9) : null;

    let ptr = 0;
    for (let i = 0; i < triCount; i++) {
      const t = triangleIndices[i];
      let i0: number, i1: number, i2: number;
      if (indexAttr) {
        if (t * 3 + 2 >= indexAttr.count) continue;
        i0 = indexAttr.getX(t * 3);
        i1 = indexAttr.getX(t * 3 + 1);
        i2 = indexAttr.getX(t * 3 + 2);
      } else {
        if (t * 3 + 2 >= posAttr.count) continue;
        i0 = t * 3;
        i1 = t * 3 + 1;
        i2 = t * 3 + 2;
      }

      // v0
      positions[ptr] = posAttr.getX(i0);
      positions[ptr + 1] = posAttr.getY(i0);
      positions[ptr + 2] = posAttr.getZ(i0);
      if (normals && normAttr) {
        normals[ptr] = normAttr.getX(i0);
        normals[ptr + 1] = normAttr.getY(i0);
        normals[ptr + 2] = normAttr.getZ(i0);
      }

      // v1
      positions[ptr + 3] = posAttr.getX(i1);
      positions[ptr + 4] = posAttr.getY(i1);
      positions[ptr + 5] = posAttr.getZ(i1);
      if (normals && normAttr) {
        normals[ptr + 3] = normAttr.getX(i1);
        normals[ptr + 4] = normAttr.getY(i1);
        normals[ptr + 5] = normAttr.getZ(i1);
      }

      // v2
      positions[ptr + 6] = posAttr.getX(i2);
      positions[ptr + 7] = posAttr.getY(i2);
      positions[ptr + 8] = posAttr.getZ(i2);
      if (normals && normAttr) {
        normals[ptr + 6] = normAttr.getX(i2);
        normals[ptr + 7] = normAttr.getY(i2);
        normals[ptr + 8] = normAttr.getZ(i2);
      }

      ptr += 9;
    }

    const highlightGeo = new THREE.BufferGeometry();
    highlightGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    if (normals) {
      highlightGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    } else {
      highlightGeo.computeVertexNormals();
    }

    const highlightGroup = new THREE.Group();
    highlightGroup.name = 'USER_ISLAND_HIGHLIGHT';

    // Translucent white fill
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const fillMesh = new THREE.Mesh(highlightGeo, fillMat);
    fillMesh.name = 'USER_ISLAND_HIGHLIGHT_FILL';
    fillMesh.renderOrder = 10;
    highlightGroup.add(fillMesh);

    // Crisp white wireframe contour lines
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      wireframeLinewidth: wireframeLineWidth,
      transparent: true,
      opacity: 0.9,
      depthTest: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const wireMesh = new THREE.Mesh(highlightGeo, wireMat);
    wireMesh.name = 'USER_ISLAND_HIGHLIGHT_WIRE';
    wireMesh.renderOrder = 11;
    highlightGroup.add(wireMesh);

    // Attach to mesh if single mesh, or root if merged
    const targetParent =
      modelData.geometry === modelData.mesh.geometry ? modelData.mesh : modelData.root;
    targetParent.add(highlightGroup);

    return () => {
      cleanupHighlight();
    };
  }, [selectedIsland, modelData, wireframeLineWidth]);

  // Raycast helper to find intersection with the 3D model
  const getRaycastHit = useCallback(
    (clientX: number, clientY: number) => {
      if (!sceneRef.current || !cameraRef.current || !modelData?.root) return null;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;

      mouseVecRef.current.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = raycasterRef.current;
      raycaster.setFromCamera(mouseVecRef.current, cameraRef.current);
      const allHits = raycaster.intersectObjects(modelData.root.children, true);
      for (const hit of allHits) {
        if (
          hit.object.name !== 'USER_MODEL_WIREFRAME' &&
          !hit.object.name.startsWith('USER_ISLAND_HIGHLIGHT') &&
          hit.object.parent?.name !== 'USER_ISLAND_HIGHLIGHT' &&
          hit.uv
        ) {
          return hit;
        }
      }
      return null;
    },
    [modelData]
  );

  // 3D Pointer Down: Record starting coordinate for click vs orbit/pan drag detection
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const isMiddleOrRight = e.button === 1 || e.button === 2;
    const isModifierPan = e.altKey || e.shiftKey;

    if (isMiddleOrRight || isModifierPan || isPanActiveRef.current) {
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
      return;
    }

    if (e.button === 0) {
      pointerDownPosRef.current = {
        x: e.clientX,
        y: e.clientY,
        time: performance.now(),
      };
    }
  };

  // 3D Pointer Move: Dynamic cursor feedback
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // If dragging to rotate or pan, show grabbing cursor
    if (e.buttons !== 0) {
      if (containerRef.current) containerRef.current.style.cursor = 'grabbing';
      return;
    }

    if (e.altKey || e.shiftKey || isPanActiveRef.current) {
      if (containerRef.current) containerRef.current.style.cursor = 'grab';
      return;
    }

    const now = performance.now();
    if (now - lastRaycastTime.current < 25) return;
    lastRaycastTime.current = now;

    if (!modelData) {
      if (containerRef.current) containerRef.current.style.cursor = 'default';
      return;
    }

    const hit = getRaycastHit(e.clientX, e.clientY);
    if (containerRef.current) {
      if (activeTool === 'eyedropper') {
        containerRef.current.style.cursor = hit ? 'crosshair' : 'default';
      } else {
        containerRef.current.style.cursor = hit ? 'pointer' : 'default';
      }
    }
  };

  // 3D Pointer Up: Left click selects the UV island (or samples color if eyedropper)
  const handlePointerUp = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e && (e.altKey || e.shiftKey || e.button !== 0 || isPanActiveRef.current)) {
      pointerDownPosRef.current = null;
      if (containerRef.current) {
        containerRef.current.style.cursor =
          e.altKey || e.shiftKey || isPanActiveRef.current ? 'grab' : 'default';
      }
      return;
    }

    if (e && e.button === 0 && pointerDownPosRef.current) {
      const dx = e.clientX - pointerDownPosRef.current.x;
      const dy = e.clientY - pointerDownPosRef.current.y;
      const dist = Math.hypot(dx, dy);
      const elapsed = performance.now() - pointerDownPosRef.current.time;
      pointerDownPosRef.current = null;

      // Mouse moved less than 6px within 600ms -> Click to select UV island
      if (dist < 6 && elapsed < 600) {
        if (!modelData) return;

        const hit = getRaycastHit(e.clientX, e.clientY);
        if (hit && hit.uv) {
          const uv = hit.uv;

          if (activeTool === 'eyedropper' && paintEngine) {
            const tw = paintEngine.getWidth();
            const th = paintEngine.getHeight();
            const tx = uv.x * tw;
            const ty = (1 - uv.y) * th;
            const color = paintEngine.pickColor(tx, ty);
            onPickColor?.(color);
            statusCallback?.(`Sampled color from 3D: ${color}`);
            return;
          }

          // Select UV island from 3D surface
          onPickUV(uv.x, uv.y);
          const island = findIslandAtUV(uv.x, uv.y, modelData.uvAnalysis);
          if (island) {
            statusCallback?.(
              `Selected Island #${island.id} (${island.triangleIndices.length} tris) from 3D view`
            );
          } else {
            statusCallback?.(`Selected UV (${uv.x.toFixed(3)}, ${uv.y.toFixed(3)})`);
          }
        } else {
          // Clicked empty background: deselect island
          onPickUV(-1, -1);
          statusCallback?.('Deselected UV Island');
        }
      }
    } else if (!e) {
      pointerDownPosRef.current = null;
    }

    if (containerRef.current && (!e || e.buttons === 0)) {
      containerRef.current.style.cursor = isPanActiveRef.current ? 'grab' : 'default';
    }
  };

  const handlePointerLeave = () => {
    pointerDownPosRef.current = null;
    if (containerRef.current) {
      containerRef.current.style.cursor = isPanActiveRef.current ? 'grab' : 'default';
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!modelData) return;
    const hit = getRaycastHit(e.clientX, e.clientY);
    if (hit && hit.uv) {
      const island = findIslandAtUV(hit.uv.x, hit.uv.y, modelData.uvAnalysis);
      onPickUV(hit.uv.x, hit.uv.y);
      statusCallback?.(
        island
          ? `Selected Island #${island.id} (${island.triangleIndices.length} tris)`
          : `No island at UV (${hit.uv.x.toFixed(2)}, ${hit.uv.y.toFixed(2)})`
      );
    }
  };

  const setCameraView = (type: 'front' | 'side' | 'top' | 'iso') => {
    if (!cameraRef.current || !controlsRef.current) return;
    const d = 3.5;
    if (type === 'front') cameraRef.current.position.set(0, 0, d);
    if (type === 'side') cameraRef.current.position.set(d, 0, 0);
    if (type === 'top') cameraRef.current.position.set(0, d, 0.001);
    if (type === 'iso') cameraRef.current.position.set(d * 0.7, d * 0.7, d * 0.7);
    controlsRef.current.target.set(0, 0, 0);
    controlsRef.current.update();
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-zinc-900 overflow-hidden select-none">
      {/* Top Floating Control Bar */}
      <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
        {/* Left: Viewport Mode */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 bg-zinc-900/90 backdrop-blur-md px-2 py-0.5 rounded border border-zinc-800 pointer-events-auto shadow-sm"
        >
          <span className="text-xs font-medium text-zinc-300 pr-1 border-r border-zinc-800">
            3D View
          </span>

          <div className="flex items-center gap-0.5">
            <Tooltip content="Lit Texture">
              <IconButton
                size="xs"
                variant={shadingMode === 'textured' ? 'solid' : 'ghost'}
                onClick={() => setShadingMode('textured')}
                aria-label="Lit texture"
                className="text-zinc-300"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </IconButton>
            </Tooltip>

            <Tooltip content="Unlit Flat Diffuse (Best for texture inspection)">
              <IconButton
                size="xs"
                variant={shadingMode === 'unlit' ? 'solid' : 'ghost'}
                onClick={() => setShadingMode('unlit')}
                aria-label="Unlit diffuse"
                className="text-zinc-300"
              >
                <Eye className="w-3.5 h-3.5" />
              </IconButton>
            </Tooltip>

            <Tooltip content="Wireframe Overlay">
              <IconButton
                size="xs"
                variant={shadingMode === 'wireframe-textured' ? 'solid' : 'ghost'}
                onClick={() => setShadingMode('wireframe-textured')}
                aria-label="Wireframe overlay"
                className="text-zinc-300"
              >
                <Layers className="w-3.5 h-3.5" />
              </IconButton>
            </Tooltip>

            <div className="h-3 w-px bg-zinc-800 mx-0.5" />

            <Tooltip content={isPanActive ? "Switch to Orbit Rotate mode" : "Switch to Pan Camera mode"}>
              <IconButton
                size="xs"
                variant="ghost"
                onClick={() => {
                  const next = !isPanActive;
                  setIsPanActive(next);
                  if (controlsRef.current) {
                    controlsRef.current.mouseButtons.LEFT = next ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
                  }
                  if (containerRef.current) {
                    containerRef.current.style.cursor = next ? 'grab' : 'default';
                  }
                }}
                aria-label="Pan Camera Mode"
                className={`transition-colors ${
                  isPanActive
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-600 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
              </IconButton>
            </Tooltip>
          </div>
        </div>

        {/* Right: Lighting & Views */}
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 bg-zinc-900/90 backdrop-blur-md px-1.5 py-0.5 rounded border border-zinc-800 pointer-events-auto shadow-sm"
        >
          <Tooltip content={`Lighting: ${lightingPreset}`}>
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => {
                const presets: LightingPreset[] = ['studio', 'sunlight', 'soft-ambient'];
                const next = presets[(presets.indexOf(lightingPreset) + 1) % presets.length];
                setLightingPreset(next);
              }}
              aria-label="Toggle lighting"
              className="text-zinc-300"
            >
              <Sun className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <Tooltip content="Turntable Rotate">
            <IconButton
              size="xs"
              variant={autoRotate ? 'solid' : 'ghost'}
              onClick={() => setAutoRotate(!autoRotate)}
              aria-label="Turntable"
              className="text-zinc-300"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <div className="h-3 w-px bg-zinc-800 mx-0.5" />

          <Tooltip content="Front View">
            <Button size="xs" variant="ghost" onClick={() => setCameraView('front')} className="px-1 text-xs text-zinc-300">
              F
            </Button>
          </Tooltip>
          <Tooltip content="Side View">
            <Button size="xs" variant="ghost" onClick={() => setCameraView('side')} className="px-1 text-xs text-zinc-300">
              S
            </Button>
          </Tooltip>
          <Tooltip content="Top View">
            <Button size="xs" variant="ghost" onClick={() => setCameraView('top')} className="px-1 text-xs text-zinc-300">
              T
            </Button>
          </Tooltip>
          <Tooltip content="Isometric View">
            <IconButton size="xs" variant="ghost" onClick={() => setCameraView('iso')} aria-label="Isometric" className="text-zinc-300">
              <Compass className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      {/* Empty State Overlay */}
      {!modelData && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center bg-zinc-950/40 backdrop-blur-[2px] select-none pointer-events-none">
          <div className="flex flex-col items-center max-w-sm p-6 rounded-xl border border-zinc-800 bg-zinc-900/90 shadow-2xl space-y-3 pointer-events-auto">
            <div className="w-12 h-12 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
              <Box className="w-6 h-6 text-zinc-300" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-zinc-100">No 3D Model Loaded</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Drag & drop a 3D asset anywhere into this window, or open a file to inspect and repaint textures.
              </p>
            </div>
            <div className="flex items-center gap-1.5 pt-0.5">
              <Badge variant="subtle" size="sm" className="text-[10px] text-zinc-400">.GLB</Badge>
              <Badge variant="subtle" size="sm" className="text-[10px] text-zinc-400">.GLTF</Badge>
              <Badge variant="subtle" size="sm" className="text-[10px] text-zinc-400">.FBX</Badge>
              <Badge variant="subtle" size="sm" className="text-[10px] text-zinc-400">.OBJ</Badge>
            </div>
            {onOpenModelDialog && (
              <Button
                size="sm"
                variant="solid"
                onClick={onOpenModelDialog}
                className="mt-1 w-full text-xs"
              >
                Open 3D Model
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Floating 3D Interaction Tip */}
      {modelData && (
        <div className="absolute bottom-2 left-2 z-10 pointer-events-none">
          <Badge variant="subtle" size="sm" className="text-[11px] text-zinc-300 bg-zinc-950/85 border-zinc-800">
            {selectedIsland
              ? `Island #${selectedIsland.id} Selected • Click to select • Left Drag: Rotate • Alt + Drag / Middle Drag: Move • Wheel: Zoom`
              : `Click 3D part to select Island • Left Drag: Rotate • Alt + Drag / Middle Drag: Move • Wheel: Zoom`}
          </Badge>
        </div>
      )}

      {/* WebGL Canvas Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => handlePointerUp()}
        onPointerLeave={handlePointerLeave}
        onDoubleClick={handleDoubleClick}
        className="w-full h-full outline-none select-none"
      />
    </div>
  );
};
