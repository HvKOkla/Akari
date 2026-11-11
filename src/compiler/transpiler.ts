// @ts-nocheck
import { Node } from './ast';
import { Checker } from './checker';
import { buildRuntime } from './runtime';

export class CompileError extends Error {
    line?: number | string;
    column?: number | string;
    hint?: string;

    constructor(msg: string, line?: number, column?: number, hint = '') {
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

export function transpile(ast: Node[], options: any = {}): string {
    const checker = new Checker(options.allowedFunctions || []);
    checker.check(ast);

    let output = buildRuntime(options);

    function transpileNode(node: Node, isExpr = false): string {
        if (!node) return '';
        switch (node.type) {
            case 'number': return String((node as any).value);
            case 'boolean': return String((node as any).value);
            case 'string': return JSON.stringify((node as any).value);
            case 'nothing': return 'null';
            case 'variable': return (node as any).name;
            
            case 'binary': 
                return `__akari_binop("${(node as any).operator}", ${transpileNode((node as any).left, true)}, ${transpileNode((node as any).right, true)})`;
            
            case 'unary': 
                return `__akari_unop("${(node as any).operator}", ${transpileNode((node as any).argument, true)})`;
            
            case 'function_call': 
                return `${(node as any).name}(${(node as any).args.map((a: Node) => transpileNode(a, true)).join(', ')})` + (isExpr ? '' : ';\n');
            
            case 'assignment':
                if ((node as any).isDeclaration) return `${(node as any).isMut ? 'let' : 'const'} ${(node as any).name} = ${transpileNode((node as any).value, true)};\n`;
                return `${(node as any).name} = ${transpileNode((node as any).value, true)};\n`;
            
            case 'function_def':
                return `function ${(node as any).name}(${(node as any).params.join(', ')}) {\n${(node as any).body.map((s: Node) => transpileNode(s)).join('')}}\n`;
            
            case 'if': {
                let code: string = `if (${transpileNode((node as any).condition, true)}) {\n${(node as any).body.map((s: Node) => transpileNode(s)).join('')}}`;
                if ((node as any).else && (node as any).else.length) code += ` else {\n${(node as any).else.map((s: Node) => transpileNode(s)).join('')}}`;
                return code + '\n';
            }
            
            case 'while': {
                return `{
    let __akariWhileGuard = 0;
    while (${transpileNode((node as any).condition, true)}) {
        if (++__akariWhileGuard > __AKARI_MAX_ITER) {
            throw new Error("[Akari Loop] Loop too long (max " + __AKARI_MAX_ITER + " iterations).");
        }
        ${(node as any).body.map((s: Node) => transpileNode(s)).join('')}
    }
}\n`;
            }
            
            case 'for': {
                const varName = (node as any).varName;
                const start = transpileNode((node as any).start, true);
                const end = transpileNode((node as any).end, true);
                return `{
    const __akariForStart = ${start};
    const __akariForEnd = ${end};
    if (__akariForEnd - __akariForStart > __AKARI_MAX_ITER) {
        throw new Error("[Akari For] Loop too long (max " + __AKARI_MAX_ITER + " iterations).");
    }
    for (let ${varName} = __akariForStart; ${varName} < __akariForEnd; ${varName}++) {
        ${(node as any).body.map((s: Node) => transpileNode(s)).join('')}
    }
}\n`;
            }

            case 'for_in': {
                const varName = (node as any).varName;
                const coll = transpileNode((node as any).collection, true);
                return `{
    const __akariColl = ${coll};
    if (__akariColl === null || __akariColl === undefined) {
        throw new Error("[Akari For] Cannot iterate over nothing.");
    }
    let __akariForInGuard = 0;
    for (const ${varName} of __akariColl) {
        if (++__akariForInGuard > __AKARI_MAX_ITER) {
            throw new Error("[Akari For] Loop too long (max " + __AKARI_MAX_ITER + " iterations).");
        }
        ${(node as any).body.map((s: Node) => transpileNode(s)).join('')}
    }
}\n`;
            }

            case 'table_literal': {
                const entries = (node as any).entries.map((e: any) => 
                    `${JSON.stringify(e.key)}: ${transpileNode(e.value, true)}`
                ).join(', ');
                return `({ ${entries} })`;
            }

            case 'table_access':
                return `${transpileNode((node as any).target, true)}.${(node as any).key}`;

            // NOUVEAU : Gestion de l'assignation d'une propriété
            case 'table_assignment':
                return `${transpileNode((node as any).target.target, true)}.${(node as any).target.key} = ${transpileNode((node as any).value, true)};\n`;

            case 'return':
                return (node as any).value ? `return ${transpileNode((node as any).value, true)};\n` : 'return;\n';
            
            case 'break': return 'break;\n';
            case 'continue': return 'continue;\n';
            
            default:
                if ((node as any).type === 'import') {
                    throw new CompileError(
                        "'import' is not supported by the transpiler.",
                        (node as any).line,
                        (node as any).column,
                        "Akari is sandboxed by default. Use akari.expose() instead."
                    );
                }
                return '';
        }
    }

    for (const statement of ast) output += transpileNode(statement);
    return output;
}