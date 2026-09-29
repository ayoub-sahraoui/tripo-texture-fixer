import React from 'react';
import { Layers, Eye, Crosshair } from 'lucide-react';
import { UVIsland, UVPoint } from '../../core/types';
import { Badge } from '@/components/ui';

interface StatusBarProps {
  hoverUV?: UVPoint | null;
  selectedIsland: UVIsland | null;
  textureWidth: number;
  textureHeight: number;
  totalTriangles: number;
  totalVertices: number;
  zoomLevel: number;
  statusMessage?: string;
  modelLoaded?: boolean;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  hoverUV = null,
  selectedIsland,
  textureWidth,
  textureHeight,
  totalTriangles,
  totalVertices,
  zoomLevel,
  statusMessage,
  modelLoaded = true,
}) => {
  return (
    <footer className="h-[24px] bg-zinc-950 border-t border-zinc-800 px-3 flex items-center justify-between text-xs text-zinc-400 select-none z-30 shrink-0">
      {/* Left: Status & Active Mask */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          <span className="text-zinc-300">
            {statusMessage || (modelLoaded ? 'Ready' : 'Ready • No model loaded')}
          </span>
        </div>

        {modelLoaded && (
          selectedIsland ? (
            <div className="flex items-center gap-1.5 text-zinc-200">
              <Badge variant="subtle" size="sm">
                <Layers className="w-3 h-3 mr-1 inline" />
                Island #{selectedIsland.id} ({selectedIsland.triangleIndices.length} tris)
              </Badge>
            </div>
          ) : (
            <span className="text-zinc-500">Unrestricted</span>
          )
        )}
      </div>

      {/* Center: Cursor UV Coordinates */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 text-zinc-300">
          <Crosshair className="w-3 h-3 text-zinc-500" />
          <span id="statusbar-uv-coords" className="font-mono text-zinc-400">
            {hoverUV ? `UV: ${hoverUV.u.toFixed(3)}, ${hoverUV.v.toFixed(3)}` : 'UV: --'}
          </span>
        </div>
      </div>

      {/* Right: Technical Stats */}
      <div className="flex items-center gap-3 text-zinc-400">
        <div>
          <span>{modelLoaded ? `${textureWidth}×${textureHeight}` : '-- × --'}</span>
        </div>

        <div>
          <span>
            {modelLoaded
              ? `${totalTriangles.toLocaleString()} tris / ${totalVertices.toLocaleString()} v`
              : '-- tris / -- v'}
          </span>
        </div>

        <div className="flex items-center gap-1 text-zinc-300">
          <Eye className="w-3 h-3 text-zinc-500" />
          <span>{modelLoaded ? `${Math.round(zoomLevel * 100)}%` : '--%'}</span>
        </div>
      </div>
    </footer>
  );
};
