/*
 * Akari Programming Language Engine — Backend
 * (Safety Checker + Transpiler + Runtime)
 */

class CompileError extends Error {
    constructor(msg, line, column, hint = '') {
        super(msg);
        this.name = 'CompileError';
        this.line = line || '?';
        this.column = column || '?';
        this.hint = hint;
    }
    toString() {
        let out = `❌ [CompileError] ${this.message}\n  --> Line ${this.line}, Column ${this.column}`;
        if (this.hint) out += `\n  = hint: ${this.hint}`;
        return out;
    }
}

const MAX_LOOP_ITERATIONS = 1_000_000;

function transpile(ast) {
    // Checker basique
    function checkNode(node) {
        if (!node) return;
        if (node.type === 'binary') { checkNode(node.left); checkNode(node.right); }
        if (node.type === 'assignment') { checkNode(node.value); }
        if (node.type === 'function_call') { node.args.forEach(checkNode); }
        if (node.type === 'function_def') { node.body.forEach(checkNode); }
        if (node.type === 'if') { checkNode(node.condition); node.body.forEach(checkNode); node.else.forEach(checkNode); }
    }
    ast.forEach(checkNode);

    let output = buildRuntime();

    function transpileNode(node, isExpr = false) {
        if (!node) return '';
        switch (node.type) {
            case 'number': return String(node.value);
            case 'boolean': return String(node.value);
            case 'string': return JSON.stringify(node.value);
            case 'nothing': return 'null';
            case 'variable': return node.name;
            case 'binary': return `(${transpileNode(node.left, true)} ${node.operator} ${transpileNode(node.right, true)})`;
            case 'function_call': return `${node.name}(${node.args.map(a => transpileNode(a, true)).join(', ')})` + (isExpr ? '' : ';');
            case 'assignment':
                if (node.isDeclaration) return `${node.isMut ? 'let' : 'const'} ${node.name} = ${transpileNode(node.value, true)};\n`;
                return `${node.name} = ${transpileNode(node.value, true)};\n`;
            case 'function_def':
                return `function ${node.name}(${node.params.join(', ')}) {\n${node.body.map(s => transpileNode(s)).join('')}}\n`;
            case 'if':
                let code = `if (${transpileNode(node.condition, true)}) {\n${node.body.map(s => transpileNode(s)).join('')}}`;
                if (node.else && node.else.length) code += ` else {\n${node.else.map(s => transpileNode(s)).join('')}}`;
                return code + '\n';
            default: return '';
        }
    }

    for (const statement of ast) output += transpileNode(statement);
    return output;
}

function buildRuntime() {
    return `
const __AKARI_MAX_ITER = ${MAX_LOOP_ITERATIONS};
const __rt_math_sqrt = (x) => Math.sqrt(x);
const __rt_math_pow = (x, y) => Math.pow(x, y);
const __rt_math_abs = (x) => Math.abs(x);
const __rt_math_random = () => Math.random();
`;
}

module.exports = { transpile, buildRuntime, CompileError };