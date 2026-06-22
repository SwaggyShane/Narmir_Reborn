let worldMapData = [];

export function setWorldMapData(kingdoms) {
  worldMapData = Array.isArray(kingdoms) ? kingdoms : [];
}

export function getWorldMapData() {
  return worldMapData;
}
