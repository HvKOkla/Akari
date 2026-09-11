// src/bundler.js
/*
 * Akari Programming Language Engine
 * Copyright (c) 2026 [HvK Okla]
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

const fs = require('fs');
const path = require('path');
const { tokenize } = require('./lexer.js');
const { parse } = require('./Parser.js');
const { transpile } = require('./transpiler.js');

// ---------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------

class BundlerError extends Error {
    constructor(msg, file = '', tip = '') {
        super(msg);
        this.name = 'BundlerError';
        this.file = file;
        this.tip = tip;
    }

    toString() {
        let out = `❌ [Bundler] ${this.message}`;
        if (this.file) out += `\n  → Fichier : ${this.file}`;
        if (this.tip)  out += `\n  = aide   : ${this.tip}`;
        return out;
    }
}

// ---------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------

const MAX_FILE_SIZE   = 5 * 1024 * 1024;    // 5 MB par fichier
const MAX_IMPORT_DEPTH = 50;                // profondeur max
const MAX_MODULES      = 500;               // modules max par bundle

// ---------------------------------------------------------------------
// Extraction des imports
// ---------------------------------------------------------------------

function extractImports(source, filePath) {
    let tokens;
    try {
        tokens = tokenize(source);
    } catch (err) {
        throw new BundlerError(
            `Erreur de tokenisation : ${err.msg || err.message}`,
            filePath,
            err.suggestion || ''
        );
    }

    const imports = [];

    for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok.type !== 'import') continue;

        const pathTok = tokens[i + 1];

        if (!pathTok || pathTok.type !== 'string') {
            throw new BundlerError(
                `'import' doit être suivi d'une chaîne.`,
                filePath,
                `Écrivez : import "nom_module"`
            );
        }

        imports.push({
            path: pathTok.value,
            line: tok.line,
            column: tok.col
        });

        i++;
    }

    return imports;
}

function stripImports(source, imports) {
    if (imports.length === 0) return source;

    const lines = source.split('\n');
    const lineHasImport = new Set(imports.map(imp => imp.line));
    return lines
        .filter((_, idx) => !lineHasImport.has(idx + 1))
        .join('\n');
}

// ---------------------------------------------------------------------
// Résolution de module (fichiers locaux)
// ---------------------------------------------------------------------

function resolveAkariModule(importName, currentFileDir) {
    if (typeof importName !== 'string' || importName.length === 0) {
        throw new BundlerError(
            `Nom de module invalide : '${importName}'`,
            currentFileDir,
            'Le nom doit être une chaîne non vide.'
        );
    }

    const rootDir = path.resolve(__dirname, '..');
    const candidates = [];

    if (importName.startsWith('./') ||
        importName.startsWith('../') ||
        path.isAbsolute(importName)) {
        const base = path.isAbsolute(importName)
            ? importName
            : path.join(currentFileDir, importName);
        candidates.push(base + '.akari');
        candidates.push(path.join(base, 'index.akari'));
    } else {
        candidates.push(path.join(currentFileDir, importName + '.akari'));
        candidates.push(path.join(currentFileDir, importName, 'index.akari'));

        candidates.push(path.join(rootDir, 'std_akari', importName + '.akari'));
        candidates.push(path.join(rootDir, 'std_akari', importName, 'index.akari'));

        const last = path.basename(importName);
        candidates.push(path.join(rootDir, 'std_akari', importName, last + '.akari'));
    }

    for (const p of candidates) {
        try {
            const stat = fs.statSync(p);
            if (stat.isFile()) return p;
        } catch (_) {
            // essaie le suivant
        }
    }

    throw new BundlerError(
        `Module '${importName}' introuvable.`,
        currentFileDir,
        `Chemins testés :\n    ${candidates.join('\n    ')}`
    );
}

// ---------------------------------------------------------------------
// Chargement récursif
// ---------------------------------------------------------------------

function loadModuleGraph(entryFilePath) {
    const cache       = new Map();
    const visiting    = new Set();
    const loaded      = [];
    const loadedSet   = new Set();
    const importChain = [];

    function load(filePath, depth) {
        const abs = path.resolve(filePath);

        if (cache.has(abs)) {
            return cache.get(abs);
        }

        if (depth > MAX_IMPORT_DEPTH) {
            throw new BundlerError(
                `Profondeur d'import dépassée (${MAX_IMPORT_DEPTH}).`,
                abs,
                `Chaîne : ${importChain.join(' → ')}`
            );
        }

        if (loaded.length >= MAX_MODULES) {
            throw new BundlerError(
                `Trop de modules dans le bundle (max ${MAX_MODULES}).`,
                abs
            );
        }

        if (visiting.has(abs)) {
            const cycleStart = importChain.indexOf(abs);
            const cycle = importChain.slice(cycleStart).concat(abs);
            throw new BundlerError(
                `Dépendance circulaire détectée.`,
                abs,
                `Cycle : ${cycle.join(' → ')}`
            );
        }

        let stat;
        try {
            stat = fs.statSync(abs);
        } catch (err) {
            throw new BundlerError(
                `Fichier inaccessible : ${abs}`,
                abs,
                err.message
            );
        }

        if (!stat.isFile()) {
            throw new BundlerError(
                `Ce n'est pas un fichier : ${abs}`,
                abs
            );
        }

        if (stat.size > MAX_FILE_SIZE) {
            throw new BundlerError(
                `Fichier trop gros (${stat.size} octets, max ${MAX_FILE_SIZE}).`,
                abs
            );
        }

        let source;
        try {
            source = fs.readFileSync(abs, 'utf-8');
        } catch (err) {
            throw new BundlerError(
                `Impossible de lire le fichier.`,
                abs,
                err.message
            );
        }

        const imports = extractImports(source, abs);
        const strippedSource = stripImports(source, imports);

        const record = {
            path: abs,
            source,
            strippedSource,
            imports
        };
        cache.set(abs, record);

        visiting.add(abs);
        importChain.push(abs);

        for (const imp of imports) {
            const depPath = resolveAkariModule(imp.path, path.dirname(abs));
            load(depPath, depth + 1);
        }

        importChain.pop();
        visiting.delete(abs);

        if (!loadedSet.has(abs)) {
            loadedSet.add(abs);
            loaded.push(record);
        }

        return record;
    }

    load(entryFilePath, 0);

    return { modules: loaded, cache };
}

// ---------------------------------------------------------------------
// Fusion
// ---------------------------------------------------------------------

function mergeModules(modules) {
    const parts = [];
    for (const mod of modules) {
        parts.push(`# ===== Module : ${path.basename(mod.path)} =====`);
        parts.push(mod.strippedSource);
        parts.push('');
    }
    return parts.join('\n');
}

// ---------------------------------------------------------------------
// Point d'entrée principal
// ---------------------------------------------------------------------

function bundleAndTranspile(entryFilePath, options = {}) {
    const { verbose = false, onError = null } = options;

    if (!entryFilePath || typeof entryFilePath !== 'string') {
        throw new BundlerError(
            `Chemin d'entrée invalide.`,
            '',
            `Usage : bundleAndTranspile('chemin/vers/fichier.akari')`
        );
    }

    if (!fs.existsSync(entryFilePath)) {
        throw new BundlerError(
            `Fichier d'entrée introuvable.`,
            entryFilePath,
            `Vérifiez le chemin.`
        );
    }

    try {
        if (verbose) console.error(`[Bundler] Entrée : ${entryFilePath}`);

        const { modules } = loadModuleGraph(entryFilePath);

        if (verbose) {
            console.error(`[Bundler] ${modules.length} module(s) chargé(s) :`);
            for (const m of modules) {
                console.error(`  → ${path.relative(process.cwd(), m.path)}`);
            }
        }

        const fullSource = mergeModules(modules);

        let ast;
        try {
            ast = parse(fullSource);
        } catch (err) {
            throw new BundlerError(
                `Erreur de parsing : ${err.msg || err.message}`,
                entryFilePath,
                err.suggestion || `Ligne ${err.line}, colonne ${err.column}`
            );
        }

        let jsCode;
        try {
            jsCode = transpile(ast);
        } catch (err) {
            throw new BundlerError(
                `Erreur de transpilation : ${err.message}`,
                entryFilePath,
                err.tip || ''
            );
        }

        return jsCode;

    } catch (err) {
        if (onError) {
            onError(err);
            return null;
        }
        throw err;
    }
}

// ---------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------

if (require.main === module) {
    const args = process.argv.slice(2);
    const verbose = args.includes('--verbose') || args.includes('-v');
    const filtered = args.filter(a => a !== '--verbose' && a !== '-v');

    if (filtered.length === 0) {
        console.error('Usage : node src/bundler.js <fichier.akari> [--verbose]');
        process.exit(1);
    }

    try {
        const jsCode = bundleAndTranspile(filtered[0], { verbose });
        process.stdout.write(jsCode);
    } catch (err) {
        console.error(err.toString ? err.toString() : (err.message || err));
        process.exit(1);
    }
}

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------

module.exports = {
    bundleAndTranspile,
    extractImports,
    resolveAkariModule,
    BundlerError
};