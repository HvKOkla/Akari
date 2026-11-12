# Akari Standard Library (`std_akari`)

Welcome to the official standard library for the **Akari** programming language.

While the core engine (`src/`) is kept minimal to guarantee security and embeddability, `std_akari` is where the community can add useful modules.

## Philosophy

Akari is a **safe, embeddable scripting language**. Because it is sandboxed by default, the standard library does not include dangerous I/O operations (like reading files or network access). Instead, it focuses on pure logic, mathematics, and data manipulation.

## Available Modules

- `maths/base.akari`: Basic math helpers.
- `maths/trig.akari`: Trigonometry functions (sin, cos, tan).
- `maths/vecteurs.akari`: 2D/3D vector math.

*(Note: If you are embedding Akari in your app, you must explicitly allow these modules or expose equivalent host functions via `akari.expose()`).*

## Contributing

The standard library is **open to community contributions**. 

Want to add a new module? (e.g., string manipulation, advanced math, sorting algorithms). 
1. Create a new `.akari` file in the appropriate folder.
2. Write tests for it.
3. Submit a Pull Request on [GitHub](https://github.com/HvKOkla/Akari).

Please ensure your code is written in English and follows the Akari style guide (explicit `end`, 4 spaces indentation).
