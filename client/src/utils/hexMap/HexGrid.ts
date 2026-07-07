export interface HexCell {
  col: number;
  row: number;
  x: number;
  y: number;
  terrain: string;
}

export interface HexGridData {
  width: number;
  height: number;
  seed: number;
  cells: HexCell[];
}
