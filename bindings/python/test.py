import sys
import os
sys.path.append(os.path.dirname(__file__))

from akari import Akari

print("--- Test du pont Python ---")

engine = Akari(allow=['say'])

engine.run("""
let player = { "name": "Alice", "hp": 100 }
say("Hello from Python, " + player.name)
say("HP: " + toText(player.hp))
""")