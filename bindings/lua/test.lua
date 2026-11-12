local akari = require("akari")

print("--- Test du pont Lua ---")

akari.run([[
let player = { "name": "Alice", "hp": 100 }
say("Hello from Lua, " + player.name)
]])