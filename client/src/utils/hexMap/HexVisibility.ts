import { getFlatIndex, isValidHex } from './HexGeometry';

/**
 * Fog of war visibility states.
 * Stored in Uint8Array: 0 = Unseen, 1 = Seen, 2 = Current.
 * O(1) lookup, 2.76MB max memory for full world.
 */
export enum FogState {
  Unseen = 0,  // Black fog, fully hidden
  Seen = 1,    // Discovered, no fog overlay
  Current = 2, // Currently visible, no fog overlay
}

/**
 * Creates a fast visibility lookup function using Uint8Array.
 */
export function createVisibilityLookup(
  visibilityData: Uint8Array,
  gridWidth: number,
  gridHeight: number
) {
  return (col: number, row: number): FogState => {
    if (!isValidHex(col, row, gridWidth, gridHeight)) {
      return FogState.Unseen;
    }
    const idx = getFlatIndex(col, row, gridWidth);
    return (visibilityData[idx] as FogState) || FogState.Unseen;
  };
}

/**
 * Build a visibility Uint8Array from server BigInt bitmasks.
 * One-time cost during context creation.
 */
export function buildVisibilityArray(
  gridWidth: number,
  gridHeight: number,
  seenCells: bigint,
  currentCells: bigint
): Uint8Array {
  const visArray = new Uint8Array(gridWidth * gridHeight);

  for (let row = 0; row < gridHeight; row++) {
    for (let col = 0; col < gridWidth; col++) {
      const idx = getFlatIndex(col, row, gridWidth);
      const bitIdx = idx;

      let state = FogState.Unseen;
      if ((currentCells & (1n << BigInt(bitIdx))) !== 0n) {
        state = FogState.Current;
      } else if ((seenCells & (1n << BigInt(bitIdx))) !== 0n) {
        state = FogState.Seen;
      }

      visArray[idx] = state;
    }
  }

  return visArray;
}
