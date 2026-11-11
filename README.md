
# Akari

> **Safe by default. Small by design.**

A safe, embeddable scripting language for your app.
19 keywords. Explicit `end`. No I/O, no network, no crashes.

**Status:** Production Ready · **Version:** 1.0.0 · **License:** Apache-2.0


## Why Akari?

Lua is 30 years old. JavaScript's `eval()` is a security nightmare. WASM is too low-level.

If you want to add **user scripting** to your game, editor, or SaaS, you need something **safe** by default. Akari was built for this.

- **Safe by default** — `say`, I/O, and network access are disabled unless *you* explicitly allow them.
- **Impitoyable Checker** — blocks access to `process`, `require`, `eval`, and `constructor` *before* compilation.
- **Can't crash your app** — scripts run in isolated Worker threads with strict memory limits (16MB) and timeouts (1s).
- **Data Structures** — native support for Tables (`{}`) to model game entities, configs, and more.
- **100% TypeScript** — a modular compiler (Lexer, Parser, Checker, Transpiler) strictly typed.
- **Red Team Tested** — 32 automated tests, including 8 hacker attacks that are successfully blocked.


## Embed in 10 lines

Akari is designed to be embedded. You can run untrusted user code safely in your Node.js application:

```javascript
const { Akari } = require('akari-lang');

const akari = new Akari({
  allow: ['say'],          // Only allow what the script needs
  maxIterations: 100_000,  // Prevent infinite loops
  timeout: 1000            // Kill after 1 second
});

// Expose host functions to the script
akari.expose('getPlayerHealth', () => player.health);
akari.expose('damagePlayer', (amount) => player.damage(amount));

// Run untrusted user code safely
await akari.run(`
  let hp = getPlayerHealth()
  if hp < 10:
    say("Low health!")
    damagePlayer(100)
  end
`);
```

## Syntax

let x = 5          # immutable
mut count = 0      # mutable

let player = { "name": "Alice", "hp": 100 }  # Tables (dicts)
say(player.name)

def square(n):
    return n * n
end

if x > 10:
    say("big")
else:
    say("small")
end

for i in 1..5:
    say(i)
end

## Keywords

`import` · `def` · `end` · `return` · `if` · `else` · `for` · `in` · `while` · `stop` · `skip` · `try` · `catch` · `true` · `false` · `nothing` · `let` · `mut`

*(19 keywords. That's it.)*

## Built-in functions

- **I/O:** `say` (requires `allow: ['say']`)
- **Conversion:** `toNumber`, `toText`, `kind`
- **Math:** `sqrt`, `pow`, `abs`, `floor`, `ceil`, `round`, `min`, `max`, `random`

## CLI

If you just want to run Akari scripts locally:

```bash
npm install -g akari-lang
akari run <file>
akari check <file>
akari build <file> --sql
```

## Stability

**Code written today will run in 10 years.**

No breaking changes. Ever.

## License

Apache-2.0
```