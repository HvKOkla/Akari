const { parentPort, workerData } = require('worker_threads');
const vm = require('vm');

const { code, allowedFunctions, timeout } = workerData;

const sandbox = Object.create(null);
sandbox.process = undefined;
sandbox.require = undefined;
sandbox.module = undefined;
sandbox.globalThis = undefined;
sandbox.window = undefined;

const capturedLogs = [];
const originalLog = console.log;
console.log = (...args) => {
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
    parentPort.postMessage({ success: true, result, logs: capturedLogs });
} catch (error) {
    parentPort.postMessage({ success: false, error: error.message, logs: capturedLogs });
} finally {
    console.log = originalLog;
}