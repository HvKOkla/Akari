const fs = require('fs');
const path = require('path');
const { run } = require('../../index.js');

const dir = __dirname;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.akari'));

let passed = 0;
let failed = 0;

// Fonction magique pour nettoyer la sortie
function cleanOutput(str) {
    return str.split('\n').map(line => line.trim()).filter(line => line.length > 0).join('\n');
}

console.log('Running conformance tests...\n');

for (const file of files) {
    const akariFile = path.join(dir, file);
    const baseName = file.replace('.akari', '');
    const expectedOutFile = path.join(dir, baseName + '.stdout');
    const expectedErrFile = path.join(dir, baseName + '.stderr');

    const captured = [];
    const origLog = console.log;
    console.log = (...args) => captured.push(args.join(' '));

    let errMsg = '';

    try {
        const source = fs.readFileSync(akariFile, 'utf8');
        run(source);
        
        console.log = origLog;
        
        const output = cleanOutput(captured.join('\n'));

        if (fs.existsSync(expectedOutFile)) {
            const expected = cleanOutput(fs.readFileSync(expectedOutFile, 'utf8'));
            if (output === expected) {
                console.log('✔ ' + file);
                passed++;
            } else {
                console.log('✖ ' + file + ' (wrong output)');
                console.log('  Expected:\n' + expected);
                console.log('  Got:\n' + output);
                failed++;
            }
        } else {
            console.log('✖ ' + file + ' (expected .stdout missing)');
            failed++;
        }
    } catch (err) {
        console.log = origLog;
        errMsg = err.message || String(err);
        
        if (fs.existsSync(expectedErrFile)) {
            const expected = fs.readFileSync(expectedErrFile, 'utf8').trim();
            
            if (errMsg.includes(expected)) {
                console.log('✔ ' + file + ' (expected error caught)');
                passed++;
            } else {
                console.log('✖ ' + file + ' (wrong error message)');
                console.log('  Expected: ' + expected);
                console.log('  Got:      ' + errMsg);
                failed++;
            }
        } else {
            console.log('✖ ' + file + ' (unexpected error)');
            console.log(errMsg);
            failed++;
        }
    }
}

console.log(`\n${passed} passed, ${failed} failed.`);
if (failed > 0) process.exit(1);