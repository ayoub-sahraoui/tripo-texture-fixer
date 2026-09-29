import React, { useRef } from 'react';
import {
  Box,
  FolderOpen,
  Image as ImageIcon,
  Paintbrush,
  Eraser,
  Pipette,
  PaintBucket,
  MousePointerClick,
  Hand,
  RotateCcw,
  RotateCw,
  Trash2,
  PanelRight,
  PanelRightClose,
  Lock,
  Layers,
  X,
  Stamp,
  Flame,
  Sparkles,
} from 'lucide-react';
import { ToolType, UVIsland, BrushSettings } from '../../core/types';
import { Button, IconButton, Badge, Tooltip } from '@/components/ui';

interface HeaderBarProps {
  modelName: string;
  modelLoaded: boolean;
  activeTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  brushSettings: BrushSettings;
  onUpdateBrushSettings?: (patch: Partial<BrushSettings>) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClearPaint: () => void;
  selectedIsland: UVIsland | null;
  onClearSelectedIsland: () => void;
  paintConstraintMode: 'free' | 'selection';
  onChangePaintConstraintMode: (mode: 'free' | 'selection') => void;
  showWireframe?: boolean;
  onToggleWireframe?: () => void;
  onLoadModelFile: (file: File) => void;
  onLoadTextureFile: (file: File) => void;
  isPropertiesOpen: boolean;
  onToggleProperties: () => void;
  onOpenModelDialog?: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  modelName,
  modelLoaded,
  activeTool,
  onSelectTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onClearPaint,
  selectedIsland,
  onClearSelectedIsland,
  paintConstraintMode,
  onChangePaintConstraintMode,
  showWireframe = true,
  onToggleWireframe,
  onLoadModelFile,
  onLoadTextureFile,
  isPropertiesOpen,
  onToggleProperties,
  onOpenModelDialog,
}) => {
  const modelInputRef = useRef<HTMLInputElement>(null);
  const textureInputRef = useRef<HTMLInputElement>(null);

  const handleModelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onLoadModelFile(e.target.files[0]);
    }
  };

  const handleTextureChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onLoadTextureFile(e.target.files[0]);
    }
  };

  const getToolClass = (tool: ToolType) => {
    const isActive = activeTool === tool;
    return `h-7 w-7 rounded-md transition-all border ${
      isActive
        ? 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-sm'
        : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 border-transparent'
    }`;
  };

  return (
    <header className="h-[42px] bg-zinc-950 border-b border-zinc-800 px-3 flex items-center justify-between select-none z-30 shrink-0 text-zinc-300 w-full overflow-x-auto scrollbar-none gap-2">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={modelInputRef}
        onChange={handleModelChange}
        accept=".glb,.gltf,.obj,.fbx,.zip"
        className="hidden"
      />
      <input
        type="file"
        ref={textureInputRef}
        onChange={handleTextureChange}
        accept=".png,.jpg,.jpeg,.webp"
        className="hidden"
      />

      {/* 1. Left: Brand & File Operations (Prioritized CTAs) */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 pr-2 border-r border-zinc-800">
          <Box className="w-4 h-4 text-zinc-200" />
          <span className="text-xs font-semibold text-zinc-100 tracking-tight hidden sm:inline">
            Tripo Texture Fixer
          </span>
          <span className="text-xs font-semibold text-zinc-100 tracking-tight sm:hidden">
            Tripo
          </span>
          <Badge variant="subtle" size="sm" className="hidden md:inline-flex">
            3D
          </Badge>
        </div>

        {/* File Actions */}
        <div className="flex items-center gap-1">
          {/* Open Model - High Priority CTA */}
          <Tooltip content="Open 3D model (.glb, .gltf, .fbx, .obj, .zip)">
            <Button
              variant="outline"
              size="xs"
              onClick={() => onOpenModelDialog ? onOpenModelDialog() : modelInputRef.current?.click()}
              className="gap-1.5 text-xs text-zinc-200 bg-zinc-900 border-zinc-700/80 hover:bg-zinc-800 hover:text-white hover:border-zinc-600"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Open Model</span>
            </Button>
          </Tooltip>

          {/* Open Texture */}
          <Tooltip content={modelLoaded ? "Attach or replace texture image (.png / .jpg)" : "Load a 3D model first"}>
            <Button
              variant="outline"
              size="xs"
              disabled={!modelLoaded}
              onClick={() => textureInputRef.current?.click()}
              className="gap-1.5 text-xs text-zinc-300 hover:text-white border-zinc-800 hover:border-zinc-700 disabled:opacity-40"
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Open Texture</span>
            </Button>
          </Tooltip>
        </div>
      </div>

      {/* 2. Center: Dedicated Tools Group (Highest Interaction Priority) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Core Tool Palette */}
        <div className={`flex items-center gap-0.5 bg-zinc-900/90 p-0.5 rounded-lg border border-zinc-800 transition-opacity ${
          !modelLoaded ? 'opacity-40 pointer-events-none' : ''
        }`}>
          <Tooltip content="Brush Tool" shortcut="B">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => onSelectTool('brush')}
              aria-label="Brush"
              className={getToolClass('brush')}
            >
              <Paintbrush className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <Tooltip content="Eraser Tool" shortcut="E">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => onSelectTool('eraser')}
              aria-label="Eraser"
              className={getToolClass('eraser')}
            >
              <Eraser className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <Tooltip content="Eyedropper Tool" shortcut="I">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => onSelectTool('eyedropper')}
              aria-label="Eyedropper"
              className={getToolClass('eyedropper')}
            >
              <Pipette className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <Tooltip content="Fill Bucket" shortcut="G">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => onSelectTool('bucket')}
              aria-label="Bucket"
              className={getToolClass('bucket')}
            >
              <PaintBucket className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <Tooltip content="Clone Stamp (Alt+Click to pick source)" shortcut="C">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => onSelectTool('clone-stamp')}
              aria-label="Clone Stamp"
              className={getToolClass('clone-stamp')}
            >
              <Stamp className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <Tooltip content="Smudge Tool (Blend & pull colors)" shortcut="R">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => onSelectTool('smudge')}
              aria-label="Smudge"
              className={getToolClass('smudge')}
            >
              <Flame className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <Tooltip content="Blur / Soften Tool" shortcut="J">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => onSelectTool('blur')}
              aria-label="Blur"
              className={getToolClass('blur')}
            >
              <Sparkles className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <div className="w-px h-3.5 bg-zinc-800 mx-0.5" />

          <Tooltip content="UV Island Selection (Mask paint to region)" shortcut="S">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => onSelectTool('island-select')}
              aria-label="Island select"
              className={getToolClass('island-select')}
            >
              <MousePointerClick className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <Tooltip content="Pan View" shortcut="H">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={() => onSelectTool('pan')}
              aria-label="Pan"
              className={getToolClass('pan')}
            >
              <Hand className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>
        </div>

        {/* Undo / Redo / Clear Group */}
        <div className="flex items-center gap-0.5 pl-1 border-l border-zinc-800">
          <Tooltip content="Undo stroke" shortcut="Ctrl+Z">
            <IconButton
              size="xs"
              variant="ghost"
              disabled={!canUndo}
              onClick={onUndo}
              aria-label="Undo"
              className="h-7 w-7 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <Tooltip content="Redo stroke" shortcut="Ctrl+Y">
            <IconButton
              size="xs"
              variant="ghost"
              disabled={!canRedo}
              onClick={onRedo}
              aria-label="Redo"
              className="h-7 w-7 text-zinc-400 hover:text-zinc-100 disabled:opacity-30"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>

          <Tooltip content={modelLoaded ? "Clear paint layer" : "No model loaded"}>
            <IconButton
              size="xs"
              variant="ghost"
              disabled={!modelLoaded}
              onClick={onClearPaint}
              aria-label="Clear paint"
              className="h-7 w-7 text-zinc-400 hover:text-zinc-100 disabled:opacity-30 hidden sm:inline-flex"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>
        </div>

        {/* Paint Mode: Free vs On Selection (Responsive) */}
        {modelLoaded && (
          <div className="flex items-center">
            {/* Desktop Segmented Toggle */}
            <div className="hidden sm:flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5 text-xs">
              <Tooltip content="Free paint mode without boundaries" shortcut="M">
                <button
                  type="button"
                  onClick={() => onChangePaintConstraintMode('free')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                    paintConstraintMode === 'free'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-600'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Free
                </button>
              </Tooltip>
              <Tooltip
                content={
                  selectedIsland
                    ? `Constrain strokes to Island #${selectedIsland.id}`
                    : "Constrain strokes to selected UV island"
                }
                shortcut="M"
              >
                <button
                  type="button"
                  onClick={() => onChangePaintConstraintMode('selection')}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                    paintConstraintMode === 'selection'
                      ? 'bg-zinc-800 text-zinc-100 shadow-sm border border-zinc-600'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  <span>Selection</span>
                </button>
              </Tooltip>
            </div>

            {/* Mobile / Narrow Screen Single Toggle Icon */}
            <div className="sm:hidden">
              <Tooltip
                content={paintConstraintMode === 'selection' ? 'Switch to Free Paint' : 'Switch to Island Constraint'}
                shortcut="M"
              >
                <IconButton
                  size="xs"
                  variant="ghost"
                  onClick={() => onChangePaintConstraintMode(paintConstraintMode === 'selection' ? 'free' : 'selection')}
                  aria-label="Toggle Paint Mode"
                  className={`h-7 w-7 border ${
                    paintConstraintMode === 'selection'
                      ? 'bg-zinc-800 text-zinc-100 border-zinc-600'
                      : 'text-zinc-400 border-zinc-800'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                </IconButton>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Active Island Indicator Pill */}
        {selectedIsland && (
          <div
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] border transition-colors shrink-0 ${
              paintConstraintMode === 'selection'
                ? 'bg-zinc-900 border-zinc-700 text-zinc-200 font-medium'
                : 'bg-zinc-900/80 border-zinc-800 text-zinc-400'
            }`}
          >
            <span className="font-mono text-[10px]">
              {paintConstraintMode === 'selection' ? `Mask #${selectedIsland.id}` : `#${selectedIsland.id}`}
            </span>
            <button
              type="button"
              onClick={onClearSelectedIsland}
              className="text-zinc-400 hover:text-white transition-colors"
              title="Clear selected island (Esc)"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* 3. Right: Workstation Panel Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Model name (optional subtle indicator on wide screens) */}
        {modelLoaded && (
          <span className="text-zinc-500 text-[11px] font-mono truncate max-w-[130px] hidden 2xl:inline" title={modelName}>
            {modelName}
          </span>
        )}

        {/* UV Wireframe Overlay Quick Toggle (Only on extra large screens) */}
        {modelLoaded && onToggleWireframe && (
          <Tooltip content={showWireframe ? "Hide UV Map Over Texture (U)" : "Show UV Map Over Texture (U)"} shortcut="U">
            <IconButton
              size="xs"
              variant="ghost"
              onClick={onToggleWireframe}
              aria-label="Toggle UV map overlay"
              className={`h-7 w-7 rounded-md border transition-colors hidden xl:inline-flex ${
                showWireframe
                  ? 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border-transparent hover:border-zinc-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
            </IconButton>
          </Tooltip>
        )}

        {/* Properties Panel Toggle - High Priority Layout Anchor */}
        <Tooltip
          content={isPropertiesOpen ? "Collapse Properties panel (P)" : "Expand Properties panel (P)"}
          shortcut="P"
        >
          <Button
            variant="outline"
            size="xs"
            onClick={onToggleProperties}
            aria-label="Toggle properties panel"
            className={`gap-1.5 text-xs transition-colors ${
              isPropertiesOpen
                ? 'bg-zinc-800 text-zinc-100 border-zinc-600 shadow-sm hover:bg-zinc-700'
                : 'text-zinc-400 hover:text-zinc-100 border-zinc-800 hover:border-zinc-700 bg-transparent'
            }`}
          >
            {isPropertiesOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRight className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline font-medium">Properties</span>
          </Button>
        </Tooltip>
      </div>
    </header>
  );
};
