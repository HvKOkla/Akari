# Akari v2.0.0 (Work in Progress)

This folder contains the next-generation engine for Akari.

## Why a rewrite?
The v1.0.0 engine (in `src/`) is written in TypeScript. It is stable, tested, and secure. 
However, to achieve maximum performance and absolute memory safety, we are migrating the critical parts to compiled languages.

## Architecture
- **`parser-go/`**: The Lexer, Parser, and Transpiler, rewritten in Go. (Goal: 20x faster parsing).
- **`sandbox-rs/`**: The Sandbox, rewritten in Rust using `Wasmtime`. (Goal: OS-level isolation).

## Status
**Work in Progress.** The v1.0.0 engine remains the stable, production-ready version. 
Do not use the v2 folder in production yet.