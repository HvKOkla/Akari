
```markdown
# Akari Extensions

The core engine of Akari is **frozen**. It has 19 keywords and a sandboxed runtime.
But Akari is designed to be extended. This folder contains official and community extensions.

## What is an extension?

An extension is a separate npm package that uses `akari.expose()` to add new functions to the Akari sandbox. 
It does **not** modify the engine. It simply bridges the gap between Akari and the host environment.

## Why extensions?

Because Akari is **safe by default**. It has no I/O, no networking, and no file system access. 
If you need those features, you create an extension and explicitly expose them to the script.

## How to create an extension

1. **Create a folder** in `extensions/` (e.g. `extensions/akari-json`).
2. **Create a `package.json`** with a name like `akari-json`.
3. **Write your code** in `index.js`. Use `akari.expose()` to expose your functions.

### Example: `akari-json`

```javascript
// extensions/akari-json/index.js
module.exports = function exposeJSON(akari) {
  akari.expose('jsonParse', (str) => JSON.parse(str));
  akari.expose('jsonStringify', (obj) => JSON.stringify(obj));
};
```

### How users install it

```bash
npm install akari-lang akari-json
```

```javascript
const { Akari } = require('akari-lang');
const exposeJSON = require('akari-json');

const akari = new Akari({ allow: ['say'] });
exposeJSON(akari);

akari.run(`
  let data = jsonParse('{"name": "Akari"}')
  say(data.name)
`);
```

## Rules for extensions

- **No engine modification**: You cannot change `src/frontend.js` or `src/backend.js`.
- **No sandbox bypass**: Your functions must be safe. Do not expose `eval`, `process`, or `require`.
- **English only**: All comments and documentation must be in English.
- **Tests required**: Every extension must have a test file showing it works.

## Submit your extension

Once your extension is ready:
1. Add a `README.md` explaining what it does.
2. Submit a Pull Request to add your folder in `extensions/`.
3. We will review it and link it in the main `ECOSYSTEM.md`.
```