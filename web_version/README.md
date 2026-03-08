# PMD Map Generator - Web Version

This is a JavaScript port of the PMD Map Generator for web browsers, suitable for itch.io.

## Files

- `index.html` - The main web interface
- `eos_dungeons.js` - Core dungeon generation logic using pre-extracted sprites
- `map_maker.js` - Map generation wrapper
- `assets/` - Pre-extracted sprites and tiles from the original assets folder

## Usage

1. Open `index.html` in a web browser
2. Select an XML floor file
3. Configure options
4. Click "Generate Map"
5. View and download the generated PNG

## Local Testing

Due to browser security restrictions, you cannot open `index.html` directly as a file (`file://`). Instead, run a local HTTP server:

```bash
cd web_version
python -m http.server 8000
```

Then open `http://localhost:8000` in your browser.

## Sprite Usage

The web version loads tileset images directly from `assets/dtef/{tileset_id}/tileset_*.png` files, similar to how the original Python code uses the extracted assets. No binary parsing is done - the PNGs are used as tile sheets for drawing.

## Notes

- Dungeon generation uses seeded random tiles from the tileset images
- Full sprite logic (monsters, items, etc.) is not implemented yet - only basic tile drawing
- For production, enhance with proper entity placement and sprite drawing

## Running on itch.io

Upload the files to itch.io as an HTML5 game. Ensure the assets folder is included and accessible.