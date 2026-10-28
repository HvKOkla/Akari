
```markdown
# Security Example

This folder contains examples demonstrating Akari's sandbox.

## `hacker.akari`

This script tries to do three dangerous things:
1. Import the file system (`fs`).
2. Import the network (`http`).
3. Freeze the server with an infinite loop (`while true`).

### What happens when you run it?

Akari blocks **all** of them, safely:

```bash
$ akari run examples/security/hacker.akari
❌ [CompileError] 'import' is not supported by the transpiler.
  --> Line 4, Column 1
  = hint: Akari is sandboxed by default. Use akari.expose() instead.
```

The script never reaches the infinite loop. The file system is never accessed. The network is never touched.

**Your app stays alive.**
```