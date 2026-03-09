import { createDungeon, exportDungeonPNG } from "./eos_renderer.js";

const map_maker = {
  async generateMap(xmlText, options = []) {

    const width = 50;
    const height = 50;

    console.log("Generating map with options:", options);

    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    const floorLayout = xmlDoc.querySelector("FloorLayout");
    const tilesetId = floorLayout.getAttribute("tileset");

    console.log("Tileset ID:", tilesetId);

    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

    // Generate dungeon
    createDungeon(rand, width, height);

    // Load tileset image
    const tileImage = new Image();
    tileImage.src = `assets/dungeon_tiles/dtef/${tilesetId}/tileset_0.png`;

    await new Promise((res, rej) => {
      tileImage.onload = res;
      tileImage.onerror = rej;
    });

    // Export dungeon
    const url = await exportDungeonPNG(tileImage);

    return url;
  }
};

window.map_maker = map_maker;