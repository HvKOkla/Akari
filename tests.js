'use strict';

const akari = require('./index.js');

let pass = 0, fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('✔ ' + name);
  } catch (err) {
    fail++;
    console.log('✖ ' + name);
    console.log('  ' + err.message);
  }
}

function assertEqual(a, b) {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

console.log('Akari Test Suite\n');

test('lexer: recognize number', () => {
  const toks = akari.tokenize('42');
  assertEqual(toks[0].value, 42);
});

test('run: say prints to console', () => {
  const captured = [];
  const origLog = console.log;
  console.log = (...args) => captured.push(args.join(' '));
  akari.run('say("hello")');
  console.log = origLog;
  assertEqual(captured, ['hello']);
});

test('run: arithmetic', () => {
  const captured = [];
  const origLog = console.log;
  console.log = (...args) => captured.push(args.join(' '));
  akari.run('say(2 + 2)');
  console.log = origLog;
  assertEqual(captured, ['4']);
});

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);