import React, { useState } from 'react';
import {
  SlidersHorizontal,
  X,
  Image as ImageIcon,
  Box,
  Layers,
  Sun,
  Download,
  AlertTriangle,
  FolderOpen,
  Trash2,
  Paintbrush,
  Lock,
  Wand2,
  Sliders,
  Check,
} from 'lucide-react';
import {
  BrushSettings,
  ModelData,
  ToolType,
  UVIsland,
  LightingPreset,
  ColorAdjustmentOptions,
  BlendMode,
  PaintConstraintMode,
} from '../../core/types';
import { Button, IconButton, Badge, Tooltip } from '@/components/ui';
import * as Slider from '@/components/ui/slider';

interface PropertiesPanelProps {
  modelData: ModelData | null;
  activeTool: ToolType;
  brushSettings: BrushSettings;
  onUpdateBrushSettings: (settings: Partial<BrushSettings>) => void;
  recentColors: string[];
  onSelectColor: (color: string) => void;
  selectedIsland: UVIsland | null;
  onClearSelectedIsland: () => void;
  onFillIsland: () => void;
  selectedFaces?: number[];
  onClearSelectedFaces?: () => void;
  onFillFaces?: () => void;
  onSelectIslandFaces?: () => void;
  paintConstraintMode: PaintConstraintMode;
  onChangePaintConstraintMode: (mode: PaintConstraintMode) => void;
  showWireframe: boolean;
  onToggleWireframe: () => void;
  wireframeOpacity: number;
  onChangeWireframeOpacity: (val: number) => void;
  wireframeLineWidth: number;
  onChangeWireframeLineWidth: (val: number) => void;
  lightingPreset: LightingPreset;
  onChangeLightingPreset: (preset: LightingPreset) => void;
  autoRotate: boolean;
  onToggleAutoRotate: () => void;
  onLoadModelClick: () => void;
  onLoadTextureClick: () => void;
  onClearPaint: () => void;
  onExportTexture: () => void;
  onExportGLB: () => void;
  isOpen: boolean;
  onClose: () => void;
  onTriggerEnhancement?: (type: 'seam-bleed' | 'sharpen' | 'blur', val?: number) => void;
  onAdjustColors?: (opts: ColorAdjustmentOptions) => void;
}

// Categorized game artist color palettes
const COLOR_PALETTES = {
  shading: {
    label: 'Value & Shading',
    colors: [
      { name: 'Pure White', hex: '#ffffff' },
      { name: 'Highlight', hex: '#f4f4f5' },
      { name: 'Light Gray', hex: '#e4e4e7' },
      { name: 'Midtone', hex: '#a1a1aa' },
      { name: 'Neutral Gray', hex: '#71717a' },
      { name: 'Shadow Gray', hex: '#52525b' },
      { name: 'Dark Shadow', hex: '#3f3f46' },
      { name: 'Deep Shadow', hex: '#27272a' },
      { name: 'Near Black', hex: '#18181b' },
      { name: 'Pitch Black', hex: '#09090b' },
    ],
  },
  materials: {
    label: 'PBR Materials',
    colors: [
      { name: 'Gold / Brass', hex: '#facc15' },
      { name: 'Bronze', hex: '#d97706' },
      { name: 'Copper', hex: '#ea580c' },
      { name: 'Dark Rust', hex: '#991b1b' },
      { name: 'Warm Wood', hex: '#854d0e' },
      { name: 'Mahogany', hex: '#78350f' },
      { name: 'Leather Dark', hex: '#451a03' },
      { name: 'Stone Gray', hex: '#64748b' },
      { name: 'Iron Slate', hex: '#334155' },
      { name: 'Forest Moss', hex: '#166534' },
      { name: 'Earth Sand', hex: '#ca8a04' },
      { name: 'Raw Clay', hex: '#b45309' },
    ],
  },
  character: {
    label: 'Character & Skin',
    colors: [
      { name: 'Highlight Specular', hex: '#fef3c7' },
      { name: 'Fair Skin', hex: '#fed7aa' },
      { name: 'Warm Peach', hex: '#fdba74' },
      { name: 'Tan Skin', hex: '#fb923c' },
      { name: 'Blush / Lip', hex: '#f43f5e' },
      { name: 'Warm Brown', hex: '#9a3412' },
      { name: 'Deep Skin', hex: '#7c2d12' },
      { name: 'Dark Skin / Fur', hex: '#451a03' },
      { name: 'Hair Shadow', hex: '#1c1917' },
      { name: 'Eye Pupil', hex: '#0a0a0a' },
    ],
  },
  vfx: {
    label: 'Sci-Fi & VFX Glow',
    colors: [
      { name: 'Plasma Cyan', hex: '#06b6d4' },
      { name: 'Electric Blue', hex: '#3b82f6' },
      { name: 'Laser Lime', hex: '#84cc16' },
      { name: 'Acid Green', hex: '#22c55e' },
      { name: 'Hazard Yellow', hex: '#eab308' },
      { name: 'Warning Orange', hex: '#f97316' },
      { name: 'Crimson Glow', hex: '#ef4444' },
      { name: 'Plasma Purple', hex: '#a855f7' },
      { name: 'Neon Pink', hex: '#ec4899' },
      { name: 'Deep Indigo', hex: '#6366f1' },
    ],
  },
};

type PaletteCategory = keyof typeof COLOR_PALETTES;

const QUICK_SIZES = [2, 6, 12, 24, 48, 96];

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  modelData,
  activeTool,
  brushSettings,
  onUpdateBrushSettings,
  recentColors,
  onSelectColor,
  selectedIsland,
  onClearSelectedIsland,
  onFillIsland,
  selectedFaces = [],
  onClearSelectedFaces,
  onFillFaces,
  onSelectIslandFaces,
  paintConstraintMode,
  onChangePaintConstraintMode,
  showWireframe,
  onToggleWireframe,
  wireframeOpacity,
  onChangeWireframeOpacity,
  wireframeLineWidth,
  onChangeWireframeLineWidth,
  lightingPreset,
  onChangeLightingPreset,
  autoRotate,
  onToggleAutoRotate,
  onLoadModelClick,
  onLoadTextureClick,
  onClearPaint,
  onExportTexture,
  onExportGLB,
  isOpen,
  onClose,
  onTriggerEnhancement,
  onAdjustColors,
}) => {
  const [activePaletteTab, setActivePaletteTab] = useState<PaletteCategory>('shading');
  const [hexInput, setHexInput] = useState(brushSettings.color);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [saturation, setSaturation] = useState(0);
  const [invert, setInvert] = useState(false);
  const [seamPadding, setSeamPadding] = useState(8);

  const handleHexSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let val = hexInput.trim();
    if (!val.startsWith('#')) val = '#' + val;
    if (/^#[0-9A-Fa-f]{6}$/i.test(val) || /^#[0-9A-Fa-f]{3}$/i.test(val)) {
      onSelectColor(val);
    }
  };

  if (!isOpen) return null;

  return (
    <aside className="w-80 h-full bg-zinc-950 border-l border-zinc-800 flex flex-col z-20 shrink-0 text-zinc-300 font-sans select-none">
      {/* Panel Header */}
      <div className="h-[42px] px-3.5 border-b border-zinc-800 flex items-center justify-between shrink-0 bg-zinc-900/60">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
          <span className="text-xs font-semibold text-zinc-100 tracking-wide uppercase">
            Properties
          </span>
        </div>
        <Tooltip content="Close properties panel">
          <IconButton
            size="xs"
            variant="ghost"
            onClick={onClose}
            aria-label="Close properties"
            className="text-zinc-400 hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </IconButton>
        </Tooltip>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3.5 space-y-5 text-xs divide-y divide-zinc-800/80">
        {/* 1. BRUSH & TOOL PROPERTIES */}
        <div className="space-y-3.5 pt-0">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-200 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <Paintbrush className="w-3.5 h-3.5 text-zinc-400" />
              Brush & Color
            </span>
            <Badge variant="subtle" size="sm" className="capitalize text-[10px]">
              {activeTool}
            </Badge>
          </div>

          {/* Color preview & Hex input */}
          <div className="flex items-center gap-2.5 bg-zinc-900/80 p-2 rounded-md border border-zinc-800/80">
            <div className="relative group cursor-pointer shrink-0">
              <input
                type="color"
                value={brushSettings.color}
                onChange={(e) => {
                  onSelectColor(e.target.value);
                  setHexInput(e.target.value);
                }}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                title="Click to open color picker"
              />
              <div
                className="w-9 h-9 rounded border border-zinc-700 shadow-sm transition-transform group-hover:scale-105"
                style={{ backgroundColor: brushSettings.color }}
              />
            </div>

            <form onSubmit={handleHexSubmit} className="flex-1 flex items-center gap-1.5">
              <input
                type="text"
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                onBlur={handleHexSubmit}
                placeholder="#ffffff"
                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 font-mono focus:outline-none focus:border-zinc-500"
              />
            </form>
          </div>

          {/* Enhanced Color Palettes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-400 font-medium">Palette</span>
              {/* Category selector pills */}
              <div className="flex gap-1">
                {(Object.keys(COLOR_PALETTES) as PaletteCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActivePaletteTab(cat)}
                    className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${
                      activePaletteTab === cat
                        ? 'bg-zinc-800 text-zinc-100 font-medium'
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {cat === 'shading'
                      ? 'Shading'
                      : cat === 'materials'
                      ? 'PBR'
                      : cat === 'character'
                      ? 'Skin'
                      : 'VFX'}
                  </button>
                ))}
              </div>
            </div>

            {/* Active Category Swatches */}
            <div className="grid grid-cols-6 gap-1.5 p-2 bg-zinc-900/60 rounded-md border border-zinc-800/80">
              {COLOR_PALETTES[activePaletteTab].colors.map((c) => {
                const isSelected =
                  brushSettings.color.toLowerCase() === c.hex.toLowerCase();
                return (
                  <Tooltip key={c.hex} content={`${c.name} (${c.hex})`}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectColor(c.hex);
                        setHexInput(c.hex);
                      }}
                      style={{ backgroundColor: c.hex }}
                      className={`w-7 h-7 rounded border border-zinc-700/60 transition-transform flex items-center justify-center hover:scale-110 active:scale-95 ${
                        isSelected
                          ? 'ring-2 ring-white ring-offset-1 ring-offset-zinc-950 scale-105'
                          : ''
                      }`}
                      aria-label={c.name}
                    >
                      {isSelected && (
                        <Check
                          className={`w-3.5 h-3.5 ${
                            c.hex.toLowerCase() === '#ffffff' ||
                            c.hex.toLowerCase() === '#f4f4f5' ||
                            c.hex.toLowerCase() === '#fef3c7'
                              ? 'text-zinc-900'
                              : 'text-white'
                          }`}
                        />
                      )}
                    </button>
                  </Tooltip>
                );
              })}
            </div>

            {/* Recent Colors Memory */}
            {recentColors.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="text-[10px] text-zinc-500 font-medium">Recent Colors</span>
                <div className="flex flex-wrap gap-1.5">
                  {recentColors.map((color, idx) => (
                    <Tooltip key={`${color}-${idx}`} content={color}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectColor(color);
                          setHexInput(color);
                        }}
                        style={{ backgroundColor: color }}
                        className="w-5 h-5 rounded border border-zinc-700/60 hover:scale-110 active:scale-95 transition-transform"
                      />
                    </Tooltip>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Size Slider & Quick Presets */}
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Brush Size</span>
              <span className="font-mono text-zinc-200">{brushSettings.size}px</span>
            </div>
            <Slider.Root
              size="sm"
              value={[brushSettings.size]}
              min={1}
              max={120}
              step={1}
              onValueChange={(d) => onUpdateBrushSettings({ size: d.value[0] })}
              className="w-full flex items-center"
            >
              <Slider.Control className="relative flex items-center w-full h-3 cursor-pointer">
                <Slider.Track className="relative h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <Slider.Range className="h-full bg-zinc-300" />
                </Slider.Track>
                <Slider.Thumb
                  index={0}
                  className="w-3.5 h-3.5 rounded-full bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </Slider.Control>
            </Slider.Root>

            <div className="flex gap-1 pt-0.5">
              {QUICK_SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => onUpdateBrushSettings({ size: sz })}
                  className={`flex-1 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                    brushSettings.size === sz
                      ? 'bg-zinc-800 border-zinc-600 text-white'
                      : 'border-zinc-800/80 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {sz}px
                </button>
              ))}
            </div>
          </div>

          {/* Opacity Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Opacity</span>
              <span className="font-mono text-zinc-200">
                {Math.round(brushSettings.opacity * 100)}%
              </span>
            </div>
            <Slider.Root
              size="sm"
              value={[brushSettings.opacity * 100]}
              min={1}
              max={100}
              step={1}
              onValueChange={(d) => onUpdateBrushSettings({ opacity: d.value[0] / 100 })}
              className="w-full flex items-center"
            >
              <Slider.Control className="relative flex items-center w-full h-3 cursor-pointer">
                <Slider.Track className="relative h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <Slider.Range className="h-full bg-zinc-300" />
                </Slider.Track>
                <Slider.Thumb
                  index={0}
                  className="w-3.5 h-3.5 rounded-full bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </Slider.Control>
            </Slider.Root>
          </div>

          {/* Hardness Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Edge Hardness</span>
              <span className="font-mono text-zinc-200">
                {Math.round(brushSettings.hardness * 100)}%
              </span>
            </div>
            <Slider.Root
              size="sm"
              value={[brushSettings.hardness * 100]}
              min={0}
              max={100}
              step={1}
              onValueChange={(d) => onUpdateBrushSettings({ hardness: d.value[0] / 100 })}
              className="w-full flex items-center"
            >
              <Slider.Control className="relative flex items-center w-full h-3 cursor-pointer">
                <Slider.Track className="relative h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <Slider.Range className="h-full bg-zinc-300" />
                </Slider.Track>
                <Slider.Thumb
                  index={0}
                  className="w-3.5 h-3.5 rounded-full bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </Slider.Control>
            </Slider.Root>
          </div>

          {/* Blend Mode */}
          <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Blend Mode</span>
              <span className="font-mono text-zinc-400 text-[10px]">
                {brushSettings.blendMode === 'source-over' || !brushSettings.blendMode
                  ? 'Normal'
                  : brushSettings.blendMode}
              </span>
            </div>
            <select
              value={brushSettings.blendMode || 'source-over'}
              onChange={(e) => onUpdateBrushSettings({ blendMode: e.target.value as BlendMode })}
              className="w-full bg-zinc-950 text-zinc-200 text-xs rounded px-2.5 py-1.5 outline-none hover:bg-zinc-900 cursor-pointer border border-zinc-800 focus:border-zinc-600 transition-colors"
            >
              <option value="source-over">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="screen">Screen</option>
              <option value="overlay">Overlay</option>
              <option value="soft-light">Soft Light</option>
              <option value="lighter">Add / Lighten</option>
              <option value="darken">Darken</option>
              <option value="color-dodge">Color Dodge</option>
            </select>
          </div>

          {/* Brush Engine Style */}
          <div className="space-y-1.5 pt-1 border-t border-zinc-800/80">
            <span className="text-[11px] text-zinc-400">Brush Engine</span>
            <div className="grid grid-cols-2 gap-1 p-0.5 bg-zinc-950 rounded border border-zinc-800">
              <button
                type="button"
                onClick={() => onUpdateBrushSettings({ brushType: 'soft-round' })}
                className={`py-1 rounded text-[10px] font-medium transition-colors ${
                  (brushSettings.brushType || 'soft-round') === 'soft-round'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Soft Round
              </button>
              <button
                type="button"
                onClick={() => onUpdateBrushSettings({ brushType: 'freehand-ink' })}
                className={`py-1 rounded text-[10px] font-medium transition-colors ${
                  brushSettings.brushType === 'freehand-ink'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-600 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                Freehand Ink
              </button>
            </div>
          </div>

          {/* Spacing Slider */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Dab Spacing</span>
              <span className="font-mono text-zinc-200">
                {Math.round((brushSettings.spacing ?? 0.15) * 100)}%
              </span>
            </div>
            <Slider.Root
              size="sm"
              value={[Math.round((brushSettings.spacing ?? 0.15) * 100)]}
              min={5}
              max={50}
              step={1}
              onValueChange={(d) => onUpdateBrushSettings({ spacing: d.value[0] / 100 })}
              className="w-full flex items-center"
            >
              <Slider.Control className="relative flex items-center w-full h-3 cursor-pointer">
                <Slider.Track className="relative h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <Slider.Range className="h-full bg-zinc-300" />
                </Slider.Track>
                <Slider.Thumb
                  index={0}
                  className="w-3.5 h-3.5 rounded-full bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </Slider.Control>
            </Slider.Root>
          </div>

          {/* Stroke Smoothing / Stabilization */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-[11px]">
              <span className="text-zinc-400">Stroke Smoothing</span>
              <span className="font-mono text-zinc-200">
                {Math.round((brushSettings.smoothing ?? 0.5) * 100)}%
              </span>
            </div>
            <Slider.Root
              size="sm"
              value={[Math.round((brushSettings.smoothing ?? 0.5) * 100)]}
              min={0}
              max={100}
              step={5}
              onValueChange={(d) => onUpdateBrushSettings({ smoothing: d.value[0] / 100 })}
              className="w-full flex items-center"
            >
              <Slider.Control className="relative flex items-center w-full h-3 cursor-pointer">
                <Slider.Track className="relative h-1.5 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <Slider.Range className="h-full bg-zinc-300" />
                </Slider.Track>
                <Slider.Thumb
                  index={0}
                  className="w-3.5 h-3.5 rounded-full bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-zinc-400"
                />
              </Slider.Control>
            </Slider.Root>
          </div>

          {/* Clone Stamp Source Status */}
          {activeTool === 'clone-stamp' && (
            <div className="p-2 bg-zinc-900/70 rounded border border-zinc-800 text-[11px] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400 font-medium">Clone Source</span>
                {brushSettings.cloneSource && (
                  <button
                    type="button"
                    onClick={() => onUpdateBrushSettings({ cloneSource: null })}
                    className="text-[10px] text-zinc-500 hover:text-zinc-200"
                  >
                    Reset
                  </button>
                )}
              </div>
              <div className="text-zinc-300 font-mono text-[10px]">
                {brushSettings.cloneSource
                  ? `(${brushSettings.cloneSource.x}, ${brushSettings.cloneSource.y})`
                  : 'Hold Alt & Click texture to set'}
              </div>
            </div>
          )}
        </div>

        {/* 2. MODEL & TEXTURE STATUS */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-200 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <Box className="w-3.5 h-3.5 text-zinc-400" />
              Model & Texture
            </span>
            <Button
              variant="outline"
              size="xs"
              onClick={onLoadModelClick}
              className="text-[11px] h-6 px-2 text-zinc-300 hover:text-white"
            >
              <FolderOpen className="w-3 h-3 mr-1" />
              {modelData ? 'Replace' : 'Open Model'}
            </Button>
          </div>

          {modelData ? (
            <div className="space-y-2 bg-zinc-900/60 p-2.5 rounded-md border border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">File:</span>
                <span className="text-zinc-200 font-medium truncate max-w-[170px]" title={modelData.modelName}>
                  {modelData.modelName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Geometry:</span>
                <span className="text-zinc-300 font-mono">
                  {modelData.uvAnalysis.totalTriangles.toLocaleString()} tris
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-400">Resolution:</span>
                <span className="text-zinc-300 font-mono">
                  {modelData.textureCanvas.width} × {modelData.textureCanvas.height}
                </span>
              </div>

              {/* Texture Map Alert if FBX loaded without texture */}
              {!modelData.hasTextureMap ? (
                <div className="p-2 mt-1 rounded bg-zinc-900 border border-zinc-800 space-y-1.5">
                  <div className="flex items-start gap-1.5 text-zinc-200 font-medium text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-zinc-400" />
                    <span>No texture map detected</span>
                  </div>
                  <p className="text-[10px] text-zinc-400 leading-relaxed">
                    Tripo AI FBX models often have an external texture image. Attach your texture file to view and paint over it.
                  </p>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={onLoadTextureClick}
                    className="w-full text-xs text-zinc-200 hover:text-white border-zinc-700 hover:bg-zinc-800"
                  >
                    <ImageIcon className="w-3.5 h-3.5 mr-1 text-zinc-400" />
                    Load Texture Image (.png / .jpg)
                  </Button>
                </div>
              ) : (
                <div className="pt-1 flex gap-1.5">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={onLoadTextureClick}
                    className="flex-1 text-[11px] h-6 text-zinc-300 hover:text-white"
                  >
                    <ImageIcon className="w-3 h-3 mr-1 text-zinc-400" />
                    Replace Texture
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={onClearPaint}
                    className="h-6 px-2 text-zinc-400 hover:text-zinc-100"
                    title="Clear paint strokes"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-zinc-500 text-center py-4 bg-zinc-900/40 rounded border border-dashed border-zinc-800">
              No 3D model loaded
            </div>
          )}
        </div>

        {/* 3. UV SELECTION & MASKING */}
        <div className="space-y-2.5 pt-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-200 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
              UV Selection & Masking
            </span>
            {paintConstraintMode !== 'free' && (selectedIsland || selectedFaces.length > 0) && (
              <Badge variant="outline" size="sm" className="text-[10px] text-zinc-300 border-zinc-700">
                Active Mask
              </Badge>
            )}
          </div>

          {/* Paint Mode Selection: 3-way toggle */}
          <div className="space-y-1.5 bg-zinc-900/50 p-2 rounded border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-300">Paint Constraint</span>
              <span className="text-[10px] text-zinc-500 font-mono">Key: M</span>
            </div>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-zinc-950 rounded border border-zinc-800">
              <button
                type="button"
                onClick={() => onChangePaintConstraintMode('free')}
                className={`py-1 rounded text-[11px] font-medium transition-colors ${
                  paintConstraintMode === 'free'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => onChangePaintConstraintMode('islands')}
                className={`py-1 rounded text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
                  paintConstraintMode === 'islands'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-600 shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>Islands</span>
              </button>
              <button
                type="button"
                onClick={() => onChangePaintConstraintMode('faces')}
                className={`py-1 rounded text-[11px] font-medium transition-colors flex items-center justify-center gap-1 ${
                  paintConstraintMode === 'faces'
                    ? 'bg-zinc-800 text-zinc-100 border border-zinc-600 shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Box className="w-3 h-3" />
                <span>Faces</span>
              </button>
            </div>
            <p className="text-[10px] text-zinc-500 leading-normal">
              {paintConstraintMode === 'free'
                ? 'Strokes paint freely across all mesh regions with zero boundary clipping.'
                : paintConstraintMode === 'islands'
                ? selectedIsland
                  ? `Strokes are locked inside Island #${selectedIsland.id} to prevent seam bleeding.`
                  : 'Strokes will lock inside whatever island is selected.'
                : selectedFaces.length > 0
                ? `Strokes are locked strictly inside the ${selectedFaces.length} selected face(s).`
                : 'Click faces in 3D or 2D to select them and constrain painting.'}
            </p>
          </div>

          {/* Mode 1: Free Mode Status */}
          {paintConstraintMode === 'free' && (
            <div className="p-2.5 bg-zinc-900/40 rounded border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
              <span className="text-zinc-200 font-medium block mb-1">Free Painting Mode</span>
              Draw freely on any part of the model or texture without selection boundaries or masks.
            </div>
          )}

          {/* Mode 2: Island Selection Card */}
          {paintConstraintMode === 'islands' && (
            selectedIsland ? (
              <div className="space-y-2 bg-zinc-900/70 p-2.5 rounded-md border border-zinc-700/80">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-100 font-medium">Island #{selectedIsland.id}</span>
                  <span className="font-mono text-zinc-400">
                    {selectedIsland.triangleIndices.length} triangles
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Paint strokes are constrained to this UV region to prevent seam bleeding.
                </p>
                <div className="space-y-1 pt-1 border-t border-zinc-800">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                    <span>UV Line Thickness</span>
                    <span className="font-mono text-zinc-200 font-semibold">{wireframeLineWidth.toFixed(1)}px</span>
                  </div>
                  <div className="flex gap-1">
                    {[0.5, 1.0, 1.5, 2.0, 3.0].map((thickness) => (
                      <button
                        key={thickness}
                        type="button"
                        onClick={() => onChangeWireframeLineWidth(thickness)}
                        className={`flex-1 py-0.5 rounded text-[9px] font-mono transition-colors border ${
                          Math.abs(wireframeLineWidth - thickness) < 0.1
                            ? 'bg-zinc-800 text-zinc-100 border-zinc-600 font-semibold'
                            : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800/40'
                        }`}
                      >
                        {thickness}px
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <Button
                    variant="solid"
                    size="xs"
                    onClick={onFillIsland}
                    className="flex-1 text-[11px] h-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                  >
                    Fill Island
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={onClearSelectedIsland}
                    className="text-[11px] h-6 px-2 text-zinc-400 hover:text-zinc-200"
                  >
                    Unmask (Esc)
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-900/40 p-2 rounded border border-zinc-800/80">
                Click any part of the 3D mesh or 2D UV layout to select its island.
              </p>
            )
          )}

          {/* Mode 3: Faces Selection Card */}
          {paintConstraintMode === 'faces' && (
            selectedFaces.length > 0 ? (
              <div className="space-y-2 bg-zinc-900/70 p-2.5 rounded-md border border-zinc-700/80">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-100 font-medium">
                    {selectedFaces.length} Face{selectedFaces.length > 1 ? 's' : ''} Selected
                  </span>
                  <span className="font-mono text-zinc-400 text-[10px]">
                    Shift+Click to multi-select
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 leading-normal">
                  Paint strokes and bucket fills are locked inside these individual polygons.
                </p>
                <div className="space-y-1 pt-1 border-t border-zinc-800">
                  <div className="flex justify-between items-center text-[10px] text-zinc-400">
                    <span>UV Line Thickness</span>
                    <span className="font-mono text-zinc-200 font-semibold">{wireframeLineWidth.toFixed(1)}px</span>
                  </div>
                  <div className="flex gap-1">
                    {[0.5, 1.0, 1.5, 2.0, 3.0].map((thickness) => (
                      <button
                        key={thickness}
                        type="button"
                        onClick={() => onChangeWireframeLineWidth(thickness)}
                        className={`flex-1 py-0.5 rounded text-[9px] font-mono transition-colors border ${
                          Math.abs(wireframeLineWidth - thickness) < 0.1
                            ? 'bg-zinc-800 text-zinc-100 border-zinc-600 font-semibold'
                            : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800/40'
                        }`}
                      >
                        {thickness}px
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-1.5 pt-1">
                  <Button
                    variant="solid"
                    size="xs"
                    onClick={onFillFaces || onFillIsland}
                    className="flex-1 text-[11px] h-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
                  >
                    Fill Faces
                  </Button>
                  {onSelectIslandFaces && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={onSelectIslandFaces}
                      className="text-[11px] h-6 px-2 text-zinc-300 hover:text-white"
                      title="Select all faces in this island"
                    >
                      Expand
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={onClearSelectedFaces}
                    className="text-[11px] h-6 px-2 text-zinc-400 hover:text-zinc-200"
                  >
                    Clear (Esc)
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-zinc-500 leading-relaxed bg-zinc-900/40 p-2 rounded border border-zinc-800/80">
                Click any face on the 3D model or 2D UV wireframe to select it. Hold <span className="font-semibold text-zinc-300">Shift</span> to select multiple faces.
              </p>
            )
          )}
        </div>

        {/* 4. TEXTURE ENHANCEMENT & REPAIR */}
        <div className="space-y-3 pt-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-200 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
              <Wand2 className="w-3.5 h-3.5 text-zinc-400" />
              Texture Enhancement
            </span>
            <Badge variant="subtle" size="sm" className="text-[10px] text-zinc-400">
              {selectedIsland ? `Island #${selectedIsland.id}` : 'Global'}
            </Badge>
          </div>

          {/* UV Seam Bleed / Margin Dilation */}
          <div className="p-2.5 bg-zinc-900/50 rounded border border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-200">UV Seam Bleed (Dilation)</span>
              <span className="text-[10px] text-zinc-500 font-mono">{seamPadding}px</span>
            </div>
            <p className="text-[10px] text-zinc-500 leading-normal">
              Expands border pixels outward to eliminate dark seam lines on 3D meshes.
            </p>
            <div className="flex gap-1">
              {[4, 8, 16].map((pad) => (
                <button
                  key={pad}
                  type="button"
                  onClick={() => setSeamPadding(pad)}
                  className={`flex-1 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                    seamPadding === pad
                      ? 'bg-zinc-800 border-zinc-600 text-white'
                      : 'border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {pad}px
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="xs"
              disabled={!modelData}
              onClick={() => onTriggerEnhancement?.('seam-bleed', seamPadding)}
              className="w-full text-[11px] h-6 text-zinc-300 hover:text-white"
            >
              Apply Seam Bleed
            </Button>
          </div>

          {/* Color Adjustments */}
          <div className="p-2.5 bg-zinc-900/50 rounded border border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-200 flex items-center gap-1">
                <Sliders className="w-3 h-3 text-zinc-400" />
                Color Adjustments
              </span>
              {(brightness !== 0 || contrast !== 0 || saturation !== 0 || invert) && (
                <button
                  type="button"
                  onClick={() => {
                    setBrightness(0);
                    setContrast(0);
                    setSaturation(0);
                    setInvert(false);
                  }}
                  className="text-[10px] text-zinc-500 hover:text-zinc-200"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Brightness */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Brightness</span>
                <span className="font-mono">{brightness > 0 ? `+${brightness}` : brightness}</span>
              </div>
              <Slider.Root
                size="sm"
                value={[brightness]}
                min={-100}
                max={100}
                step={5}
                onValueChange={(d) => setBrightness(d.value[0])}
                className="w-full flex items-center"
              >
                <Slider.Control className="relative flex items-center w-full h-2.5 cursor-pointer">
                  <Slider.Track className="relative h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <Slider.Range className="h-full bg-zinc-400" />
                  </Slider.Track>
                  <Slider.Thumb index={0} className="w-3 h-3 rounded-full bg-white shadow focus:outline-none" />
                </Slider.Control>
              </Slider.Root>
            </div>

            {/* Contrast */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Contrast</span>
                <span className="font-mono">{contrast > 0 ? `+${contrast}` : contrast}</span>
              </div>
              <Slider.Root
                size="sm"
                value={[contrast]}
                min={-100}
                max={100}
                step={5}
                onValueChange={(d) => setContrast(d.value[0])}
                className="w-full flex items-center"
              >
                <Slider.Control className="relative flex items-center w-full h-2.5 cursor-pointer">
                  <Slider.Track className="relative h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <Slider.Range className="h-full bg-zinc-400" />
                  </Slider.Track>
                  <Slider.Thumb index={0} className="w-3 h-3 rounded-full bg-white shadow focus:outline-none" />
                </Slider.Control>
              </Slider.Root>
            </div>

            {/* Saturation */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>Saturation</span>
                <span className="font-mono">{saturation > 0 ? `+${saturation}` : saturation}</span>
              </div>
              <Slider.Root
                size="sm"
                value={[saturation]}
                min={-100}
                max={100}
                step={5}
                onValueChange={(d) => setSaturation(d.value[0])}
                className="w-full flex items-center"
              >
                <Slider.Control className="relative flex items-center w-full h-2.5 cursor-pointer">
                  <Slider.Track className="relative h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <Slider.Range className="h-full bg-zinc-400" />
                  </Slider.Track>
                  <Slider.Thumb index={0} className="w-3 h-3 rounded-full bg-white shadow focus:outline-none" />
                </Slider.Control>
              </Slider.Root>
            </div>

            {/* Invert */}
            <label className="flex items-center gap-2 cursor-pointer text-[10px] text-zinc-400 pt-0.5">
              <input
                type="checkbox"
                checked={invert}
                onChange={(e) => setInvert(e.target.checked)}
                className="rounded bg-zinc-800 border-zinc-700 text-zinc-100 accent-zinc-400 focus:ring-0"
              />
              <span>Invert Colors</span>
            </label>

            <Button
              variant="solid"
              size="xs"
              disabled={!modelData || (brightness === 0 && contrast === 0 && saturation === 0 && !invert)}
              onClick={() => {
                onAdjustColors?.({ brightness, contrast, saturation, hue: 0, invert });
                setBrightness(0);
                setContrast(0);
                setSaturation(0);
                setInvert(false);
              }}
              className="w-full text-[11px] h-6 bg-zinc-800 hover:bg-zinc-700 text-zinc-100"
            >
              Apply Adjustments
            </Button>
          </div>
        </div>

        {/* 5. VIEWPORT & LIGHTING */}
        <div className="space-y-3 pt-4">
          <span className="font-semibold text-zinc-200 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
            <Sun className="w-3.5 h-3.5 text-zinc-400" />
            Viewport & Lighting
          </span>

          {/* Wireframe toggle & opacity */}
          <div className="space-y-1.5 bg-zinc-900/50 p-2 rounded border border-zinc-800">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-300">UV Wireframe Overlay</span>
              <button
                type="button"
                onClick={onToggleWireframe}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  showWireframe
                    ? 'bg-zinc-200 text-zinc-900'
                    : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {showWireframe ? 'Visible' : 'Hidden'}
              </button>
            </div>

            {/* Opacity */}
            <div className="pt-1.5 space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>UV Map Opacity (Mesh & Selection)</span>
                <span className="font-mono">{Math.round(wireframeOpacity * 100)}%</span>
              </div>
              <Slider.Root
                size="sm"
                value={[wireframeOpacity * 100]}
                min={5}
                max={100}
                step={5}
                onValueChange={(d) => onChangeWireframeOpacity(d.value[0] / 100)}
                className="w-full flex items-center"
              >
                <Slider.Control className="relative flex items-center w-full h-2.5 cursor-pointer">
                  <Slider.Track className="relative h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <Slider.Range className="h-full bg-zinc-400" />
                  </Slider.Track>
                  <Slider.Thumb
                    index={0}
                    className="w-3 h-3 rounded-full bg-white shadow focus:outline-none"
                  />
                </Slider.Control>
              </Slider.Root>
            </div>

            {/* Line Thickness (Controls both Selection and Mesh Wireframe) */}
            <div className="space-y-1.5 pt-1 border-t border-zinc-800/60">
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>UV Line Thickness (Mesh & Selection)</span>
                <span className="font-mono text-zinc-300 font-semibold">{wireframeLineWidth.toFixed(1)}px</span>
              </div>
              <Slider.Root
                size="sm"
                value={[wireframeLineWidth * 10]}
                min={5}
                max={50}
                step={2.5}
                onValueChange={(d) => onChangeWireframeLineWidth(d.value[0] / 10)}
                className="w-full flex items-center"
              >
                <Slider.Control className="relative flex items-center w-full h-2.5 cursor-pointer">
                  <Slider.Track className="relative h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
                    <Slider.Range className="h-full bg-zinc-400" />
                  </Slider.Track>
                  <Slider.Thumb
                    index={0}
                    className="w-3 h-3 rounded-full bg-white shadow focus:outline-none"
                  />
                </Slider.Control>
              </Slider.Root>
              {/* Quick thickness presets */}
              <div className="flex gap-1 pt-0.5">
                {[0.5, 1.0, 1.5, 2.0, 3.0].map((thickness) => (
                  <button
                    key={thickness}
                    type="button"
                    onClick={() => onChangeWireframeLineWidth(thickness)}
                    className={`flex-1 py-0.5 rounded text-[9px] font-mono transition-colors border ${
                      Math.abs(wireframeLineWidth - thickness) < 0.1
                        ? 'bg-zinc-800 text-zinc-100 border-zinc-600 font-semibold'
                        : 'bg-zinc-900/60 text-zinc-400 border-zinc-800 hover:text-zinc-200 hover:bg-zinc-800/40'
                    }`}
                  >
                    {thickness}px
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 3D Lighting Presets */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-zinc-400">3D Lighting</span>
            <div className="grid grid-cols-3 gap-1">
              {(['studio', 'sunlight', 'soft-ambient'] as LightingPreset[]).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onChangeLightingPreset(preset)}
                  className={`py-1 rounded text-[10px] capitalize transition-colors border ${
                    lightingPreset === preset
                      ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                      : 'border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {preset.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* 3D Auto-rotate toggle */}
          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-zinc-400">Auto-Rotate Model</span>
            <button
              type="button"
              onClick={onToggleAutoRotate}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                autoRotate
                  ? 'bg-zinc-200 text-zinc-900'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {autoRotate ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* 5. EXPORT ACTIONS */}
        <div className="space-y-2.5 pt-4 pb-2">
          <span className="font-semibold text-zinc-200 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            Export & Save
          </span>

          <div className="space-y-1.5">
            <Button
              variant="outline"
              size="xs"
              disabled={!modelData}
              onClick={onExportTexture}
              className="w-full text-xs justify-center text-zinc-200 hover:text-white disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export Texture (.PNG)
            </Button>
            <Button
              variant="solid"
              size="xs"
              disabled={!modelData}
              onClick={onExportGLB}
              className="w-full text-xs justify-center font-medium disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export 3D Model (.GLB)
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};
