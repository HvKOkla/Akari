#!/usr/bin/env node
/*
 * Akari CLI
 * Copyright (c) 2026 [HvK Okla]
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const akari = require('../index.js'); // <-- L'index à la racine

const VERSION = require('../package.json').version;

// ---------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  magenta:'\x1b[35m',
  cyan:   '\x1b[36m'
};

function color(name, text) {
  return C[name] + text + C.reset;
}

// ---------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------

function printHelp() {
  console.log(`
${color('bold', color('cyan', 'Akari'))} ${color('dim', 'v' + VERSION)}
${color('dim', 'A safe, embeddable scripting language.')}

${color('bold', 'USAGE')}
  akari <command> [options]

${color('bold', 'LANGUAGE')}
  ${color('cyan', 'run')}     <file.akari>       Compile and execute a file
  ${color('cyan', 'build')}   <file.akari>       Compile to JavaScript or SQL
  ${color('cyan', 'check')}   <file.akari>       Check syntax only
  ${color('cyan', 'exec')}    "<code>"           Execute a one-liner
  ${color('cyan', 'repl')}                       Start an interactive REPL

${color('bold', 'TOOLS')}
  ${color('cyan', 'fmt')}     <file.akari>       Format code
  ${color('cyan', 'doc')}     <file.akari>       Generate docs from comments
  ${color('cyan', 'stats')}   <file.akari>       Code statistics

${color('bold', 'DEBUG')}
  ${color('cyan', 'tokens')}  <file.akari>       Show tokens (debug)
  ${color('cyan', 'ast')}     <file.akari>       Show AST (debug)

${color('bold', 'MISC')}
  ${color('cyan', 'version')}                    Show version
  ${color('cyan', 'help')}                       Show this help

${color('bold', 'OPTIONS')}
  ${color('cyan', '-o, --out')} <file>           Output file for 'build'
  ${color('cyan', '--sql')}                      Build to SQL instead of JS
  ${color('cyan', '-w, --watch')}                Auto-reload on file change
  ${color('cyan', '-v, --verbose')}              Verbose mode
  ${color('cyan', '-q, --quiet')}                Quiet mode

${color('bold', 'EXAMPLES')}
  akari run main.akari
  akari build main.akari -o main.js
  akari build query.akari --sql -o query.sql
  akari exec 'say(2 + 2)'
  akari tokens main.akari

${color('dim', 'Learn more: https://github.com/HvKOkla/Akari')}
`);
}

// ---------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------

function requireFile(file) {
  if (!file) {
    console.error(color('red', '✖ Missing file.'));
    console.error(color('dim', `  Usage: akari run <file.akari>`));
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(color('red', `✖ File not found: ${file}`));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------

function cmdRun(args, opts) {
  const file = args[0];
  requireFile(file);

  const execute = () => {
    try {
      const source = fs.readFileSync(file, 'utf-8');
      if (!opts.quiet) console.log(color('dim', `▶ ${file}\n`));
      
      akari.run(source);
      
      if (!opts.quiet) console.log(color('green', `\n✔ OK`));
    } catch (err) {
      const msg = err.toString ? err.toString() : (err.message || String(err));
      console.error(color('red', msg));
      process.exitCode = 1;
    }
  };

  if (opts.watch) {
    console.log(color('cyan', `👁  Watch mode: ${file}`));
    execute();
    console.log(color('dim', `\nWaiting for changes... (Ctrl+C to quit)\n`));
    fs.watchFile(file, { interval: 300 }, () => {
      console.clear();
      console.log(color('cyan', `👁  Change detected at ${new Date().toLocaleTimeString()}\n`));
      execute();
      console.log(color('dim', `\nWaiting for changes...\n`));
    });
  } else {
    execute();
  }
}

// --- NOUVEAU : cmdBuild ---
function cmdBuild(args, opts) {
  const file = args[0];
  requireFile(file);

  const source = fs.readFileSync(file, 'utf-8');

  // Si l'option --sql est passée
  if (opts.sql) {
    try {
      const sql = akari.compileToSQL(source);
      const outFile = opts.out || file.replace('.akari', '.sql');
      
      fs.writeFileSync(outFile, sql, 'utf-8');
      if (!opts.quiet) console.log(color('green', `✔ SQL written to ${outFile}`));
    } catch (err) {
      const msg = err.toString ? err.toString() : (err.message || String(err));
      console.error(color('red', msg));
      process.exit(1);
    }
    return;
  }

  // Sinon, on compile en JavaScript
  try {
    const js = akari.compile(source);
    if (opts.out) {
      fs.writeFileSync(opts.out, js, 'utf-8');
      if (!opts.quiet) console.log(color('green', `✔ JS written to ${opts.out}`));
    } else {
      console.log(js);
    }
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdCheck(args, opts) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const ast = akari.parse(source);
    if (!opts.quiet) {
      console.log(color('green', `✔ ${file} is valid (${ast.length} statements)`));
    }
    process.exit(0);
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdExec(args, opts) {
  const code = args.join(' ');
  if (!code.trim()) {
    console.error(color('red', '✖ Missing code.'));
    console.error(color('dim', `  Usage: akari exec "say(2+2)"`));
    process.exit(1);
  }

  try {
    akari.run(code);
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdRepl() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: color('cyan', 'akari> ')
  });

  console.log(color('bold', `Akari REPL v${VERSION}`));
  console.log(color('dim', 'Type .exit to quit, .help for help.\n'));
  rl.prompt();

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (trimmed === '.exit' || trimmed === '.quit') {
      rl.close();
      return;
    }
    if (trimmed === '.help') {
      console.log('Commands:');
      console.log('  .exit   quit');
      console.log('  .help   this help');
      rl.prompt();
      return;
    }
    if (!trimmed) {
      rl.prompt();
      return;
    }

    try {
      akari.run(line);
    } catch (err) {
      const msg = err.toString ? err.toString() : (err.message || String(err));
      console.error(color('red', msg));
    }
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(color('dim', '\nBye.'));
    process.exit(0);
  });
}

function cmdFmt(args, opts) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const lines = source.split('\n');
    let depth = 0;
    const out = [];

    for (let raw of lines) {
      const line = raw.trim();
      if (!line) { out.push(''); continue; }

      const dedent = /^(end|else\b|catch\b)/.test(line);
      if (dedent && depth > 0) depth--;

      out.push('    '.repeat(depth) + line);

      if (/:\s*$/.test(line)) depth++;
    }

    const formatted = out.join('\n');
    fs.writeFileSync(file, formatted, 'utf-8');
    if (!opts.quiet) console.log(color('green', `✔ ${file} formatted`));
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdTokens(args, opts) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const tokens = akari.tokenize(source);
    if (!opts.quiet) console.log(color('cyan', `Tokens (${tokens.length}):\n`));
    for (const tok of tokens) {
      const pos = color('dim', `[${tok.line}:${tok.col}]`);
      const type = color('yellow', tok.type.padEnd(12));
      const value = JSON.stringify(tok.value);
      console.log(`  ${pos} ${type} ${value}`);
    }
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdAst(args, opts) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const ast = akari.parse(source);
    console.log(JSON.stringify(ast, null, 2));
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdDoc(args, opts) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const lines = source.split('\n');
    const docs = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#') && !line.startsWith('#!')) {
        const comment = line.slice(1).trim();
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j].trim();
          if (!next) continue;
          if (next.startsWith('def ')) {
            const match = next.match(/^def\s+(\w+)\s*\(([^)]*)\)/);
            if (match) {
              docs.push({ comment, name: match[1], params: match[2].trim() || 'none' });
            }
          }
          break;
        }
      }
    }

    if (docs.length === 0) {
      console.log(color('yellow', '⚠ No documented functions.'));
      console.log(color('dim', 'Add a # comment before each def.'));
      process.exit(0);
    }

    console.log(color('cyan', `📖 Documentation: ${file}\n`));
    for (const d of docs) {
      console.log(color('bold', d.name + '(' + d.params + ')'));
      console.log('  ' + d.comment);
      console.log('');
    }
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdStats(args, opts) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const lines = source.split('\n');
    const tokens = akari.tokenize(source);
    const ast = akari.parse(source);

    let functions = 0;
    let comments = 0;
    let blanks = 0;

    for (const line of lines) {
      const t = line.trim();
      if (!t) blanks++;
      else if (t.startsWith('#') || t.startsWith('//')) comments++;
    }
    for (const node of ast) {
      if (node.type === 'function_def') functions++;
    }

    console.log(color('cyan', `📊 Stats: ${file}\n`));
    console.log(`  Lines         : ${color('bold', lines.length)}`);
    console.log(`  Blank lines   : ${blanks}`);
    console.log(`  Comments      : ${comments}`);
    console.log(`  Tokens        : ${tokens.length}`);
    console.log(`  Statements    : ${ast.length}`);
    console.log(`  Functions     : ${functions}`);
    console.log(`  Size          : ${(source.length / 1024).toFixed(2)} KB`);
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { verbose: false, quiet: false, watch: false, sql: false, out: null };
  const args = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-v' || a === '--verbose') opts.verbose = true;
    else if (a === '-q' || a === '--quiet') opts.quiet = true;
    else if (a === '-w' || a === '--watch') opts.watch = true;
    else if (a === '--sql') opts.sql = true;
    else if (a === '-o' || a === '--out') { opts.out = argv[++i]; }
    else if (a === '-h' || a === '--help') { printHelp(); process.exit(0); }
    else if (a === '--version') { console.log(VERSION); process.exit(0); }
    else args.push(a);
  }

  return { args, opts };
}

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = argv[0];
  const rest = argv.slice(1);
  const { args, opts } = parseArgs(rest);

  switch (command) {
    case 'run':     return cmdRun(args, opts);
    case 'build':   return cmdBuild(args, opts); 
    case 'check':   return cmdCheck(args, opts);
    case 'exec':    return cmdExec(args, opts);
    case 'repl':    return cmdRepl();
    case 'fmt':     return cmdFmt(args, opts);
    case 'tokens':  return cmdTokens(args, opts);
    case 'ast':     return cmdAst(args, opts);
    case 'doc':     return cmdDoc(args, opts);
    case 'stats':   return cmdStats(args, opts);
    case 'version': console.log(VERSION); return;
    case 'help':
    case '--help':
    case '-h':      printHelp(); return;
    default: {
      if (command.endsWith('.akari')) {
        return cmdRun([command, ...args], opts);
      }
      console.error(color('red', `✖ Unknown command: ${command}`));
      console.error(color('dim', `  Type 'akari help' for help.`));
      process.exit(1);
    }
  }
}

main();