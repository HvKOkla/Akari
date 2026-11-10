/*
 * Akari Programming Language Engine
 * Main Entry Point
 * 
 * FROZEN: This file is part of the frozen engine.
 */

'use strict';

const { tokenize, parse, LexerError, ParseError } = require('./src/frontend.js');
const { transpile, CompileError } = require('./src/backend.js');
const { transpileToSQL, SQLCompileError } = require('./backends/sql.js'); // NOUVEAU

/**
 * Compile Akari code to JavaScript.
 */
function compile(source, options = {}) {
  const ast = parse(source);
  return transpile(ast, options);
}

/**
 * Compile Akari code to SQL.
 */
function compileToSQL(source) {
  const ast = parse(source);
  return transpileToSQL(ast);
}

// Builtins purs exposes a tous les scripts (miroir des __rt_* du runtime).
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

/**
 * Compile and execute Akari code (for CLI/tests only).
 * WARNING: Not sandboxed. Do not use with untrusted code.
 */
function run(source) {
  const js = compile(source);
  const sandbox = { say: (...args) => console.log(...args), ...BUILTINS };
  const fn = new Function(...Object.keys(sandbox), `"use strict";\n${js}`);
  return fn(...Object.values(sandbox));
}

/**
 * Akari — Safe, embeddable scripting language.
 */
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

  /**
   * Expose a host function to the Akari script.
   */
  expose(name, fn) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      throw new TypeError(`Akari.expose: invalid name '${name}'. Names must start with a letter or underscore.`);
    }
    if (typeof fn !== 'function') {
      throw new TypeError(`Akari.expose: '${name}' must be a function.`);
    }
    this.exposed.set(name, Object.freeze(fn));
  }

  /**
   * Compile and run Akari code in a sandboxed context.
   */
  run(source) {
    const js = compile(source, { maxIterations: this.options.maxIterations });

    // 1. Construction du sandbox
    const sandbox = { ...BUILTINS };

    // On n'autorise "say" que si explicitement demandé
    if (this.options.allow.includes('say')) {
      sandbox.say = (...args) => console.log(...args);
    } else {
      sandbox.say = () => { throw new Error("[Akari I/O] say() is not allowed. Enable it with allow: ['say']."); };
    }

    // 2. Ajout des fonctions exposées (noms validés par expose())
    for (const [name, fn] of this.exposed) {
      sandbox[name] = fn;
    }

    // 3. Injection dans le scope du script
    const names = Object.keys(sandbox);
    const destructuring = names.length ? `const { ${names.join(', ')} } = __sandbox__;` : '';

    const fn = new Function(
      '__sandbox__',
      `"use strict";
       const process = undefined;
       const require = undefined;
       const module = undefined;
       const globalThis = undefined;
       const window = undefined;
       ${destructuring}
       ${js}
      `
    );

    return fn(sandbox);
  }
}

// ---------------------------------------------------------------------
// Export (Frozen)
// ---------------------------------------------------------------------
module.exports = Object.freeze({
  tokenize,
  parse,
  transpile,
  compileToSQL, // NOUVEAU
  LexerError,
  ParseError,
  CompileError,
  SQLCompileError, // NOUVEAU
  compile,
  run,
  Akari
});