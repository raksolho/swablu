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
canvas.width = 0;
canvas.height = 0;

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

// === REMAP_RULES from skytemple_dtef.rules (48 entries). None is at index 17 — NOT 14. ===
// explorers_dtef uses enumerate(keys): x = i % 6 + 6*ti, y = floor(i/6), skip when key is None → hole at linear index 17 → (5,2) per type block.
// Sheet position for a base rule = its index i in this array (same i as Python enumerate).
const REMAP_RULES_FULL = [
  0x07, 0xc7, 0xc1, 0x05, 0x44, 0x41,
  0x1f, 0xff, 0xf1, 0x11, 0x00, 0x50,
  0x1c, 0x7c, 0x70, 0x14, 0x01,
  null,
  0xf5, 0x5f, 0x45, 0x04, 0x55, 0x40,
  0xd7, 0x7d, 0x54, 0x15, 0x10, 0x51,
  0xfd, 0x7f, 0x1d, 0x71, 0xc5, 0x47,
  0xf7, 0xdf, 0x17, 0xd1, 0x74, 0x5c,
  0x57, 0xd5, 0x5d, 0x75, 0xdd, 0x77,
];

const BASE_RULES = REMAP_RULES_FULL.filter((r) => r !== null);

// === GET 256 VARIATIONS (matches skytemple_dtef.rules.get_rule_variations(REMAP_RULES)) ===
function getRuleVariationsRemap() {
  const variations = new Map();
  for (const x of REMAP_RULES_FULL) {
    variations.set(x, new Set());
  }
  for (let rule = 0; rule < 256; rule++) {
    let r = rule;
    if ((r & DmaNeighbor.NORTH_WEST) && (!(r & DmaNeighbor.NORTH) || !(r & DmaNeighbor.WEST))) r &= ~DmaNeighbor.NORTH_WEST;
    if ((r & DmaNeighbor.NORTH_EAST) && (!(r & DmaNeighbor.NORTH) || !(r & DmaNeighbor.EAST))) r &= ~DmaNeighbor.NORTH_EAST;
    if ((r & DmaNeighbor.SOUTH_WEST) && (!(r & DmaNeighbor.SOUTH) || !(r & DmaNeighbor.WEST))) r &= ~DmaNeighbor.SOUTH_WEST;
    if ((r & DmaNeighbor.SOUTH_EAST) && (!(r & DmaNeighbor.SOUTH) || !(r & DmaNeighbor.EAST))) r &= ~DmaNeighbor.SOUTH_EAST;
    if (variations.has(r)) variations.get(r).add(rule);
  }
  return variations;
}

const VARIATIONS = getRuleVariationsRemap();

/** Linear index i in REMAP_RULES_FULL (0..47); same i used in explorers_dtef paste position. */
function baseRuleToSheetLinearIndex(baseRule) {
  const i = REMAP_RULES_FULL.indexOf(baseRule);
  return i;
}

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
// Tilesheet layout matches explorers_dtef: enumerate index i -> x = i % 6 + 6*type, y = floor(i/6). None at REMAP_RULES index 17 -> hole at i=17 -> (5,2) per type.
const TILESHEET_WIDTH = 6;
const EMPTY_SLOT_LINEAR = 17;
const EMPTY_SLOT_COL = EMPTY_SLOT_LINEAR % TILESHEET_WIDTH;
const EMPTY_SLOT_ROW = Math.floor(EMPTY_SLOT_LINEAR / TILESHEET_WIDTH);

/** Never sample the empty slot at i=17; if we land on it, use the next tile to the right. */
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
  let sheetLinear = baseRuleToSheetLinearIndex(baseRule);
  if (sheetLinear < 0) {
    const fb = type === TILE_WALL ? baseRuleToSheetLinearIndex(0xff) : 0;
    sheetLinear = fb >= 0 ? fb : 0;
  }

  const typeOffset = TILE_TYPE_OFFSET[type] ?? 0;
  let col = (sheetLinear % TILESHEET_WIDTH) + (TILESHEET_WIDTH * typeOffset);
  let row = Math.floor(sheetLinear / TILESHEET_WIDTH);
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
  const variations = Array.from(VARIATIONS.get(base) ?? []);
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
  const variations = Array.from(VARIATIONS.get(base) ?? []);
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
  // offCtx.fillRect(player.x * TILE_SIZE, player.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);

  return new Promise((resolve, reject) => {
    offCanvas.toBlob(blob => {
      if (!blob) return reject(new Error("Canvas toBlob failed"));
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

// === EXPORT ===
export { createDungeon, exportDungeonPNG, TILE_SIZE, TILE_WALL, TILE_FLOOR };