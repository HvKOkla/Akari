'use strict';

const akari = require('./index.js');

let pass = 0, fail = 0;

async function test(name, fn) {
  try {
    await fn();
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

async function captureAsync(fn) {
  const captured = [];
  const origLog = console.log;
  console.log = (...args) => captured.push(args.join(' '));
  try { await fn(); } finally { console.log = origLog; }
  return captured;
}

function captureSync(fn) {
  const captured = [];
  const origLog = console.log;
  console.log = (...args) => captured.push(args.join(' '));
  try { fn(); } finally { console.log = origLog; }
  return captured;
}

(async () => {
  console.log('Akari Test Suite\n');

  await test('lexer: recognize number', () => {
    const toks = akari.tokenize('42');
    assertEqual(toks[0].value, 42);
  });

  await test('run (sync): say prints to console', () => {
    const out = captureSync(() => akari.run('say("hello")'));
    assertEqual(out, ['hello']);
  });

  await test('run (sync): arithmetic', () => {
    const out = captureSync(() => akari.run('say(2 + 2)'));
    assertEqual(out, ['4']);
  });

  await test('run (sync): reassign mut variable (x = 2)', () => {
    const out = captureSync(() => akari.run('mut x = 1\nx = 2\nsay(x)'));
    assertEqual(out, ['2']);
  });

  await test('run (sync): while loop with counter', () => {
    const out = captureSync(() => akari.run('mut i = 0\nwhile i < 3:\n    say(i)\n    i = i + 1\nend'));
    assertEqual(out, ['0', '1', '2']);
  });

  await test('run (sync): stop breaks out of loop', () => {
    const out = captureSync(() => akari.run('for i in 1..10:\n    if i == 3:\n        stop\n    end\n    say(i)\nend'));
    assertEqual(out, ['1', '2']);
  });

  await test('run (sync): skip continues loop', () => {
    const out = captureSync(() => akari.run('for i in 1..4:\n    if i % 2 == 0:\n        skip\n    end\n    say(i)\nend'));
    assertEqual(out, ['1', '3']);
  });

  await test('run (sync): for_in over exposed list', async () => {
    const { Akari } = akari;
    const engine = new Akari({ allow: ['say'] });
    engine.expose('getItems', () => [10, 20, 30]);
    const out = await captureAsync(() => engine.run('for x in getItems():\n    say(x)\nend'));
    assertEqual(out, ['10', '20', '30']);
  });

  await test('Akari.run: sandbox executes without SyntaxError', async () => {
    const { Akari } = akari;
    const engine = new Akari({ allow: ['say'] });
    const out = await captureAsync(() => engine.run('say("sandbox ok")'));
    assertEqual(out, ['sandbox ok']);
  });

  await test('Akari.run: exposed function is callable from script', async () => {
    const { Akari } = akari;
    const engine = new Akari({ allow: ['say'] });
    engine.expose('double', (x) => x * 2);
    const out = await captureAsync(() => engine.run('say(double(21))'));
    assertEqual(out, ['42']);
  });

  await test('Akari.run: say blocked without allow option', async () => {
    const { Akari } = akari;
    const engine = new Akari();
    let threw = false;
    try { await engine.run('say(1)'); } catch (e) { threw = /not allowed/i.test(e.message); }
    assertEqual(threw, true);
  });

    await test('Akari.run: maxIterations option is enforced', async () => {
    const { Akari } = akari;
    const engine = new Akari({ maxIterations: 100, timeout: 100 });
    let threw = false;
    try { await engine.run('while true:\nend'); } catch (e) { 
        threw = /timeout|Loop too long/i.test(e.message); 
    }
    assertEqual(threw, true);
  });

  await test('Akari.expose: rejects invalid names', () => {
    const { Akari } = akari;
    const engine = new Akari();
    let threw = false;
    try { engine.expose('bad name!', () => 1); } catch (e) { threw = e instanceof TypeError; }
    assertEqual(threw, true);
  });

  await test('run: member access user.age transpiles', async () => {
    const { Akari } = akari;
    const engine = new Akari({ allow: ['say'] });
    engine.expose('getUser', () => ({ age: 21, name: 'Ada' }));
    const out = await captureAsync(() => engine.run('let u = getUser()\nif u.age > 18:\n    say(u.name)\nend'));
    assertEqual(out, ['Ada']);
  });

  await test('run: try keyword gives clear error', () => {
    let msg = '';
    try { akari.run('try:\nend'); } catch (e) { msg = e.message; }
    assertEqual(/reserved keyword/.test(msg), true);
  });

  await test('sql: escapes single quotes', () => {
    const sql = akari.compileToSQL("if u.name == \"o'brien\":\n    return u.name\nend");
    assertEqual(sql.includes("''"), true);
  });

  await test('sql: rejects unsupported nodes', () => {
    let threw = false;
    try { akari.compileToSQL('say(1)'); } catch (e) { threw = e.name === 'SQLCompileError'; }
    assertEqual(threw, true);
  });

  console.log(`\n${pass} passed, ${fail} failed.`);
  process.exit(fail ? 1 : 0);
})();