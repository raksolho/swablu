import os
import subprocess
import sys
import importlib

# --- List of packages you want to ensure are installed ---
required_packages = [
    "discord.py==1.7.3",
    "requests-oauthlib>=1.3.0",
    "tornado==6.5.0",
    "mysql-connector-python==9.1.0",
    "skytemple-files==1.8.3",
    "skytemple-rust==1.8.2",
    "skytemple-dtef==1.6.1",
    "pycairo"
]

# --- Helper function to check if a package is installed ---
def install_if_missing(pkg):
    try:
        pkg_name = pkg.split("==")[0].split(">=")[0]
        importlib.import_module(pkg_name.replace("-", "_"))
    except ImportError:
        print(f"Installing missing package: {pkg}")
        subprocess.run([sys.executable, "-m", "pip", "install", pkg], check=True)

# --- Install each package if missing ---
for package in required_packages:
    install_if_missing(package)

# --- Change working directory to your script folder ---
script_dir = os.path.join(os.path.dirname(__file__), "specific")
os.chdir(script_dir)

# --- Get ROM path from command line or default ---
rom_path = sys.argv[1] if len(sys.argv) > 1 else None
if rom_path is None:
    print("Usage: python run_dungeons.py <path_to_rom>")
    sys.exit(1)

# --- Run eos_dungeons.py with the ROM ---
subprocess.run([sys.executable, "eos_dungeons.py", rom_path])
