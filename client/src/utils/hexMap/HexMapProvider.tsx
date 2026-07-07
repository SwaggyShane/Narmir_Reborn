import React, { createContext, useMemo, ReactNode } from 'react';
import { HexGridData } from './HexGrid';
import { createVisibilityLookup, buildVisibilityArray, FogState } from './HexVisibility';
import { getHexNeighbors } from './HexSpatial';
// Import directly from terrainUtils to avoid circular dependency with HexGrid
// @ts-ignore - terrainUtils is JS, not TS
import { buildHexGrid } from '../terrainUtils.js';

export interface HexContextValue {
  grid: HexGridData | null;
  lookupFogState: ((col: number, row: number) => FogState) | null;
  visibilityArray: Uint8Array | null;
  getHexNeighbors: (col: number, row: number) => Array<{ col: number; row: number }>;
  gameState: { seed: number; width: number; height: number } | null;
}

export const HexMapContext = createContext<HexContextValue | null>(null);

interface HexMapProviderProps {
  gameState: { seed: number; width: number; height: number };
  visibility: { seenCells: bigint; currentCells: bigint };
  children: ReactNode;
}

/**
 * Provider for hex map data. Manages grid caching and visibility lookups.
 * Grid is cached and only rebuilt when gameState changes.
 */
export function HexMapProvider({ gameState, visibility, children }: HexMapProviderProps) {
  const grid = useMemo(() => {
    return buildHexGrid(gameState.width, gameState.height, gameState.seed);
  }, [gameState.seed, gameState.width, gameState.height]);

  const visibilityArray = useMemo(() => {
    return buildVisibilityArray(gameState.width, gameState.height, visibility.seenCells, visibility.currentCells);
  }, [gameState.width, gameState.height, visibility.seenCells, visibility.currentCells]);

  const lookupFogState = useMemo(() => {
    return createVisibilityLookup(visibilityArray, gameState.width, gameState.height);
  }, [visibilityArray, gameState.width, gameState.height]);

  const value: HexContextValue = {
    grid,
    lookupFogState,
    visibilityArray,
    getHexNeighbors: (col, row) => getHexNeighbors(col, row, gameState.width, gameState.height),
    gameState,
  };

  return <HexMapContext.Provider value={value}>{children}</HexMapContext.Provider>;
}

/**
 * Hook to use hex context.
 */
export function useHexMap(): HexContextValue {
  const context = React.useContext(HexMapContext);
  if (!context) {
    throw new Error('useHexMap must be used within HexMapProvider');
  }
  return context;
}
