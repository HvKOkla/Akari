```markdown
# Akari

> Learn to code in 1 week. Simple, powerful.


## 18 Keywords

`import` · `def` · `end` · `return` · `if` · `else` · `else if` · `for` · `in` · `while` · `stop` · `skip` · `try` · `catch` · `true` · `false` · `nothing` · `let` · `mut`


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

## Built-in Functions

### I/O & Types

| Function | Description |
| :--- | :--- |
| `say(...)` | Print values |
| `ask(msg?)` | Read user input (browser only) |
| `toNumber(v)` | Convert to number |
| `toText(v)` | Convert to text |
| `kind(v)` | Return type name |

### Options

| Function | Description |
| :--- | :--- |
| `Some(v)` | Wrap a value |
| `None()` | Empty option |
| `isSome(opt)` | Check if has value |
| `isNone(opt)` | Check if empty |

### Buffers

| Function | Description |
| :--- | :--- |
| `int8(n)` `uint8(n)` `uint8Clamped(n)` | Typed arrays |
| `int16(n)` `uint16(n)` `int32(n)` `uint32(n)` | Typed arrays |
| `float32(n)` `float64(n)` | Typed arrays |
| `bigInt64(n)` `bigUint64(n)` | BigInt arrays |
| `arrayBuffer(bytes)` | Raw buffer |
| `dataView(buf)` | DataView wrapper |

### Buffer Operations

| Function | Description |
| :--- | :--- |
| `fill(buf, val)` | Fill with value |
| `copy(buf)` | Shallow copy |
| `slice(buf, start, end)` | Sub-buffer |
| `isBuffer(buf)` | Check if buffer |
| `bufferSize(buf)` | Byte length |
| `toFloat32(buf)` `toFloat64(buf)` | Convert buffer type |
| `toInt32(buf)` `toUint8(buf)` `toUint8Clamped(buf)` | Convert buffer type |
| `toInt16(buf)` `toUint16(buf)` | Convert buffer type |

### WebGPU (experimental)

| Function | Description |
| :--- | :--- |
| `gpuInit()` | Initialize WebGPU |
| `gpuBuffer(buf)` | Upload to GPU |
| `gpuSync(buf, handle)` | Sync CPU → GPU |


## Limits

- **50 MB** max per buffer
- **10,000,000** max iterations per loop


## License

Apache 2.0
```