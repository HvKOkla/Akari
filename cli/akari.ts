#!/usr/bin/env node

import * as fs from 'fs';
import * as readline from 'readline';
import * as path from 'path';
import * as akari from '../index';

// Lecture dynamique de la version depuis package.json
let VERSION = '1.0.0';
try {
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf-8'));
  VERSION = pkg.version;
} catch (e) {}

interface CliOptions {
  verbose: boolean;
  quiet: boolean;
  watch: boolean;
  sql: boolean;
  out: string | null;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

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

function color(name: keyof typeof C, text: string): string {
  return C[name] + text + C.reset;
}

function printBanner() {
  console.log(color('cyan', `
    _    _         _ 
   / \\  | | ____ _(_)
  / _ \\ | |/ / _\` | |
 / ___ \\|   < (_| | |
/_/   \\_\\_|\\_\\__,_|_|
`));
}

function printHelp() {
  printBanner();
  console.log(`  ${color('bold', 'Akari')} ${color('dim', 'v' + VERSION)}`);
  console.log(`  ${color('dim', 'Safe by default. Small by design.')}\n`);

  console.log(`${color('bold', 'USAGE')}`);
  console.log(`  akari <command> [options]\n`);

  console.log(`${color('bold', 'LANGUAGE')}`);
  console.log(`  ${color('cyan', 'run')}     <file.akari>       Compile and execute a file`);
  console.log(`  ${color('cyan', 'build')}   <file.akari>       Compile to JavaScript or SQL`);
  console.log(`  ${color('cyan', 'check')}   <file.akari>       Check syntax only`);
  console.log(`  ${color('cyan', 'exec')}    "<code>"           Execute a one-liner`);
  console.log(`  ${color('cyan', 'repl')}                       Start an interactive REPL\n`);

  console.log(`${color('bold', 'TOOLS')}`);
  console.log(`  ${color('cyan', 'fmt')}     <file.akari>       Format code`);
  console.log(`  ${color('cyan', 'doc')}     <file.akari>       Generate docs from comments`);
  console.log(`  ${color('cyan', 'stats')}   <file.akari>       Code statistics\n`);

  console.log(`${color('bold', 'DEBUG')}`);
  console.log(`  ${color('cyan', 'tokens')}  <file.akari>       Show tokens (debug)`);
  console.log(`  ${color('cyan', 'ast')}     <file.akari>       Show AST (debug)\n`);

  console.log(`${color('bold', 'MISC')}`);
  console.log(`  ${color('cyan', 'version')}                    Show version`);
  console.log(`  ${color('cyan', 'help')}                       Show this help\n`);

  console.log(`${color('dim', 'Learn more: https://github.com/HvKOkla/Akari')}\n`);
}

function requireFile(file?: string) {
  if (!file) {
    console.error(color('red', '✖ Missing file.'));
    console.error(color('dim', `  Usage: akari run <file.akari>`));
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(color('red', `✖ File not found: ${file}`));
    process.exit(1);
  }
  // SÉCURITÉ : Limite de taille de fichier (1 Mo max)
  const stats = fs.statSync(file);
  if (stats.size > 1024 * 1024) {
    console.error(color('red', '✖ File too large (max 1MB).'));
    process.exit(1);
  }
}

async function cmdRun(args: string[], opts: CliOptions) {
  const file = args[0];
  requireFile(file);

  const execute = async () => {
    try {
      const source = fs.readFileSync(file, 'utf-8');
      if (!opts.quiet) console.log(color('dim', `▶ ${file}\n`));
      
      // SÉCURITÉ : On utilise le Sandbox avec le Worker et on autorise say
      const engine = new akari.Akari({ allow: ['say'], timeout: 1000 });
      await engine.run(source);
      
      if (!opts.quiet) console.log(color('green', `\n✔ OK`));
    } catch (err) {
      const msg = getErrorMessage(err);
      console.error(color('red', msg));
      process.exitCode = 1;
    }
  };

  if (opts.watch) {
    console.log(color('cyan', `👁  Watch mode: ${file}`));
    await execute();
    console.log(color('dim', `\nWaiting for changes... (Ctrl+C to quit)\n`));
    fs.watchFile(file, { interval: 300 }, async () => {
      console.clear();
      console.log(color('cyan', `👁  Change detected at ${new Date().toLocaleTimeString()}\n`));
      await execute();
      console.log(color('dim', `\nWaiting for changes...\n`));
    });
  } else {
    await execute();
  }
}

function cmdBuild(args: string[], opts: CliOptions) {
  const file = args[0];
  requireFile(file);

  const source = fs.readFileSync(file, 'utf-8');

  if (opts.sql) {
    try {
      const sql = akari.compileToSQL(source);
      const outFile = opts.out || file.replace('.akari', '.sql');
      
      fs.writeFileSync(outFile, sql, 'utf-8');
      if (!opts.quiet) console.log(color('green', `✔ SQL written to ${outFile}`));
    } catch (err) {
      const msg = getErrorMessage(err);
      console.error(color('red', msg));
      process.exit(1);
    }
    return;
  }

  try {
    const js = akari.compile(source);
    if (opts.out) {
      fs.writeFileSync(opts.out, js, 'utf-8');
      if (!opts.quiet) console.log(color('green', `✔ JS written to ${opts.out}`));
    } else {
      console.log(js);
    }
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdCheck(args: string[], opts: CliOptions) {
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
    const msg = getErrorMessage(err);
    console.error(color('red', msg));
    process.exit(1);
  }
}

async function cmdExec(args: string[], opts: CliOptions) {
  const code = args.join(' ');
  if (!code.trim()) {
    console.error(color('red', '✖ Missing code.'));
    console.error(color('dim', `  Usage: akari exec "say(2+2)"`));
    process.exit(1);
  }

  try {
    const engine = new akari.Akari({ allow: ['say'], timeout: 1000 });
    await engine.run(code);
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdRepl() {
  printBanner();
  console.log(`  ${color('bold', 'Akari REPL')} ${color('dim', 'v' + VERSION)}`);
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: color('cyan', 'akari> ')
  });

  console.log(color('dim', 'Type .exit to quit, .help for help.\n'));
  rl.prompt();

  rl.on('line', async (line: string) => {
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
      const engine = new akari.Akari({ allow: ['say'], timeout: 1000 });
      await engine.run(line);
    } catch (err) {
      const msg = getErrorMessage(err);
      console.error(color('red', msg));
    }
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(color('dim', '\nBye.'));
    process.exit(0);
  });
}

function cmdFmt(args: string[], opts: CliOptions) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const lines = source.split('\n');
    let depth = 0;
    const out: string[] = [];

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
    const msg = getErrorMessage(err);
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdTokens(args: string[], opts: CliOptions) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const tokens = akari.tokenize(source);
    if (!opts.quiet) console.log(color('cyan', `Tokens (${tokens.length}):\n`));
    for (const tok of tokens) {
      const pos = color('dim', `[${(tok as any).line}:${(tok as any).col}]`);
      const type = color('yellow', (tok as any).type.padEnd(12));
      const value = JSON.stringify((tok as any).value);
      console.log(`  ${pos} ${type} ${value}`);
    }
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdAst(args: string[], opts: CliOptions) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const ast = akari.parse(source);
    console.log(JSON.stringify(ast, null, 2));
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdDoc(args: string[], opts: CliOptions) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const lines = source.split('\n');
    const docs: { comment: string, name: string, params: string }[] = [];

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
    const msg = getErrorMessage(err);
    console.error(color('red', msg));
    process.exit(1);
  }
}

function cmdStats(args: string[], opts: CliOptions) {
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
      if ((node as any).type === 'function_def') functions++;
    }

    console.log(color('cyan', `📊 Stats: ${file}\n`));
    console.log(`  Lines         : ${color('bold', String(lines.length))}`);
    console.log(`  Blank lines   : ${blanks}`);
    console.log(`  Comments      : ${comments}`);
    console.log(`  Tokens        : ${tokens.length}`);
    console.log(`  Statements    : ${ast.length}`);
    console.log(`  Functions     : ${functions}`);
    console.log(`  Size          : ${(source.length / 1024).toFixed(2)} KB`);
  } catch (err) {
    const msg = getErrorMessage(err);
    console.error(color('red', msg));
    process.exit(1);
  }
}

function parseArgs(argv: string[]): { args: string[], opts: CliOptions } {
  const opts: CliOptions = { verbose: false, quiet: false, watch: false, sql: false, out: null };
  const args: string[] = [];

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

async function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0) {
    printHelp();
    process.exit(0);
  }

  const command = argv[0];
  const rest = argv.slice(1);
  const { args, opts } = parseArgs(rest);

  switch (command) {
    case 'run':     await cmdRun(args, opts); break;
    case 'build':   cmdBuild(args, opts); break; 
    case 'check':   cmdCheck(args, opts); break;
    case 'exec':    await cmdExec(args, opts); break;
    case 'repl':    cmdRepl(); break;
    case 'fmt':     cmdFmt(args, opts); break;
    case 'tokens':  cmdTokens(args, opts); break;
    case 'ast':     cmdAst(args, opts); break;
    case 'doc':     cmdDoc(args, opts); break;
    case 'stats':   cmdStats(args, opts); break;
    case 'version': console.log(VERSION); break;
    case 'help':
    case '--help':
    case '-h':      printHelp(); break;
    default: {
      if (command.endsWith('.akari')) {
        await cmdRun([command, ...args], opts);
      } else {
        console.error(color('red', `✖ Unknown command: ${command}`));
        console.error(color('dim', `  Type 'akari help' for help.`));
        process.exit(1);
      }
    }
  }
}

main();