# Contributing to Akari Standard Library (`std_akari`)

Thank you for your interest in contributing to the Akari Standard Library! Because the core engine (`/src`) is frozen to ensure long-term stability and backward compatibility, the standard library is the primary place where the community can grow and add useful modules.

Please follow these guidelines to make sure your contributions are integrated smoothly.


## 1. What can you contribute?
We welcome modular utilities and tools written in pure Akari, such as:
* **Advanced Mathematics** (Matrices, geometry, statistics)
* **Text & String manipulation** (Formatting, parsing helpers)
* **Data Structures** (Queues, stacks, advanced lists)
* **Utility helpers**


## 2. Rules for Contributions
To keep Akari simple, readable, and consistent, all contributions must respect these rules:
1. **Use Akari syntax:** Stick strictly to the 17 keywords (`def`, `return`, `end`, `if`, `for`, etc.).
2. **Comment your code:** Every function should include clear comments explaining what it does and what parameters it expects.
3. **No breaking changes:** Do not modify existing functions in a way that breaks scripts written by other users.
4. **Keep it lightweight:** Avoid overly complex or bloated dependencies.


## 3. How to Submit a Pull Request (PR)
1. Fork the repository on Codeberg.
2. Create a new branch for your feature (e.g., `git checkout -b feature/matrix-module`).
3. Add your `.akari` file in the appropriate subfolder inside `std_akari/` (e.g., `std_akari/maths/matrices.akari`).
4. Test your code thoroughly using the Akari transpiler.
5. Open a Pull Request on Codeberg with a clear description of what your module does.

Thank you for helping build the future of Akari! 