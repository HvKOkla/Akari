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

class CompileError extends Error {
    constructor(msg, line, column, tip = '') {
        super(msg);
        this.name = 'CompileError';
        this.line = line || '?';
        this.column = column || '?';
        this.tip = tip;
    }

    toString() {
        let out = `❌ [CompileError] ${this.message}\n`;
        out += `  --> Ligne ${this.line}, Colonne ${this.column}`;
        if (this.tip) out += `\n  = aide: ${this.tip}`;
        return out;
    }
}

const MAX_ALLOCATION_BYTES = 50 * 1024 * 1024;
const MAX_LOOP_ITERATIONS  = 10_000_000;

const AKARI_TYPES = Object.freeze({
    NUMBER:  'number',
    STRING:  'string',
    BOOLEAN: 'boolean',
    NOTHING: 'nothing',
    BUFFER:  'buffer',
    OPTION:  'option',
    LIST:    'list',
    TABLE:   'table',
    UNKNOWN: 'unknown'
});

// ---------------------------------------------------------------------
// Safety Checker
// ---------------------------------------------------------------------

function runSafetyChecker(ast) {
    const globalScope = new Map();
    const functions = new Map();

    // ---------------------------------------------------------------
    // BUILTINS du langage Akari
    //
    // Note : les primitives runtime (__rt_*) ne sont PAS listées ici.
    // Elles sont ignorées automatiquement dans checkNode (voir plus bas).
    // Elles sont définies dans le runtime (primitives.js) et utilisées
    // uniquement par la std (base.akari, vecteurs.akari, etc.).
    // ---------------------------------------------------------------
    const BUILTINS = Object.freeze({
        // --- IO ---
        say: -1, ask: -1,

        // --- Conversion / introspection ---
        toNumber: 1, toText: 1, kind: 1,

        // --- Buffers typés ---
        int8: 1, uint8: 1, uint8Clamped: 1, int16: 1, uint16: 1,
        int32: 1, uint32: 1, float32: 1, float64: 1,
        bigInt64: 1, bigUint64: 1, arrayBuffer: 1, dataView: 1,

        // --- Conversions de buffers ---
        toFloat64: 1, toFloat32: 1, toInt32: 1, toUint8: 1,
        toUint8Clamped: 1, toInt16: 1, toUint16: 1,

        // --- Operations sur buffers ---
        fill: 2, copy: 1, slice: 3, isBuffer: 1, bufferSize: 1,

        // --- Options ---
        Some: 1, None: 0, isSome: 1, isNone: 1,

        // --- WebGPU ---
        gpuInit: 0, gpuBuffer: 1, gpuSync: 2
    });

    // ---------------------------------------------------------------
    // Inferer le type d'un noeud AST
    // ---------------------------------------------------------------
    function inferType(node, scope) {
        if (!node) return AKARI_TYPES.UNKNOWN;
        switch (node.type) {
            case 'number':   return AKARI_TYPES.NUMBER;
            case 'string':   return AKARI_TYPES.STRING;
            case 'boolean':  return AKARI_TYPES.BOOLEAN;
            case 'nothing':  return AKARI_TYPES.NOTHING;
            case 'list':     return AKARI_TYPES.LIST;
            case 'table':    return AKARI_TYPES.TABLE;
            case 'table_access': return AKARI_TYPES.UNKNOWN;
            case 'variable': {
                const info = scope.get(node.name);
                return info ? info.type : AKARI_TYPES.UNKNOWN;
            }
            case 'function_call': {
                // --- Fonctions retournant un BUFFER ---
                const bufferFns = new Set([
                    'int8','uint8','uint8Clamped','int16','uint16',
                    'int32','uint32','float32','float64',
                    'bigInt64','bigUint64','arrayBuffer',
                    'toFloat64','toFloat32','toInt32','toUint8',
                    'toUint8Clamped','toInt16','toUint16','copy','slice'
                ]);
                if (bufferFns.has(node.name)) return AKARI_TYPES.BUFFER;
                if (node.name === 'dataView') return AKARI_TYPES.BUFFER;

                if (node.name === 'Some' || node.name === 'None') return AKARI_TYPES.OPTION;
                if (node.name === 'toNumber') return AKARI_TYPES.NUMBER;
                if (node.name === 'toText')   return AKARI_TYPES.STRING;
                if (node.name === 'kind')     return AKARI_TYPES.STRING;
                if (node.name === 'isBuffer') return AKARI_TYPES.BOOLEAN;
                if (node.name === 'isSome' || node.name === 'isNone') return AKARI_TYPES.BOOLEAN;
                if (node.name === 'bufferSize') return AKARI_TYPES.NUMBER;

                // Les primitives runtime sont considérées comme retournant NUMBER
                // (par défaut). Si une primitive retourne un autre type, elle
                // sera traitée comme UNKNOWN et cela reste acceptable.
                if (node.name.startsWith('__rt_')) {
                    return AKARI_TYPES.UNKNOWN;
                }

                return AKARI_TYPES.UNKNOWN;
            }
            case 'index_access': {
                const targetType = inferType(node.target, scope);
                if (targetType === AKARI_TYPES.BUFFER) return AKARI_TYPES.NUMBER;
                if (targetType === AKARI_TYPES.LIST)   return AKARI_TYPES.UNKNOWN;
                return AKARI_TYPES.UNKNOWN;
            }
            case 'binary':  return AKARI_TYPES.UNKNOWN;
            case 'unary':   return AKARI_TYPES.UNKNOWN;
            default: return AKARI_TYPES.UNKNOWN;
        }
    }

    function assertAssignable(varName, expected, actual, line, column) {
        if (expected === AKARI_TYPES.UNKNOWN || actual === AKARI_TYPES.UNKNOWN) return;
        if (expected === actual) return;
        throw new CompileError(
            `Type incohérent pour '${varName}' : attendu '${expected}', reçu '${actual}'.`,
            line, column,
            `Les variables Akari ne changent pas de type après déclaration.`
        );
    }

    // ---------------------------------------------------------------
    // Collecte des fonctions definies par l'utilisateur
    // ---------------------------------------------------------------
    for (const node of ast) {
        if (node.type === 'function_def') {
            if (functions.has(node.name) || BUILTINS[node.name] !== undefined) {
                throw new CompileError(
                    `Redéfinition de la fonction '${node.name}'.`,
                    node.line, node.column,
                    `Renommez '${node.name}' pour éviter une collision.`
                );
            }
            functions.set(node.name, node.params.length);
        }
    }

    // ---------------------------------------------------------------
    // Verification recursive
    // ---------------------------------------------------------------
    function checkNode(node, scope, inLoop = false, inFunction = false) {
        if (!node) return;

        switch (node.type) {
            case 'number':
            case 'string':
            case 'boolean':
            case 'nothing':
                break;

            case 'list': {
                node.elements.forEach(e => checkNode(e, scope, inLoop, inFunction));
                break;
            }

            case 'table': {
                node.entries.forEach(e => checkNode(e.value, scope, inLoop, inFunction));
                break;
            }

            case 'table_access': {
                checkNode(node.target, scope, inLoop, inFunction);
                break;
            }

            case 'table_assignment': {
                checkNode(node.target, scope, inLoop, inFunction);
                checkNode(node.value, scope, inLoop, inFunction);
                break;
            }

            case 'assignment': {
                checkNode(node.value, scope, inLoop, inFunction);
                const valType = inferType(node.value, scope);
                const isDecl = node.isDeclaration === true;

                if (isDecl) {
                    if (scope.has(node.name)) {
                        throw new CompileError(
                            `Variable '${node.name}' déjà déclarée dans ce scope.`,
                            node.line, node.column,
                            `Renommez ou réassignez sans 'let'/'mut'.`
                        );
                    }
                    const isMut = node.isMut === true;
                    scope.set(node.name, { type: valType, isConstant: !isMut });
                    break;
                }

                if (!scope.has(node.name)) {
                    throw new CompileError(
                        `Variable '${node.name}' non déclarée.`,
                        node.line, node.column,
                        `Déclarez avec 'let ${node.name} = ...' ou 'mut ${node.name} = ...' d'abord.`
                    );
                }
                const info = scope.get(node.name);
                if (info.isConstant) {
                    throw new CompileError(
                        `'${node.name}' est immuable.`,
                        node.line, node.column,
                        `Déclarez 'mut ${node.name} = ...' pour autoriser la modification.`
                    );
                }
                assertAssignable(node.name, info.type, valType, node.line, node.column);
                break;
            }

            case 'variable': {
                if (!scope.has(node.name)) {
                    throw new CompileError(
                        `Variable '${node.name}' introuvable.`,
                        node.line, node.column,
                        `Déclarez '${node.name}' avant de l'utiliser.`
                    );
                }
                break;
            }

            case 'function_call': {
                node.args.forEach(a => checkNode(a, scope, inLoop, inFunction));

                // Les primitives runtime (__rt_*) sont toujours acceptées.
                // Elles sont définies dans le runtime (primitives.js).
                if (node.name.startsWith('__rt_')) {
                    break;
                }

                const expected = BUILTINS[node.name] !== undefined
                    ? BUILTINS[node.name]
                    : functions.get(node.name);

                if (expected === undefined) {
                    throw new CompileError(
                        `Fonction '${node.name}' non définie.`,
                        node.line, node.column,
                        `Définissez '${node.name}' ou importez-la.`
                    );
                }

                if (expected !== -1 && node.args.length !== expected) {
                    throw new CompileError(
                        `'${node.name}' attend ${expected} argument(s), ${node.args.length} reçu(s).`,
                        node.line, node.column,
                        `Corrigez l'appel.`
                    );
                }
                break;
            }

            case 'function_def': {
                const localScope = new Map(scope);
                const seen = new Set();

                for (const param of node.params) {
                    const pname = typeof param === 'string' ? param : param.name;
                    if (seen.has(pname)) {
                        throw new CompileError(
                            `Paramètre '${pname}' dupliqué dans '${node.name}'.`,
                            node.line, node.column,
                            `Renommez un des paramètres.`
                        );
                    }
                    seen.add(pname);
                    localScope.set(pname, { type: AKARI_TYPES.UNKNOWN, isConstant: false });
                }

                node.body.forEach(s => checkNode(s, localScope, false, true));
                break;
            }

            case 'binary': {
                checkNode(node.left, scope, inLoop, inFunction);
                checkNode(node.right, scope, inLoop, inFunction);
                break;
            }

            case 'unary': {
                checkNode(node.argument, scope, inLoop, inFunction);
                break;
            }

            case 'index_access': {
                checkNode(node.target, scope, inLoop, inFunction);
                checkNode(node.index, scope, inLoop, inFunction);

                const targetType = inferType(node.target, scope);
                const indexType  = inferType(node.index, scope);

                if (indexType !== AKARI_TYPES.UNKNOWN && indexType !== AKARI_TYPES.NUMBER) {
                    throw new CompileError(
                        `L'index doit être un nombre, reçu '${indexType}'.`,
                        node.index.line, node.index.column,
                        `Utilisez une valeur numérique : a[0], a[i+1], etc.`
                    );
                }

                if (targetType !== AKARI_TYPES.UNKNOWN &&
                    targetType !== AKARI_TYPES.BUFFER &&
                    targetType !== AKARI_TYPES.STRING &&
                    targetType !== AKARI_TYPES.LIST) {
                    throw new CompileError(
                        `Impossible d'indexer un '${targetType}'.`,
                        node.target.line, node.target.column,
                        `Seuls les buffers, listes et textes sont indexables.`
                    );
                }
                break;
            }

            case 'index_assignment': {
                checkNode(node.target, scope, inLoop, inFunction);
                checkNode(node.value, scope, inLoop, inFunction);

                let root = node.target;
                while (root && root.type === 'index_access') {
                    root = root.target;
                }
                const rootType = inferType(root, scope);

                if (rootType !== AKARI_TYPES.UNKNOWN &&
                    rootType !== AKARI_TYPES.BUFFER &&
                    rootType !== AKARI_TYPES.LIST) {
                    throw new CompileError(
                        `Impossible d'écrire dans un '${rootType}'.`,
                        node.target.line, node.target.column,
                        `Seuls les buffers et listes sont modifiables par index.`
                    );
                }

                if (root && root.type === 'variable') {
                    const info = scope.get(root.name);
                    if (info && info.isConstant) {
                        throw new CompileError(
                            `Impossible de modifier '${root.name}' : immuable.`,
                            node.line, node.column,
                            `Déclarez 'mut ${root.name} = ...' pour autoriser la modification.`
                        );
                    }
                }
                break;
            }

            case 'if': {
                checkNode(node.condition, scope, inLoop, inFunction);

                const thenScope = new Map(scope);
                node.body.forEach(s => checkNode(s, thenScope, inLoop, inFunction));

                if (node.else && node.else.length > 0) {
                    const elseScope = new Map(scope);
                    node.else.forEach(s => checkNode(s, elseScope, inLoop, inFunction));
                }
                break;
            }

            case 'for': {
                checkNode(node.start, scope, inLoop, inFunction);
                checkNode(node.end, scope, inLoop, inFunction);

                const loopScope = new Map(scope);
                loopScope.set(node.varName, { type: AKARI_TYPES.NUMBER, isConstant: true });
                node.body.forEach(s => checkNode(s, loopScope, true, inFunction));
                break;
            }

            case 'for_in': {
                checkNode(node.collection, scope, inLoop, inFunction);

                const loopScope = new Map(scope);
                loopScope.set(node.varName, { type: AKARI_TYPES.UNKNOWN, isConstant: true });
                node.body.forEach(s => checkNode(s, loopScope, true, inFunction));
                break;
            }

            case 'while': {
                checkNode(node.condition, scope, inLoop, inFunction);
                node.body.forEach(s => checkNode(s, new Map(scope), true, inFunction));
                break;
            }

            case 'try': {
                const tryScope = new Map(scope);
                node.body.forEach(s => checkNode(s, tryScope, inLoop, inFunction));

                const catchScope = new Map(scope);
                catchScope.set(node.errorVar, { type: AKARI_TYPES.STRING, isConstant: true });
                node.catchBody.forEach(s => checkNode(s, catchScope, inLoop, inFunction));
                break;
            }

            case 'break':
            case 'continue': {
                if (!inLoop) {
                    throw new CompileError(
                        `'${node.type === 'break' ? 'stop' : 'skip'}' hors boucle.`,
                        node.line, node.column,
                        `Placez cette instruction dans un 'for' ou un 'while'.`
                    );
                }
                break;
            }

            case 'return': {
                if (!inFunction) {
                    throw new CompileError(
                        `'return' hors fonction.`,
                        node.line, node.column,
                        `Placez 'return' dans une fonction 'def'.`
                    );
                }
                if (node.value) checkNode(node.value, scope, inLoop, inFunction);
                break;
            }

            case 'import': {
                throw new CompileError(
                    `'import' non supporté par le transpileur.`,
                    node.line, node.column,
                    `Utilisez le bundler pour résoudre les imports.`
                );
            }

            default:
                throw new CompileError(
                    `Nœud AST non supporté : '${node.type}'.`,
                    node.line || '?', node.column || '?',
                    `Bug interne du transpileur.`
                );
        }
    }

    for (const node of ast) {
        checkNode(node, globalScope, false, false);
    }
}

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        runSafetyChecker,
        CompileError,
        AKARI_TYPES,
        MAX_ALLOCATION_BYTES,
        MAX_LOOP_ITERATIONS
    };
} else {
    window.runSafetyChecker = runSafetyChecker;
    window.CompileError = CompileError;
    window.AKARI_TYPES = AKARI_TYPES;
}