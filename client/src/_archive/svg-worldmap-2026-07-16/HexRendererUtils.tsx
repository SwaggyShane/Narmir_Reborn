import React from 'react';
import { generateHexPolygonPoints } from './HexSVGHelpers';
import { TERRAIN_COLORS, FOG_COLORS, HEX_STROKE_WIDTH, HEX_STROKE_COLOR, Z_INDEX } from './HexMapConfig';
import { FogState } from './HexVisibility';
import { HexCell } from './HexGrid';

interface HexTerrainProps {
  hex: HexCell;
  onClick?: (col: number, row: number) => void;
  isSelected?: boolean;
}

export function HexTerrain({ hex, onClick, isSelected }: HexTerrainProps) {
  const points = generateHexPolygonPoints(hex.x, hex.y);
  const fill = TERRAIN_COLORS[hex.terrain as keyof typeof TERRAIN_COLORS] || '#556b2f';

  return (
    <polygon
      points={points}
      fill={fill}
      stroke={isSelected ? 'var(--gold)' : HEX_STROKE_COLOR}
      strokeWidth={isSelected ? 2 : HEX_STROKE_WIDTH}
      onClick={() => onClick?.(hex.col, hex.row)}
      style={{
        cursor: onClick ? 'pointer' : 'default',
        zIndex: Z_INDEX.terrain,
      }}
    />
  );
}

interface HexFogOverlayProps {
  cx: number;
  cy: number;
  fogState: FogState;
}

export function HexFogOverlay({ cx, cy, fogState }: HexFogOverlayProps) {
  if (fogState !== FogState.Unseen) {
    return null;
  }

  const points = generateHexPolygonPoints(cx, cy);

  return (
    <polygon
      points={points}
      fill={FOG_COLORS.unseen}
      opacity={FOG_COLORS.unseenOpacity}
      pointerEvents="none"
      style={{ zIndex: Z_INDEX.fog }}
    />
  );
}
