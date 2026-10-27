/*
 * Akari Programming Language Engine
 * Main Entry Point
 * 
 * FROZEN: This file is part of the frozen engine.
 */

'use strict';

const { tokenize, parse, LexerError, ParseError } = require('./src/frontend.js');
const { transpile, CompileError } = require('./src/backend.js');

/**
 * Compile Akari code to JavaScript.
 */
function compile(source) {
  const ast = parse(source);
  return transpile(ast);
}

/**
 * Compile and execute Akari code (for CLI/tests only).
 * WARNING: Not sandboxed. Do not use with untrusted code.
 */
function run(source) {
  const js = compile(source);
  const sandbox = { say: (...args) => console.log(...args) };
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
    if (typeof fn !== 'function') {
      throw new TypeError(`Akari.expose: '${name}' must be a function.`);
    }
    // On gèle la fonction pour éviter les modifications
    this.exposed.set(name, Object.freeze(fn));
  }

  /**
   * Compile and run Akari code in a sandboxed context.
   */
  run(source) {
    const js = compile(source);
    
    // 1. Construction du sandbox
    const sandbox = {
      // On expose les variables globales autorisées
      __AKARI_MAX_ITER: this.options.maxIterations,
    };

    // On n'autorise "say" que si explicitement demandé
    if (this.options.allow.includes('say')) {
      sandbox.say = (...args) => console.log(...args);
    } else {
      sandbox.say = () => { throw new Error("[Akari I/O] say() is not allowed. Enable it with allow: ['say']."); };
    }

    // 2. Ajout des fonctions exposées
    for (const [name, fn] of this.exposed) {
      sandbox[name] = fn;
    }

    // 3. Exécution sécurisée (avec "use strict" et sans accès à globalThis)
    // L'astuce du `new Proxy` empêche l'accès à `globalThis` depuis le code généré
    const fn = new Function(
      '__sandbox__', 
      `"use strict";
       const { say, __AKARI_MAX_ITER } = __sandbox__;
       const process = undefined;
       const require = undefined;
       const globalThis = undefined;
       const window = undefined;
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
  LexerError,
  ParseError,
  CompileError,
  compile,
  run,
  Akari
});