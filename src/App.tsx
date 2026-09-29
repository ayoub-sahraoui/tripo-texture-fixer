import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as Splitter from '@/components/ui/splitter';
import {
  ToolType,
  BrushSettings,
  UVIsland,
  ModelData,
  LightingPreset,
  ColorAdjustmentOptions,
} from './core/types';
import { PaintEngine } from './core/paintEngine';
import {
  loadModelFile,
  exportGLB,
} from './core/modelLoader';
import { findIslandAtUV, createIslandPath2D } from './core/uvAnalyzer';
import { HeaderBar } from './components/layout/HeaderBar';
import { StatusBar } from './components/layout/StatusBar';
import { ThreeViewport } from './components/viewport/ThreeViewport';
import { UVEditorCanvas } from './components/editor/UVEditorCanvas';
import { PropertiesPanel } from './components/editor/PropertiesPanel';

export const App: React.FC = () => {
  const [modelData, setModelData] = useState<ModelData | null>(null);
  const [paintEngine, setPaintEngine] = useState<PaintEngine | null>(null);

  // Active Tool & Settings
  const [activeTool, setActiveTool] = useState<ToolType>('brush');
  const [brushSettings, setBrushSettings] = useState<BrushSettings>({
    size: 24,
    opacity: 1.0,
    hardness: 0.8,
    color: '#06b6d4',
  });

  // Recent Colors Memory
  const [recentColors, setRecentColors] = useState<string[]>([
    '#ffffff',
    '#06b6d4',
    '#eab308',
    '#ef4444',
    '#22c55e',
    '#18181b',
  ]);

  // UV Island Selection & Overlays
  const [selectedIsland, setSelectedIsland] = useState<UVIsland | null>(null);
  const [paintConstraintMode, setPaintConstraintMode] = useState<'free' | 'selection'>('selection');
  const [showWireframe, setShowWireframe] = useState<boolean>(true);
  const [wireframeOpacity, setWireframeOpacity] = useState<number>(0.65);
  const [wireframeLineWidth, setWireframeLineWidth] = useState<number>(1.0);

  // 3D Viewport controls
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('studio');
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  // Properties Panel visibility
  const [isPropertiesOpen, setIsPropertiesOpen] = useState<boolean>(true);

  // Navigation & Status
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [statusMessage, setStatusMessage] = useState<string>('Ready • No model loaded');

  const [, setHistoryTick] = useState(0);
  const bumpHistory = useCallback(() => {
    setHistoryTick((t) => t + 1);
  }, []);

  const modelFileInputRef = useRef<HTMLInputElement>(null);
  const textureFileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectColor = (color: string) => {
    setBrushSettings((prev) => ({ ...prev, color }));
    setRecentColors((prev) => {
      const filtered = prev.filter((c) => c.toLowerCase() !== color.toLowerCase());
      return [color, ...filtered].slice(0, 10);
    });
  };

  const handlePickColor = (color: string) => {
    handleSelectColor(color);
    setStatusMessage(`Eyedropper picked: ${color}`);
  };

  const initModelWithEngine = (data: ModelData) => {
    setModelData(data);
    setSelectedIsland(null);

    const engine = new PaintEngine(
      data.textureCanvas.width,
      data.textureCanvas.height,
      data.textureCanvas,
      (outputCanvas) => {
        if (data.canvasTexture) {
          const ctx = data.textureCtx;
          ctx.clearRect(0, 0, data.textureCanvas.width, data.textureCanvas.height);
          ctx.drawImage(outputCanvas, 0, 0);
          data.canvasTexture.needsUpdate = true;
        }
      }
    );

    setPaintEngine(engine);
    bumpHistory();
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'b':
          setActiveTool('brush');
          setStatusMessage('Tool: Brush');
          break;
        case 'e':
          setActiveTool('eraser');
          setStatusMessage('Tool: Eraser');
          break;
        case 'i':
          setActiveTool('eyedropper');
          setStatusMessage('Tool: Eyedropper');
          break;
        case 'g':
          setActiveTool('bucket');
          setStatusMessage('Tool: Bucket');
          break;
        case 'c':
          setActiveTool('clone-stamp');
          setStatusMessage('Tool: Clone Stamp (Alt+Click on texture to pick source)');
          break;
        case 'r':
          setActiveTool('smudge');
          setStatusMessage('Tool: Smudge (Pull & blend colors)');
          break;
        case 'j':
          setActiveTool('blur');
          setStatusMessage('Tool: Blur / Soften');
          break;
        case 's':
          setActiveTool('island-select');
          setStatusMessage('Tool: Island Select');
          break;
        case 'h':
          setActiveTool('pan');
          setStatusMessage('Tool: Pan');
          break;
        case 'm':
          setPaintConstraintMode((prev) => {
            const next = prev === 'free' ? 'selection' : 'free';
            setStatusMessage(`Paint Mode: ${next === 'free' ? 'Free (Unrestricted)' : 'On Selection'}`);
            return next;
          });
          break;
        case 'u':
          setShowWireframe((prev) => !prev);
          break;
        case 'p':
          setIsPropertiesOpen((prev) => !prev);
          break;
        case 'escape':
          handleClearSelectedIsland();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paintEngine]);

  // Synchronize PaintEngine active mask with selectedIsland and paintConstraintMode
  useEffect(() => {
    if (!paintEngine || !modelData) return;

    if (paintConstraintMode === 'selection' && selectedIsland) {
      const mask = createIslandPath2D(
        selectedIsland,
        modelData.uvAnalysis.triangles,
        paintEngine.getWidth(),
        paintEngine.getHeight()
      );
      paintEngine.setActiveMask(mask);
      setStatusMessage(
        `On Selection Mode: Island #${selectedIsland.id} masked (${selectedIsland.triangleIndices.length} triangles)`
      );
    } else {
      paintEngine.setActiveMask(null);
      if (selectedIsland) {
        setStatusMessage(`Free Mode: Island #${selectedIsland.id} highlighted (unrestricted painting)`);
      } else {
        setStatusMessage('Free Mode (Unrestricted painting)');
      }
    }
  }, [paintEngine, modelData, selectedIsland, paintConstraintMode]);

  const handleSelectIsland = useCallback((island: UVIsland | null) => {
    setSelectedIsland(island);
  }, []);

  const handleClearSelectedIsland = () => {
    setSelectedIsland(null);
  };

  // 3D Model Raycast Picking: User clicked on 3D face
  const handlePickUVFrom3D = useCallback(
    (u: number, v: number) => {
      if (!modelData) return;
      if (u < 0 || v < 0) {
        handleSelectIsland(null);
        return;
      }
      const island = findIslandAtUV(u, v, modelData.uvAnalysis);
      if (island) {
        handleSelectIsland(island);
      }
    },
    [modelData, handleSelectIsland]
  );

  // History controls
  const handleUndo = () => {
    if (paintEngine && paintEngine.canUndo()) {
      paintEngine.undo();
      bumpHistory();
      setStatusMessage('Undo');
    }
  };

  const handleRedo = () => {
    if (paintEngine && paintEngine.canRedo()) {
      paintEngine.redo();
      bumpHistory();
      setStatusMessage('Redo');
    }
  };

  const handleClearPaint = () => {
    if (paintEngine) {
      paintEngine.clearPaintLayer();
      bumpHistory();
      setStatusMessage('Cleared paint layer');
    }
  };

  const handleFillIsland = () => {
    if (paintEngine && selectedIsland) {
      paintEngine.fillIsland(brushSettings.color, brushSettings.opacity);
      bumpHistory();
      setStatusMessage(`Filled Island #${selectedIsland.id}`);
    }
  };

  const handleEnhancement = (type: 'seam-bleed' | 'sharpen' | 'blur', val?: number) => {
    if (!paintEngine) return;
    if (type === 'seam-bleed') {
      paintEngine.bleedUVSeams(val || 8);
      setStatusMessage(`Applied UV Seam Bleed (${val || 8}px margin)`);
    } else if (type === 'sharpen') {
      paintEngine.sharpenTexture(val || 1.0);
      setStatusMessage(`Applied Sharpen (${val || 1.0}x)`);
    } else if (type === 'blur') {
      paintEngine.blurTexture(val || 2);
      setStatusMessage(`Applied Denoise / Blur (${val || 2}px)`);
    }
    bumpHistory();
  };

  const handleAdjustColors = (opts: ColorAdjustmentOptions) => {
    if (!paintEngine) return;
    paintEngine.adjustColors(opts);
    setStatusMessage('Applied Color Adjustments');
    bumpHistory();
  };

  // File loading
  const handleLoadModelFile = async (file: File, textureFile?: File) => {
    try {
      setStatusMessage(`Loading ${file.name}...`);
      const loaded = await loadModelFile(file, textureFile);
      initModelWithEngine(loaded);
      if (loaded.hasTextureMap) {
        setStatusMessage(`Loaded: ${file.name} (with texture map)`);
      } else {
        setStatusMessage(`Loaded: ${file.name} • (Tip: Load texture map in Properties panel)`);
      }
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Error loading model: ${msg}`);
      setStatusMessage(`Error loading model`);
    }
  };

  const handleLoadTextureFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (paintEngine) {
          paintEngine.setBaseImage(img);
          setModelData((prev) => (prev ? { ...prev, hasTextureMap: true } : null));
          setStatusMessage(`Loaded texture map: ${file.name}`);
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const modelFile = files.find((f) => {
        const name = f.name.toLowerCase();
        return (
          name.endsWith('.glb') ||
          name.endsWith('.gltf') ||
          name.endsWith('.obj') ||
          name.endsWith('.fbx') ||
          name.endsWith('.zip')
        );
      });
      const textureFile = files.find((f) => {
        const name = f.name.toLowerCase();
        return (
          name.endsWith('.png') ||
          name.endsWith('.jpg') ||
          name.endsWith('.jpeg') ||
          name.endsWith('.webp')
        );
      });

      if (modelFile) {
        await handleLoadModelFile(modelFile, textureFile);
      } else if (textureFile) {
        handleLoadTextureFile(textureFile);
      }
    }
  };

  // Export actions
  const handleExportTexture = () => {
    if (!paintEngine) return;
    const dataUrl = paintEngine.exportImage('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    const baseName = modelData?.modelName.replace(/\.[^/.]+$/, '') || 'texture';
    a.download = `${baseName}_texture.png`;
    a.click();
    setStatusMessage(`Exported: ${a.download}`);
  };

  const handleExportGLB = async () => {
    if (!modelData) return;
    try {
      setStatusMessage('Exporting .GLB...');
      const blob = await exportGLB(modelData);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const baseName = modelData.modelName.replace(/\.[^/.]+$/, '');
      a.download = `${baseName}_fixed.glb`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusMessage(`Exported: ${a.download}`);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Export failed: ${msg}`);
      setStatusMessage('Export failed');
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="flex flex-col w-screen h-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans"
    >
      {/* Hidden file inputs for open dialog triggers */}
      <input
        type="file"
        ref={modelFileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleLoadModelFile(e.target.files[0]);
          }
        }}
        accept=".glb,.gltf,.obj,.fbx,.zip"
        className="hidden"
      />
      <input
        type="file"
        ref={textureFileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleLoadTextureFile(e.target.files[0]);
          }
        }}
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
      />

      {/* 1. Streamlined Top Bar (42px) with Primary Painting Tools */}
      <HeaderBar
        modelName={modelData?.modelName || 'No model loaded'}
        modelLoaded={!!modelData}
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        brushSettings={brushSettings}
        onUpdateBrushSettings={(patch) =>
          setBrushSettings((prev) => ({ ...prev, ...patch }))
        }
        canUndo={paintEngine ? paintEngine.canUndo() : false}
        canRedo={paintEngine ? paintEngine.canRedo() : false}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClearPaint={handleClearPaint}
        selectedIsland={selectedIsland}
        onClearSelectedIsland={handleClearSelectedIsland}
        paintConstraintMode={paintConstraintMode}
        onChangePaintConstraintMode={setPaintConstraintMode}
        showWireframe={showWireframe}
        onToggleWireframe={() => setShowWireframe(!showWireframe)}
        onLoadModelFile={handleLoadModelFile}
        onLoadTextureFile={handleLoadTextureFile}
        isPropertiesOpen={isPropertiesOpen}
        onToggleProperties={() => setIsPropertiesOpen(!isPropertiesOpen)}
        onOpenModelDialog={() => modelFileInputRef.current?.click()}
      />

      {/* 2. Main Workspace Split View + Properties Panel */}
      <div className="flex-1 w-full min-h-0 relative flex overflow-hidden">
        {/* Center Splitter: 3D Viewport & 2D UV Editor */}
        <div className="flex-1 h-full min-w-0 relative">
          <Splitter.Root
            defaultSize={[
              { id: 'viewport-3d', size: 45, minSize: 20 },
              { id: 'editor-2d', size: 55, minSize: 20 },
            ]}
            className="w-full h-full"
          >
            {/* Left: 3D Viewport */}
            <Splitter.Panel id="viewport-3d">
              <ThreeViewport
                modelData={modelData}
                paintEngine={paintEngine}
                activeTool={activeTool}
                brushSettings={brushSettings}
                selectedIsland={selectedIsland}
                paintConstraintMode={paintConstraintMode}
                onPickUV={handlePickUVFrom3D}
                onPickColor={handlePickColor}
                statusCallback={setStatusMessage}
                onOpenModelDialog={() => modelFileInputRef.current?.click()}
                lightingPreset={lightingPreset}
                autoRotate={autoRotate}
                onStrokeEnd={bumpHistory}
                wireframeLineWidth={wireframeLineWidth}
              />
            </Splitter.Panel>

            {/* Resizable Divider */}
            <Splitter.ResizeTrigger id="viewport-3d:editor-2d" aria-label="Resize panels" />

            {/* Right: 2D UV Map & Texture Editor (Full Height) */}
            <Splitter.Panel id="editor-2d">
              <div className="w-full h-full relative overflow-hidden">
                <UVEditorCanvas
                  modelData={modelData}
                  paintEngine={paintEngine}
                  activeTool={activeTool}
                  brushSettings={brushSettings}
                  selectedIsland={selectedIsland}
                  onSelectIsland={handleSelectIsland}
                  showWireframe={showWireframe}
                  onToggleWireframe={() => setShowWireframe(!showWireframe)}
                  wireframeOpacity={wireframeOpacity}
                  wireframeLineWidth={wireframeLineWidth}
                  onPickColor={handlePickColor}
                  zoomLevel={zoomLevel}
                  setZoomLevel={setZoomLevel}
                  onStrokeEnd={bumpHistory}
                  onUpdateBrushSettings={(patch) =>
                    setBrushSettings((prev) => ({ ...prev, ...patch }))
                  }
                  statusCallback={setStatusMessage}
                />
              </div>
            </Splitter.Panel>
          </Splitter.Root>
        </div>

        {/* Dedicated Properties Panel (Right side) */}
        <PropertiesPanel
          modelData={modelData}
          activeTool={activeTool}
          brushSettings={brushSettings}
          onUpdateBrushSettings={(patch) =>
            setBrushSettings((prev) => ({ ...prev, ...patch }))
          }
          recentColors={recentColors}
          onSelectColor={handleSelectColor}
          selectedIsland={selectedIsland}
          onClearSelectedIsland={handleClearSelectedIsland}
          onFillIsland={handleFillIsland}
          paintConstraintMode={paintConstraintMode}
          onChangePaintConstraintMode={setPaintConstraintMode}
          showWireframe={showWireframe}
          onToggleWireframe={() => setShowWireframe(!showWireframe)}
          wireframeOpacity={wireframeOpacity}
          onChangeWireframeOpacity={setWireframeOpacity}
          wireframeLineWidth={wireframeLineWidth}
          onChangeWireframeLineWidth={setWireframeLineWidth}
          lightingPreset={lightingPreset}
          onChangeLightingPreset={setLightingPreset}
          autoRotate={autoRotate}
          onToggleAutoRotate={() => setAutoRotate(!autoRotate)}
          onLoadModelClick={() => modelFileInputRef.current?.click()}
          onLoadTextureClick={() => textureFileInputRef.current?.click()}
          onClearPaint={handleClearPaint}
          onExportTexture={handleExportTexture}
          onExportGLB={handleExportGLB}
          isOpen={isPropertiesOpen}
          onClose={() => setIsPropertiesOpen(false)}
          onTriggerEnhancement={handleEnhancement}
          onAdjustColors={handleAdjustColors}
        />
      </div>

      {/* 3. Bottom Status Bar (24px) */}
      <StatusBar
        selectedIsland={selectedIsland}
        textureWidth={paintEngine?.getWidth() || 1024}
        textureHeight={paintEngine?.getHeight() || 1024}
        totalTriangles={modelData?.uvAnalysis.totalTriangles || 0}
        totalVertices={modelData?.uvAnalysis.totalVertices || 0}
        zoomLevel={zoomLevel}
        statusMessage={statusMessage}
        modelLoaded={!!modelData}
      />
    </div>
  );
};

export default App;
