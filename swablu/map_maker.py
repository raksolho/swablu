"""
This script provides a way of creating random dungeons offline, using XML files as presets for the dungeon information.
It uses modified source code to bypass the bot configurations and provide the generation locally.
The XML files should be inside the 'assets/' folder, and the generated PNG will also be saved there.
"""

import sys
import os
from typing import Tuple
from xml.etree import ElementTree
from dotenv import load_dotenv

from skytemple_files.dungeon_data.mappa_bin.mappa_xml import mappa_floor_from_xml
from skytemple_files.common.ppmdu_config.xml_reader import Pmd2XmlReader
from skytemple_rust.st_dma import Dma
from skytemple_rust.st_dpc import Dpc
from skytemple_rust.st_dpci import Dpci
from skytemple_rust.st_dpl import Dpl
from skytemple_rust.st_dpla import Dpla

from specific.eos_dungeons import Options, dungeon_data_files, generate_floor, DtefProvider, ExplorersDtefImporter

load_dotenv()

def generate_map_from_xml(xml_filename: str, options_list: list = None) -> bytes:
    if options_list is None:
        options_list = []
    
    options_str = " ".join(options_list)
    
    STATIC_DATA = Pmd2XmlReader.load_default()
    ITEM_CATEGORIES = STATIC_DATA.dungeon_data.item_categories
    ITEM_CATEGORIES_BY_NAME = {x.name: x for x in ITEM_CATEGORIES.values()}
    
    xml_path = os.path.join("assets/", xml_filename)
    if not os.path.isfile(xml_path):
        raise FileNotFoundError(f"XML file not found: {xml_path}")
    
    with open(xml_path, "rb") as f:
        xml = ElementTree.parse(f).getroot()
    
    options = Options(options_str)
    
    floor_layout = xml.find('FloorLayout')
    tileset_id = int(floor_layout.get('tileset', '0'))
    
    with DtefProvider(None, tileset_id) as dtef_dir_name:
        base_tileset: Tuple[Dma, Dpc, Dpci, Dpl, Dpla] = dungeon_data_files()
        importer = ExplorersDtefImporter(*base_tileset)
        importer.do_import(
            dtef_dir_name,
            os.path.join(dtef_dir_name, "tileset.dtef.xml"),
            os.path.join(dtef_dir_name, "tileset_0.png"),
            os.path.join(dtef_dir_name, "tileset_1.png"),
            os.path.join(dtef_dir_name, "tileset_2.png")
        )
        tileset = base_tileset
    
    floor = mappa_floor_from_xml(xml, ITEM_CATEGORIES_BY_NAME)
    png_file = generate_floor(options, floor, tileset)
    
    return png_file.getvalue()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python script.py <file.xml> [+flags...]")
        sys.exit(1)
    
    xml_filename = sys.argv[1]
    flags = sys.argv[2:] if len(sys.argv) > 2 else []
    
    try:
        png_data = generate_map_from_xml(xml_filename, flags)
        output_path = os.path.join("assets", "generated_map.png")
        with open(output_path, "wb") as f:
            f.write(png_data)
        print("Map generated successfully!")
        print(f"PNG file saved as: {output_path}")
    except Exception as e:
        print(f"Error generating the map: {e}")
