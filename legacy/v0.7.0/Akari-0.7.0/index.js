'use strict';

const path = require('path');
const { Worker } = require('worker_threads');

const { tokenize, parse, LexerError, ParseError } = require('./src/frontend.js');
const { transpile, CompileError } = require('./src/backend.js');
const { transpileToSQL, SQLCompileError } = require('./backends/sql.js');

function compile(source, options = {}) {
  const ast = parse(source);
  return transpile(ast, options);
}

function compileToSQL(source) {
  const ast = parse(source);
  return transpileToSQL(ast);
}

const BUILTINS = Object.freeze({
  toText: (v) => String(v),
  toNumber: (v) => Number(v),
  kind: (v) => {
    if (v === null || v === undefined) return 'nothing';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'boolean') return 'boolean';
    if (Array.isArray(v)) return 'list';
    if (typeof v === 'object') return 'table';
    return 'unknown';
  },
  sqrt: Math.sqrt, pow: Math.pow, abs: Math.abs,
  floor: Math.floor, ceil: Math.ceil, round: Math.round,
  min: Math.min, max: Math.max, random: Math.random,
});

function run(source) {
  const js = compile(source, { allowedFunctions: ['say'] });
  const sandbox = { say: (...args) => console.log(...args), ...BUILTINS };
  const fn = new Function(...Object.keys(sandbox), `"use strict";\n${js}`);
  return fn(...Object.values(sandbox));
}

class Akari {
  constructor(options = {}) {
    this.options = {
      allow: options.allow || [],
      maxIterations: options.maxIterations || 1_000_000,
      timeout: options.timeout || 1000,
      ...options
    };
    this.exposed = new Map();
  }

  expose(name, fn) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new TypeError(`Akari.expose: invalid name '${name}'.`);
    }
    if (typeof fn !== 'function') {
      throw new TypeError(`Akari.expose: '${name}' must be a function.`);
    }
    this.exposed.set(name, Object.freeze(fn));
  }

  async run(source) {
    const allowedFunctions = [...this.options.allow, ...this.exposed.keys()];
    
    const js = compile(source, { 
        maxIterations: this.options.maxIterations,
        allowedFunctions: allowedFunctions
    });

    const exposedFuncs = {};
    for (const [name, fn] of this.exposed) {
        exposedFuncs[name] = fn.toString(); 
    }
    
    if (this.options.allow.includes('say')) {
      exposedFuncs.say = "(...args) => console.log(...args)";
    }

    return new Promise((resolve, reject) => {
        const worker = new Worker(path.join(__dirname, 'src', 'sandbox-worker.js'), {
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
            // Restitution des logs capturés par le Worker
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

module.exports = Object.freeze({
  tokenize, parse, transpile, compileToSQL, LexerError, ParseError, CompileError, SQLCompileError, compile, run, Akari
});