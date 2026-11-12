# Security Policy

## Supported Versions

Akari is currently in **v1.0.0 (Production Ready)**. 
Security updates are provided for the latest stable release only. Older versions are not supported.

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0.0 | :x:                |

## Reporting a Vulnerability

**DO NOT report security vulnerabilities through public GitHub issues, Discord, or social media.**

Akari executes untrusted code by design. Security is not a feature; it is the foundation of this project. 
If you discover a way to escape the sandbox, access the host system, or crash the host application, we want to know immediately, and we want to keep it private until a fix is published.

### How to report

1. Go to the **Security** tab of this repository.
2. Click on **"Report a vulnerability"** (GitHub Private Vulnerability Reporting).
3. Provide a detailed description, including a **minimal, reproducible Akari script** that demonstrates the issue.

We will acknowledge your report within **48 hours** and provide an estimated timeline for the fix.

## What is considered a vulnerability?

We take the following very seriously:

- **Sandbox Escape**: Executing arbitrary JavaScript or accessing `process`, `require`, `globalThis`, etc.
- **Prototype Pollution**: Modifying `Object.prototype`, `Array.prototype`, or any global object.
- **Denial of Service (DoS)**: Bypassing the `maxIterations` limit (infinite loops) or the `timeout` limit.
- **Memory Exhaustion**: Bypassing the `resourceLimits` (16MB max) of the Worker sandbox.
- **SQL Injection**: Bypassing the whitelist in the SQL backend.
- **Data Leakage**: Exposing host variables or functions that were not explicitly exposed via `akari.expose()`.

## What is NOT considered a vulnerability?

To keep the signal-to-noise ratio high, the following are **not** security issues:

- A script returning `null` or `undefined` because the user forgot to return a value.
- Syntax errors in the Akari code (this is the job of the Parser).
- The fact that Akari does not have a specific feature (e.g., `try/catch` or file imports).
- Performance issues on very large scripts (unless it causes a crash).
- Zero-day vulnerabilities in the underlying V8 engine (report those to Google).

## Our Security Promise (Zero Trust)

Akari is built on the principle of **Zero Trust**:
- **No `eval()`** in the user code.
- **No file system access**.
- **No network access**.
- **Strict Static Checker**: Blocks dangerous keywords *before* compilation.
- **Hardened Sandbox**: Runs in an isolated `worker_threads` with memory and time limits.

If you find a flaw in this promise, we want to know immediately.