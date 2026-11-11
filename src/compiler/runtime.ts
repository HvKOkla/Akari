const MAX_LOOP_ITERATIONS = 1_000_000;

export function buildRuntime(options: any = {}): string {
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