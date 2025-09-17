import os
import subprocess
import sys

script_dir = os.path.join(os.path.dirname(__file__), "swablu", "specific")
os.chdir(script_dir)

subprocess.run([sys.executable, "eos_dungeons.py"])
