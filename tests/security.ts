// @ts-nocheck

'use strict';
const akari = require('../index.js');

async function runSecurityTests() {
    const { Akari } = akari;
    let pass = 0, fail = 0;

    // Fonction pour tester une attaque
    const attack = async (name, code) => {
        try {
            const engine = new Akari({ allow: ['say'], timeout: 100 });
            await engine.run(code);
            
            // Si on arrive ici, le hack a réussi. C'EST UNE CATASTROPHE.
            console.log(`✖ FAILLE CRITIQUE : ${name}`);
            fail++;
        } catch (e) {
            // On accepte tous les messages qui prouvent que l'attaque a été bloquée
            const isBlocked = /forbidden|not allowed|ParseError|timeout|Loop too long|Expected 'identifier'/i.test(e.message);
            
            if (isBlocked) {
                console.log(`✔ ${name}`);
                pass++;
            } else {
                console.log(`✖ ${name} (erreur inattendue: ${e.message})`);
                fail++;
            }
        }
    };

    console.log('Running Red Team Security Tests...\n');

    // 1. Accès aux variables globales
    await attack('Accès à process', 'let x = process');
    await attack('Accès à require', 'let x = require');
    await attack('Accès à eval', 'let x = eval');
    
    // 2. Prototype Pollution
    await attack('Accès à constructor', 'let x = say.constructor');
    await attack('Accès à __proto__', 'let x = say.__proto__');
    
    // 3. Déni de service (Boucles infinies)
    await attack('Boucle infinie (while)', 'while true:\nend');
    await attack('Boucle infinie (for)', 'for i in 0..10000000:\nend');
    
    // 4. Injection de code JS via la syntaxe
    await attack('Tentative d\'injection JS', 'let x = say.constructor("return process")()');

    console.log(`\n${pass} attaques bloquées, ${fail} failles.`);
    process.exit(fail ? 1 : 0);
}

runSecurityTests();