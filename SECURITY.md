# Security Policy

## Supported Versions

Akari is currently in **alpha** (v0.6.x). 
Security updates will be provided for the latest minor release only.

| Version | Supported          |
| ------- | ------------------ |
| 0.6.x   | :white_check_mark: |
| < 0.6.0 | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Because Akari is a sandboxed scripting language, security is our top priority. 
If you discover a way to escape the sandbox, access the file system, or crash the host application, please report it privately.

To report a vulnerability:
1. Go to the **Security** tab of this repository.
2. Click on **"Report a vulnerability"** (GitHub Private Vulnerability Reporting).
3. Provide a detailed description of the issue, including a minimal Akari script that reproduces it.

We will acknowledge your report within 48 hours and work on a fix.

## Our Security Promise

Akari is designed to be **safe by default**:
- No `eval()`.
- No file system access.
- No network access.
- Infinite loops are blocked automatically.

If you find a flaw in this promise, we want to know immediately.
