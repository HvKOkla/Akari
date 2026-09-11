#!/usr/bin/env node
/*
 * Akari CLI
 * Copyright (c) 2026 [HvK Okla]
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

const fs = require('fs');
const path = require('path');
const akari = require('../src/index.js');

const VERSION = require('../package.json').version;

// ---------------------------------------------------------------------
// Couleurs
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
// Aide
// ---------------------------------------------------------------------

function printHelp() {
  console.log(`
${color('bold', color('cyan', 'Akari'))} ${color('dim', 'v' + VERSION)}
${color('dim', 'A teaching language in 18 keywords.')}

${color('bold', 'USAGE')}
  akari <command> [options]

${color('bold', 'LANGAGE')}
  ${color('cyan', 'run')}     <file.akari>       Compile et exécute un fichier
  ${color('cyan', 'build')}   <file.akari>       Compile vers JavaScript
  ${color('cyan', 'check')}   <file.akari>       Vérifie la syntaxe
  ${color('cyan', 'exec')}    "<code>"           Exécute une ligne
  ${color('cyan', 'repl')}                       Démarre un REPL interactif
  ${color('cyan', 'init')}    [nom]              Crée un nouveau projet

${color('bold', 'OUTILS')}
  ${color('cyan', 'fmt')}     <file.akari>       Formate le code
  ${color('cyan', 'test')}    [dossier]          Lance les tests
  ${color('cyan', 'doc')}     <file.akari>       Génère la doc depuis les commentaires
  ${color('cyan', 'stats')}   <file.akari>       Statistiques du code

${color('bold', 'DEBUG')}
  ${color('cyan', 'tokens')}  <file.akari>       Affiche les tokens (debug)
  ${color('cyan', 'ast')}     <file.akari>       Affiche l'AST (debug)

${color('bold', 'DIVERS')}
  ${color('cyan', 'version')}                    Affiche la version
  ${color('cyan', 'help')}                       Affiche cette aide

${color('bold', 'OPTIONS')}
  ${color('cyan', '-o, --out')} <file>           Fichier de sortie pour 'build'
  ${color('cyan', '-w, --watch')}                Relance auto à chaque modif
  ${color('cyan', '-v, --verbose')}              Mode verbeux
  ${color('cyan', '-q, --quiet')}                Mode silencieux

${color('bold', 'EXEMPLES')}
  akari init mon_projet
  akari run main.akari
  akari run --watch main.akari
  akari build main.akari -o main.js
  akari exec 'say(2 + 2)'
  akari fmt main.akari
  akari test
  akari tokens main.akari
  akari ast main.akari

${color('dim', 'Learn more: https://codeberg.org/HvK_Okla/Akari')}
`);
}

// ---------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------

function requireFile(file) {
  if (!file) {
    console.error(color('red', '✖ Fichier manquant.'));
    console.error(color('dim', `  Usage : akari run <file.akari>`));
    process.exit(1);
  }
  if (!fs.existsSync(file)) {
    console.error(color('red', `✖ Fichier introuvable : ${file}`));
    process.exit(1);
  }
}

function runJS(js, quiet = false) {
  const runner = new Function('"use strict";\n' + js);
  runner();
}

function captureOutput(fn) {
  const out = [];
  const origLog = console.log;
  const origWarn = console.warn;
  const origErr = console.error;
  console.log = (...a) => out.push(a.join(' '));
  console.warn = (...a) => out.push('⚠ ' + a.join(' '));
  console.error = (...a) => out.push('✖ ' + a.join(' '));
  try {
    fn();
  } finally {
    console.log = origLog;
    console.warn = origWarn;
    console.error = origErr;
  }
  return out;
}

// ---------------------------------------------------------------------
// run
// ---------------------------------------------------------------------

function cmdRun(args, opts) {
  const file = args[0];
  requireFile(file);

  const execute = () => {
    try {
      const js = akari.bundleAndTranspile(file, { verbose: opts.verbose });
      if (!opts.quiet) console.log(color('dim', `▶ ${file}\n`));
      runJS(js);
      if (!opts.quiet) console.log(color('green', `\n✔ OK`));
    } catch (err) {
      const msg = err.toString ? err.toString() : (err.message || String(err));
      console.error(color('red', msg));
    }
  };

  if (opts.watch) {
    console.log(color('cyan', `👁  Watch mode : ${file}`));
    execute();
    console.log(color('dim', `\nEn attente de modifications… (Ctrl+C pour quitter)\n`));
    fs.watchFile(file, { interval: 300 }, () => {
      console.clear();
      console.log(color('cyan', `👁  Changement détecté à ${new Date().toLocaleTimeString()}\n`));
      execute();
      console.log(color('dim', `\nEn attente de modifications…\n`));
    });
  } else {
    execute();
  }
}

// ---------------------------------------------------------------------
// build
// ---------------------------------------------------------------------

function cmdBuild(args, opts) {
  const file = args[0];
  requireFile(file);

  if (!opts.quiet) console.log(color('dim', `⚙ Compilation de ${file}…`));

  try {
    const js = akari.bundleAndTranspile(file, { verbose: opts.verbose });

    if (opts.out) {
      fs.writeFileSync(opts.out, js, 'utf-8');
      if (!opts.quiet) {
        const size = (js.length / 1024).toFixed(1);
        console.log(color('green', `✔ Écrit dans ${opts.out} (${size} KB)`));
      }
    } else {
      process.stdout.write(js);
    }
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// check
// ---------------------------------------------------------------------

function cmdCheck(args, opts) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const ast = akari.parse(source);
    if (!opts.quiet) {
      console.log(color('green', `✔ ${file} est valide (${ast.length} statements)`));
    }
    process.exit(0);
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// exec
// ---------------------------------------------------------------------

function cmdExec(args, opts) {
  const code = args.join(' ');
  if (!code.trim()) {
    console.error(color('red', '✖ Code manquant.'));
    console.error(color('dim', `  Usage : akari exec "say(2+2)"`));
    process.exit(1);
  }

  try {
    const js = akari.compile(code);
    runJS(js);
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// repl
// ---------------------------------------------------------------------

function cmdRepl() {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: color('cyan', 'akari> ')
  });

  console.log(color('bold', `Akari REPL v${VERSION}`));
  console.log(color('dim', 'Tape .exit pour quitter, .help pour l\'aide.\n'));
  rl.prompt();

  rl.on('line', (line) => {
    const trimmed = line.trim();
    if (trimmed === '.exit' || trimmed === '.quit') {
      rl.close();
      return;
    }
    if (trimmed === '.help') {
      console.log('Commandes :');
      console.log('  .exit   quitter');
      console.log('  .help   cette aide');
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

// ---------------------------------------------------------------------
// init
// ---------------------------------------------------------------------

function cmdInit(args, opts) {
  const projectName = args[0] || 'akari-project';
  const dir = path.resolve(projectName);

  if (fs.existsSync(dir)) {
    console.error(color('red', `✖ Le dossier '${projectName}' existe déjà.`));
    process.exit(1);
  }

  console.log(color('cyan', `⚙ Création du projet '${projectName}'…\n`));

  fs.mkdirSync(dir);
  fs.mkdirSync(path.join(dir, 'src'));

  // main.akari
  fs.writeFileSync(path.join(dir, 'main.akari'), `# ${projectName}
# Lance avec : akari run main.akari

say("Bonjour depuis ${projectName} !")

def square(n):
    return n * n
end

say("2² = " + toText(square(2)))
`, 'utf-8');

  // README
  fs.writeFileSync(path.join(dir, 'README.md'), `# ${projectName}

Un projet Akari.

## Lancer

\`\`\`bash
akari run main.akari
\`\`\`
`, 'utf-8');

  // .gitignore
  fs.writeFileSync(path.join(dir, '.gitignore'), `node_modules/
*.js
!src/*.js
`, 'utf-8');

  console.log(color('green', '✔ Projet créé :'));
  console.log(color('dim', `  ${projectName}/`));
  console.log(color('dim', `  ├── main.akari`));
  console.log(color('dim', `  ├── README.md`));
  console.log(color('dim', `  └── .gitignore`));
  console.log('');
  console.log(color('cyan', 'Prochaines étapes :'));
  console.log(color('dim', `  cd ${projectName}`));
  console.log(color('dim', `  akari run main.akari`));
}

// ---------------------------------------------------------------------
// fmt
// ---------------------------------------------------------------------

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
    if (!opts.quiet) console.log(color('green', `✔ ${file} formaté`));
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// tokens
// ---------------------------------------------------------------------

function cmdTokens(args, opts) {
  const file = args[0];
  requireFile(file);

  try {
    const source = fs.readFileSync(file, 'utf-8');
    const tokens = akari.tokenize(source);
    if (!opts.quiet) console.log(color('cyan', `Tokens (${tokens.length}) :\n`));
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

// ---------------------------------------------------------------------
// ast
// ---------------------------------------------------------------------

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

// ---------------------------------------------------------------------
// test
// ---------------------------------------------------------------------

function cmdTest(args, opts) {
  const dir = args[0] || './tests';

  if (!fs.existsSync(dir)) {
    console.error(color('red', `✖ Dossier '${dir}' introuvable.`));
    process.exit(1);
  }

  const files = fs.readdirSync(dir)
    .filter(f => f.endsWith('.akari'))
    .map(f => path.join(dir, f));

  if (files.length === 0) {
    console.error(color('yellow', `⚠ Aucun fichier .akari dans '${dir}'.`));
    process.exit(1);
  }

  console.log(color('cyan', `🧪 Test : ${files.length} fichier(s) dans '${dir}'\n`));

  let passed = 0;
  let failed = 0;

  for (const file of files) {
    const name = path.basename(file);
    try {
      const js = akari.bundleAndTranspile(file);
      runJS(js);
      console.log(color('green', `✔ ${name}`));
      passed++;
    } catch (err) {
      console.log(color('red', `✖ ${name}`));
      console.log(color('dim', `  ${err.message || err}`));
      failed++;
    }
  }

  console.log('');
  if (failed === 0) {
    console.log(color('green', `✔ ${passed} fichier(s) valide(s).`));
    process.exit(0);
  } else {
    console.log(color('red', `✖ ${failed} fichier(s) échoué(s), ${passed} valide(s).`));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// doc
// ---------------------------------------------------------------------

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
        // Look ahead pour voir si la prochaine ligne non-vide est un def
        for (let j = i + 1; j < lines.length; j++) {
          const next = lines[j].trim();
          if (!next) continue;
          if (next.startsWith('def ')) {
            const match = next.match(/^def\s+(\w+)\s*\(([^)]*)\)/);
            if (match) {
              docs.push({ comment, name: match[1], params: match[2].trim() || 'aucun' });
            }
          }
          break;
        }
      }
    }

    if (docs.length === 0) {
      console.log(color('yellow', '⚠ Aucune fonction documentée.'));
      console.log(color('dim', 'Ajoute un commentaire # avant chaque def.'));
      process.exit(0);
    }

    console.log(color('cyan', `📖 Documentation : ${file}\n`));
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

// ---------------------------------------------------------------------
// stats
// ---------------------------------------------------------------------

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

    console.log(color('cyan', `📊 Statistiques : ${file}\n`));
    console.log(`  Lignes         : ${color('bold', lines.length)}`);
    console.log(`  Lignes vides   : ${blanks}`);
    console.log(`  Commentaires   : ${comments}`);
    console.log(`  Tokens         : ${tokens.length}`);
    console.log(`  Statements     : ${ast.length}`);
    console.log(`  Fonctions      : ${functions}`);
    console.log(`  Taille         : ${(source.length / 1024).toFixed(2)} KB`);
  } catch (err) {
    const msg = err.toString ? err.toString() : (err.message || String(err));
    console.error(color('red', msg));
    process.exit(1);
  }
}

// ---------------------------------------------------------------------
// Parsing des arguments
// ---------------------------------------------------------------------

function parseArgs(argv) {
  const opts = { verbose: false, quiet: false, out: null, watch: false };
  const args = [];

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-v' || a === '--verbose') opts.verbose = true;
    else if (a === '-q' || a === '--quiet') opts.quiet = true;
    else if (a === '-w' || a === '--watch') opts.watch = true;
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
    case 'init':    return cmdInit(args, opts);
    case 'fmt':     return cmdFmt(args, opts);
    case 'tokens':  return cmdTokens(args, opts);
    case 'ast':     return cmdAst(args, opts);
    case 'test':    return cmdTest(args, opts);
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
      console.error(color('red', `✖ Commande inconnue : ${command}`));
      console.error(color('dim', `  Tape 'akari help' pour l'aide.`));
      process.exit(1);
    }
  }
}

main();