import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import sys
import subprocess
import threading

sys.path.append(os.path.dirname(__file__))

try:
    from map_maker import generate_map
except ImportError as e:
    print(f"Error importing generate_map_from_xml: {e}")
    print("Make sure you're running this from the project root directory")
    print("And that all dependencies are installed")
    sys.exit(1)


class MapMakerGUI:
    def __init__(self, root):
        self.root = root

        self.root.title("PMD Map Generator")
        self.root.geometry("600x700")

        self.selected_file = tk.StringVar()
        self.selected_rom = tk.StringVar()

        self.options = {}
        self.generated_image_data = None

        self.setup_ui()

    def setup_ui(self):
        container = ttk.Frame(self.root)
        container.grid(row=0, column=0, sticky="nsew")

        canvas = tk.Canvas(container, borderwidth=0, width=600)

        vscrollbar = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=vscrollbar.set)

        vscrollbar.pack(side="right", fill="both")
        canvas.pack(side="bottom", anchor='center', fill="both", expand=True)

        main_frame = ttk.Frame(canvas, padding="20")
        canvas.create_window((0, 0), window=main_frame, anchor="nw")

        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

        def on_configure(event):
            canvas.configure(scrollregion=canvas.bbox("all"))

        main_frame.bind("<Configure>", on_configure)

        def _on_mousewheel(event):
            canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

        canvas.bind_all("<MouseWheel>", _on_mousewheel)

        title_label = ttk.Label(
            main_frame,
            text="PMD Map Generator",
            font=("Arial", 16, "bold")
        )
        title_label.grid(row=0, column=0, columnspan=2, pady=(0, 20))

        rom_frame = ttk.LabelFrame(main_frame, text="Select ROM File", padding="10")
        rom_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        ttk.Label(rom_frame).grid(row=0, column=0, sticky=tk.W)
        ttk.Button(rom_frame, text="Browse...", command=self.browse_rom).grid(row=0, column=1, padx=(10, 0))
        self.rom_label = ttk.Label(rom_frame, text="No file selected", foreground="gray")
        self.rom_label.grid(row=0, column=2, sticky=(tk.W, tk.E))

        file_frame = ttk.LabelFrame(main_frame, text="Select XML File", padding="10")
        file_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        ttk.Button(file_frame, text="Browse...", command=self.browse_file).grid(row=0, column=0, padx=(0, 10))
        self.file_label = ttk.Label(file_frame, text="No file selected", foreground="gray")
        self.file_label.grid(row=0, column=1, sticky=(tk.W, tk.E))

        # --- Show Tiles Button (moved here) ---
        self.show_tiles_btn = ttk.Button(file_frame, text="Show Tiles", command=self.show_tiles_window)
        self.show_tiles_btn.grid(row=1, column=0, columnspan=2, pady=(10, 0), sticky=(tk.W, tk.E))

        # XML Editor Button

        options_frame = ttk.LabelFrame(main_frame, text="Generation Options", padding="10")
        options_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        presets_frame = ttk.LabelFrame(options_frame, text="Quick Presets", padding="5")
        presets_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        self.options['onlyfloor'] = tk.BooleanVar()
        ttk.Checkbutton(presets_frame, text="Only Floor (no items/monsters)",
                        variable=self.options['onlyfloor']).grid(row=0, column=0, sticky=tk.W)

        disable_frame = ttk.LabelFrame(options_frame, text="Disable Elements", padding="5")
        disable_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        disable_options = [
            ('nostairs', 'No Stairs'),
            ('nomonsters', 'No Monsters'),
            ('noflooritems', 'No Floor Items'),
            ('notraps', 'No Traps'),
            ('nokecleon', 'No Kecleon Shop')
        ]

        for i, (key, text) in enumerate(disable_options):
            self.options[key] = tk.BooleanVar()
            ttk.Checkbutton(disable_frame, text=text,
                            variable=self.options[key]).grid(row=i // 2, column=i % 2, sticky=tk.W, padx=(0, 20))

        advanced_frame = ttk.LabelFrame(options_frame, text="Advanced Options", padding="5")
        advanced_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        # In the advanced_frame section
        self.options['showgrid'] = tk.BooleanVar()
        ttk.Checkbutton(
            advanced_frame,
            text="Show Grid",
            variable=self.options['showgrid']
        ).grid(row=0, column=0, sticky=tk.W)

        self.options['burieditems'] = tk.BooleanVar()
        ttk.Checkbutton(
            advanced_frame,
            text="Show Buried Items",
            variable=self.options['burieditems']
        ).grid(row=0, column=1, sticky=tk.W)

        self.options['nopatches'] = tk.BooleanVar()
        ttk.Checkbutton(
            advanced_frame,
            text="No Patches",
            variable=self.options['nopatches']
        ).grid(row=0, column=2, sticky=tk.W)

        seed_frame = ttk.Frame(advanced_frame)
        seed_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(10, 0))

        ttk.Label(seed_frame, text="Random Seed (optional):").grid(row=0, column=0, sticky=tk.W)
        self.seed_var = tk.StringVar()
        seed_entry = ttk.Entry(seed_frame, textvariable=self.seed_var, width=20)
        seed_entry.grid(row=0, column=1, padx=(10, 0))

        self.generate_btn = ttk.Button(
            main_frame,
            text="Generate Map",
            command=self.generate_map,
            style="Accent.TButton"
        )
        self.generate_btn.grid(row=4, column=0, columnspan=2, pady=20)

        self.progress = ttk.Progressbar(main_frame, mode='indeterminate')
        self.progress.grid(row=5, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))

        self.status_label = ttk.Label(main_frame, text="Ready to generate maps!")
        self.status_label.grid(row=6, column=0, columnspan=2)

        self.preview_frame = ttk.LabelFrame(main_frame, text="Map Preview", padding="10")
        self.preview_frame.grid(row=7, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=(10, 0))

        self.preview_label = ttk.Label(self.preview_frame, text="No map generated yet", width=90)
        self.preview_label.pack(expand=True, fill='both')

        self.save_btn = ttk.Button(self.preview_frame, text="💾 Save Map",
                                   command=self.save_map, state='disabled')
        self.save_btn.pack(pady=(10, 0))

        # --- Show Tiles Button ---
        # (Moved to file_frame above)
    def show_tiles_window(self):
        # Only show tiles if both XML and ROM are selected
        if not self.selected_file.get() or not self.selected_rom.get():
            messagebox.showwarning("Select Files", "Please select both an XML file and a ROM file before viewing tiles.")
            return

        import glob
        import tempfile
        from PIL import Image, ImageTk
        tiles_win = tk.Toplevel(self.root)
        tiles_win.title("Tiles Preview")
        tiles_win.geometry("800x600")
        frame = ttk.Frame(tiles_win, padding="10")
        frame.pack(fill=tk.BOTH, expand=True)

        canvas = tk.Canvas(frame, borderwidth=0)
        vscrollbar = ttk.Scrollbar(frame, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=vscrollbar.set)
        vscrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)

        inner_frame = ttk.Frame(canvas)
        canvas.create_window((0, 0), window=inner_frame, anchor="nw")

        def on_configure(event):
            canvas.configure(scrollregion=canvas.bbox("all"))
        inner_frame.bind("<Configure>", on_configure)

        # Find all tileset_0.png files in assets/dungeon_tiles/dtef/*/tileset_0.png
        base_dir = os.path.join(os.path.dirname(__file__), "assets", "dungeon_tiles", "dtef")
        print(f"[DEBUG] Searching for tiles in: {base_dir}")
        search_pattern = os.path.join(base_dir, "*", "tileset_0.png")
        print(f"[DEBUG] Using glob pattern: {search_pattern}")
        png_files = glob.glob(search_pattern)
        print(f"[DEBUG] Found {len(png_files)} tileset_0.png files:")
        for f in png_files:
            print(f"[DEBUG]   {f}")
        if not png_files:
            ttk.Label(inner_frame, text="No tileset_0.png files found in dungeon_tiles/dtef subfolders.").pack()
            return

        self._tile_images = []  # Keep references to avoid garbage collection
        import functools
        def set_tileset(tileset_id):
            self.selected_tileset = tileset_id
            self.status_label.config(text=f"Tileset set to {tileset_id}")
            print(f"[DEBUG] Tileset set to {tileset_id}")
            # Regenerate map instantly
            self.regenerate_map_with_tileset(tileset_id)
        for i, png_path in enumerate(png_files):
            try:
                print(f"[DEBUG] Loading image: {png_path}")
                img = Image.open(png_path)
                img.thumbnail((128, 128))
                photo = ImageTk.PhotoImage(img)
                self._tile_images.append(photo)
                tile_frame = ttk.Frame(inner_frame, padding=5)
                tile_frame.grid(row=i // 5, column=i % 5, padx=5, pady=5)
                parent_folder = os.path.basename(os.path.dirname(png_path))
                label = ttk.Label(tile_frame, image=photo)
                label.pack()
                name_label = ttk.Label(tile_frame, text=f"{parent_folder}/tileset_0.png", font=("Arial", 8))
                name_label.pack()
                # Bind click event to set tileset
                label.bind("<Button-1>", functools.partial(lambda _e, tid: set_tileset(tid), tid=parent_folder))
            except Exception as e:
                print(f"[DEBUG] Error loading {png_path}: {e}")
                ttk.Label(inner_frame, text=f"Error loading {os.path.basename(png_path)}: {e}").pack()

    def regenerate_map_with_tileset(self, tileset_id):
        # Regenerate map using the selected tileset
        # Only works if an XML file is selected
        if not self.selected_file.get():
            self.status_label.config(text="Select an XML file first!")
            return
        # Patch the XML file's FloorLayout tileset attribute
        import xml.etree.ElementTree as ET
        xml_path = self.selected_file.get()
        try:
            tree = ET.parse(xml_path)
            root = tree.getroot()
            floor_layout = root.find('FloorLayout')
            if floor_layout is not None:
                floor_layout.set('tileset', str(tileset_id))
                tree.write(xml_path)
                print(f"[DEBUG] Updated tileset in XML to {tileset_id}")
            else:
                self.status_label.config(text="No FloorLayout element in XML!")
                return
        except Exception as e:
            self.status_label.config(text=f"Error updating tileset: {e}")
            print(f"[DEBUG] Error updating tileset: {e}")
            return
        # Regenerate map
        self.generate_map()

        for i, png_path in enumerate(png_files):
            try:
                print(f"[DEBUG] Loading image: {png_path}")
                img = Image.open(png_path)
                img.thumbnail((128, 128))
                photo = ImageTk.PhotoImage(img)
                self._tile_images.append(photo)
                tile_frame = ttk.Frame(inner_frame, padding=5)
                tile_frame.grid(row=i // 5, column=i % 5, padx=5, pady=5)
                parent_folder = os.path.basename(os.path.dirname(png_path))
                label = ttk.Label(tile_frame, image=photo)
                label.pack()
                name_label = ttk.Label(tile_frame, text=f"{parent_folder}/tileset_0.png", font=("Arial", 8))
                name_label.pack()
                # Bind click event to set tileset
                label.bind("<Button-1>", functools.partial(lambda _e, tid: set_tileset(tid), tid=parent_folder))
            except Exception as e:
                print(f"[DEBUG] Error loading {png_path}: {e}")
                ttk.Label(inner_frame, text=f"Error loading {os.path.basename(png_path)}: {e}").pack()

        main_frame.columnconfigure(1, weight=1)
        file_frame.columnconfigure(1, weight=1)
        options_frame.columnconfigure(1, weight=1)

        self.options['onlyfloor'].trace('w', self.on_only_floor_changed)

    # ------------------- XML Editor -------------------
    def open_xml_editor(self, xml_file=None):
        """
        Opens the XML editor with the provided file.
        If xml_file is None, uses the currently selected XML file.
        """
        if xml_file is None:
            xml_file = self.selected_file.get()

        if not xml_file:
            messagebox.showerror("No File", "Please select an XML file first!")
            return

        editor_script = os.path.join(os.path.dirname(__file__), "xml_editor.py")
        if not os.path.exists(editor_script):
            messagebox.showerror("Editor Not Found", "The XML editor script was not found!")
            return

        # Open editor in a new process with the XML
        subprocess.Popen([sys.executable, editor_script, xml_file])


    # ------------------- Browse File & ROM -------------------
    def browse_file(self):
        filename = filedialog.askopenfilename(
            title="Select XML File",
            filetypes=[("XML files", "*.xml"), ("All files", "*.*")]
        )
        if filename:
            self.selected_file.set(filename)
            self.file_label.config(text=os.path.basename(filename), foreground="black")
            self.status_label.config(text="File selected. Opening XML editor...")

            # Automatically open the XML editor with the chosen file
            editor_script = os.path.join(os.path.dirname(__file__), "xml_editor.py")
            if not os.path.exists(editor_script):
                messagebox.showerror("Editor Not Found", "The XML editor script was not found!")
                return
            subprocess.Popen([sys.executable, editor_script, filename])


    def browse_rom(self):
        filename = filedialog.askopenfilename(
            title="Select ROM File",
            filetypes=[("NDS files", "*.nds"), ("All files", "*.*")]
        )
        if filename:
            self.selected_rom.set(filename)
            self.rom_label.config(text=os.path.basename(filename), foreground="black")

            # Check if dtef files already exist
            dtef_dir = os.path.join(os.path.dirname(__file__), "assets", "dungeon_tiles", "dtef")
            if os.path.isdir(dtef_dir) and any(os.path.isdir(os.path.join(dtef_dir, name)) for name in os.listdir(dtef_dir)):
                self.status_label.config(text="ROM already processed (dtef files found)")
                messagebox.showinfo("ROM Processing Skipped", "ROM processing skipped: dtef files already exist.")
                return

            self.status_label.config(text="Processing ROM... please wait")

            # Loading popup
            loading_win = tk.Toplevel(self.root)
            loading_win.title("Loading")
            loading_win.geometry("300x100")
            loading_win.transient(self.root)
            loading_win.grab_set()

            ttk.Label(loading_win, text="Processing ROM, please wait...").pack(pady=10)
            progress = ttk.Progressbar(loading_win, mode="indeterminate")
            progress.pack(fill="x", padx=20, pady=10)
            progress.start()

            def run_rom_setup():
                try:
                    subprocess.run(
                        [sys.executable, "specific/eos_dungeons.py", self.selected_rom.get()],
                        check=True
                    )
                    self.status_label.config(text="ROM processed successfully!")
                except subprocess.CalledProcessError as e:
                    messagebox.showerror("Error", f"ROM processing failed:\n{e}")
                    self.status_label.config(text="ROM processing failed")
                finally:
                    progress.stop()
                    loading_win.destroy()

            threading.Thread(target=run_rom_setup, daemon=True).start()

    # ------------------- Other Existing Functions -------------------
    def on_only_floor_changed(self, *args):
        if self.options['onlyfloor'].get():
            self.options['nostairs'].set(True)
            self.options['nomonsters'].set(True)
            self.options['noflooritems'].set(True)
            self.options['notraps'].set(True)

    def get_options_list(self):
        options = []
        option_mapping = {
            'onlyfloor': '+onlyfloor',
            'nostairs': '+nostairs',
            'nomonsters': '+nomonsters',
            'noflooritems': '+noflooritems',
            'notraps': '+notraps',
            'nokecleon': '+nokecleon',
            'burieditems': '+burieditems',
            'nopatches': '+nopatches',
            'showgrid': '+showgrid'
        }
        for key, flag in option_mapping.items():
            if self.options[key].get():
                options.append(flag)
        seed = self.seed_var.get().strip()
        if seed:
            try:
                int(seed)
                options.append(f'+seed:{seed}')
            except ValueError:
                messagebox.showerror("Invalid Seed", "Seed must be a number!")
                return None
        return options

    def generate_map(self):
        if not self.selected_file.get():
            messagebox.showerror("No File", "Please select an XML file first!")
            return
        if not os.path.exists(self.selected_file.get()):
            messagebox.showerror("File Not Found", "The selected file doesn't exist!")
            return

        options = self.get_options_list()
        if options is None:
            return

        self.generate_btn.config(state='disabled')
        self.progress.start()
        self.status_label.config(text="Generating map...")
        self.root.update()

        try:
            import xml.etree.ElementTree as ET
            with open(self.selected_file.get(), 'rb') as f:
                xml_tree = ET.parse(f)
                root = xml_tree.getroot()

            floor_layout = root.find('FloorLayout')
            if floor_layout is None:
                raise ValueError("XML file does not contain a 'FloorLayout' element.")

            png_data = generate_map(self.selected_file.get(), options)
            self.generated_image_data = png_data
            self.show_preview(png_data)
            self.status_label.config(text="Map generated successfully! Preview shown below.")
        except Exception as e:
            import traceback
            detailed_error = f"Error: {str(e)}\n\nFull traceback:\n{traceback.format_exc()}"
            error_window = tk.Toplevel(self.root)
            error_window.title("Map Generation Error")
            error_window.geometry("600x400")
            ttk.Label(error_window, text="Map generation failed:", font=("Arial", 12, "bold")).pack(pady=10)
            text_frame = ttk.Frame(error_window)
            text_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=10)
            text_widget = tk.Text(text_frame, wrap=tk.WORD, height=15)
            scrollbar = ttk.Scrollbar(text_frame, orient=tk.VERTICAL, command=text_widget.yview)
            text_widget.configure(yscrollcommand=scrollbar.set)
            text_widget.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
            text_widget.insert(tk.END, detailed_error)
            text_widget.config(state=tk.DISABLED)
            ttk.Button(error_window, text="Close", command=error_window.destroy).pack(pady=10)
        finally:
            self.progress.stop()
            self.generate_btn.config(state='normal')

    def show_preview(self, png_data):
        try:
            import tempfile
            with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
                temp_file.write(png_data)
                temp_path = temp_file.name
            photo = tk.PhotoImage(file=temp_path)
            max_width, max_height = 600, 300
            if photo.width() > max_width or photo.height() > max_height:
                ratio = min(max_width / photo.width(), max_height / photo.height())
                new_width = int(photo.width() * ratio)
                new_height = int(photo.height() * ratio)
                resized_photo = photo.subsample(
                    max(1, int(photo.width() / new_width)),
                    max(1, int(photo.height() / new_height))
                )
                photo = resized_photo
            self.preview_label.config(image=photo, text="")
            self.preview_label.image = photo
            self.save_btn.config(state='normal')
            try:
                os.unlink(temp_path)
            except:
                pass
        except Exception:
            self.show_preview_fallback(png_data)

    def show_preview_fallback(self, png_data):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as temp_file:
            temp_file.write(png_data)
            temp_path = temp_file.name
        preview_text = f"Map generated successfully!\nSize: {len(png_data)} bytes\nFile: {temp_path}"
        self.preview_label.config(text=preview_text)
        self.save_btn.config(state='normal')

    def save_map(self):
        if not self.generated_image_data:
            messagebox.showerror("No Map", "No map data to save!")
            return
        output_path = filedialog.asksaveasfilename(
            title="Save Generated Map",
            defaultextension=".png",
            filetypes=[("PNG files", "*.png"), ("All files", "*.*")],
            initialfile="generated_map.png"
        )
        if output_path:
            try:
                with open(output_path, 'wb') as f:
                    f.write(self.generated_image_data)
                self.status_label.config(text=f"Map saved to: {os.path.basename(output_path)}")
                messagebox.showinfo("Success", f"Map saved to:\n{output_path}")
            except Exception as e:
                messagebox.showerror("Save Error", f"Failed to save map: {str(e)}")
        else:
            self.status_label.config(text="Save cancelled")


def main():
    root = tk.Tk()
    style = ttk.Style()
    style.theme_use('clam')
    style.configure("Accent.TButton", foreground="white", background="#4CAF50")
    style.map("Accent.TButton", background=[('active', '#45a049')])
    MapMakerGUI(root)
    root.update_idletasks()
    x = (root.winfo_screenwidth() // 2) - (root.winfo_width() // 2)
    y = (root.winfo_screenheight() // 2) - (root.winfo_height() // 2)
    root.geometry(f"+{x}+{y}")
    root.mainloop()


if __name__ == "__main__":
    main()
