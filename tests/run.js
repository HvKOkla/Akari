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

// --- Listes ---
test('parser: empty list', () => {
  const ast = akari.parse('let x = []');
  assertEqual(ast[0].value.type, 'list');
  assertEqual(ast[0].value.elements.length, 0);
});

test('parser: list with numbers', () => {
  const ast = akari.parse('let x = [1, 2, 3]');
  assertEqual(ast[0].value.type, 'list');
  assertEqual(ast[0].value.elements.length, 3);
});

test('parser: list with mixed types', () => {
  const ast = akari.parse('let x = [1, "hello", true]');
  assertEqual(ast[0].value.elements.length, 3);
});

test('parser: trailing comma in list', () => {
  const ast = akari.parse('let x = [1, 2, 3,]');
  assertEqual(ast[0].value.elements.length, 3);
});

test('run: create and access list', () => {
  const out = captureOutput(`
    let x = [10, 20, 30]
    say(x[0])
    say(x[1])
    say(x[2])
  `);
  assertEqual(out, ['10', '20', '30']);
});

test('run: modify list element', () => {
  const out = captureOutput(`
    mut x = [10, 20, 30]
    x[1] = 99
    say(x[1])
  `);
  assertEqual(out, ['99']);
});

test('run: nested list', () => {
  const out = captureOutput(`
    let x = [[1, 2], [3, 4]]
    say(x[0][1])
    say(x[1][0])
  `);
  assertEqual(out, ['2', '3']);
});

test('run: list with expressions', () => {
  const out = captureOutput(`
    let x = [1 + 2, 3 * 4]
    say(x[0])
    say(x[1])
  `);
  assertEqual(out, ['3', '12']);
});

// --- Tables ---
test('parser: empty table', () => {
  const ast = akari.parse('let x = {}');
  assertEqual(ast[0].value.type, 'table');
  assertEqual(ast[0].value.entries.length, 0);
});

test('parser: table with entries', () => {
  const ast = akari.parse('let x = { a = 1, b = 2 }');
  assertEqual(ast[0].value.type, 'table');
  assertEqual(ast[0].value.entries.length, 2);
});

test('run: create and access table', () => {
  const out = captureOutput(`
    let p = { x = 400, y = 300 }
    say(p.x)
    say(p.y)
  `);
  assertEqual(out, ['400', '300']);
});

test('run: modify table property', () => {
  const out = captureOutput(`
    mut p = { x = 400, y = 300 }
    p.x = 500
    say(p.x)
  `);
  assertEqual(out, ['500']);
});

test('run: nested table', () => {
  const out = captureOutput(`
    let p = { pos = { x = 1, y = 2 } }
    say(p.pos.x)
    say(p.pos.y)
  `);
  assertEqual(out, ['1', '2']);
});

test('run: table with list', () => {
  const out = captureOutput(`
    let p = { noms = ["alice", "bob"] }
    say(p.noms[0])
    say(p.noms[1])
  `);
  assertEqual(out, ['alice', 'bob']);
});

// --- For-in (boucles sur collections) ---
test('run: for-in over list', () => {
  const out = captureOutput(`
    let noms = ["alice", "bob", "charlie"]
    for nom in noms:
      say(nom)
    end
  `);
  assertEqual(out, ['alice', 'bob', 'charlie']);
});

test('run: for-in over list of tables', () => {
  const out = captureOutput(`
    let entities = [
      { x = 100, y = 200 },
      { x = 300, y = 400 }
    ]
    for e in entities:
      say(e.x)
      say(e.y)
    end
  `);
  assertEqual(out, ['100', '200', '300', '400']);
});

test('run: for-in with break', () => {
  const out = captureOutput(`
    let noms = ["a", "b", "c", "d"]
    for nom in noms:
      if nom == "c":
        stop
      end
      say(nom)
    end
  `);
  assertEqual(out, ['a', 'b']);
});

test('run: for-in with continue', () => {
  const out = captureOutput(`
    let noms = ["a", "b", "c"]
    for nom in noms:
      if nom == "b":
        skip
      end
      say(nom)
    end
  `);
  assertEqual(out, ['a', 'c']);
});

test('run: for-in over string', () => {
  const out = captureOutput(`
    let mot = "abc"
    for lettre in mot:
      say(lettre)
    end
  `);
  assertEqual(out, ['a', 'b', 'c']);
});

test('run: for-in over float32 buffer', () => {
  const out = captureOutput(`
    mut v = float32(3)
    v[0] = 10
    v[1] = 20
    v[2] = 30
    for x in v:
      say(x)
    end
  `);
  assertEqual(out, ['10', '20', '30']);
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