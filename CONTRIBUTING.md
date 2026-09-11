
# Contributing to Akari

Thanks for your interest in Akari. This guide explains how to help.

**Short version:** the engine is frozen. All contributions go to `std_akari/`.

## Table of contents

- [The engine is frozen](#the-engine-is-frozen)
- [Code of conduct](#code-of-conduct)
- [What we're looking for](#what-were-looking-for)
- [What we're NOT looking for](#what-were-not-looking-for)
- [Reporting a bug](#reporting-a-bug)
- [Suggesting a feature](#suggesting-a-feature)
- [Submitting code](#submitting-code)
- [Code style](#code-style)
- [Adding a standard library module](#adding-a-standard-library-module)
- [Stability policy](#stability-policy)


## The engine is frozen

**Very important. Read this first.**

The core files are **frozen forever**:

- `src/lexer.js`
- `src/Parser.js`
- `src/transpiler.js`
- `src/bundler.js`
- `src/bundler.browser.js`

**Do not modify them.**

They are stable, tested, and complete. Any change risks breaking everything. Akari promises **10 years of stability** — this is how we keep that promise.

**Any pull request that modifies these files will be rejected without discussion.**

If you find a bug in the engine:

1. **Report it** in an issue
2. **Wait for discussion**
3. **Don't submit a PR** until approved
4. **Understand** that some bugs won't be fixed (see [Stability policy](#stability-policy))

**All contributions go to `std_akari/`.**

This is the rule. It keeps Akari small, safe, and stable.

---

## Code of conduct

Be kind. Be patient. Be constructive.

Disagreements are fine. Personal attacks are not.

We're all here because we like programming languages. Let's keep it that way.

---

## What we're looking for

- **Math** functions (geometry, trigonometry, matrices)
- **Text** utilities (upper, lower, split, join)
- **Buffer** helpers (conversions, iteration)
- **Physics** helpers (velocity, acceleration)
- **Bug fixes** in existing stdlib modules
- **Documentation** improvements
- **Examples** showing Akari in action
- **Translations** of the docs

---

## What we're NOT looking for

- **New keywords** — Akari has 18. That's final.
- **New syntax** — the language is frozen.
- **Changes to built-ins** — `say`, `float32`, etc. are frozen.
- **Networking** — Akari has no network access.
- **File system access** — Akari runs in browsers too.
- **Classes** — not now, not ever.
- **Type annotations** — Akari is dynamically typed.
- **Meta-programming** — no macros, no eval.
- **Third-party dependencies** — Akari has zero.

If your idea needs any of these, it's not a good fit.

---

## Reporting a bug

Open an [issue](https://codeberg.org/HvK_Okla/Akari/issues) with:

1. **Title** — one sentence describing the bug
2. **Expected behavior** — what you thought would happen
3. **Actual behavior** — what really happened
4. **Steps to reproduce** — minimal code that triggers it
5. **Version** — output of `akari --version`
6. **Environment** — OS, browser (if playground)

Example:

```markdown
### Bug: `clamp()` returns wrong value for negative inputs

**Expected:** `clamp(-5, 0, 10)` should return `0`
**Actual:** it returns `-5`

**Steps:**
```akari
import "maths/base"
say(clamp(-5, 0, 10))
```

**Version:** 0.4.0
**Environment:** Windows 11, Node 20
```

---

## Suggesting a feature

Open an [issue](https://codeberg.org/HvK_Okla/Akari/issues) with the `enhancement` label.

Answer these questions:

1. **What does the feature do?**
2. **Why is it useful?**
3. **Show a small example.**
4. **Does it add a keyword?** (if yes, it's rejected)
5. **Does it modify the engine?** (if yes, it's rejected)

Example:

```markdown
### Feature: `sqrt()` function

**What:** Returns the square root of a number.
**Why:** Needed for distance calculations.

**Example:**
```akari
import "maths/base"
say(sqrt(16))    # 4
```

**Adds a keyword?** No.
**Modifies the engine?** No, just a stdlib function.
```

---

## Submitting code

### 1. Fork the repository

Click "Fork" on the Codeberg page.

### 2. Clone your fork

```bash
git clone https://codeberg.org/YOUR-USERNAME/Akari.git
cd Akari
```

### 3. Create a branch

```bash
git checkout -b my-feature
```

Use a clear name: `add-sqrt`, `fix-clamp`, `improve-docs`.

### 4. Make your changes

- Add your code to `std_akari/`
- Add tests to `tests/`
- Update the wiki if needed

### 5. Run the tests

```bash
npm test
```

All tests must pass.

### 6. Commit

```bash
git add .
git commit -m "Add sqrt function to maths/base"
```

Write clear commit messages. Describe **what** and **why**.

### 7. Push

```bash
git push origin my-feature
```

### 8. Open a Pull Request

On Codeberg, click "New Pull Request". Explain:

- What you changed
- Why you changed it
- Any trade-offs

A maintainer will review it.

**Reminder:** if your PR modifies `src/*.js`, it will be closed immediately.

---

## Code style

### Akari code

- Use `def`, `:`, and `end`
- Indentation: **4 spaces** (or 2, but be consistent)
- Comments in **English**
- Keep functions **small** (under 20 lines if possible)
- One function per concept

Example:

```akari
# Returns the square root of a number.
def sqrt(n):
    if n < 0:
        return 0
    end
    return n
end
```

### Documentation

Every stdlib function should have:

- A **one-line comment** above the `def`
- An **example** in the wiki
- A **test** in `tests/`

---

## Adding a standard library module

To add a new module:

### 1. Choose a category

Existing categories:

- `maths/` — math functions
- `geometry/` — geometry helpers
- `physics/` — physics helpers
- `text/` — text utilities
- `utils/` — general helpers

If your module doesn't fit, propose a new category in an issue.

### 2. Create the file

Path: `std_akari/<category>/<name>.akari`

Example: `std_akari/geometry/circle.akari`

### 3. Write the code

```akari

# Returns pi.
def pi():
    return 3.141592653589793
end

# Returns the area of a circle.
def area(r):
    return pi() * r * r
end

# Returns the circumference of a circle.
def circumference(r):
    return 2 * pi() * r
end
```

### 4. Add tests

Create `tests/test_geometry_circle.akari`:

```akari
import "geometry/circle"

if pi() > 3.14 && pi() < 3.15:
    say("pi OK")
else:
    say("pi FAILED")
end

if area(2) > 12.5 && area(2) < 12.6:
    say("area OK")
else:
    say("area FAILED")
end
```

### 5. Update the wiki

Create a page named after your module (e.g. `geometry-circle`).
Link it from `Home` and `_Sidebar`.

### 6. Submit

Follow the [Submitting code](#submitting-code) steps.


## Stability policy

Akari promises **10 years of stability**.

This means:

- **No breaking changes** — ever
- **No new keywords** — ever
- **No syntax changes** — ever
- **No changes to the engine** — ever

### What this means for bug reports

If a bug can be fixed **without** changing the engine, it will be fixed.

If a bug requires **changing the engine**, it will **not** be fixed. Instead:

1. It will be documented
2. A workaround will be suggested (if possible)
3. The issue will be closed with the label `wontfix`

This is intentional. **Stability > fixes.**

### What this means for features

New features must:

- Live in `std_akari/`
- Not add keywords
- Not modify the engine
- Not break existing code

If your feature meets these criteria, it's welcome.

If not, it's not a good fit for Akari.


## Questions?

If anything is unclear, open an issue. We're friendly.

Thanks for contributing.
```

**Enregistre.**

