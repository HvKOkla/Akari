
```markdown
# Akari

# Akari

> **Safe by default. Small by design.**

A safe, embeddable scripting language for your app.
19 keywords. Explicit `end`. No I/O, no network, no crashes.

**Status:**product · **Version:1.0.0 · **License:** Apache-2.0

---

## Why Akari?

Lua is 30 years old. JavaScript's `eval()` is a security nightmare. WASM is too low-level. 

If you want to add **user scripting** to your game, editor, or SaaS, you need something **safe** by default. Akari was built for this.

- **Safe by default** — `say`, I/O, and network access are disabled unless *you* allow them.
- **Can't crash your app** — infinite loops and excessive memory are caught automatically by the engine.
- **Clear errors** — your users understand what went wrong with plain-English hints.
- **Tiny** — 19 keywords, 2 core files, zero dependencies.

---

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
const result = akari.run(`
  let hp = getPlayerHealth()
  if hp < 10:
    say("Low health!")
    damagePlayer(100)
  end
`);
```

## Syntax

```akari
let x = 5          # immutable
mut count = 0      # mutable

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

try:
    risky()
catch err:
    say(err)
end
```

## Keywords

`import` · `def` · `end` · `return` · `if` · `else` · `for` · `in` · `while` · `stop` · `skip` · `try` · `catch` · `true` · `false` · `nothing` · `let` · `mut`

*(19 keywords. That's it.)*

## Built-in functions

- **I/O:** `say` (requires `allow: ['say']`)
- **Options:** `Some`, `None`, `isSome`, `isNone`
- **Conversion:** `toNumber`, `toText`, `kind`
- **Math:** `sqrt`, `pow`, `abs`, `random` (via `__rt_math_*`)

## CLI

If you just want to run Akari scripts locally:

```bash
npm install -g akari-lang
akari run <file>
akari check <file>
```

## Stability

**Code written today will run in 10 years.**

No breaking changes. Ever.

## License

Apache-2.0
```
