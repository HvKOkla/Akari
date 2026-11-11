import { parentPort, workerData } from 'worker_threads';
import * as vm from 'vm';

interface WorkerInput {
    code: string;
    allowedFunctions: Record<string, string>;
    timeout: number;
}

const { code, allowedFunctions, timeout } = workerData as WorkerInput;

const sandbox: Record<string, any> = Object.create(null);
sandbox.process = undefined;
sandbox.require = undefined;
sandbox.module = undefined;
sandbox.globalThis = undefined;
sandbox.window = undefined;

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