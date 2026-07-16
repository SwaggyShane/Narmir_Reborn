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
 * Marks bits from a BigInt bitmap into visArray. Converts to a base-2
 * string once (radix-2 BigInt->string conversion is linear in bit count)
 * instead of testing each cell with `1n << BigInt(idx)`, which reallocates
 * an idx-bit BigInt per call and makes a full-grid scan O(cells^2).
 */
function applyBits(bitmap: bigint, totalCells: number, visArray: Uint8Array, state: FogState): void {
  if (bitmap === 0n) return;
  const bin = bitmap.toString(2);
  const len = bin.length;
  const max = Math.min(len, totalCells);
  for (let i = 0; i < max; i++) {
    if (bin.charCodeAt(len - 1 - i) === 49 /* '1' */) {
      visArray[i] = state;
    }
  }
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
  const totalCells = gridWidth * gridHeight;
  const visArray = new Uint8Array(totalCells);

  applyBits(seenCells, totalCells, visArray, FogState.Seen);
  applyBits(currentCells, totalCells, visArray, FogState.Current);

  return visArray;
}
