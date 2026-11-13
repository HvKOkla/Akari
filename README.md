
# Akari

<div align="center">
  <img src="Akari.png" alt="Akari Logo" width="120" />
  <h1>Akari</h1>
  <p><strong>Safe by default. Small by design.</strong></p>
</div>

Akari is a lightweight, embeddable scripting language designed for secure execution in games, SaaS platforms, and desktop applications.

**Status:** Production Ready (v1.0.0) · **License:** Apache-2.0

![License](https://img.shields.io/badge/license-Apache--2.0-blue)
![Security](https://img.shields.io/badge/security-hardened-green)

## Overview

Modern applications often require user-defined logic (mods, macros, rules, or configurations). However, embedding existing solutions presents trade-offs: Lua lacks strict sandboxing, JavaScript's `eval()` is inherently insecure, and WASM is too complex for simple scripting tasks.

Akari solves this by providing a strictly typed, easily embeddable language with a zero-trust execution model. 

## Key Features

- **Zero-Trust Sandboxing:** Scripts run in an isolated environment with strict memory limits and timeouts. Native functions must be explicitly exposed by the host.
- **Static Security Checker:** The compiler analyzes the AST before execution, blocking dangerous constructs (`process`, `require`, `eval`, `__proto__`) and preventing unauthorized scope access.
- **Predictable Execution:** Guardrails against infinite loops and runaway memory consumption.
- **Minimalist Syntax:** 19 keywords. Explicit block termination (`end`). No hidden magic, no prototypes. 
- **Native Data Structures:** First-class support for Tables (`{}`), allowing scripts to model complex entities and configs.
- **Multi-Language Bindings:** Designed for interoperability, with official support for Node.js, Rust, Python, and Go.

## Installation
git clone https://github.com/HvKOkla/Akari.git
cd Akari
npm install
npm run build


## Usage

Akari is built to be embedded. The host application defines the boundaries and exposes only the necessary capabilities.

```javascript
const { Akari } = require('akari-lang');

const akari = new Akari({
  allow: ['say'],          // Explicitly allow the 'say' built-in
  maxIterations: 100_000,  // Hard limit to prevent infinite loops
  timeout: 1000            // Abort execution after 1 second
});

// Expose host functions to the Akari script
akari.expose('getPlayerHealth', () => player.health);
akari.expose('damagePlayer', (amount) => player.damage(amount));

// Execute untrusted user code
await akari.run(`
  let hp = getPlayerHealth()
  if hp < 10:
    say("Critical health!")
    damagePlayer(100)
  end
`);
```

## Language Syntax

```akari
let x = 5          # Immutable binding
mut count = 0      # Mutable binding

let player = { "name": "Alice", "hp": 100 }
say(player.name)

def square(n):
    return n * n
end

if x > 10:
    say("Condition met")
else:
    say("Condition failed")
end

for i in 1..5:
    say(i)
end
```

### Keywords
`import` · `def` · `end` · `return` · `if` · `else` · `for` · `in` · `while` · `stop` · `skip` · `try` · `catch` · `true` · `false` · `nothing` · `let` · `mut`

## Contributing

Akari is an open-source project. Contributions to the compiler, standard library, or bindings are welcome. 

## License

Licensed under the Apache License 