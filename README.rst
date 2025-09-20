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
2) run py setup_and_run.py
--------------------------------------------------
Running the Bot / Tools
--------------------------------------------------
1) Running the Map Maker GUI:
   python mapmaker_gui.py
   - Opens a GUI with all options.
   -Select your ROM, XML and options, then click "Generate Map"
   - A sample XML file `testFloor.xml` is included.


--------------------------------------------------
Map Maker Options
--------------------------------------------------
## Map Maker Options

**onlyfloor** - Shortcut for all of these:

- `+nostairs` → disables stair rendering
- `+nomonsters` → disables monster rendering
- `+noflooritems` → disables floor item rendering
- `+notraps` → disables trap rendering
- `+nokecleon` → disables Kecleon shop rendering
- `+burieditems` → shows buried items
- `+nopatches` → ignores "UnusedDungeonChancePatch"
- `+seed` → sets the random generator seed

--------------------------------------------------
Notes
--------------------------------------------------
- Ensure all assets and XML files are correctly in "assets"
- Different seeds produce different dungeon layouts
If you have any questions or problems, please feel free to DM me in Discord: Raks
It might bug a bit because it was a personal project based on an existing code, so please let me know!
