// eos_renderer_dma_fixed.js
// Dungeon renderer + generator. Tiling logic matches skytemple_dtef (rules.py, explorers_dtef.py)
// and skytemple_files.graphics.dma (DmaNeighbor protocol, get_tile_neighbors order).

const TILE_SIZE = 24;
const TILE_WALL = 0;
const TILE_FLOOR = 22;
const TILE_WATER = 21; // if you add water
// === CANVAS SETUP ===
const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");
canvas.width = 960;
canvas.height = 640;

// === GAME STATE ===
let map = [];
let rooms = [];
let player = { x: 0, y: 0 };

// === DMA NEIGHBOR BIT FLAGS (must match skytemple_files.graphics.dma.protocol.DmaNeighbor) ===
const DmaNeighbor = {
  SOUTH: 0x01,
  SOUTH_EAST: 0x02,
  EAST: 0x04,
  NORTH_EAST: 0x08,
  NORTH: 0x10,
  NORTH_WEST: 0x20,
  WEST: 0x40,
  SOUTH_WEST: 0x80,
};

// === 47 BASE RULES from skytemple_dtef.rules.REMAP_RULES (excluding None at index 14) ===
// Order matches tilesheet: indices 0-13, then 15-47 of REMAP_RULES (index 14 is None)
const BASE_RULES = [
  DmaNeighbor.EAST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.WEST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH,
  DmaNeighbor.EAST | DmaNeighbor.SOUTH,
  DmaNeighbor.WEST | DmaNeighbor.EAST,
 
  DmaNeighbor.WEST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.EAST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH | DmaNeighbor.SOUTH,
  0,
  DmaNeighbor.NORTH | DmaNeighbor.WEST,
  DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.EAST,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.WEST | DmaNeighbor.EAST,
  // index 14 is None in Python REMAP_RULES - skipped
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.WEST,
  DmaNeighbor.NORTH | DmaNeighbor.EAST,
  DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH,
  DmaNeighbor.EAST,
  DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH,
  DmaNeighbor.WEST,
  DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.EAST,
  DmaNeighbor.NORTH | DmaNeighbor.EAST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH,
  DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.EAST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.SOUTH,
  DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH,
  DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.NORTH | DmaNeighbor.EAST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.EAST,
  DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.WEST | DmaNeighbor.EAST,
  DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
  DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH | DmaNeighbor.NORTH_EAST | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH_WEST | DmaNeighbor.SOUTH,
  DmaNeighbor.NORTH_WEST | DmaNeighbor.NORTH | DmaNeighbor.WEST | DmaNeighbor.EAST | DmaNeighbor.SOUTH | DmaNeighbor.SOUTH_EAST,
];

// === GET 256 VARIATIONS FROM BASE RULES (matches skytemple_dtef.rules.get_rule_variations) ===
function getRuleVariations(baseRules) {
  const variations = {};
  for (const base of baseRules) variations[base] = new Set();

  for (let rule = 0; rule < 256; rule++) {
    let r = rule;
    // Corner cleanup: clear diagonal if either cardinal is missing (same as Python rules.py)
    if ((r & DmaNeighbor.NORTH_WEST) && (!(r & DmaNeighbor.NORTH) || !(r & DmaNeighbor.WEST))) r &= ~DmaNeighbor.NORTH_WEST;
    if ((r & DmaNeighbor.NORTH_EAST) && (!(r & DmaNeighbor.NORTH) || !(r & DmaNeighbor.EAST))) r &= ~DmaNeighbor.NORTH_EAST;
    if ((r & DmaNeighbor.SOUTH_WEST) && (!(r & DmaNeighbor.SOUTH) || !(r & DmaNeighbor.WEST))) r &= ~DmaNeighbor.SOUTH_WEST;
    if ((r & DmaNeighbor.SOUTH_EAST) && (!(r & DmaNeighbor.SOUTH) || !(r & DmaNeighbor.EAST))) r &= ~DmaNeighbor.SOUTH_EAST;

    if (variations[r] !== undefined) variations[r].add(rule);
  }
  return variations;
}

const VARIATIONS = getRuleVariations(BASE_RULES);

/** Apply same corner cleanup as rules.py: clear diagonal bits when the two cardinals are not both set. */
function reduceRule(rawRule) {
  let r = rawRule;
  if ((r & DmaNeighbor.NORTH_WEST) && (!(r & DmaNeighbor.NORTH) || !(r & DmaNeighbor.WEST))) r &= ~DmaNeighbor.NORTH_WEST;
  if ((r & DmaNeighbor.NORTH_EAST) && (!(r & DmaNeighbor.NORTH) || !(r & DmaNeighbor.EAST))) r &= ~DmaNeighbor.NORTH_EAST;
  if ((r & DmaNeighbor.SOUTH_WEST) && (!(r & DmaNeighbor.SOUTH) || !(r & DmaNeighbor.WEST))) r &= ~DmaNeighbor.SOUTH_WEST;
  if ((r & DmaNeighbor.SOUTH_EAST) && (!(r & DmaNeighbor.SOUTH) || !(r & DmaNeighbor.EAST))) r &= ~DmaNeighbor.SOUTH_EAST;
  return r;
}

// === HELPERS ===
function neighbors(x, y) {
  if (x < 0 || y < 0 || x >= map[0].length || y >= map.length) return {};
  const type = map[y][x];
  const width = map[0].length;
  const height = map.length;
  // Out-of-bounds: treat as "same" for wall/water (like skytemple treat_outside_as_wall) so edge tiles get correct rule
  const outOfBoundsSame = type === TILE_WALL || type === TILE_WATER;
  const same = (nx, ny) => {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) return outOfBoundsSame;
    return map[ny][nx] === type;
  };
  return {
    n: same(x, y - 1),
    s: same(x, y + 1),
    w: same(x - 1, y),
    e: same(x + 1, y),
    nw: same(x - 1, y - 1),
    ne: same(x + 1, y - 1),
    sw: same(x - 1, y + 1),
    se: same(x + 1, y + 1),
  };
}

function computeBitfield(n) {
  // Order must match skytemple_files.graphics.dma.util.get_tile_neighbors: S, SE, E, NE, N, NW, W, SW
  return (n.s ? DmaNeighbor.SOUTH : 0) |
         (n.se ? DmaNeighbor.SOUTH_EAST : 0) |
         (n.e ? DmaNeighbor.EAST : 0) |
         (n.ne ? DmaNeighbor.NORTH_EAST : 0) |
         (n.n ? DmaNeighbor.NORTH : 0) |
         (n.nw ? DmaNeighbor.NORTH_WEST : 0) |
         (n.w ? DmaNeighbor.WEST : 0) |
         (n.sw ? DmaNeighbor.SOUTH_WEST : 0);
}
const TILE_TYPE_OFFSET = {
  [TILE_WALL]: 0,
  [TILE_WATER]: 1,
  [TILE_FLOOR]: 2,

};
// Tilesheet layout matches explorers_dtef: 6 cols x 8 rows per type, 3 types side-by-side (18 cols total).
// REMAP_RULES has None at index 14, so the exported sheet has an empty/purple slot at (2,2) per type — we must skip it.
const TILESHEET_WIDTH = 6;
 /** Linear position of the empty/purple slot in each type block (col=2, row=2 -> local index 14). */
const EMPTY_SLOT_COL = 2;
const EMPTY_SLOT_ROW = 2;

/** Logical rule index 0..46 -> sheet position (skips index 14 = empty/purple slot). */
function ruleIndexToSheetPosition(logicalIndex) {
  if (logicalIndex === 15) return 33;
  if(logicalIndex===17) return 10;
  return logicalIndex < 14 ? logicalIndex : logicalIndex + 1;
}

/** Never sample the purple/empty slot; if we land on it, use the next tile. */
function clampAwayFromEmptySlot(col, row, typeOffset) {
  const localCol = col - TILESHEET_WIDTH * typeOffset;
  const localRow = row;
  if (localCol === EMPTY_SLOT_COL && localRow === EMPTY_SLOT_ROW) {
    return { col: col + 1, row };
  }
  return { col, row };
}

function getMappedTileIndex(x, y, xmlTiles, ruleVariations) {
  const n = neighbors(x, y);
  const rawBf = computeBitfield(n);
  const type = map[y][x];

  const baseRule = reduceRule(rawBf);
  let baseRuleIndex = BASE_RULES.indexOf(baseRule);
  if (baseRuleIndex < 0) {
    baseRuleIndex = type === TILE_WALL ? BASE_RULES.indexOf(0xFF) : 0;
    if (baseRuleIndex < 0) baseRuleIndex = 0;
  }
  const idx = baseRuleIndex;

  const sheetPos = ruleIndexToSheetPosition(idx);
  const typeOffset = TILE_TYPE_OFFSET[type] ?? 0;
  let col = (sheetPos % TILESHEET_WIDTH) + (TILESHEET_WIDTH * typeOffset);
  let row = Math.floor(sheetPos / TILESHEET_WIDTH);
  ({ col, row } = clampAwayFromEmptySlot(col, row, typeOffset));

  return { col, row };
}
// === MAP GENERATION ===
function createMap(width, height) {
  map = Array.from({ length: height }, () => Array(width).fill(TILE_WALL));
}

function carve(x, y) { if (map[y] && map[y][x] !== undefined) map[y][x] = TILE_FLOOR; }
function carveRoom(r) { for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) carve(x, y); }
function carveHTunnel(x1, x2, y) { for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) carve(x, y); }
function carveVTunnel(y1, y2, x) { for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) carve(x, y); }
function intersects(a, b) { return !(a.x + a.w <= b.x || a.x >= b.x + b.w || a.y + a.h <= b.y || a.y >= b.y + b.h); }

function createDungeon(randFunc, width, height) {
  createMap(width, height);
  rooms = [];
  const MAX_ROOMS = 40, MIN_SIZE = 5, MAX_SIZE = 12;

  for (let i = 0; i < MAX_ROOMS; i++) {
    const w = randFunc(MIN_SIZE, MAX_SIZE);
    const h = randFunc(MIN_SIZE, MAX_SIZE);
    const x = randFunc(2, width - w - 2);
    const y = randFunc(2, height - h - 2);
    const newRoom = { x, y, w, h };
    if (rooms.some(r => intersects(r, newRoom))) continue;
    carveRoom(newRoom);

    const centerX = Math.floor(newRoom.x + newRoom.w / 2);
    const centerY = Math.floor(newRoom.y + newRoom.h / 2);
    if (rooms.length === 0) { player.x = centerX; player.y = centerY; }
    else {
      const prev = rooms[rooms.length - 1];
      const prevX = Math.floor(prev.x + prev.w / 2);
      const prevY = Math.floor(prev.y + prev.h / 2);
      if (randFunc(0,1) < 0.5) { carveHTunnel(prevX, centerX, prevY); carveVTunnel(prevY, centerY, centerX); }
      else { carveVTunnel(prevY, centerY, prevX); carveHTunnel(prevX, centerX, centerY); }
    }
    rooms.push(newRoom);
  }
}
const xmlTiles = [
  { type: "floor", baseRule: 0b00000000, variation: 0 },
  { type: "floor", baseRule: 0b00000000, variation: 1 },
  { type: "floor", baseRule: 0b00000000, variation: 2 },
  { type: "wall",  baseRule: 0b11111111, variation: 0 },
  { type: "wall",  baseRule: 0b11111111, variation: 1 },
  { type: "wall",  baseRule: 0b11111111, variation: 2 },
];
// Generate all wall tiles
for (let base of BASE_RULES) {
  const variations = Array.from(VARIATIONS[base]); // set of valid variations
  let i = 0;
  for (let v of variations) {
    xmlTiles.push({
      type: "wall",
      baseRule: base,
      variation: i // index used in your tileset horizontally
    });
    i++;
  }
}

// Generate all floor tiles
for (let base of BASE_RULES) {
  const variations = Array.from(VARIATIONS[base]);
  let i = 0;
  for (let v of variations) {
    xmlTiles.push({
      type: "floor",
      baseRule: base,
      variation: i
    });
    i++;
  }
}
// === DRAW & EXPORT DUNGEON TO PNG ===
function exportDungeonPNG(tileImage) {
  const offCanvas = document.createElement("canvas");
  offCanvas.width = map[0].length * TILE_SIZE;
  offCanvas.height = map.length * TILE_SIZE;
  const offCtx = offCanvas.getContext("2d");

  for (let y = 0; y < map.length; y++) {
    for (let x = 0; x < map[0].length; x++) {
      const { col, row } = getMappedTileIndex(x, y, xmlTiles, VARIATIONS);

      // Clamp col/row to tileset dimensions
      const maxCols = Math.floor(tileImage.width / TILE_SIZE);
      const maxRows = Math.floor(tileImage.height / TILE_SIZE);
      const safeCol = Math.min(col, maxCols - 1);
      const safeRow = Math.min(row, maxRows - 1);
      
      offCtx.drawImage(
        tileImage,
        safeCol * TILE_SIZE,
        safeRow * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE,
        x * TILE_SIZE,
        y * TILE_SIZE,
        TILE_SIZE,
        TILE_SIZE
      );
    }
  }

  offCtx.fillStyle = "orange";
  offCtx.fillRect(player.x * TILE_SIZE, player.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

  return new Promise((resolve, reject) => {
    offCanvas.toBlob(blob => {
      if (!blob) return reject(new Error("Canvas toBlob failed"));
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

// === EXPORT ===
export { createDungeon, exportDungeonPNG, TILE_SIZE, TILE_WALL, TILE_FLOOR };