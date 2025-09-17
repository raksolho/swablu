"""
Minimal offline dungeon generator.
Usage: python dungeon_gen.py <floor.xml> [+flags...]
"""

import sys, os, random
from xml.etree import ElementTree
from io import BytesIO

# --- Import all necessary dungeon modules ---
from skytemple_files.dungeon_data.mappa_bin.mappa_xml import mappa_floor_from_xml
from skytemple_files.common.ppmdu_config.xml_reader import Pmd2XmlReader
from skytemple_rust.st_dma import Dma
from skytemple_rust.st_dpc import Dpc
from skytemple_rust.st_dpci import Dpci
from skytemple_rust.st_dpl import Dpl
from skytemple_rust.st_dpla import Dpla
from specific.eos_dungeons import Options, dungeon_data_files, generate_floor, DtefProvider, ExplorersDtefImporter

# --- Load static data once ---
STATIC = Pmd2XmlReader.load_default()
ITEMS_BY_NAME = {x.name: x for x in STATIC.dungeon_data.item_categories.values()}

# --- Main generation function ---
def generate_map(xml_file, flags=[]):
    xml_path = os.path.join("assets", xml_file)
    if not os.path.exists(xml_path):
        raise FileNotFoundError(f"XML file not found: {xml_path}")

    root = ElementTree.parse(xml_path).getroot()
    floor = mappa_floor_from_xml(root, ITEMS_BY_NAME)
    options = Options(" ".join(flags))
    tileset_id = int(root.find('FloorLayout').get('tileset', 0))

    with DtefProvider(None, tileset_id) as dtef:
        base_tiles = dungeon_data_files()
        ExplorersDtefImporter(*base_tiles).do_import(
            dtef,
            os.path.join(dtef, "tileset.dtef.xml"),
            os.path.join(dtef, "tileset_0.png"),
            os.path.join(dtef, "tileset_1.png"),
            os.path.join(dtef, "tileset_2.png")
        )
        return generate_floor(options, floor, base_tiles).getvalue()

# --- CLI entrypoint ---
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python dungeon_gen.py <floor.xml> [+flags...]")
        sys.exit(1)

    xml_file, flags = sys.argv[1], sys.argv[2:]
    out_file = os.path.join("assets", "generated_map.png")

    try:
        png_data = generate_map(xml_file, flags)
        with open(out_file, "wb") as f:
            f.write(png_data)
        print(f"Map successfully generated: {out_file}")
    except Exception as e:
        print(f"Error: {e}")
