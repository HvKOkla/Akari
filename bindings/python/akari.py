import subprocess
import json
import os

class Akari:
    def __init__(self, allow=['say'], timeout=1000):
        self.allow = allow
        self.timeout = timeout
        # On cherche le dossier racine d'Akari (deux niveaux au-dessus)
        self.engine_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

    def run(self, code):
        # On prépare le script Node.js
        js_runner = f"""
        const {{ Akari }} = require('./dist/index.js');
        (async () => {{
            const engine = new Akari({{ allow: {json.dumps(self.allow)}, timeout: {self.timeout} }});
            await engine.run({json.dumps(code)});
        }})().catch(err => {{
            console.error(err.message);
            process.exit(1);
        }});
        """
        
        # On lance Node.js
        result = subprocess.run(
            ['node', '-e', js_runner], 
            cwd=self.engine_path,
            capture_output=True, 
            text=True
        )
        
        # Si Node.js a planté, on lève une erreur Python
        if result.returncode != 0:
            raise Exception(f"Erreur Akari: {result.stderr.strip()}")
        
        # SÉCURITÉ / AFFICHAGE : On récupère la sortie de Node.js
        output = result.stdout.strip()
        
        # On l'affiche dans le terminal Python (pour que tu voies le "say")
        if output:
            print(output)
            
        return output