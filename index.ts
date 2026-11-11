import path from 'path';
import { Worker } from 'worker_threads';

import { tokenize, parse, LexerError, ParseError } from './src/compiler';
import { transpile, CompileError } from './src/compiler/transpiler';
import { transpileToSQL, SQLCompileError } from './src/backends/sql';

export interface AkariOptions {
    allow?: string[];
    maxIterations?: number;
    timeout?: number;
    allowedFunctions?: string[];
}

export interface ExposedFunction {
    name: string;
    fn: (...args: any[]) => any;
}

function compile(source: string, options: AkariOptions = {}): string {
    const ast = parse(source);
    return transpile(ast, options);
}

function compileToSQL(source: string, context?: any): string {
    const ast = parse(source);
    return transpileToSQL(ast, context);
}

const BUILTINS: Record<string, Function> = Object.freeze({
    toText: (v: any) => String(v),
    toNumber: (v: any) => Number(v),
    kind: (v: any) => {
        if (v === null || v === undefined) return 'nothing';
        if (typeof v === 'number') return 'number';
        if (typeof v === 'string') return 'string';
        if (typeof v === 'boolean') return 'boolean';
        if (Array.isArray(v)) return 'list';
        if (typeof v === 'object') return 'table';
        return 'unknown';
    },
    sqrt: Math.sqrt,
    pow: Math.pow,
    abs: Math.abs,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    min: Math.min,
    max: Math.max,
    random: Math.random,
});

export function run(source: string): any {
    const js = compile(source, { allowedFunctions: ['say'] });
    const sandbox = { say: (...args: any[]) => console.log(...args), ...BUILTINS };
    const fn = new Function(...Object.keys(sandbox), `"use strict";\n${js}`);
    return fn(...Object.values(sandbox));
}

export class Akari {
    private options: Required<AkariOptions>;
    private exposed: Map<string, Function>;

    constructor(options: AkariOptions = {}) {
        this.options = {
            allow: options.allow || [],
            maxIterations: options.maxIterations || 1_000_000,
            timeout: options.timeout || 1000,
            allowedFunctions: options.allowedFunctions || [],
        };
        this.exposed = new Map();
    }

    public expose(name: string, fn: Function): void {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
            throw new TypeError(`Akari.expose: invalid name '${name}'.`);
        }
        if (typeof fn !== 'function') {
            throw new TypeError(`Akari.expose: '${name}' must be a function.`);
        }
        this.exposed.set(name, Object.freeze(fn));
    }

    public async run(source: string): Promise<any> {
        const allowedFunctions = [...this.options.allow, ...this.exposed.keys()];
        
        const js = compile(source, { 
            maxIterations: this.options.maxIterations,
            allowedFunctions: allowedFunctions
        });

        const exposedFuncs: Record<string, string> = {};
        for (const [name, fn] of this.exposed) {
            exposedFuncs[name] = fn.toString(); 
        }
        
        if (this.options.allow.includes('say')) {
            exposedFuncs.say = "(...args) => console.log(...args)";
        }

        return new Promise((resolve, reject) => {
            // LE CHEMIN DU WORKER EST MIS À JOUR ICI
            const worker = new Worker(path.join(__dirname, 'src', 'sandbox', 'worker.js'), {
                workerData: {
                    code: js,
                    allowedFunctions: exposedFuncs,
                    timeout: this.options.timeout
                },
                resourceLimits: {
                    maxOldGenerationSizeMb: 16,
                    maxYoungGenerationSizeMb: 8,
                    codeRangeSizeMb: 8
                }
            });

            worker.on('message', (msg) => {
                if (msg.logs) {
                    for (const line of msg.logs) {
                        console.log(line);
                    }
                }
                if (msg.success) {
                    resolve(msg.result);
                } else {
                    reject(new Error(`[Akari Sandbox] ${msg.error}`));
                }
            });

            worker.on('error', reject);
            worker.on('exit', (code) => {
                if (code !== 0) reject(new Error(`[Akari Sandbox] Worker stopped with exit code ${code}`));
            });
        });
    }
}

export {
    tokenize,
    parse,
    transpile,
    compileToSQL,
    LexerError,
    ParseError,
    CompileError,
    SQLCompileError,
    compile,
};