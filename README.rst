==================================================
                      SWABLU
==================================================

A Discord Bot for assigning a role to SkyTemple users.

--------------------------------------------------
About
--------------------------------------------------
This is a fork of the original Swablu bot, modified
to work locally and offline. Support the original
bot at: https://github.com/SkyTemple/swablu

--------------------------------------------------
Setup Instructions
--------------------------------------------------
1) Clone the repository
2) Install dependencies:
   pip install -r requirements.txt
   (if this doesn't work, install each one separately)

3) Place your ROM in the "assets" folder.

4) Place your XML file in the "assets" folder.
   - You can generate one using SkyTemple.
   - A sample XML file `testFloor.xml` is included.

--------------------------------------------------
Running the Bot / Tools
--------------------------------------------------
1) Running the dungeon script:
   cd swablu/specific
   python eos_dungeons.py
   cd ..

2) Running the Map Maker GUI:
   python mapmaker_gui.py
   - Opens a GUI with all options.

3) Running the Map Maker from console:
   python map_maker.py <xml-file> [options]

   Example:
   python map_maker.py testFloor.xml +seed:1

--------------------------------------------------
Map Maker Options
--------------------------------------------------
+onlyfloor   Shortcut for all of these:
   
+nostairs     -> disables stair rendering
+nomonsters   -> disables monster rendering
+noflooritems -> disables floor item rendering
+notraps      -> disables trap rendering
+nokecleon      -> disables Kecleon shop rendering
+burieditems    -> shows buried items
+nopatches      -> ignores "UnusedDungeonChancePatch"
+seed    -> sets the random generator seed

--------------------------------------------------
Notes
--------------------------------------------------
- Ensure all assets and XML files are correctly in "assets"
- Different seeds produce different dungeon layouts
