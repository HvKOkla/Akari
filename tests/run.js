/*
 * Akari Test Runner
 * Copyright (c) 2026 [HvK Okla]
 */

'use strict';

const path = require('path');
const akari = require('../src/index.js');

// ---------------------------------------------------------------------
// Micro-framework de test
// ---------------------------------------------------------------------

const results = { pass: 0, fail: 0, errors: [] };
const VERBOSE = process.argv.includes('--verbose');
const COLOR = !process.argv.includes('--no-color');

const c = {
  reset:  COLOR ? '\x1b[0m'  : '',
  red:    COLOR ? '\x1b[31m' : '',
  green:  COLOR ? '\x1b[32m' : '',
  yellow: COLOR ? '\x1b[33m' : '',
  dim:    COLOR ? '\x1b[2m'  : ''
};

function test(name, fn) {
  try {
    fn();
    results.pass++;
    if (VERBOSE) console.log(c.green + '✔' + c.reset + ' ' + name);
  } catch (err) {
    results.fail++;
    results.errors.push({ name, err });
    console.log(c.red + '✖' + c.reset + ' ' + name);
    console.log('  ' + c.dim + (err.message || err) + c.reset);
  }
}

function assertEqual(actual, expected, msg = '') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(
      `${msg}\n    Expected: ${e}\n    Actual:   ${a}`
    );
  }
}

function assertThrows(fn, msgPattern = null) {
  try {
    fn();
    throw new Error('Expected an error, but none was thrown.');
  } catch (err) {
    if (msgPattern && !String(err.message || err).includes(msgPattern)) {
      throw new Error(
        `Expected error matching "${msgPattern}", got: "${err.message || err}"`
      );
    }
  }
}

/**
 * Capture la sortie de `console.log` pendant l'exécution d'un programme.
 */
function captureOutput(source) {
  const captured = [];
  const origLog = console.log;
  console.log = (...args) => captured.push(args.join(' '));
  try {
    akari.run(source);
  } finally {
    console.log = origLog;
  }
  return captured;
}

// ---------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------

console.log(c.dim + 'Akari Test Suite\n' + c.reset);

// --- Lexer ---
test('lexer: recognize number', () => {
  const toks = akari.tokenize('42');
  assertEqual(toks[0].type, 'number');
  assertEqual(toks[0].value, 42);
});

test('lexer: recognize string', () => {
  const toks = akari.tokenize('"hello"');
  assertEqual(toks[0].type, 'string');
  assertEqual(toks[0].value, 'hello');
});

test('lexer: recognize all keywords', () => {
  const src = 'import def end return if else for in while stop skip try catch true false nothing let mut';
  const toks = akari.tokenize(src);
  const types = toks.filter(t => t.type !== 'EOF').map(t => t.type);
  assertEqual(types, ['import','def','end','return','if','else','for','in','while','stop','skip','try','catch','true','false','nothing','let','mut']);
});

// --- Parser ---
test('parser: simple assignment', () => {
  const ast = akari.parse('let x = 5');
  assertEqual(ast.length, 1);
  assertEqual(ast[0].type, 'assignment');
  assertEqual(ast[0].name, 'x');
  assertEqual(ast[0].isMut, false);
});

test('parser: mutable assignment', () => {
  const ast = akari.parse('mut x = 5');
  assertEqual(ast[0].isMut, true);
});

test('parser: index access', () => {
  const ast = akari.parse('say(v[0])');
  assertEqual(ast[0].type, 'function_call');
  assertEqual(ast[0].args[0].type, 'index_access');
});

test('parser: throw on invalid syntax', () => {
  assertThrows(() => akari.parse('def def'), 'Parse');
});

// --- Transpiler ---
test('transpile: hello world', () => {
  const js = akari.compile('say("hello")');
  assertEqual(typeof js, 'string');
  assertEqual(js.includes('say("hello")'), true);
});

// --- Exécution ---
test('run: say prints to console', () => {
  const out = captureOutput('say("hello")');
  assertEqual(out, ['hello']);
});

test('run: arithmetic', () => {
  const out = captureOutput('say(2 + 3 * 4)');
  assertEqual(out, ['14']);
});

test('run: string concat', () => {
  const out = captureOutput('say("a" + "b")');
  assertEqual(out, ['ab']);
});

test('run: function definition and call', () => {
  const src = `
    def square(n):
      return n * n
    end
    say(square(5))
  `;
  const out = captureOutput(src);
  assertEqual(out, ['25']);
});

test('run: for loop', () => {
  const src = `
    for i in 1..3:
      say(i)
    end
  `;
  const out = captureOutput(src);
  assertEqual(out, ['1', '2', '3']);
});

test('run: while loop', () => {
  const src = `
    mut n = 0
    while n < 3:
      say(n)
      n = n + 1
    end
  `;
  const out = captureOutput(src);
  assertEqual(out, ['0', '1', '2']);
});

test('run: if/else', () => {
  const src = `
    if 1 > 2:
      say("a")
    else:
      say("b")
    end
  `;
  const out = captureOutput(src);
  assertEqual(out, ['b']);
});

test('run: try/catch', () => {
  const src = `
    try:
      let x = float32(99999999)
    catch err:
      say("caught")
    end
  `;
  const out = captureOutput(src);
  assertEqual(out, ['caught']);
});

// --- Buffers ---
test('run: float32 allocation', () => {
  const src = 'mut v = float32(3)\nv[0] = 10\nsay(v[0])';
  const out = captureOutput(src);
  assertEqual(out, ['10']);
});

test('run: buffer out of bounds throws', () => {
  const src = 'mut v = float32(3)\nsay(v[10])';
  assertThrows(() => captureOutput(src), 'Hors bornes');
});

// --- Immuabilité ---
test('run: reassign let throws', () => {
  const src = 'let x = 5\nx = 10';
  assertThrows(() => captureOutput(src), 'immuable');
});

test('run: reassign mut works', () => {
  const src = 'mut x = 5\nx = 10\nsay(x)';
  const out = captureOutput(src);
  assertEqual(out, ['10']);
});

// --- Erreurs de type ---
test('run: type mismatch throws', () => {
  const src = 'mut x = 5\nx = "hello"';
  assertThrows(() => captureOutput(src), 'Type incohérent');
});

// --- Result ---
console.log('');
if (results.fail === 0) {
  console.log(c.green + `✔ All ${results.pass} tests passed.` + c.reset);
  process.exit(0);
} else {
  console.log(c.red + `✖ ${results.fail} test(s) failed, ${results.pass} passed.` + c.reset);
  process.exit(1);
}