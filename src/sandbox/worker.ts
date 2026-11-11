import { parentPort, workerData } from 'worker_threads';
import * as vm from 'vm';

interface WorkerInput {
    code: string;
    allowedFunctions: Record<string, string>;
    timeout: number;
}

const { code, allowedFunctions, timeout } = workerData as WorkerInput;

const sandbox: Record<string, any> = Object.create(null);

// --- SÉCURITÉ : On bloque les accès au système ---
sandbox.process = undefined;
sandbox.require = undefined;
sandbox.module = undefined;
sandbox.globalThis = undefined;
sandbox.window = undefined;
sandbox.global = undefined;
sandbox.exports = undefined;
sandbox.__dirname = undefined;
sandbox.__filename = undefined;

// --- NOUVEAU : On expose les fonctions natives (Builtins) ---
sandbox.toText = (v: any) => String(v);
sandbox.toNumber = (v: any) => Number(v);
sandbox.kind = (v: any) => {
    if (v === null || v === undefined) return 'nothing';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') return 'string';
    if (typeof v === 'boolean') return 'boolean';
    if (Array.isArray(v)) return 'list';
    if (typeof v === 'object') return 'table';
    return 'unknown';
};
sandbox.sqrt = Math.sqrt;
sandbox.pow = Math.pow;
sandbox.abs = Math.abs;
sandbox.floor = Math.floor;
sandbox.ceil = Math.ceil;
sandbox.round = Math.round;
sandbox.min = Math.min;
sandbox.max = Math.max;
sandbox.random = Math.random;
// -----------------------------------------------------------

const capturedLogs: string[] = [];
const originalLog = console.log;
console.log = (...args: any[]) => {
    capturedLogs.push(args.join(' '));
};


for (const [name, fnString] of Object.entries(allowedFunctions)) {
    try {
        sandbox[name] = eval(fnString);
    } catch (e) {
        sandbox[name] = () => { throw new Error(`Failed to load exposed function '${name}'`); };
    }
}


Object.freeze(sandbox);

const context = vm.createContext(sandbox);

try {
    const script = new vm.Script(code);
    const result = script.runInContext(context, {
        timeout: timeout,
        displayErrors: false
    });
    if (parentPort) parentPort.postMessage({ success: true, result, logs: capturedLogs });
} catch (error: any) {
    if (parentPort) parentPort.postMessage({ success: false, error: error.message, logs: capturedLogs });
} finally {
    console.log = originalLog;
}