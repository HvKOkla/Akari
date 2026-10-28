# Akari — Project Notes & Architecture

> **Status:** v1.0.0 (Stable)
> **Motto:** Safe by default. Small by design.

This file is a summary of the architecture, design decisions, and future roadmap of Akari. It is meant for contributors and for future me (if I ever take a break).

---

## 1. The Core Philosophy

- **19 keywords.** No more, no less. The language is **frozen**.
- **Safe by default.** No I/O, no network. Everything is sandboxed.
- **Small by design.** The engine is 4 files, zero dependencies.

## 2. The Architecture (Flat)

The engine is split into two main files in `src/`:

1. **`frontend.js`** : Lexer + Parser. Reads Akari source and produces an AST.
2. **`backend.js`** : Checker + Transpiler. Takes the AST and generates JavaScript.

The entry point is `index.js` at the root. It exports the `Akari` class (for embedding) and the `run` function (for CLI/tests).

## 3. The Sandbox (How it works)

Akari is safe because:
- It transpiles to JS, but uses `new Function()` with an **empty scope**.
- The user can only access what the host exposes via `akari.expose()`.
- `import` is blocked at the transpiler level.
- Infinite loops are blocked at 1,000,000 iterations.

## 4. The "JavaScript Detachment"

Akari does **not** inherit JavaScript's bad behaviors:
- `"5" + 2` throws an error (no type coercion).
- `5 / 0` throws an error (no `Infinity`).
- `==` is strict (like `===`).

This is done by generating calls to `__akari_binop()` and `__akari_unop()` in the runtime.

## 5. What's Done (v1.0.0)

- [x] Lexer & Parser (with operator precedence).
- [x] Safety checker (identifiers, scoping).
- [x] Transpiler (strict semantics).
- [x] Sandbox (via `new Function`).
- [x] CLI (`akari run`, `akari exec`, `akari repl`).
- [x] 5 conformance tests (`tests/conformance/`).
- [x] Documentation (README, SECURITY, CONTRIBUTING, spec).
- [x] Examples (hello, fizzbuzz, game_mod).

## 6. What's Next (Roadmap)

- [ ] **Playground** (HTML + JS, for browser testing).
- [ ] **VS Code Extension** (syntax highlighting).
- [ ] **WASM Backend** (via AssemblyScript, for browser playground).
- [ ] **Lua/Python Backend** (for microcontrollers, but "unsafe" by default).

## 7. How to use the AI (Optional)

If you want to generate Akari code with an LLM (like DeepSeek, ChatGPT, or Groq), use this prompt:

> *"You are an expert in Akari. Akari has 19 keywords. Blocks end with 'end'. No I/O, no network. Write only valid Akari code."*

## 8. The Rules (Do not break)

1. **Never add a 20th keyword.**
2. **Never break the conformance tests.**
3. **Never remove the sandbox.**
4. **Never add dependencies to the core engine.**

---

*Last updated: [Date]*
