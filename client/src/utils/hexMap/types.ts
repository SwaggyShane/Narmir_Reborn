import { HexCell, HexGridData } from './HexGrid';
import { FogState } from './HexVisibility';

export interface GameState {
  seed: number;
  width: number;
  height: number;
}

export interface VisibilityState {
  seenCells: bigint;
  currentCells: bigint;
}

export type FogStateLookup = (col: number, row: number) => FogState;

export type { HexCell, HexGridData };
export type { FogState };
