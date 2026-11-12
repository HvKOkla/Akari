# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-12

### The "Resurrection" Release

This is the first stable release of Akari. It represents a complete rewrite of the engine.

**A Note on the Project's History:**
Between the early prototypes (v0.x) and this release, Akari was almost deleted. The original JavaScript codebase had become unmaintainable, and the security model was flawed (using `new Function()` for execution). 
After an intense 48-hour sprint, the entire engine was migrated to strict TypeScript, the sandbox was rebuilt using `worker_threads`, and the project was saved.

### Added
- **100% TypeScript Architecture**: Modular compiler (Lexer, Parser, Checker, Transpiler).
- **Impitoyable Static Checker**: Blocks dangerous keywords (`process`, `require`, `eval`, `constructor`) *before* execution.
- **Hardened Sandbox**: Runs in isolated `worker_threads` with memory limits (16MB) and timeouts (1s).
- **Tables (`{}`)**: Native support for dictionaries (e.g., `let player = { "hp": 100 }`).
- **SQL Backend**: Transpile safe scripts to SQL with whitelisting.
- **Language Bindings**: 
  - Python (`bindings/python`)
  - Rust (`bindings/rust`, published on crates.io)
  - Go (`bindings/go`)
- **CLI Tools**: `run`, `build`, `check`, `exec`, `repl`, `fmt`, `doc`, `stats`.
- **32 Tests**: Including 8 Red Team tests (sandbox escapes, infinite loops, prototype pollution).

### Changed
- Migrated from a stack-based VM (see `legacy/vm.js`) to a flat transpiler architecture for better performance and error handling.
- Rewrote all error messages to be beginner-friendly.

### Removed
- Removed `new Function()` (security hazard).
- Removed the legacy VM from the active codebase (kept in `legacy/` for historical reference).

## [0.6.0] - 2026-10-15

### The "Pre-Migration" State

- Last major version before the TypeScript migration.
- Implemented basic Lexer and Parser in JavaScript.
- Added initial sandbox using `new Function` (later found to be insecure).
- Implemented basic SQL backend.
- The project was put on hold for several weeks, nearly abandoned due to technical debt.

## [0.1.0] - 2026-07-20

### The "Genesis"

- Initial commit.
- Stack-based virtual machine (see `legacy/vm.js`).
- Basic arithmetic, variables, and loops.
- A simple idea: "What if I created my own safe scripting language?"