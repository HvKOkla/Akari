const { bundleAndTranspile } = require('../src/bundler.js');
const fs = require('fs');
const path = require('path');

const testFile = path.join(__dirname, '..', 'std_akari', '_test_vecteurs.akari');

const code = `
import "maths/vecteurs"

let a = vec2(3, 4)
let b = vec2(1, 2)

say(dot2(a, b))           # 11
say(lengthSq2(a))         # 25
say(length2(a))           # 5
say(distance2(a, b))      # sqrt(8) = 2.828...
say(add2(a, b)[0])        # 4
say(sub2(a, b)[0])        # 2
say(scale2(a, 2)[0])      # 6

let n = normalize2(a)
say(n[0])                 # 0.6
say(n[1])                 # 0.8

let c = vec3(1, 0, 0)
let d = vec3(0, 1, 0)
say(cross3(c, d)[2])      # 1
`;

fs.writeFileSync(testFile, code, 'utf-8');

try {
    const js = bundleAndTranspile(testFile);
    eval(js);
} catch (err) {
    console.error('❌ Erreur :', err.message || err);
    if (err.toString) console.error(err.toString());
} finally {
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
}