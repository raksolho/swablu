import sys
import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import xml.etree.ElementTree as ET

class CollapsibleFrame(ttk.Frame):
    def __init__(self, parent, text="", *args, **kwargs):
        super().__init__(parent, *args, **kwargs)

        self.show = tk.BooleanVar()
        self.show.set(True)

        self.header = ttk.Frame(self)
        self.header.pack(fill="x")
        self.toggle_button = ttk.Checkbutton(self.header, text=text, variable=self.show, command=self._toggle,
                                             style="Toolbutton")
        self.toggle_button.pack(side="left", fill="x")

        self.sub_frame = ttk.Frame(self)
        self.sub_frame.pack(fill="x", padx=10, pady=5)

    def _toggle(self):
        if self.show.get():
            self.sub_frame.pack(fill="x", padx=10, pady=5)
        else:
            self.sub_frame.forget()

class FloorEditor:
    def __init__(self, root, xml_path=None):
        self.root = root
        self.root.title("Dungeon Floor XML Editor")
        self.root.geometry("650x750")

        # Scrollable canvas
        canvas = tk.Canvas(root)
        scrollbar = ttk.Scrollbar(root, orient="vertical", command=canvas.yview)
        self.scrollable_frame = ttk.Frame(canvas)

        self.scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(
                scrollregion=canvas.bbox("all")
            )
        )

        canvas.create_window((0, 0), window=self.scrollable_frame, anchor="nw")
        canvas.configure(yscrollcommand=scrollbar.set)

        canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        self.xml_tree = None
        self.xml_path = None

        # -------------------- Sections --------------------
        # Floor Layout
        self.floor_frame = CollapsibleFrame(self.scrollable_frame, text="Floor Layout")
        self.floor_frame.pack(fill="x", padx=5, pady=5)
        self.tileset_var = tk.StringVar()
        self.bgm_var = tk.StringVar()
        self.weather_var = tk.StringVar()
        self.number_var = tk.StringVar()

        tk.Label(self.floor_frame.sub_frame, text="Tileset").grid(row=0, column=0, sticky="w")
        tk.Entry(self.floor_frame.sub_frame, textvariable=self.tileset_var).grid(row=0, column=1, sticky="ew")
        tk.Label(self.floor_frame.sub_frame, text="BGM").grid(row=1, column=0, sticky="w")
        tk.Entry(self.floor_frame.sub_frame, textvariable=self.bgm_var).grid(row=1, column=1, sticky="ew")
        tk.Label(self.floor_frame.sub_frame, text="Weather").grid(row=2, column=0, sticky="w")
        tk.Entry(self.floor_frame.sub_frame, textvariable=self.weather_var).grid(row=2, column=1, sticky="ew")
        tk.Label(self.floor_frame.sub_frame, text="Floor Number").grid(row=3, column=0, sticky="w")
        tk.Entry(self.floor_frame.sub_frame, textvariable=self.number_var).grid(row=3, column=1, sticky="ew")
        self.floor_frame.sub_frame.columnconfigure(1, weight=1)

        # Generator Settings
        self.gen_vars = {k: tk.StringVar() for k in [
            "room_density","floor_connectivity","initial_enemy_density","dead_ends",
            "item_density","trap_density","extra_hallway_density","buried_item_density",
            "water_density","max_coin_amount"
        ]}
        self.gen_frame = CollapsibleFrame(self.scrollable_frame, text="Generator Settings")
        self.gen_frame.pack(fill="x", padx=5, pady=5)
        for i, key in enumerate(self.gen_vars):
            tk.Label(self.gen_frame.sub_frame, text=key).grid(row=i, column=0, sticky="w")
            tk.Entry(self.gen_frame.sub_frame, textvariable=self.gen_vars[key]).grid(row=i, column=1, sticky="ew")
        self.gen_frame.sub_frame.columnconfigure(1, weight=1)

        # Chances
        self.chances_vars = {k: tk.StringVar() for k in [
            "shop","monster_house","unused","sticky_item",
            "empty_monster_house","hidden_stairs"
        ]}
        self.chances_frame = CollapsibleFrame(self.scrollable_frame, text="Chances")
        self.chances_frame.pack(fill="x", padx=5, pady=5)
        for i, key in enumerate(self.chances_vars):
            tk.Label(self.chances_frame.sub_frame, text=key).grid(row=i, column=0, sticky="w")
            tk.Entry(self.chances_frame.sub_frame, textvariable=self.chances_vars[key]).grid(row=i, column=1, sticky="ew")
        self.chances_frame.sub_frame.columnconfigure(1, weight=1)

        # Terrain Settings
        self.terrain_vars = {k: tk.StringVar() for k in [
            "secondary_used","secondary_percentage","imperfect_rooms",
            "unk1","unk3","unk4","unk5","unk6","unk7"
        ]}
        self.terrain_frame = CollapsibleFrame(self.scrollable_frame, text="Terrain Settings")
        self.terrain_frame.pack(fill="x", padx=5, pady=5)
        for i, key in enumerate(self.terrain_vars):
            tk.Label(self.terrain_frame.sub_frame, text=key).grid(row=i, column=0, sticky="w")
            tk.Entry(self.terrain_frame.sub_frame, textvariable=self.terrain_vars[key]).grid(row=i, column=1, sticky="ew")
        self.terrain_frame.sub_frame.columnconfigure(1, weight=1)

        # Misc Settings
        self.misc_vars = {k: tk.StringVar() for k in [
            "unkE","kecleon_shop_item_positions","unk_hidden_stairs","enemy_iq","iq_booster_boost"
        ]}
        self.misc_frame = CollapsibleFrame(self.scrollable_frame, text="Misc Settings")
        self.misc_frame.pack(fill="x", padx=5, pady=5)
        for i, key in enumerate(self.misc_vars):
            tk.Label(self.misc_frame.sub_frame, text=key).grid(row=i, column=0, sticky="w")
            tk.Entry(self.misc_frame.sub_frame, textvariable=self.misc_vars[key]).grid(row=i, column=1, sticky="ew")
        self.misc_frame.sub_frame.columnconfigure(1, weight=1)

        # Monster List
        self.monster_list = ttk.Treeview(self.scrollable_frame, columns=("id","level","weight"), show="headings", height=10)
        self.monster_list.heading("id", text="Monster ID")
        self.monster_list.heading("level", text="Level")
        self.monster_list.heading("weight", text="Weight")
        self.monster_list.pack(fill="both", expand=True, padx=5, pady=5)

        # Buttons
        btn_frame = tk.Frame(self.scrollable_frame)
        btn_frame.pack(fill="x", pady=5)
        tk.Button(btn_frame, text="Add Monster", command=self.add_monster).pack(side="left", padx=5)
        tk.Button(btn_frame, text="Edit Selected Monster", command=self.edit_monster).pack(side="left", padx=5)
        tk.Button(btn_frame, text="Remove Selected Monster", command=self.remove_monster).pack(side="left", padx=5)
        tk.Button(btn_frame, text="Save XML", command=self.save_xml).pack(side="left", padx=5)

        if xml_path:
            self.load_xml(xml_path)

    # ------------------------- Load XML -------------------------
 # ------------------------- Load XML -------------------------
    def load_xml(self, path):
        if not os.path.exists(path):
            messagebox.showerror("File Not Found", f"{path} does not exist!")
            return

        self.xml_path = path
        self.xml_tree = ET.parse(path)
        root = self.xml_tree.getroot()

        # FloorLayout
        fl = root.find("FloorLayout")
        if fl is not None:
            self.tileset_var.set(fl.get("tileset", ""))
            self.bgm_var.set(fl.get("bgm", ""))
            self.weather_var.set(fl.get("weather", ""))
            self.number_var.set(fl.get("number", ""))

            # GeneratorSettings inside FloorLayout
            gs = fl.find("GeneratorSettings")
            if gs is not None:
                for k in self.gen_vars:
                    val = gs.attrib.get(k)
                    if val is not None:
                        self.gen_vars[k].set(val)

            # Chances inside FloorLayout
            ch = fl.find("Chances")
            if ch is not None:
                for k in self.chances_vars:
                    val = ch.attrib.get(k)
                    if val is not None:
                        self.chances_vars[k].set(val)

            # TerrainSettings inside FloorLayout
            ts = fl.find("TerrainSettings")
            if ts is not None:
                for k in self.terrain_vars:
                    val = ts.attrib.get(k)
                    if val is not None:
                        self.terrain_vars[k].set(val)

            # MiscSettings inside FloorLayout
            ms = fl.find("MiscSettings")
            if ms is not None:
                for k in self.misc_vars:
                    val = ms.attrib.get(k)
                    if val is not None:
                        self.misc_vars[k].set(val)

        # Monsters
        self.monster_list.delete(*self.monster_list.get_children())
        ml = root.find("MonsterList")
        if ml is not None:
            for m in ml.findall("Monster"):
                self.monster_list.insert("", "end", values=(m.get("id",""), m.get("level",""), m.get("weight","")))

    # ------------------------- Save XML -------------------------
    def save_xml(self):
        if not self.xml_tree:
            messagebox.showwarning("No File", "No XML loaded to save!")
            return

        root = self.xml_tree.getroot()
        fl = root.find("FloorLayout")
        if fl is not None:
            fl.set("tileset", self.tileset_var.get())
            fl.set("bgm", self.bgm_var.get())
            fl.set("weather", self.weather_var.get())
            fl.set("number", self.number_var.get())

            # GeneratorSettings
            gs = fl.find("GeneratorSettings")
            if gs is not None:
                for k in self.gen_vars:
                    gs.set(k, self.gen_vars[k].get())

            # Chances
            ch = fl.find("Chances")
            if ch is not None:
                for k in self.chances_vars:
                    ch.set(k, self.chances_vars[k].get())

            # TerrainSettings
            ts = fl.find("TerrainSettings")
            if ts is not None:
                for k in self.terrain_vars:
                    ts.set(k, self.terrain_vars[k].get())

            # MiscSettings
            ms = fl.find("MiscSettings")
            if ms is not None:
                for k in self.misc_vars:
                    ms.set(k, self.misc_vars[k].get())

        # Monsters
        ml = root.find("MonsterList")
        if ml is not None:
            for m in ml.findall("Monster"):
                ml.remove(m)
            for item in self.monster_list.get_children():
                v = self.monster_list.item(item, "values")
                m_elem = ET.SubElement(ml, "Monster")
                m_elem.set("id", v[0])
                m_elem.set("level", v[1])
                m_elem.set("weight", v[2])
                m_elem.set("weight2", "0")

        if self.xml_path:
            self.xml_tree.write(self.xml_path, encoding="utf-8", xml_declaration=True)
            messagebox.showinfo("Saved", f"Saved changes to {self.xml_path}")

   # ------------------------- Monsters -------------------------
    def add_monster(self):
        win = tk.Toplevel(self.root); win.title("Add Monster")
        id_var, level_var, weight_var = tk.StringVar(), tk.StringVar(), tk.StringVar()
        tk.Label(win,text="Monster ID").grid(row=0,column=0); tk.Entry(win,textvariable=id_var).grid(row=0,column=1)
        tk.Label(win,text="Level").grid(row=1,column=0); tk.Entry(win,textvariable=level_var).grid(row=1,column=1)
        tk.Label(win,text="Weight").grid(row=2,column=0); tk.Entry(win,textvariable=weight_var).grid(row=2,column=1)
        tk.Button(win,text="Add", command=lambda:[self.monster_list.insert("", "end", values=(id_var.get(), level_var.get(), weight_var.get())), win.destroy()]).grid(row=3,columnspan=2,pady=5)

    def edit_monster(self):
        sel = self.monster_list.selection()
        if not sel: messagebox.showwarning("No Selection","Select a monster first"); return
        item = sel[0]; vals = self.monster_list.item(item,"values")
        win = tk.Toplevel(self.root); win.title("Edit Monster")
        id_var, level_var, weight_var = tk.StringVar(value=vals[0]), tk.StringVar(value=vals[1]), tk.StringVar(value=vals[2])
        tk.Label(win,text="Monster ID").grid(row=0,column=0); tk.Entry(win,textvariable=id_var).grid(row=0,column=1)
        tk.Label(win,text="Level").grid(row=1,column=0); tk.Entry(win,textvariable=level_var).grid(row=1,column=1)
        tk.Label(win,text="Weight").grid(row=2,column=0); tk.Entry(win,textvariable=weight_var).grid(row=2,column=1)
        tk.Button(win,text="Save", command=lambda:[self.monster_list.item(item,values=(id_var.get(),level_var.get(),weight_var.get())), win.destroy()]).grid(row=3,columnspan=2,pady=5)

    def remove_monster(self):
        if len(self.monster_list.get_children()) <= 4:
            messagebox.showwarning("Minimum Monsters","Front must have at least 4 monsters!"); return
        sel = self.monster_list.selection()
        for item in sel: self.monster_list.delete(item)

# ------------------------- Main -------------------------
if __name__ == "__main__":
    xml_file = sys.argv[1] if len(sys.argv) > 1 else None
    root = tk.Tk()
    app = FloorEditor(root, xml_file)
    root.mainloop()
