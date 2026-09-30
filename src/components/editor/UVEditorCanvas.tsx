import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ToolType,
  BrushSettings,
  UVIsland,
  UVPoint,
  ModelData,
  PaintConstraintMode,
} from '../../core/types';
import { PaintEngine } from '../../core/paintEngine';
import {
  findIslandAtUV,
  findTriangleAtUV,
  createIslandPath2D,
  createIslandBoundaryPath2D,
  createFacesPath2D,
  createFacesBoundaryPath2D,
  renderWireframe,
} from '../../core/uvAnalyzer';
import { ZoomIn, ZoomOut, Maximize, RotateCcw, Layers } from 'lucide-react';
import { Button, IconButton, Tooltip } from '@/components/ui';

interface UVEditorCanvasProps {
  modelData: ModelData | null;
  paintEngine: PaintEngine | null;
  activeTool: ToolType;
  brushSettings: BrushSettings;
  paintConstraintMode: PaintConstraintMode;
  selectedIsland: UVIsland | null;
  onSelectIsland: (island: UVIsland | null) => void;
  selectedFaces?: number[];
  onSelectFace?: (faceIndex: number, multiSelect?: boolean) => void;
  showWireframe: boolean;
  onToggleWireframe?: () => void;
  wireframeOpacity: number;
  wireframeLineWidth?: number;
  onPickColor: (color: string) => void;
  zoomLevel: number;
  setZoomLevel: (zoom: number) => void;
  onStrokeEnd?: () => void;
  onUpdateBrushSettings?: (patch: Partial<BrushSettings>) => void;
  statusCallback?: (msg: string) => void;
}

export const UVEditorCanvas: React.FC<UVEditorCanvasProps> = ({
  modelData,
  paintEngine,
  activeTool,
  brushSettings,
  paintConstraintMode,
  selectedIsland,
  onSelectIsland,
  selectedFaces = [],
  onSelectFace,
  showWireframe,
  onToggleWireframe,
  wireframeOpacity,
  wireframeLineWidth = 1.0,
  onPickColor,
  zoomLevel,
  setZoomLevel,
  onStrokeEnd,
  onUpdateBrushSettings,
  statusCallback,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);

  // Pan offset in screen pixels
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 30, y: 30 });
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);

  // Synchronous refs for continuous drag painting and panning
  const isPaintingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPoint = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Direct DOM cursor ring ref for 120 FPS latency-free tracking
  const cursorRingRef = useRef<HTMLDivElement>(null);
  const containerRectRef = useRef<DOMRect | null>(null);
  const hasAutoCentered = useRef(false);

  // Direct DOM update for Status Bar UV coordinates - ZERO React re-renders!
  const updateStatusBarUV = useCallback((point: UVPoint | null) => {
    const el = document.getElementById('statusbar-uv-coords');
    if (el) {
      el.textContent = point
        ? `UV: ${point.u.toFixed(3)}, ${point.v.toFixed(3)}`
        : 'UV: --';
    }
  }, []);

  // Keyboard space listener for Pan
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setSpacePressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Screen to canvas coordinate conversion
  const screenToCanvas = useCallback(
    (clientX: number, clientY: number): { x: number; y: number } | null => {
      if (!containerRef.current || !paintEngine) return null;
      const rect = containerRef.current.getBoundingClientRect();
      const screenX = clientX - rect.left;
      const screenY = clientY - rect.top;

      const texX = (screenX - pan.x) / zoomLevel;
      const texY = (screenY - pan.y) / zoomLevel;

      return { x: texX, y: texY };
    },
    [pan, zoomLevel, paintEngine]
  );

  // Draw main texture layer
  const renderMainCanvas = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas || !paintEngine) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = paintEngine.getWidth();
    const h = paintEngine.getHeight();
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(paintEngine.getOutputCanvas(), 0, 0);
  }, [paintEngine]);

  // Draw UV wireframe and selected island highlight
  const renderOverlay = useCallback(() => {
    const overlay = overlayCanvasRef.current;
    if (!overlay || !modelData) return;
    const ctx = overlay.getContext('2d');
    if (!ctx) return;

    const w = modelData.textureCanvas.width;
    const h = modelData.textureCanvas.height;
    if (overlay.width !== w || overlay.height !== h) {
      overlay.width = w;
      overlay.height = h;
    }
    ctx.clearRect(0, 0, w, h);

    // 1. Draw UV Wireframe
    if (showWireframe && modelData.uvAnalysis.wireframeCanvas) {
      ctx.save();
      ctx.globalAlpha = wireframeOpacity;
      ctx.drawImage(modelData.uvAnalysis.wireframeCanvas, 0, 0, w, h);
      ctx.restore();
    }

    // 2. Selection Highlight & Mask boundary: ONLY rendered when NOT in Free mode
    if (paintConstraintMode === 'islands' && selectedIsland) {
      const path = createIslandPath2D(
        selectedIsland,
        modelData.uvAnalysis.triangles,
        w,
        h
      );

      ctx.save();
      // Translucent white fill highlight modulated by wireframeOpacity
      const fillAlpha = Math.max(0.04, Math.min(0.35, wireframeOpacity * 0.35));
      ctx.fillStyle = `rgba(255, 255, 255, ${fillAlpha})`;
      ctx.fill(path);

      // Selected island UV wireframe lines modulated by wireframeOpacity
      ctx.strokeStyle = `rgba(255, 255, 255, ${wireframeOpacity})`;
      ctx.lineWidth = wireframeLineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(path);

      // Distinct outer perimeter boundary contour (scales with wireframeLineWidth and wireframeOpacity)
      const boundaryPath = createIslandBoundaryPath2D(
        selectedIsland,
        modelData.uvAnalysis.triangles,
        w,
        h
      );
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1.0, Math.max(0.3, wireframeOpacity * 1.3))})`;
      ctx.lineWidth = Math.max(wireframeLineWidth * 1.5, wireframeLineWidth + 0.75);
      ctx.stroke(boundaryPath);
      ctx.restore();
    } else if (paintConstraintMode === 'faces' && selectedFaces && selectedFaces.length > 0) {
      const path = createFacesPath2D(
        selectedFaces,
        modelData.uvAnalysis.triangles,
        w,
        h
      );

      ctx.save();
      // Translucent white fill highlight modulated by wireframeOpacity
      const fillAlpha = Math.max(0.05, Math.min(0.4, wireframeOpacity * 0.4));
      ctx.fillStyle = `rgba(255, 255, 255, ${fillAlpha})`;
      ctx.fill(path);

      // Selected faces UV wireframe lines modulated by wireframeOpacity
      ctx.strokeStyle = `rgba(255, 255, 255, ${wireframeOpacity})`;
      ctx.lineWidth = wireframeLineWidth;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke(path);

      // Boundary contour of selected faces
      const boundaryPath = createFacesBoundaryPath2D(
        selectedFaces,
        modelData.uvAnalysis.triangles,
        w,
        h
      );
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1.0, Math.max(0.3, wireframeOpacity * 1.3))})`;
      ctx.lineWidth = Math.max(wireframeLineWidth * 1.5, wireframeLineWidth + 0.75);
      ctx.stroke(boundaryPath);
      ctx.restore();
    }

    // 3. Draw Clone Stamp Source Marker
    if (activeTool === 'clone-stamp' && brushSettings.cloneSource) {
      const { x: sx, y: sy } = brushSettings.cloneSource;
      ctx.save();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.0;
      const size = 10;
      ctx.beginPath();
      ctx.arc(sx, sy, 5, 0, Math.PI * 2);
      ctx.moveTo(sx - size, sy);
      ctx.lineTo(sx + size, sy);
      ctx.moveTo(sx, sy - size);
      ctx.lineTo(sx, sy + size);
      ctx.stroke();
      ctx.restore();
    }
  }, [
    modelData,
    showWireframe,
    wireframeOpacity,
    paintConstraintMode,
    selectedIsland,
    selectedFaces,
    wireframeLineWidth,
    activeTool,
    brushSettings.cloneSource,
  ]);

  // Subscribe to PaintEngine output updates (Undo, Redo, Filters, Clear, etc.)
  useEffect(() => {
    if (!paintEngine) return;
    const unsubscribe = paintEngine.subscribe(() => {
      renderMainCanvas();
    });
    renderMainCanvas();
    return unsubscribe;
  }, [paintEngine, renderMainCanvas]);

  useEffect(() => {
    renderOverlay();
  }, [renderOverlay]);

  // Re-render wireframe canvas whenever line thickness changes
  useEffect(() => {
    if (!modelData) return;
    const { wireframeCanvas, triangles } = modelData.uvAnalysis;
    if (wireframeCanvas && triangles && triangles.length > 0) {
      renderWireframe(wireframeCanvas, triangles, 'rgba(255, 255, 255, 0.85)', wireframeLineWidth);
      renderOverlay();
    }
  }, [wireframeLineWidth, modelData, renderOverlay]);

  // Auto-fit texture to view with ResizeObserver
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !paintEngine) return;
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const tw = paintEngine.getWidth();
    const th = paintEngine.getHeight();

    const scale = Math.min((cw - 48) / tw, (ch - 48) / th);
    const newZoom = Math.max(0.15, Math.min(scale, 1.5));
    setZoomLevel(newZoom);
    setPan({
      x: (cw - tw * newZoom) / 2,
      y: (ch - th * newZoom) / 2,
    });
  }, [paintEngine, setZoomLevel]);

  // Zoom centered on the viewport center (so canvas never drifts off-screen)
  const zoomAtCenter = useCallback(
    (factor: number) => {
      if (!containerRef.current) return;
      const container = containerRef.current;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      if (cw <= 0 || ch <= 0) return;

      const centerX = cw / 2;
      const centerY = ch / 2;

      const currentZoom = zoomLevel;
      const newZoom = Math.min(Math.max(0.15, currentZoom * factor), 8.0);
      const ratio = newZoom / currentZoom;

      setZoomLevel(newZoom);
      setPan((prevPan) => ({
        x: centerX - (centerX - prevPan.x) * ratio,
        y: centerY - (centerY - prevPan.y) * ratio,
      }));
    },
    [zoomLevel, setZoomLevel]
  );

  // Reset to 100% zoom and center texture
  const zoomTo100 = useCallback(() => {
    if (!containerRef.current || !paintEngine) {
      setZoomLevel(1.0);
      return;
    }
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const tw = paintEngine.getWidth();
    const th = paintEngine.getHeight();

    setZoomLevel(1.0);
    setPan({
      x: (cw - tw * 1.0) / 2,
      y: (ch - th * 1.0) / 2,
    });
  }, [paintEngine, setZoomLevel]);

  useEffect(() => {
    if (!containerRef.current || !paintEngine) return;
    const container = containerRef.current;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 50 && height > 50) {
          if (!hasAutoCentered.current) {
            hasAutoCentered.current = true;
            fitToScreen();
          }
        }
      }
    });

    ro.observe(container);
    // Immediate try in case already laid out
    if (container.clientWidth > 50 && container.clientHeight > 50 && !hasAutoCentered.current) {
      hasAutoCentered.current = true;
      fitToScreen();
    }

    return () => ro.disconnect();
  }, [paintEngine, fitToScreen]);

  // Wheel zoom centered at mouse position
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    const newZoom = Math.min(Math.max(0.15, zoomLevel * zoomFactor), 8.0);

    const newPanX = mouseX - (mouseX - pan.x) * (newZoom / zoomLevel);
    const newPanY = mouseY - (mouseY - pan.y) * (newZoom / zoomLevel);

    setZoomLevel(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  // Pointer Down
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const isMiddleClick = e.button === 1;
    const isPanMode = activeTool === 'pan' || spacePressed || isMiddleClick || e.button === 2;

    if (isPanMode) {
      isPanningRef.current = true;
      setIsPanning(true);
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      return;
    }

    if (e.button !== 0 || !paintEngine || !modelData) return;

    const coords = screenToCanvas(e.clientX, e.clientY);
    if (!coords) return;

    const w = paintEngine.getWidth();
    const h = paintEngine.getHeight();

    if (activeTool === 'island-select') {
      if (coords.x >= 0 && coords.x < w && coords.y >= 0 && coords.y < h) {
        const u = coords.x / w;
        const v = 1 - coords.y / h;
        if (paintConstraintMode === 'faces') {
          const tri = findTriangleAtUV(u, v, modelData.uvAnalysis);
          if (tri) {
            onSelectFace?.(tri.triangleIndex, e.shiftKey);
          }
        } else if (paintConstraintMode === 'islands') {
          const island = findIslandAtUV(u, v, modelData.uvAnalysis);
          onSelectIsland(island);
        }
      }
      return;
    }

    if (activeTool === 'eyedropper') {
      const color = paintEngine.pickColor(coords.x, coords.y);
      onPickColor(color);
      return;
    }

    if (activeTool === 'bucket') {
      paintEngine.fillIsland(brushSettings.color, brushSettings.opacity);
      renderMainCanvas();
      return;
    }

    if (activeTool === 'clone-stamp' && e.altKey) {
      onUpdateBrushSettings?.({
        cloneSource: { x: Math.round(coords.x), y: Math.round(coords.y) },
      });
      statusCallback?.(
        `Clone Source set at (${Math.round(coords.x)}, ${Math.round(coords.y)})`
      );
      renderOverlay();
      return;
    }

    const isPaintingTool =
      activeTool === 'brush' ||
      activeTool === 'eraser' ||
      activeTool === 'clone-stamp' ||
      activeTool === 'smudge' ||
      activeTool === 'blur' ||
      activeTool === 'sharpen';

    if (isPaintingTool) {
      if (activeTool === 'clone-stamp' && !brushSettings.cloneSource) {
        statusCallback?.('Hold Alt and Click on texture to set Clone Source first');
        return;
      }
      isPaintingRef.current = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {}
      paintEngine.startStroke(
        coords.x,
        coords.y,
        brushSettings,
        activeTool,
        e.pressure || 0.5
      );
      renderMainCanvas();
    }
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const isPaintingTool =
      activeTool === 'brush' ||
      activeTool === 'eraser' ||
      activeTool === 'clone-stamp' ||
      activeTool === 'smudge' ||
      activeTool === 'blur' ||
      activeTool === 'sharpen';

    if (cursorRingRef.current && containerRef.current) {
      if (!containerRectRef.current) {
        containerRectRef.current = containerRef.current.getBoundingClientRect();
      }
      const rect = containerRectRef.current;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      cursorRingRef.current.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -50%)`;
      cursorRingRef.current.style.display = isPaintingTool ? 'block' : 'none';
    }

    if (isPanningRef.current) {
      const dx = e.clientX - lastPanPoint.current.x;
      const dy = e.clientY - lastPanPoint.current.y;
      lastPanPoint.current = { x: e.clientX, y: e.clientY };
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      return;
    }

    const coords = screenToCanvas(e.clientX, e.clientY);
    if (coords && paintEngine) {
      const w = paintEngine.getWidth();
      const h = paintEngine.getHeight();

      if (coords.x >= 0 && coords.x <= w && coords.y >= 0 && coords.y <= h) {
        updateStatusBarUV({
          u: coords.x / w,
          v: 1 - coords.y / h,
        });
      } else {
        updateStatusBarUV(null);
      }

      if (isPaintingRef.current && isPaintingTool) {
        paintEngine.continueStroke(
          coords.x,
          coords.y,
          brushSettings,
          activeTool,
          e.pressure || 0.5
        );
        renderMainCanvas();
      }
    }
  };

  // Pointer Up
  const handlePointerUp = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
    }
    if (isPaintingRef.current && paintEngine) {
      isPaintingRef.current = false;
      paintEngine.endStroke();
      renderMainCanvas();
      onStrokeEnd?.();
    }
    if (e) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!paintEngine || !modelData) return;
    if (paintConstraintMode === 'free') return; // Selection makes no sense in free mode
    const coords = screenToCanvas(e.clientX, e.clientY);
    if (!coords) return;
    const w = paintEngine.getWidth();
    const h = paintEngine.getHeight();
    if (coords.x >= 0 && coords.x < w && coords.y >= 0 && coords.y < h) {
      const u = coords.x / w;
      const v = 1 - coords.y / h;
      if (paintConstraintMode === 'faces') {
        const tri = findTriangleAtUV(u, v, modelData.uvAnalysis);
        if (tri) {
          onSelectFace?.(tri.triangleIndex, e.shiftKey);
        }
      } else if (paintConstraintMode === 'islands') {
        const island = findIslandAtUV(u, v, modelData.uvAnalysis);
        onSelectIsland(island);
      }
    }
  };

  const isPaintingTool =
    activeTool === 'brush' ||
    activeTool === 'eraser' ||
    activeTool === 'clone-stamp' ||
    activeTool === 'smudge' ||
    activeTool === 'blur' ||
    activeTool === 'sharpen';

  const handlePointerEnter = () => {
    if (containerRef.current) {
      containerRectRef.current = containerRef.current.getBoundingClientRect();
    }
    if (cursorRingRef.current) {
      cursorRingRef.current.style.display = isPaintingTool ? 'block' : 'none';
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    containerRectRef.current = null;
    if (cursorRingRef.current) {
      cursorRingRef.current.style.display = 'none';
    }
    updateStatusBarUV(null);
    handlePointerUp(e);
  };

  const getCursorClass = () => {
    if (isPanning || spacePressed || activeTool === 'pan') {
      return isPanning ? 'cursor-grabbing' : 'cursor-grab';
    }
    if (activeTool === 'island-select') return 'cursor-pointer';
    if (activeTool === 'eyedropper') return 'cursor-crosshair';
    if (activeTool === 'bucket') return 'cursor-cell';
    // Native hardware crosshair cursor: 0ms latency, zero lag, exact hardware sync
    return 'cursor-crosshair';
  };

  const texW = paintEngine?.getWidth() || 1024;
  const texH = paintEngine?.getHeight() || 1024;
  const brushScreenDiameter = Math.max(2, brushSettings.size * zoomLevel);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onDoubleClick={handleDoubleClick}
      className={`relative w-full h-full overflow-hidden bg-zinc-950 select-none ${!modelData ? 'cursor-default' : getCursorClass()}`}
    >
      {!modelData ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-6 text-center select-none bg-zinc-950">
          <div className="flex flex-col items-center max-w-xs p-6 rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 text-zinc-400 space-y-2.5">
            <div className="w-10 h-10 rounded-lg bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-400">
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-zinc-200">UV Map & Texture Viewport</span>
            <p className="text-[11px] text-zinc-500 leading-normal">
              UV island wireframe overlay and texture layers will be ready for painting once a 3D model is loaded.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Top Floating Zoom & Fit Controls */}
          <div
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-zinc-900/90 backdrop-blur-md px-1.5 py-0.5 rounded border border-zinc-800 shadow-sm pointer-events-auto"
          >
            <Tooltip content="Zoom Out (-)">
              <IconButton
                size="xs"
                variant="ghost"
                onClick={() => zoomAtCenter(0.8)}
                aria-label="Zoom out"
                className="text-zinc-300 hover:text-white hover:bg-zinc-800"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </IconButton>
            </Tooltip>

            <Tooltip content="Reset to 100% zoom">
              <button
                type="button"
                onClick={zoomTo100}
                className="text-xs text-zinc-300 hover:text-white px-1.5 py-0.5 rounded hover:bg-zinc-800/80 min-w-[42px] text-center font-mono transition-colors"
              >
                {Math.round(zoomLevel * 100)}%
              </button>
            </Tooltip>

            <Tooltip content="Zoom In (+)">
              <IconButton
                size="xs"
                variant="ghost"
                onClick={() => zoomAtCenter(1.25)}
                aria-label="Zoom in"
                className="text-zinc-300 hover:text-white hover:bg-zinc-800"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </IconButton>
            </Tooltip>

            <div className="h-3 w-px bg-zinc-800 mx-0.5" />

            <Tooltip content="Fit Texture to Screen">
              <IconButton
                size="xs"
                variant="ghost"
                onClick={fitToScreen}
                aria-label="Fit to screen"
                className="text-zinc-300 hover:text-white hover:bg-zinc-800"
              >
                <Maximize className="w-3.5 h-3.5" />
              </IconButton>
            </Tooltip>

            <Tooltip content="Reset to 100% Zoom">
              <IconButton
                size="xs"
                variant="ghost"
                onClick={zoomTo100}
                aria-label="100% Zoom"
                className="text-zinc-300 hover:text-white hover:bg-zinc-800"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </IconButton>
            </Tooltip>

            <div className="h-3 w-px bg-zinc-800 mx-0.5" />

            <Tooltip content={showWireframe ? "Hide UV Map Over Texture (U)" : "Show UV Map Over Texture (U)"} shortcut="U">
              <Button
                size="xs"
                variant="ghost"
                onClick={onToggleWireframe}
                className={`gap-1 px-1.5 h-6 text-[11px] font-medium transition-colors ${
                  showWireframe
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-600 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>UV Map</span>
              </Button>
            </Tooltip>
          </div>

      {/* Canvas Viewport Transform (Zero delay, no CSS transition lag) */}
      <div
        className="absolute origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
          width: `${texW}px`,
          height: `${texH}px`,
        }}
      >
        {/* Checkerboard Backdrop */}
        <div className="absolute inset-0 bg-checkerboard shadow-xl border border-zinc-700" />

        {/* 1. Main Texture Paint Canvas */}
        <canvas
          ref={mainCanvasRef}
          width={texW}
          height={texH}
          className="absolute inset-0 pointer-events-none"
        />

        {/* 2. UV Wireframe & Selection Highlight Overlay Canvas */}
        <canvas
          ref={overlayCanvasRef}
          width={texW}
          height={texH}
          className="absolute inset-0 pointer-events-none"
        />
      </div>

      {/* 3. Screen-Space High-Contrast Precision Brush Cursor Ring (GPU composited) */}
      {isPaintingTool && (
        <div
          ref={cursorRingRef}
          className="pointer-events-none absolute left-0 top-0 rounded-full z-30 will-change-transform"
          style={{
            display: 'none',
            width: `${brushScreenDiameter}px`,
            height: `${brushScreenDiameter}px`,
            border: '1px solid rgba(255, 255, 255, 0.85)',
            outline: '1px solid rgba(0, 0, 0, 0.75)',
            outlineOffset: '-1px',
          }}
        >
          {/* Inner Hardness Core Ring (shows solid 100% opacity threshold before feather falloff) */}
          {brushSettings.hardness < 0.95 && (
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full pointer-events-none"
              style={{
                width: `${Math.max(2, brushScreenDiameter * brushSettings.hardness)}px`,
                height: `${Math.max(2, brushScreenDiameter * brushSettings.hardness)}px`,
                border: '1px dashed rgba(255, 255, 255, 0.75)',
              }}
            />
          )}
        </div>
      )}
        </>
      )}
    </div>
  );
};
