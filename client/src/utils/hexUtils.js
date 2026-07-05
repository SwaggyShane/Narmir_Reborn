// Client-side hex grid utilities (matches server game/hex-utils.js)
export const HEX_SIZE = 34;
export const HEX_W = Math.sqrt(3) * HEX_SIZE;
export const HEX_VERT = HEX_SIZE * 1.5;

export function pixelToHex(x, y) {
  const r = y / HEX_VERT;
  const q = x / HEX_W - r / 2;

  const cubeX = q;
  const cubeZ = r;
  const cubeY = -cubeX - cubeZ;

  let rx = Math.round(cubeX);
  let ry = Math.round(cubeY);
  let rz = Math.round(cubeZ);
  const dx = Math.abs(rx - cubeX);
  const dy = Math.abs(ry - cubeY);
  const dz = Math.abs(rz - cubeZ);
  if (dx > dy && dx > dz) {
    rx = -ry - rz;
  } else if (dy > dz) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  const row = rz + 0;
  const col = rx + (rz - (rz & 1)) / 2 + 0;
  return { col, row };
}

export function hexCenter(col, row) {
  const x = col * HEX_W + (row % 2 !== 0 ? HEX_W / 2 : 0);
  const y = row * HEX_VERT;
  return { x, y };
}

export function hexCorners(cx, cy, size = HEX_SIZE) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push([
      Math.round((cx + size * Math.cos(angle)) * 10) / 10,
      Math.round((cy + size * Math.sin(angle)) * 10) / 10,
    ]);
  }
  return pts;
}
