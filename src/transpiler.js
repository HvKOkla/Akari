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

if (typeof require !== 'undefined') {
    var { parse } = require('./Parser.js');
}

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
    UNKNOWN: 'unknown'
});

// ---------------------------------------------------------------------
// Safety Checker
// ---------------------------------------------------------------------

function runSafetyChecker(ast) {
    const globalScope = new Map();
    const functions = new Map();

    const BUILTINS = Object.freeze({
        say: -1, ask: -1,
        toNumber: 1, toText: 1, kind: 1,
        int8: 1, uint8: 1, uint8Clamped: 1, int16: 1, uint16: 1,
        int32: 1, uint32: 1, float32: 1, float64: 1,
        bigInt64: 1, bigUint64: 1, arrayBuffer: 1, dataView: 1,
        toFloat64: 1, toFloat32: 1, toInt32: 1, toUint8: 1,
        toUint8Clamped: 1, toInt16: 1, toUint16: 1,
        fill: 2, copy: 1, slice: 3, isBuffer: 1, bufferSize: 1,
        Some: 1, None: 0, isSome: 1, isNone: 1,
        gpuInit: 0, gpuBuffer: 1, gpuSync: 2
    });

    function inferType(node, scope) {
        if (!node) return AKARI_TYPES.UNKNOWN;
        switch (node.type) {
            case 'number':   return AKARI_TYPES.NUMBER;
            case 'string':   return AKARI_TYPES.STRING;
            case 'boolean':  return AKARI_TYPES.BOOLEAN;
            case 'nothing':  return AKARI_TYPES.NOTHING;
            case 'variable': {
                const info = scope.get(node.name);
                return info ? info.type : AKARI_TYPES.UNKNOWN;
            }
            case 'function_call': {
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
                return AKARI_TYPES.UNKNOWN;
            }
            case 'index_access': {
                const targetType = inferType(node.target, scope);
                if (targetType === AKARI_TYPES.BUFFER) return AKARI_TYPES.NUMBER;
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

    function checkNode(node, scope, inLoop = false, inFunction = false) {
        if (!node) return;

        switch (node.type) {
            case 'number':
            case 'string':
            case 'boolean':
            case 'nothing':
                break;

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
                    targetType !== AKARI_TYPES.STRING) {
                    throw new CompileError(
                        `Impossible d'indexer un '${targetType}'.`,
                        node.target.line, node.target.column,
                        `Seuls les buffers et textes sont indexables.`
                    );
                }
                break;
            }

            // =====================================================
            // ✅ FIX : index_assignment infère le type de la RACINE
            // =====================================================
            case 'index_assignment': {
                checkNode(node.target, scope, inLoop, inFunction);
                checkNode(node.value, scope, inLoop, inFunction);

                // On remonte à la variable racine (ex: 'v' dans v[0])
                let root = node.target;
                while (root && root.type === 'index_access') {
                    root = root.target;
                }
                const rootType = inferType(root, scope);

                if (rootType !== AKARI_TYPES.UNKNOWN &&
                    rootType !== AKARI_TYPES.BUFFER) {
                    throw new CompileError(
                        `Impossible d'écrire dans un '${rootType}'.`,
                        node.target.line, node.target.column,
                        `Seuls les buffers sont modifiables par index.`
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
// Runtime préambule
// ---------------------------------------------------------------------

function buildRuntime() {
    return `// =============================================================
// Akari Runtime — Généré automatiquement — NE PAS ÉDITER
// =============================================================

const __AKARI_MAX_ALLOC = ${MAX_ALLOCATION_BYTES};
const __AKARI_MAX_ITER  = ${MAX_LOOP_ITERATIONS};
let __akariAllocated = 0;

function __akariCheckAlloc(size, typeName) {
    if (typeof size !== 'number' || !Number.isFinite(size) || size < 0 || !Number.isInteger(size)) {
        throw new Error(\`[Akari Buffer] Taille invalide pour \${typeName} : \${size}\`);
    }
    if (size > __AKARI_MAX_ALLOC) {
        throw new Error(\`[Akari Buffer] Taille (\${size}) dépasse la limite (\${__AKARI_MAX_ALLOC}).\`);
    }
    __akariAllocated += size * 8;
    if (__akariAllocated > __AKARI_MAX_ALLOC) {
        throw new Error('[Akari Runtime] Mémoire totale allouée dépassée.');
    }
}

function __akariCheckBuffer(buf, fnName) {
    if (!buf || typeof buf !== 'object') {
        throw new Error(\`[Akari Buffer] \${fnName} attend un buffer, reçu \${typeof buf}.\`);
    }
    if (!ArrayBuffer.isView(buf) && !(buf instanceof ArrayBuffer)) {
        throw new Error(\`[Akari Buffer] \${fnName} : objet non-buffer.\`);
    }
}

function __akariCheckLoop(start, end, step) {
    const total = Math.abs((end - start) / (step || 1));
    if (!Number.isFinite(total) || total > __AKARI_MAX_ITER) {
        throw new Error(\`[Akari Loop] Boucle trop longue : \${total} itérations (max \${__AKARI_MAX_ITER}).\`);
    }
}

function __akariIndex(target, idx, source) {
    if (typeof idx !== 'number' || !Number.isInteger(idx)) {
        throw new Error(\`[Akari Index] Index non entier : \${idx}\`);
    }
    const len = (ArrayBuffer.isView(target) || target instanceof ArrayBuffer)
        ? target.length ?? target.byteLength
        : undefined;
    if (len !== undefined) {
        if (idx < 0 || idx >= len) {
            throw new Error(\`[Akari Index] Hors bornes : \${idx} (longueur \${len}) dans \${source}.\`);
        }
    }
    return target[idx];
}

const say = (...args) => console.log(...args.map(a => (a === undefined ? 'nothing' : a)));

const ask = (message) => {
    if (typeof message !== 'undefined') console.log(message);
    if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
        const res = window.prompt(message ?? '');
        return res === null ? '' : res;
    }
    throw new Error("[Akari I/O] ask() nécessite un navigateur.");
};

const toNumber = (val) => Number(val);
const toText   = (val) => String(val);
const kind = (val) => {
    if (val === null || val === undefined) return 'nothing';
    if (typeof val === 'number')  return 'number';
    if (typeof val === 'string')  return 'string';
    if (typeof val === 'boolean') return 'boolean';
    if (ArrayBuffer.isView(val) || val instanceof ArrayBuffer) return 'buffer';
    if (val && val.type === 'Some') return 'option';
    if (val && val.type === 'None') return 'option';
    return 'unknown';
};

const Some   = (value) => ({ type: 'Some', value });
const None   = ()      => ({ type: 'None' });
const isSome = (opt)   => !!(opt && opt.type === 'Some');
const isNone = (opt)   => !!(opt && opt.type === 'None');

const int8         = (n) => (__akariCheckAlloc(n, 'int8'),         new Int8Array(n));
const uint8        = (n) => (__akariCheckAlloc(n, 'uint8'),        new Uint8Array(n));
const uint8Clamped = (n) => (__akariCheckAlloc(n, 'uint8Clamped'), new Uint8ClampedArray(n));
const int16        = (n) => (__akariCheckAlloc(n, 'int16'),        new Int16Array(n));
const uint16       = (n) => (__akariCheckAlloc(n, 'uint16'),       new Uint16Array(n));
const int32        = (n) => (__akariCheckAlloc(n, 'int32'),        new Int32Array(n));
const uint32       = (n) => (__akariCheckAlloc(n, 'uint32'),       new Uint32Array(n));
const float32      = (n) => (__akariCheckAlloc(n, 'float32'),      new Float32Array(n));
const float64      = (n) => (__akariCheckAlloc(n, 'float64'),      new Float64Array(n));
const bigInt64     = (n) => (__akariCheckAlloc(n, 'bigInt64'),     new BigInt64Array(n));
const bigUint64    = (n) => (__akariCheckAlloc(n, 'bigUint64'),    new BigUint64Array(n));

const arrayBuffer = (bytes) => (__akariCheckAlloc(bytes, 'arrayBuffer'), new ArrayBuffer(bytes));
const dataView    = (buf)   => (__akariCheckBuffer(buf, 'dataView'), new DataView(buf));

const toFloat64      = (a) => (__akariCheckBuffer(a, 'toFloat64'),      Float64Array.from(a));
const toFloat32      = (a) => (__akariCheckBuffer(a, 'toFloat32'),      Float32Array.from(a));
const toInt32        = (a) => (__akariCheckBuffer(a, 'toInt32'),        Int32Array.from(a));
const toUint8        = (a) => (__akariCheckBuffer(a, 'toUint8'),        Uint8Array.from(a));
const toUint8Clamped = (a) => (__akariCheckBuffer(a, 'toUint8Clamped'), Uint8ClampedArray.from(a));
const toInt16        = (a) => (__akariCheckBuffer(a, 'toInt16'),        Int16Array.from(a));
const toUint16       = (a) => (__akariCheckBuffer(a, 'toUint16'),       Uint16Array.from(a));

const fill       = (a, v)     => (__akariCheckBuffer(a, 'fill'),       a.fill(v));
const copy       = (a)        => (__akariCheckBuffer(a, 'copy'),       a.slice());
const slice      = (a, s, e)  => (__akariCheckBuffer(a, 'slice'),      a.slice(s, e));
const isBuffer   = (a)        => ArrayBuffer.isView(a) || a instanceof ArrayBuffer;
const bufferSize = (a)        => (__akariCheckBuffer(a, 'bufferSize'), a.byteLength);

let __akariGpuDevice = null;
const __akariGpuBuffers = new Map();

async function gpuInit() {
    if (typeof navigator === 'undefined' || !navigator.gpu) {
        throw new Error("[Akari GPU] WebGPU non supporté sur cette plateforme.");
    }
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error("[Akari GPU] Adaptateur introuvable.");
    __akariGpuDevice = await adapter.requestDevice();
    return true;
}

function gpuBuffer(buffer) {
    __akariCheckBuffer(buffer, 'gpuBuffer');
    if (!__akariGpuDevice) throw new Error("[Akari GPU] Appelez gpuInit() d'abord.");
    const gpuBuf = __akariGpuDevice.createBuffer({
        size: buffer.byteLength,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC
    });
    const id = __akariGpuBuffers.size + 1;
    __akariGpuBuffers.set(id, gpuBuf);
    return id;
}

function gpuSync(buffer, handleId) {
    __akariCheckBuffer(buffer, 'gpuSync');
    if (!__akariGpuDevice) throw new Error("[Akari GPU] GPU non initialisé.");
    const gpuBuf = __akariGpuBuffers.get(handleId);
    if (!gpuBuf) throw new Error(\`[Akari GPU] Handle invalide : \${handleId}\`);
    __akariGpuDevice.queue.writeBuffer(
        gpuBuf, 0, buffer.buffer, buffer.byteOffset, buffer.byteLength
    );
}

// =============================================================
// Fin du runtime — début du programme Akari
// =============================================================
`;
}

// ---------------------------------------------------------------------
// Générateur de code
// ---------------------------------------------------------------------

function transpile(ast) {
    runSafetyChecker(ast);

    let output = buildRuntime();

    function indent(code, level = 1) {
        const pad = '    '.repeat(level);
        return code.split('\n').map(l => (l ? pad + l : l)).join('\n');
    }

    function emitStatement(node) {
        return transpileNode(node, false);
    }

    function emitIndexAccess(node) {
        const target = transpileNode(node.target, true);
        const idx = transpileNode(node.index, true);
        return `__akariIndex(${target}, ${idx}, ${JSON.stringify(node.target.type || 'expr')})`;
    }

    function transpileNode(node, isExpression = false) {
        if (!node) return '';

        switch (node.type) {

            case 'number':
            case 'boolean':
                return String(node.value);

            case 'string':
                return JSON.stringify(node.value);

            case 'nothing':
                return 'null';

            case 'variable':
                return node.name;

            case 'unary':
                return `(${node.operator}${transpileNode(node.argument, true)})`;

            case 'binary':
                return `(${transpileNode(node.left, true)} ${node.operator} ${transpileNode(node.right, true)})`;

            case 'index_access':
                return emitIndexAccess(node);

            case 'index_assignment': {
                function emitRawTarget(n) {
                    if (n.type === 'variable') return n.name;
                    if (n.type === 'index_access') {
                        return `${emitRawTarget(n.target)}[${transpileNode(n.index, true)}]`;
                    }
                    return transpileNode(n, true);
                }
                const rawTarget = emitRawTarget(node.target);
                const value = transpileNode(node.value, true);
                return `${rawTarget} = ${value};\n`;
            }

            case 'assignment': {
                const rhs = transpileNode(node.value, true);
                if (node.isDeclaration === true) {
                    const kw = node.isMut ? 'let' : 'const';
                    return `${kw} ${node.name} = ${rhs};\n`;
                }
                return `${node.name} = ${rhs};\n`;
            }

            // ✅ FIX : ajoute ; si utilisé comme statement
            case 'function_call': {
                const args = node.args.map(a => transpileNode(a, true)).join(', ');
                const call = `${node.name}(${args})`;
                return isExpression ? call : call + ';\n';
            }

            case 'function_def': {
                const params = node.params.map(p => (typeof p === 'string' ? p : p.name)).join(', ');
                const body = node.body.map(emitStatement).join('');
                return `function ${node.name}(${params}) {\n${indent(body)}}\n`;
            }

            case 'return': {
                if (node.value) return `return ${transpileNode(node.value, true)};\n`;
                return 'return;\n';
            }

            case 'if': {
                const cond = transpileNode(node.condition, true);

                if (isExpression) {
                    const thenExpr = node.body.length > 0
                        ? transpileNode(node.body[node.body.length - 1], true)
                        : 'null';
                    const elseExpr = (node.else && node.else.length > 0)
                        ? transpileNode(node.else[node.else.length - 1], true)
                        : 'null';
                    return `(${cond} ? ${thenExpr} : ${elseExpr})`;
                }

                let code = `if (${cond}) {\n`;
                code += indent(node.body.map(emitStatement).join(''));
                code += '}';
                if (node.else && node.else.length > 0) {
                    code += ' else {\n';
                    code += indent(node.else.map(emitStatement).join(''));
                    code += '}';
                }
                return code + '\n';
            }

            case 'for': {
                const varName = node.varName;
                const start = transpileNode(node.start, true);
                const end   = transpileNode(node.end, true);

                let code = `{\n`;
                code += `    const __akariForStart = ${start};\n`;
                code += `    const __akariForEnd = ${end};\n`;
                code += `    __akariCheckLoop(__akariForStart, __akariForEnd, 1);\n`;
                code += `    if (__akariForStart > __akariForEnd) {\n`;
                code += `        throw new Error("[Akari For] Début (" + __akariForStart + ") > fin (" + __akariForEnd + ").");\n`;
                code += `    }\n`;
                code += `    for (let ${varName} = __akariForStart; ${varName} <= __akariForEnd; ${varName}++) {\n`;
                code += indent(node.body.map(emitStatement).join(''), 2);
                code += `    }\n`;
                code += `}\n`;
                return code;
            }

            case 'while': {
                let code = `{\n`;
                code += `    let __akariWhileGuard = 0;\n`;
                code += `    while (${transpileNode(node.condition, true)}) {\n`;
                code += `        if (++__akariWhileGuard > __AKARI_MAX_ITER) {\n`;
                code += `            throw new Error("[Akari While] Boucle trop longue.");\n`;
                code += `        }\n`;
                code += indent(node.body.map(emitStatement).join(''), 2);
                code += `    }\n`;
                code += `}\n`;
                return code;
            }

            case 'try': {
                if (isExpression) {
                    const tryLast = node.body.length > 0
                        ? transpileNode(node.body[node.body.length - 1], true)
                        : 'null';
                    const catchLast = node.catchBody.length > 0
                        ? transpileNode(node.catchBody[node.catchBody.length - 1], true)
                        : 'null';

                    let expr = `(() => {\n`;
                    expr += `    try {\n`;
                    expr += indent(node.body.slice(0, -1).map(emitStatement).join(''), 2);
                    expr += `        return ${tryLast};\n`;
                    expr += `    } catch (${node.errorVar || '_err'}) {\n`;
                    expr += indent(node.catchBody.slice(0, -1).map(emitStatement).join(''), 2);
                    expr += `        return ${catchLast};\n`;
                    expr += `    }\n`;
                    expr += `})()`;
                    return expr;
                }

                let code = `try {\n`;
                code += indent(node.body.map(emitStatement).join(''));
                code += `} catch (${node.errorVar || '_err'}) {\n`;
                code += indent(node.catchBody.map(emitStatement).join(''));
                code += `}\n`;
                return code;
            }

            case 'break':    return 'break;\n';
            case 'continue': return 'continue;\n';

            case 'import':
                return '';

            default:
                throw new CompileError(
                    `Nœud AST non supporté : '${node.type}'.`,
                    node.line, node.column,
                    'Bug interne du transpileur.'
                );
        }
    }

    if (!Array.isArray(ast)) {
        throw new CompileError(
            "L'AST doit être un tableau.",
            '?', '?',
            'Le parser a probablement retourné un objet invalide.'
        );
    }

    for (const statement of ast) {
        const code = transpileNode(statement, false);
        if (!code) continue;
        output += code;
    }

    return output;
}

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { transpile, CompileError };
} else {
    window.transpile = transpile;
    window.CompileError = CompileError;
}