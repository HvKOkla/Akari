/*
 * Akari VM (v0.1) — LEGACY
 * 
 * This was the original stack-based virtual machine. 
 * It was replaced in v0.5.0 by the flat transpiler architecture 
 * for better safety, easier error handling, and native function scopes.
 * 
 * Do not use this in production. It is kept for historical reference only.
 */

class AkariVM {
    constructor() {
        this.s = [];       // Stack
        this.v = {};       // Variables
        this.f = {};       // Functions
        this.pc = 0;       // Program counter
        this.i = [];       // Instructions
        this.o = [];       // Output
        this.loops = [];
        this.line = 0;     
    }

    error(msg, instr, suggestion = '') {
        const line = instr?.line || this.line || '?';
        let full = `❌ Error: ${msg}`;
        full += `\n→ Line ${line}`;
        if (suggestion) full += `\n→ ${suggestion}`;
        throw new Error(full);
    }

    run(instructions) {
        this.i = instructions;
        this.pc = 0;
        this.s = [];
        this.v = {};
        this.o = [];
        this.loops = [];

        while (this.pc < this.i.length) {
            const instr = this.i[this.pc];
            this.line = instr?.line || this.line;
            
            try {
                this.exec(instr);
            } catch (e) {
                if (e.message && e.message.includes('Error:')) throw e;
                throw this.error(e.message || 'internal error', instr, 'Check your code');
            }
            this.pc++;
        }
        return this.o.join('\n');
    }

    exec(instr) {
        const op = instr.op;

        if (op === 'say') {
            const val = this.s.pop();
            if (val === undefined) {
                this.o.push('');
            } else {
                this.o.push(String(val));
            }
        }
        else if (op === 'push') this.s.push(instr.value);
        
        else if (op === 'store') {
            // SECURITY: Validate variable name
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(instr.name)) {
                return this.error(`invalid variable name: '${instr.name}'`, instr, 'Use letters, numbers, and underscores only.');
            }
            const val = this.s.pop();
            if (val === undefined) return this.error(`cannot store variable '${instr.name}' (stack is empty)`, instr, 'Did you forget to push a value?');
            this.v[instr.name] = val;
        }
        else if (op === 'load') {
            // SECURITY: Validate variable name
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(instr.name)) {
                return this.error(`invalid variable name: '${instr.name}'`, instr, 'Use letters, numbers, and underscores only.');
            }
            const val = this.v[instr.name];
            if (val === undefined) return this.error(`variable '${instr.name}' is not defined`, instr, 'Did you define it before using it? (e.g. x = 5)');
            this.s.push(val);
        }
        else if (op === 'add') {
            const b = this.s.pop();
            const a = this.s.pop();
            if (a === undefined || b === undefined) return this.error('not enough values to add', instr, 'You need two values on the stack');
            this.s.push(a + b);
        }
        else if (op === 'sub') {
            const b = this.s.pop();
            const a = this.s.pop();
            if (a === undefined || b === undefined) return this.error('not enough values to subtract', instr, 'You need two values on the stack');
            this.s.push(a - b);
        }
        else if (op === 'mul') {
            const b = this.s.pop();
            const a = this.s.pop();
            if (a === undefined || b === undefined) return this.error('not enough values to multiply', instr, 'You need two values on the stack');
            this.s.push(a * b);
        }
        else if (op === 'div') {
            const b = this.s.pop();
            const a = this.s.pop();
            if (a === undefined || b === undefined) return this.error('not enough values to divide', instr, 'You need two values on the stack');
            if (b === 0) return this.error('cannot divide by zero', instr, 'Make sure the divisor is not zero');
            this.s.push(a / b);
        }
        else if (op === 'eq') {
            const b = this.s.pop();
            const a = this.s.pop();
            this.s.push(a === b);
        }
        else if (op === 'neq') {
            const b = this.s.pop();
            const a = this.s.pop();
            this.s.push(a !== b);
        }
        else if (op === 'gt') {
            const b = this.s.pop();
            const a = this.s.pop();
            this.s.push(a > b);
        }
        else if (op === 'lt') {
            const b = this.s.pop();
            const a = this.s.pop();
            this.s.push(a < b);
        }
        else if (op === 'gte') {
            const b = this.s.pop();
            const a = this.s.pop();
            this.s.push(a >= b);
        }
        else if (op === 'lte') {
            const b = this.s.pop();
            const a = this.s.pop();
            this.s.push(a <= b);
        }
        else if (op === 'neg') {
            const a = this.s.pop();
            if (a === undefined) return this.error('nothing to negate', instr);
            this.s.push(-a);
        }
        else if (op === 'not') {
            const a = this.s.pop();
            this.s.push(!a);
        }
        else if (op === 'if') {
            const cond = this.s.pop();
            if (cond === undefined) return this.error('if condition is empty', instr, 'Make sure you have a condition');
            if (!cond) this.pc = instr.skipTo - 1;
        }
        else if (op === 'jump') {
            this.pc = instr.target - 1;
        }
        else if (op === 'stop') {
            if (this.loops.length === 0) return this.error('stop outside of loop', instr, 'Use stop only inside a loop');
            this.loops.pop();
            this.pc = instr.skipTo || this.i.length;
        }
        else if (op === 'skip') {
            if (this.loops.length === 0) return this.error('skip outside of loop', instr, 'Use skip only inside a loop');
            this.pc = this.loops[this.loops.length - 1]?.skipTo || this.pc;
        }
        else if (op === 'def') {
            this.f[instr.name] = { params: instr.params || [], body: instr.body || [] };
        }
        else if (op === 'call') {
            const fn = this.f[instr.name];
            if (!fn) return this.error(`function '${instr.name}' is not defined`, instr, `Did you define it with 'def ${instr.name}'?`);
            
            // SCOPE FIX: Save global variables before calling the function
            const savedVars = { ...this.v };
            
            for (const sub of fn.body) this.exec(sub);
            
            // Restore global variables (local scope disappears)
            this.v = savedVars;
        }
        else if (op === 'random') {
            const max = this.s.pop() || 1;
            const min = this.s.pop() || 0;
            this.s.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        else if (op === 'ask') {
            const msg = this.s.pop();
            const question = (msg === undefined || msg === null || msg === '') ? '' : String(msg);
            let answer = '';
            // Browser
            if (typeof prompt === 'function') {
                answer = prompt(question);
                if (answer === null) answer = '';
            }
            // Node.js (fallback)
            else if (typeof process !== 'undefined' && process.stdin) {
                answer = '';
                if (typeof console !== 'undefined') {
                    console.log('[ask] ' + question + ' (input not available in this environment)');
                }
            }
            this.s.push(answer);
        }
        else if (op === 'toNumber') {
            const val = this.s.pop();
            if (val === undefined || val === null || val === '') {
                this.s.push(0);
            } else {
                const n = Number(val);
                if (Number.isNaN(n)) {
                    return this.error(
                        `cannot convert '${val}' to number`,
                        instr,
                        'Use a value like "42" or 42'
                    );
                }
                this.s.push(n);
            }
        }
        else if (op === 'toText') {
            const val = this.s.pop();
            if (val === undefined || val === null) {
                this.s.push('');
            } else {
                this.s.push(String(val));
            }
        }
        else if (op === 'kind') {
            const val = this.s.pop();
            if (val === null || val === undefined) {
                this.s.push('nothing');
            } else if (typeof val === 'number') {
                this.s.push('number');
            } else if (typeof val === 'string') {
                this.s.push('text');
            } else if (typeof val === 'boolean') {
                this.s.push('boolean');
            } else {
                this.s.push('unknown');
            }
        }
        else {
            return this.error(`unknown instruction: ${op}`, instr, 'Check your spelling or syntax');
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AkariVM };
} else {
    window.AkariVM = AkariVM;
}