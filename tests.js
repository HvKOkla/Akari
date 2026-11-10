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

// ---------------------------------------------------------------------
// Régressions : bugs critiques corrigés en v0.6.2
// ---------------------------------------------------------------------

function capture(fn) {
  const captured = [];
  const origLog = console.log;
  console.log = (...args) => captured.push(args.join(' '));
  try { fn(); } finally { console.log = origLog; }
  return captured;
}

test('run: reassign mut variable (x = 2)', () => {
  const out = capture(() => akari.run('mut x = 1\nx = 2\nsay(x)'));
  assertEqual(out, ['2']);
});

test('run: while loop with counter', () => {
  const out = capture(() => akari.run('mut i = 0\nwhile i < 3:\n    say(i)\n    i = i + 1\nend'));
  assertEqual(out, ['0', '1', '2']);
});

test('run: stop breaks out of loop', () => {
  const out = capture(() => akari.run('for i in 1..10:\n    if i == 3:\n        stop\n    end\n    say(i)\nend'));
  assertEqual(out, ['1', '2']);
});

test('run: skip continues loop', () => {
  const out = capture(() => akari.run('for i in 1..4:\n    if i % 2 == 0:\n        skip\n    end\n    say(i)\nend'));
  assertEqual(out, ['1', '3']);
});

test('run: for_in over exposed list', () => {
  const { Akari } = akari;
  const engine = new Akari({ allow: ['say'] });
  engine.expose('getItems', () => [10, 20, 30]);
  const out = capture(() => engine.run('for x in getItems():\n    say(x)\nend'));
  assertEqual(out, ['10', '20', '30']);
});

test('Akari.run: sandbox executes without SyntaxError', () => {
  const { Akari } = akari;
  const engine = new Akari({ allow: ['say'] });
  const out = capture(() => engine.run('say("sandbox ok")'));
  assertEqual(out, ['sandbox ok']);
});

test('Akari.run: exposed function is callable from script', () => {
  const { Akari } = akari;
  const engine = new Akari({ allow: ['say'] });
  engine.expose('double', (x) => x * 2);
  const out = capture(() => engine.run('say(double(21))'));
  assertEqual(out, ['42']);
});

test('Akari.run: say blocked without allow option', () => {
  const { Akari } = akari;
  const engine = new Akari();
  let threw = false;
  try { engine.run('say(1)'); } catch (e) { threw = /not allowed/.test(e.message); }
  assertEqual(threw, true);
});

test('Akari.run: maxIterations option is enforced', () => {
  const { Akari } = akari;
  const engine = new Akari({ maxIterations: 100 });
  let threw = false;
  try { engine.run('while true:\nend'); } catch (e) { threw = /Loop too long/.test(e.message); }
  assertEqual(threw, true);
});

test('Akari.expose: rejects invalid names', () => {
  const { Akari } = akari;
  const engine = new Akari();
  let threw = false;
  try { engine.expose('bad name!', () => 1); } catch (e) { threw = e instanceof TypeError; }
  assertEqual(threw, true);
});

test('run: member access user.age transpiles', () => {
  const { Akari } = akari;
  const engine = new Akari({ allow: ['say'] });
  engine.expose('getUser', () => ({ age: 21, name: 'Ada' }));
  const out = capture(() => engine.run('let u = getUser()\nif u.age > 18:\n    say(u.name)\nend'));
  assertEqual(out, ['Ada']);
});

test('run: try keyword gives clear error', () => {
  let msg = '';
  try { akari.run('try:\nend'); } catch (e) { msg = e.message; }
  assertEqual(/reserved keyword/.test(msg), true);
});

test('sql: escapes single quotes', () => {
  const sql = akari.compileToSQL("if u.name == \"o'brien\":\n    return u.name\nend");
  assertEqual(sql.includes("''"), true);
});

test('sql: rejects unsupported nodes', () => {
  let threw = false;
  try { akari.compileToSQL('say(1)'); } catch (e) { threw = e.name === 'SQLCompileError'; }
  assertEqual(threw, true);
});

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail ? 1 : 0);