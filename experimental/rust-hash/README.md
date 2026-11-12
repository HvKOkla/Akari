# Rust Hash Prototype

This is a proof-of-concept for the Akari v2 security model. It uses the `sha2` crate to hash scripts.

## Why?
To ensure script integrity. In the future, the Akari engine will hash scripts before execution to ensure they haven't been tampered with by a third party.

## Status
- [x] Basic SHA-256 hashing.
- [ ] Connect to the main TypeScript engine via N-API.