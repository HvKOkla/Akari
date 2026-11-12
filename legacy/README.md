# Legacy Versions (Archive)

This folder contains the early prototypes and historical versions of the Akari programming language.

> ⚠️ **WARNING: DO NOT USE IN PRODUCTION**
> 
> These versions are kept for historical reference and educational purposes only. They contain known security vulnerabilities (such as the use of `eval()` and `new Function()`) and lack the sandbox isolation present in the modern engine. 

## Why keep them?

Every great project has a beginning. These files document the evolution of Akari from a simple weekend experiment to a production-ready, secure scripting language. 

By keeping them, we document:
1. **The learning curve:** How the Lexer, Parser, and Transpiler were built from scratch.
2. **The architecture shifts:** Why we moved from a stack-based VM to a flat transpiler, and later to strict TypeScript.
3. **The security journey:** How we identified critical flaws (like RCE and DoS) and progressively hardened the engine.

## Versions History

### v0.4.1 (The Genesis)
- **Date:** September 11
- **Architecture:** Stack-based VM in JavaScript.
- **Features:** Buffers (float32, int32), WebGPU bindings, HTML Playground.
- **Security:** ❌ **Critical.** Used `eval()` and `new Function()` without a sandbox. Anyone could execute arbitrary code on the host machine.

### v0.5.0 (The First Sandbox Attempt)
- **Architecture:** Transition to a flat transpiler.
- **Features:** Introduction of the `Akari` class with a capability model (`allow: ['say']`).
- **Security:** ❌ **Critical.** Still relied on `new Function()` for execution. The "sandbox" was only an illusion.

### v0.5.1 (The Pratt Parser)
- **Architecture:** Improved expression parsing.
- **Features:** Implementation of operator precedence (Pratt parsing). 
- **Security:** ❌ **Critical.** Same `new Function()` flaw. 

### v0.6.1 (The Almost-There)
- **Architecture:** Added `import`, `while`, and better lexing.
- **Features:** Native buffers, basic standard library.
- **Security:** ⚠️ **Vulnerable.** The capability model was improved, but `new Function()` still allowed sandbox escapes via the `constructor` chain.

### v0.7.0 (The Resurrection)
- **Date:** Two days ago.
- **Architecture:** Complete rewrite in **TypeScript**. Modular structure (`compiler/`, `sandbox/`, `backends/`).
- **Security:** ✅ **Secure.** Replaced `new Function()` with isolated `worker_threads`, added a strict static `Checker` (blocking `process`, `eval`, etc.), and introduced Red Team tests.

---

## The Modern Engine

If you are looking for the stable, secure, and production-ready version of Akari, please check the root `src/` directory or the latest Release (v1.0.0). 

The modern engine uses:
- Strict TypeScript architecture.
- A V8 Worker Thread sandbox with memory and time limits.
- An impitoyable static checker.
- 32 automated tests (including 8 Red Team attacks).