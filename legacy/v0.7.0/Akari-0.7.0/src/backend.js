import { Checker } from './checker';

/*
 * Akari Programming Language Engine — Backend
 * (Safety Checker + Transpiler + Runtime)
 * 
 * FROZEN: This file is part of the frozen engine.
 * TOLERANCE ZERO: Strict code generation.
 */

class CompileError extends Error {
    constructor(msg, line, column, hint = '') {
        super(msg);
        this.name = 'CompileError';
        this.line = line || '?';
        this.column = column || '?';
        this.hint = hint;
    }
    toString() {
        let out = `❌ [CompileError] ${this.message}\n  --> Line ${this.line}, Column ${this.column}`;
        if (this.hint) out += `\n  = hint: ${this.hint}`;
        return out;
    }
}

const MAX_LOOP_ITERATIONS = 1_000_000;

// ---------------------------------------------------------------------
// Safety Checker (Legacy)
// ---------------------------------------------------------------------
function checkNode(node) {
    if (!node) return;
    if (node.type === 'variable') {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(node.name)) {
            throw new CompileError(`Invalid variable name: '${node.name}'.`, node.line, node.column, "Variables must start with a letter or underscore.");
        }
    }
    // ... (le reste de ton ancien checkNode reste ici, on ne le supprime pas encore)
}

// ---------------------------------------------------------------------
// Transpiler
// ---------------------------------------------------------------------
function transpile(ast, options = {}) {
    // NOUVEAU : On appelle le Checker impitoyable
    const checker = new Checker(options.allowedFunctions || []);
    checker.check(ast);

    let output = buildRuntime(options);

    function transpileNode(node, isExpr = false) {
        if (!node) return '';
        switch (node.type) {
            case 'number': return String(node.value);
            case 'boolean': return String(node.value);
            case 'string': return JSON.stringify(node.value);
            case 'nothing': return 'null';
            case 'variable': return node.name;
            
            case 'binary': 
                return `__akari_binop("${node.operator}", ${transpileNode(node.left, true)}, ${transpileNode(node.right, true)})`;
            
            case 'unary': 
                return `__akari_unop("${node.operator}", ${transpileNode(node.argument, true)})`;
            
            case 'function_call': 
                return `${node.name}(${node.args.map(a => transpileNode(a, true)).join(', ')})` + (isExpr ? '' : ';\n');
            
            case 'assignment':
                if (node.isDeclaration) return `${node.isMut ? 'let' : 'const'} ${node.name} = ${transpileNode(node.value, true)};\n`;
                return `${node.name} = ${transpileNode(node.value, true)};\n`;
            
            case 'function_def':
                return `function ${node.name}(${node.params.join(', ')}) {\n${node.body.map(s => transpileNode(s)).join('')}}\n`;
            
            case 'if': {
                let code = `if (${transpileNode(node.condition, true)}) {\n${node.body.map(s => transpileNode(s)).join('')}}`;
                if (node.else && node.else.length) code += ` else {\n${node.else.map(s => transpileNode(s)).join('')}}`;
                return code + '\n';
            }
            
            case 'while': {
                return `{
    let __akariWhileGuard = 0;
    while (${transpileNode(node.condition, true)}) {
        if (++__akariWhileGuard > __AKARI_MAX_ITER) {
            throw new Error("[Akari Loop] Loop too long (max " + __AKARI_MAX_ITER + " iterations).");
        }
        ${node.body.map(s => transpileNode(s)).join('')}
    }
}\n`;
            }
            
            case 'for': {
                const varName = node.varName;
                const start = transpileNode(node.start, true);
                const end = transpileNode(node.end, true);
                return `{
    const __akariForStart = ${start};
    const __akariForEnd = ${end};
    if (__akariForEnd - __akariForStart > __AKARI_MAX_ITER) {
        throw new Error("[Akari For] Loop too long (max " + __AKARI_MAX_ITER + " iterations).");
    }
    for (let ${varName} = __akariForStart; ${varName} < __akariForEnd; ${varName}++) {
        ${node.body.map(s => transpileNode(s)).join('')}
    }
}\n`;
            }

            case 'for_in': {
                const varName = node.varName;
                const coll = transpileNode(node.collection, true);
                return `{
    const __akariColl = ${coll};
    if (__akariColl === null || __akariColl === undefined) {
        throw new Error("[Akari For] Cannot iterate over nothing.");
    }
    let __akariForInGuard = 0;
    for (const ${varName} of __akariColl) {
        if (++__akariForInGuard > __AKARI_MAX_ITER) {
            throw new Error("[Akari For] Loop too long (max " + __AKARI_MAX_ITER + " iterations).");
        }
        ${node.body.map(s => transpileNode(s)).join('')}
    }
}\n`;
            }

            case 'table_access':
                return `${transpileNode(node.target, true)}.${node.key}`;

            case 'return':
                return node.value ? `return ${transpileNode(node.value, true)};\n` : 'return;\n';
            
            case 'break': return 'break;\n';
            case 'continue': return 'continue;\n';
            
            case 'import':
                throw new CompileError(
                    "'import' is not supported by the transpiler.",
                    node.line,
                    node.column,
                    "Akari is sandboxed by default. Use akari.expose() instead."
                );
            
            default: return '';
        }
    }

    for (const statement of ast) output += transpileNode(statement);
    return output;
}

// ---------------------------------------------------------------------
// Runtime (Le cœur de la sémantique Akari)
// ---------------------------------------------------------------------
function buildRuntime(options = {}) {
    const maxIter = Number.isFinite(options.maxIterations) && options.maxIterations > 0
        ? Math.floor(options.maxIterations)
        : MAX_LOOP_ITERATIONS;
    return `"use strict";
const __AKARI_MAX_ITER = ${maxIter};

function __akari_binop(op, left, right) {
    if (op === '+') {
        if (typeof left !== typeof right) {
            throw new Error("[Akari Type] Cannot add " + typeof left + " and " + typeof right + ".");
        }
        return left + right;
    }
    if (op === '-') return left - right;
    if (op === '*') return left * right;
    if (op === '/') {
        if (right === 0) throw new Error("[Akari Math] Division by zero.");
        return left / right;
    }
    if (op === '%') {
        if (right === 0) throw new Error("[Akari Math] Modulo by zero.");
        return left % right;
    }
    
    if (op === '==') return left === right;
    if (op === '!=') return left !== right;
    if (op === '<') return left < right;
    if (op === '>') return left > right;
    if (op === '<=') return left <= right;
    if (op === '>=') return left >= right;
    
    if (op === '&&') return left && right;
    if (op === '||') return left || right;

    throw new Error("[Akari Internal] Unknown operator: " + op);
}

function __akari_unop(op, arg) {
    if (op === '-') return -arg;
    if (op === '!') return !arg;
    throw new Error("[Akari Internal] Unknown unary operator: " + op);
}

const __rt_math_sqrt  = (x) => Math.sqrt(x);
const __rt_math_pow   = (x, y) => Math.pow(x, y);
const __rt_math_abs   = (x) => Math.abs(x);
const __rt_math_floor = (x) => Math.floor(x);
const __rt_math_ceil  = (x) => Math.ceil(x);
const __rt_math_round = (x) => Math.round(x);
const __rt_math_min   = (a, b) => Math.min(a, b);
const __rt_math_max   = (a, b) => Math.max(a, b);
const __rt_math_random = () => Math.random();

const __rt_toNumber = (v) => Number(v);
const __rt_toText   = (v) => String(v);
const __rt_kind = (v) => {
    if (v === null || v === undefined) return 'nothing';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'boolean') return 'boolean';
    if (Array.isArray(v)) return 'list';
    if (typeof v === 'object') return 'table';
    return 'unknown';
};
`;
}

module.exports = Object.freeze({
    transpile,
    buildRuntime,
    CompileError,
    MAX_LOOP_ITERATIONS
});