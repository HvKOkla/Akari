
# Akari

<div align="center">
  <img src="Akari.png" alt="Akari Logo" width="120" />
  <h1>Akari</h1>
  <p><strong>Safe by default. Small by design.</strong></p>
</div>

A safe, embeddable scripting language for your app.
19 keywords. Explicit `end`. No I/O, no network, no crashes.

**Status:** Production Ready · **Version:** 1.0.0 · **License:** Apache-2.0

![crates.io](https://img.shields.io/crates/v/akari-rs)
![Downloads](https://img.shields.io/crates/d/akari-rs)
![npm](https://img.shields.io/npm/v/akari-lang)
![crates.io](https://img.shields.io/crates/v/akari-rs)
![License](https://img.shields.io/badge/license-Apache--2.0-blue)
![Security](https://img.shields.io/badge/security-hardened-green)

## 📖 The Story of Akari


Akari started in **July 2026** as a weekend project to understand how languages work. It began as a simple stack-based virtual machine in JavaScript (`legacy/vm.js`).

By October 2026, the project had grown, but the original JavaScript codebase was becoming a security nightmare. The project was on the verge of being **deleted forever**.

Instead of abandoning it, the entire engine was rewritten in strict TypeScript, the sandbox was rebuilt from scratch using `worker_threads`, and a strict security checker was added.

Today, Akari is a production-ready language with bindings for Python, Rust, and Go. It's a testament to the fact that with a bit of stubbornness, a dead project can be resurrected.

## Why Akari?

Lua is 30 years old. JavaScript's `eval()` is a security nightmare. WASM is too low-level.

If you want to add **user scripting** to your game, editor, or SaaS, you need something **safe** by default. Akari was built for this.

- **Safe by default** — `say`, I/O, and network access are disabled unless *you* explicitly allow them.
- **Impitoyable Checker** — blocks access to `process`, `require`, `eval`, and `constructor` *before* compilation.
- **Can't crash your app** — scripts run in isolated Worker threads with strict memory limits (16MB) and timeouts (1s).
- **Data Structures** — native support for Tables (`{}`) to model game entities, configs, and more.
- **100% TypeScript** — a modular compiler (Lexer, Parser, Checker, Transpiler) strictly typed.
- **Red Team Tested** — 32 automated tests, including 8 hacker attacks that are successfully blocked.
- **SQL Backend** — Transpile safe scripts to SQL queries with built-in whitelisting.

---

## 🌍 Language Bindings

Akari is designed to be embedded anywhere. It runs in a secure sandbox, no matter the host language.

| Language | Package | Status |
|----------|---------|--------|
| **Node.js** | `npm install akari-lang` | ✅ Official |
| **Rust** | `cargo add akari-rs` | ✅ Published on crates.io |
| **Python** | `pip install akari-lang` | 🟡 Local (Soon on PyPI) |
| **Go** | `go get github.com/HvKOkla/Akari/bindings/go/akari` | ✅ Published on GitHub |

## Editor Support
- **VS Code**: [Syntax highlighting](extensions/vscode/README.md) (Download the `.vsix` file).

## Embed in 10 lines (Node.js)

Akari is designed to be embedded. You can run untrusted user code safely in your application:

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

```akari
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
```

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