/*
 * Akari Programming Language Engine
 * Main Entry Point
 */

'use strict';

const { tokenize, parse, LexerError, ParseError } = require('./src/frontend.js');
const { transpile, CompileError } = require('./src/backend.js');

function compile(source) {
  const ast = parse(source);
  return transpile(ast);
}

function run(source) {
  const js = compile(source);
  const sandbox = { say: (...args) => console.log(...args) };
  const fn = new Function(...Object.keys(sandbox), `"use strict";\n${js}`);
  return fn(...Object.values(sandbox));
}

class Akari {
  constructor(options = {}) {
    this.options = { allow: options.allow || [], ...options };
    this.exposed = new Map();
  }
  expose(name, fn) { this.exposed.set(name, fn); }
  run(source) {
    const js = compile(source);
    const sandbox = {};
    if (this.options.allow.includes('say')) sandbox.say = (...args) => console.log(...args);
    else sandbox.say = () => { throw new Error("say() is not allowed."); };
    for (const [name, fn] of this.exposed) sandbox[name] = fn;
    const fn = new Function(...Object.keys(sandbox), `"use strict";\n${js}`);
    return fn(...Object.values(sandbox));
  }
}

module.exports = { tokenize, parse, transpile, LexerError, ParseError, CompileError, compile, run, Akari };