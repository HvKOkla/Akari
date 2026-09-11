// src/bundler.browser.js
/*
 * Akari Programming Language Engine — Browser Bundler
 * Copyright (c) 2026 [HvK Okla]
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

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
const MAX_IMPORT_DEPTH = 50;                // profondeur max d'imbrication
const MAX_MODULES      = 500;               // nombre max de modules

// ---------------------------------------------------------------------
// Dépendances (injectées par le playground)
// ---------------------------------------------------------------------

let _tokenize = null;
let _parse = null;
let _transpile = null;

/**
 * Le playground doit appeler ça AVANT bundleAndTranspile.
 *
 *   setupBrowserBundler({
 *     tokenize:  window.tokenize,
 *     parse:     window.parse,
 *     transpile: window.transpile,
 *   });
 */
function setupBrowserBundler(deps) {
    if (!deps || typeof deps !== 'object') {
        throw new BundlerError('setupBrowserBundler attend un objet {tokenize, parse, transpile}.');
    }
    if (typeof deps.tokenize !== 'function')  throw new BundlerError('tokenize manquant.');
    if (typeof deps.parse !== 'function')     throw new BundlerError('parse manquant.');
    if (typeof deps.transpile !== 'function') throw new BundlerError('transpile manquant.');

    _tokenize  = deps.tokenize;
    _parse     = deps.parse;
    _transpile = deps.transpile;
}

function requireSetup() {
    if (!_tokenize || !_parse || !_transpile) {
        throw new BundlerError(
            'Le bundler navigateur n\'est pas initialisé.',
            '',
            'Appelez setupBrowserBundler({tokenize, parse, transpile}) d\'abord.'
        );
    }
}

// ---------------------------------------------------------------------
// Extraction des imports
// ---------------------------------------------------------------------

/**
 * Extrait la liste des imports d'un fichier Akari.
 * Utilise le lexer pour éviter de matcher dans les strings/commentaires.
 */
function extractImports(source, filePath) {
    let tokens;
    try {
        tokens = _tokenize(source);
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

        i++; // saute le token string consommé
    }

    return imports;
}

/**
 * Retire les lignes d'import du source Akari.
 */
function stripImports(source, imports) {
    if (imports.length === 0) return source;

    const lines = source.split('\n');
    const lineHasImport = new Set(imports.map(imp => imp.line));
    return lines
        .filter((_, idx) => !lineHasImport.has(idx + 1))
        .join('\n');
}

// ---------------------------------------------------------------------
// Résolution de module (URL-based)
// ---------------------------------------------------------------------

/**
 * Construit la liste des URLs candidates pour un import.
 *
 * @param {string} importName  ex: "maths/base" ou "./local"
 * @param {string} baseURL     URL du fichier qui importe (pour résoudre les relatifs)
 * @returns {string[]} URLs candidates
 */
function buildCandidateURLs(importName, baseURL) {
    const candidates = [];

    // Chemin explicite (./, ../, ou absolu http(s)://)
    if (importName.startsWith('./') ||
        importName.startsWith('../') ||
        importName.startsWith('/') ||
        /^https?:\/\//i.test(importName)) {

        const base = new URL(importName, baseURL);
        candidates.push(base.href);
        candidates.push(new URL(importName + '.akari', baseURL).href);
        candidates.push(new URL(importName + '/index.akari', baseURL).href);

    } else {
        // Relatif au fichier courant
        candidates.push(new URL(importName + '.akari', baseURL).href);
        candidates.push(new URL(importName + '/index.akari', baseURL).href);

        // Dans std_akari/ (à côté de src/)
        // On remonte depuis baseURL jusqu'à la racine projet
        const projectRoot = new URL('../', new URL('../', baseURL).href).href;
        candidates.push(new URL('std_akari/' + importName + '.akari', projectRoot).href);
        candidates.push(new URL('std_akari/' + importName + '/index.akari', projectRoot).href);

        // std_akari/nom/nom.akari (pattern historique)
        const last = importName.split('/').pop();
        candidates.push(new URL('std_akari/' + importName + '/' + last + '.akari', projectRoot).href);
    }

    return candidates;
}

/**
 * Essaie de charger une URL en .akari.
 * Retourne {url, source} ou null si aucune URL ne marche.
 */
async function resolveAndFetch(importName, baseURL) {
    const candidates = buildCandidateURLs(importName, baseURL);

    for (const url of candidates) {
        try {
            const res = await fetch(url);
            if (res.ok) {
                const source = await res.text();
                return { url, source };
            }
        } catch (_) {
            // Réseau ou CORS : on essaie le suivant
        }
    }

    throw new BundlerError(
        `Module '${importName}' introuvable.`,
        baseURL,
        `URLs testées :\n    ${candidates.join('\n    ')}`
    );
}

// ---------------------------------------------------------------------
// Chargement récursif
// ---------------------------------------------------------------------

/**
 * Charge récursivement un fichier Akari et ses dépendances.
 * Version async utilisant fetch().
 */
async function loadModuleGraph(entryURL) {
    const cache      = new Map();     // url → { url, source, strippedSource, imports }
    const visiting   = new Set();     // détection de cycles
    const loaded     = [];            // ordre topologique
    const loadedSet  = new Set();     // anti-doublon
    const importChain = [];           // pile pour messages

    async function load(url, depth) {
        const absURL = new URL(url).href; // normalise

        // Cache
        if (cache.has(absURL)) {
            return cache.get(absURL);
        }

        // Profondeur
        if (depth > MAX_IMPORT_DEPTH) {
            throw new BundlerError(
                `Profondeur d'import dépassée (${MAX_IMPORT_DEPTH}).`,
                absURL,
                `Chaîne : ${importChain.join(' → ')}`
            );
        }

        // Nombre de modules
        if (loaded.length >= MAX_MODULES) {
            throw new BundlerError(
                `Trop de modules dans le bundle (max ${MAX_MODULES}).`,
                absURL
            );
        }

        // Cycle
        if (visiting.has(absURL)) {
            const cycleStart = importChain.indexOf(absURL);
            const cycle = importChain.slice(cycleStart).concat(absURL);
            throw new BundlerError(
                `Dépendance circulaire détectée.`,
                absURL,
                `Cycle : ${cycle.join(' → ')}`
            );
        }

        // Lecture via fetch
        let res;
        try {
            res = await fetch(absURL);
        } catch (err) {
            throw new BundlerError(
                `Réseau : impossible de charger le fichier.`,
                absURL,
                err.message
            );
        }

        if (!res.ok) {
            throw new BundlerError(
                `Fichier inaccessible (HTTP ${res.status}).`,
                absURL,
                `Vérifiez le chemin et que le serveur sert bien les .akari.`
            );
        }

        const source = await res.text();

        if (source.length > MAX_FILE_SIZE) {
            throw new BundlerError(
                `Fichier trop gros (${source.length} octets, max ${MAX_FILE_SIZE}).`,
                absURL
            );
        }

        // Extraction des imports
        const imports = extractImports(source, absURL);
        const strippedSource = stripImports(source, imports);

        const record = {
            url: absURL,
            source,
            strippedSource,
            imports
        };
        cache.set(absURL, record);

        // Marque en cours
        visiting.add(absURL);
        importChain.push(absURL);

        // Charge les dépendances AVANT le parent (ordre topologique)
        for (const imp of imports) {
            const { url: depURL } = await resolveAndFetch(imp.path, absURL);
            await load(depURL, depth + 1);
        }

        // Retire de la pile
        importChain.pop();
        visiting.delete(absURL);

        // Ajoute au graphe
        if (!loadedSet.has(absURL)) {
            loadedSet.add(absURL);
            loaded.push(record);
        }

        return record;
    }

    await load(entryURL, 0);

    return { modules: loaded, cache };
}

// ---------------------------------------------------------------------
// Fusion
// ---------------------------------------------------------------------

function mergeModules(modules) {
    const parts = [];
    for (const mod of modules) {
        const name = mod.url.split('/').pop();
        parts.push(`# ===== Module : ${name} =====`);
        parts.push(mod.strippedSource);
        parts.push('');
    }
    return parts.join('\n');
}

// ---------------------------------------------------------------------
// Point d'entrée principal (async)
// ---------------------------------------------------------------------

/**
 * Bundle + transpile, version navigateur.
 *
 * @param {string} entryURL        URL du fichier .akari d'entrée
 * @param {object} [options]
 * @param {boolean} [options.verbose]
 * @param {function} [options.onError]
 * @returns {Promise<string>}      Code JS généré
 */
async function bundleAndTranspile(entryURL, options = {}) {
    requireSetup();

    const { verbose = false, onError = null } = options;

    if (!entryURL || typeof entryURL !== 'string') {
        throw new BundlerError(
            `URL d'entrée invalide.`,
            '',
            `Usage : await bundleAndTranspile('main.akari')`
        );
    }

    try {
        if (verbose) console.log(`[Bundler] Entrée : ${entryURL}`);

        // 1. Chargement du graphe
        const { modules } = await loadModuleGraph(entryURL);

        if (verbose) {
            console.log(`[Bundler] ${modules.length} module(s) chargé(s) :`);
            for (const m of modules) console.log(`  → ${m.url}`);
        }

        // 2. Fusion
        const fullSource = mergeModules(modules);

        // 3. Parsing
        let ast;
        try {
            ast = _parse(fullSource);
        } catch (err) {
            throw new BundlerError(
                `Erreur de parsing : ${err.msg || err.message}`,
                entryURL,
                err.suggestion || `Ligne ${err.line}, colonne ${err.column}`
            );
        }

        // 4. Transpilation
        let jsCode;
        try {
            jsCode = _transpile(ast);
        } catch (err) {
            throw new BundlerError(
                `Erreur de transpilation : ${err.message}`,
                entryURL,
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
// Export
// ---------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        setupBrowserBundler,
        bundleAndTranspile,
        extractImports,
        buildCandidateURLs,
        BundlerError
    };
} else {
    window.setupBrowserBundler = setupBrowserBundler;
    window.bundleAndTranspile   = bundleAndTranspile;
    window.BundlerError         = BundlerError;
}