
# Akari

> Learn to code in one week.

Akari is a small programming language with **18 keywords**. It's designed for people who want to learn to code without fighting the syntax.

**Status:** alpha · **Version:** 0.4.0 · **License:** Apache-2.0

---

## Why Akari?

Because Python hurt my eyes.

Indentation is fragile. One wrong space, and everything breaks. Akari uses `end` instead. Every block ends explicitly. No surprises.

```akari
if x > 10:
    say("big")
else:
    say("small")
end
```

That's it. You always know where a block ends.

---

## Install

```bash
npm install -g akari-lang
```

## Quick start

```bash
akari init my-project
cd my-project
akari run main.akari
```

## Syntax

```akari
let x = 5          # immutable
mut count = 0      # mutable

def square(n):
    return n * n
end

if x > 10:
    say("big")
else:
    say("small")
end

for i in 1..5:
    say(i)
end

try:
    risky()
catch err:
    say(err)
end

import "maths"
```

## Keywords

`import` · `def` · `end` · `return` · `if` · `else` · `else if` · `for` · `in` · `while` · `stop` · `skip` · `try` · `catch` · `true` · `false` · `nothing` · `let` · `mut`

## Commands

```bash
akari run <file>          # compile and execute
akari build <file>        # compile to JavaScript
akari check <file>        # syntax check
akari exec "code"         # execute one line
akari repl                # interactive mode
akari init [name]         # create a project
akari fmt <file>          # format code
akari test [dir]          # run tests
akari doc <file>          # generate docs
akari stats <file>        # code statistics
```

## Built-in functions

**I/O:** `say` `ask` `toNumber` `toText` `kind`

**Options:** `Some` `None` `isSome` `isNone`

**Buffers:** `int8` `uint8` `int16` `int32` `float32` `float64` `arrayBuffer` …

**Buffer ops:** `fill` `copy` `slice` `isBuffer` `bufferSize`

**WebGPU:** `gpuInit` `gpuBuffer` `gpuSync` (experimental)

## Stability

**Code written today will run in 10 years.**

The engine is frozen. The syntax is final. The keyword count will never change.

No breaking changes. Ever.

→ Read the full [Stability promise](https://codeberg.org/HvK_Okla/Akari/wiki/Stability).

## Playground

Try Akari in your browser: *(coming soon)*

## Documentation

- [Wiki](https://codeberg.org/HvK_Okla/Akari/wiki) — full reference
- [Documentation.md](Documentation.md) — condensed version
- [Examples](https://codeberg.org/HvK_Okla/Akari/wiki/Examples) — real programs
- [Cheatsheet](https://codeberg.org/HvK_Okla/Akari/wiki/Cheatsheet) — everything on one page

## Development

```bash
git clone https://codeberg.org/HvK_Okla/Akari.git
cd Akari
npm test
```

All 21 tests should pass.

## Contributing

The engine is frozen. All contributions go to `std_akari/`.

→ See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Apache-2.0
```