
# Contributing to Akari

First off, thank you for considering contributing to Akari! It's people like you that make open source such a great community.

We welcome contributions of all kinds: bug reports, feature requests, documentation improvements, and code.

## Our Philosophy

Akari is built on two pillars: **Safety** and **Simplicity**.
- We will **never** add a feature that compromises the sandbox.
- We will **never** add a 20th keyword to the language without a very good reason.
- We believe in being kind and patient with beginners. If someone asks a "basic" question, we answer it with empathy.

## How Can I Contribute?

### 1. Reporting Bugs
- Check the [Issues](https://github.com/HvKOkla/Akari/issues) to see if the bug is already reported.
- If not, open a new issue. Include your OS, Node.js version, and the code snippet that caused the bug.

### 2. Suggesting Features
- Open an issue with the `enhancement` tag.
- Explain **why** the feature is useful (e.g., "This would help game developers do X").

### 3. Your First Code Contribution
Not sure where to start? Look for issues tagged with `good first issue`. These are specifically designed for newcomers.

### 4. Improving Documentation
Typos, unclear explanations, or missing examples are always welcome. Just open a PR with the changes.

## Local Development Setup

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/Akari.git
   cd Akari
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the engine:**
   ```bash
   npm run build
   ```

4. **Run the tests:**
   ```bash
   npm test
   ```
   *(All 32 tests must pass before you submit a PR).*

## 📐 Architecture Rules (Important)

If you want to contribute to the **core engine** (`src/compiler/`), please respect these rules:
- **No dependencies:** The engine must remain zero-dependency.
- **TypeScript strict:** All code must be strictly typed. No `any` unless absolutely necessary.
- **AST modifications:** If you add a new feature, you must update the `ast.ts`, `parser.ts`, `checker.ts`, and `transpiler.ts`.
- **Security first:** If you add a new built-in function, add it to the `BUILTINS` list in `checker.ts` and the sandbox in `worker.ts`.

## 🤝 Pull Request Process

1. Create a new branch: `git checkout -b feature/my-new-feature`
2. Commit your changes: `git commit -m "feat: add my new feature"`
3. Push to the branch: `git push origin feature/my-new-feature`
4. Open a Pull Request against the `main` branch.

**What happens next?**
- I (HvK Okla) will review your code.
- I might ask for changes. Don't take it personally! We're a team.
- Once approved, your code will be merged and you'll be credited.

## 💬 Need Help?

If you're stuck, don't hesitate to ask in the Issues or on our Discord. There are no "stupid" questions here.

Thank you for helping make Akari better! 🥂
```

---

### 🎯 Pourquoi c'est un bon fichier de contribution ?

1. **Il est rassurant** : Il dit explicitement qu'il n'y a pas de "questions bêtes". Ça désamorce les peurs.
2. **Il explique les règles d'architecture** : Si quelqu'un veut ajouter une feature, il sait qu'il doit toucher à 4 fichiers (AST, Parser, Checker, Transpiler). Ça t'évite de recevoir des PR incomplètes.
3. **Il est actionnable** : Il donne les commandes exactes (`git clone`, `npm test`). Un débutant peut le suivre pas à pas.

---

### 🚀 La touche finale : Le lien dans le README

Maintenant que tu as ces 3 fichiers (`SECURITY.md`, `CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`), il faut les mettre en valeur. 

Ouvre ton **`README.md`** et ajoute cette section **tout en bas** (juste avant la section License) :

```markdown
## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) and our [Code of Conduct](CODE_OF_CONDUCT.md).

To report a security vulnerability, please read our [Security Policy](SECURITY.md).
```