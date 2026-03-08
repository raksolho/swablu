// eos_dungeons.js
// Full dungeon renderer with PNG export and DMA-style autotiling

class UserError extends Error {
  constructor(title, message) {
    super(message);
    this.title = title;
  }
}

class Options {
  constructor(message = "") {
    this.stairs = true;
    this.monsters = true;
    this.flooritems = true;
    this.traps = true;
    this.grid = false;
    this.seed = Math.floor(Math.random() * 2 ** 32);

    for (const part of message.split(" ")) {
      if (part === "+onlyfloor") {
        this.stairs = false;
        this.monsters = false;
        this.flooritems = false;
        this.traps = false;
      } else if (part === "+nostairs") this.stairs = false;
      else if (part === "+nomonsters") this.monsters = false;
      else if (part === "+noflooritems") this.flooritems = false;
      else if (part === "+notraps") this.traps = false;
      else if (part === "+showgrid") this.grid = true;
      else if (part.startsWith("+seed:"))
        this.seed = parseInt(part.substring(6));
    }
  }
}

const dmaTable = {
  floor: {},
  wall: {},
  water: {},
};

let loadedAssets = {};

const DmaType = {
  WALL: 0,
  FLOOR: 1,
  WATER: 2,
};

async function loadTileset(id) {
  if (loadedAssets[id]) return loadedAssets[id];

  await loadDMA(id);

  const base = `assets/dungeon_tiles/dtef/${id}/`;

  const images = {};

  for (let i = 0; i < 3; i++) {
    const img = new Image();
    img.src = `${base}tileset_${i}.png`;

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    images[`tileset_${i}`] = img;
  }

  loadedAssets[id] = images;
  return images;
}

async function loadDMA(id) {
  const path = `assets/dungeon_tiles/dtef/${id}/tileset.dtef.xml`;

  const res = await fetch(path);
  const text = await res.text();

  const parser = new DOMParser();
  const xml = parser.parseFromString(text, "text/xml");

  xml.querySelectorAll("Mapping").forEach((node) => {
    const type = node.getAttribute("type").toLowerCase();
    const mask = parseInt(node.getAttribute("mask"));
    const tile = parseInt(
      node.getAttribute("tileid") ??
        node.getAttribute("tile") ??
        node.getAttribute("index") ??
        node.getAttribute("value") ??
        "0",
    );
    if (!dmaTable[type]) dmaTable[type] = {};

    if (!dmaTable[type][mask]) dmaTable[type][mask] = {};

    dmaTable[type][mask][0] = tile;
  });
}

class SeededRandom {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  nextInt(max) {
    return Math.floor(this.next() * max);
  }
}

function generateDungeonLayout(width, height, seed) {
  const rng = new SeededRandom(seed);

  const layout = Array(height)
    .fill()
    .map(() => Array(width).fill(DmaType.WALL));

  const rooms = [];
  const roomCount = rng.nextInt(5) + 4;

  for (let i = 0; i < roomCount; i++) {
    const w = rng.nextInt(8) + 4;
    const h = rng.nextInt(6) + 3;

    const x = rng.nextInt(width - w - 2) + 1;
    const y = rng.nextInt(height - h - 2) + 1;

    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) layout[yy][xx] = DmaType.FLOOR;

    rooms.push({ x, y, w, h });
  }

  for (let i = 0; i < rooms.length - 1; i++) {
    const a = rooms[i];
    const b = rooms[i + 1];

    const ax = a.x + Math.floor(a.w / 2);
    const ay = a.y + Math.floor(a.h / 2);

    const bx = b.x + Math.floor(b.w / 2);
    const by = b.y + Math.floor(b.h / 2);

    for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x++)
      layout[ay][x] = DmaType.FLOOR;

    for (let y = Math.min(ay, by); y <= Math.max(ay, by); y++)
      layout[y][bx] = DmaType.FLOOR;
  }
  return layout;
}

function buildRules(layout) {
  const padding = 5;
  const h = layout.length;
  const w = layout[0].length;

  const rules = [];

  for (let y = -padding; y < h + padding; y++) {
    const row = [];

    for (let x = -padding; x < w + padding; x++) {
      if (x < 0 || y < 0 || x >= w || y >= h) row.push(DmaType.WALL);
      else row.push(layout[y][x]);
    }

    rules.push(row);
  }

  return rules;
}

function getDMAMask(map, x, y) {
  const h = map.length;
  const w = map[0].length;

  const center = map[y][x];

  function same(px, py) {
    if (px < 0 || py < 0 || px >= w || py >= h) return false;
    return map[py][px] === center;
  }

  let mask = 0;

  if (same(x, y - 1)) mask |= 1;
  if (same(x + 1, y)) mask |= 2;
  if (same(x, y + 1)) mask |= 4;
  if (same(x - 1, y)) mask |= 8;

  return mask;
}
// --- SKYTEMPLE DMA NEIGHBOR MASK (8-direction) ---
function getTileNeighbors(matrix, x, y, isSolid, treatOutsideAsWall) {
  const dirs = [
    [0, -1], // N
    [1, 0], // E
    [0, 1], // S
    [-1, 0], // W
    [1, -1], // NE
    [1, 1], // SE
    [-1, 1], // SW
    [-1, -1], // NW
  ];

  let mask = 0;

  for (let i = 0; i < dirs.length; i++) {
    const nx = x + dirs[i][0];
    const ny = y + dirs[i][1];

    let solid;

    if (ny < 0 || ny >= matrix.length || nx < 0 || nx >= matrix[0].length) {
      solid = treatOutsideAsWall;
    } else {
      solid = matrix[ny][nx];
    }

    if (solid) mask |= 1 << i;
  }

  return mask;
}

// --- SKYTEMPLE get_mappings_for_rules() ---
function getMappingsForRules(rules, seed) {
  const rng = new SeededRandom(seed);

  const wallMatrix = [];
  const waterMatrix = [];

  for (let y = 0; y < rules.length; y++) {
    wallMatrix[y] = [];
    waterMatrix[y] = [];
    for (let x = 0; x < rules[0].length; x++) {
      const r = rules[y][x];
      wallMatrix[y][x] = r === DmaType.WALL;
      waterMatrix[y][x] = r === DmaType.WATER;
    }
  }

  const mappings = [];

  for (let y = 0; y < rules.length; y++) {
    mappings[y] = [];
    for (let x = 0; x < rules[0].length; x++) {
      const rule = rules[y][x];

      const matrix = rule === DmaType.WATER ? waterMatrix : wallMatrix;

      const isSolid = rule !== DmaType.FLOOR;

      const mask = getTileNeighbors(matrix, x, y, isSolid, false);

      const typeName =
        rule === DmaType.FLOOR
          ? "floor"
          : rule === DmaType.WALL
            ? "wall"
            : "water";

      const variations = dmaTable[typeName]?.[mask];

      let tile;
      if (variations) {
        // Pick a random variation from available ones
        const keys = Object.keys(variations);
        const randomKey = keys[rng.nextInt(keys.length)];
        tile = variations[randomKey];
      } else {
        tile = 0;
      }

      mappings[y][x] = tile;
    }
  }

  return mappings;
}
function drawTile(ctx, sheet, index, x, y, size) {
  const cols = Math.floor(sheet.width / size);

  const sx = (index % cols) * size;
  const sy = Math.floor(index / cols) * size;

  ctx.drawImage(sheet, sx, sy, size, size, x * size, y * size, size, size);
  
}

function drawGrid(ctx, width, height, cell) {
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 1;

  for (let x = 0; x <= width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cell + 0.5, 0);
    ctx.lineTo(x * cell + 0.5, height * cell);
    ctx.stroke();
  }

  for (let y = 0; y <= height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cell + 0.5);
    ctx.lineTo(width * cell, y * cell + 0.5);
    ctx.stroke();
  }
}

// eos_dungeons.js
async function generateFloor(options, floorData) {
  const tilesetId = floorData?.tilesetId ?? 0;
  const images = await loadTileset(tilesetId);

  const width = 56;
  const height = 32;
  const tileSize = 24;

  const layout = generateDungeonLayout(width, height, options.seed);
  const rules = buildRules(layout);

  const canvas = document.createElement("canvas");
  canvas.width = rules[0].length * tileSize;
  canvas.height = rules.length * tileSize;

  const ctx = canvas.getContext("2d");
  const sheet = images.tileset_0;

  const mappings = getMappingsForRules(rules);

  // Draw tiles
  for (let y = 0; y < mappings.length; y++) {
    for (let x = 0; x < mappings[0].length; x++) {
      drawTile(ctx, sheet, mappings[y][x], x, y, tileSize);
    }
  }

  // Optional: draw grid
  if (options.grid) drawGrid(ctx, rules[0].length, rules.length, tileSize);

  // Convert to blob safely
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b);
      else
        reject(
          new Error("Canvas toBlob failed — possibly tainted or zero-size"),
        );
    }, "image/png");
  });

  return { blob, tiles: layout };
}
window.eos_dungeons = {
  Options,
  generateFloor,
  loadTileset,
};

function parseXML(xmlText) {
  const parser = new DOMParser();
  return parser.parseFromString(xmlText, "text/xml");
}

async function generateMap(xmlText, optionsList) {
  const xml = parseXML(xmlText);

  const layout = xml.querySelector("FloorLayout");

  const tilesetId = layout
    ? parseInt(layout.getAttribute("tileset") || "0")
    : 0;
  console.log(`Parsed tileset ID: ${tilesetId}`);
  const options = new eos_dungeons.Options(optionsList.join(" "));

  const floorData = {
    tilesetId: tilesetId,
  };

  const blob = await eos_dungeons.generateFloor(options, floorData);
console.log(dmaTable,"DMATABLE");

  return URL.createObjectURL(blob);
}

window.map_maker = { generateMap };
