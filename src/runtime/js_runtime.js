// src/runtime/js_runtime.js
/*
 * Akari Programming Language Engine — JavaScript Runtime
 * Copyright (c) 2026 [HvK Okla]
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

if (typeof require !== 'undefined') {
    var {
        MAX_ALLOCATION_BYTES,
        MAX_LOOP_ITERATIONS
    } = require('../core/safety_checker.js');
    var primitives = require('./primitives.js');
}

// ---------------------------------------------------------------------
// Génération des primitives runtime (__rt_*)
// ---------------------------------------------------------------------

function buildPrimitives() {
    const lines = [];
    for (const [name, info] of Object.entries(primitives)) {
        if (info && info.js) {
            lines.push(`const ${name} = ${info.js};`);
        }
    }
    return lines.join('\n');
}

// ---------------------------------------------------------------------
// Runtime JS — préambule généré
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

// =============================================================
// Primitives runtime (__rt_*) — générées depuis primitives.js
// =============================================================

${buildPrimitives()}

// =============================================================
// GPU WebGPU (optionnel)
// =============================================================

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
// Export
// ---------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { buildRuntime };
} else {
    window.buildRuntime = buildRuntime;
}