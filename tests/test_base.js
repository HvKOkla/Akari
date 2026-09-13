// tests/test_base.js
const { bundleAndTranspile } = require('../src/bundler.js');
const fs = require('fs');
const path = require('path');

// Crée un fichier Akari temporaire dans std_akari pour tester
const testFile = path.join(__dirname, '..', 'std_akari', '_test_base.akari');

const code = `
import "maths/base"

say(positive(-5))
say(clamp(15, 0, 10))
say(max(5, 10))
say(min(5, 10))
say(round(3.6))
say(sign(-7))
say(percent(20, 200))
say(lerp(0, 100, 0.5))
say(smoothstep(0.5))
say(map(50, 0, 100, 0, 1))
say(square(5))
say(cube(3))
say(isEven(4))
say(isOdd(5))
say(gcd(48, 18))
say(lcm(4, 6))
say(factorial(5))
say(fib(10))
say(degToRad(180))
`;

fs.writeFileSync(testFile, code, 'utf-8');

try {
    const js = bundleAndTranspile(testFile);
    eval(js);
} catch (err) {
    console.error('❌ Erreur :', err.message || err);
    if (err.toString) console.error(err.toString());
} finally {
    // Nettoie le fichier temporaire
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
}