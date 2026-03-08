import { createDungeon, exportDungeonPNG } from "./eos_renderer.js";

const map_maker = {
  async generateMap(options = []) {
    const width = 50;
    const height = 50;

    const rand = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

    // Generate dungeon
    createDungeon(rand, width, height);

    // Load tileset image
    const tileImage = new Image();
    tileImage.src = "assets/dungeon_tiles/dtef/33/tileset_0.png";
    await new Promise((res, rej) => { tileImage.onload = res; tileImage.onerror = rej; });

    // Use exportDungeonPNG which returns a URL
    const url = await exportDungeonPNG(tileImage);

    // Return the final object URL
    return url;
  }
};

window.map_maker = map_maker;