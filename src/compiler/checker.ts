import { Node, FunctionCallNode, TableAccessNode, VariableNode, TableLiteralNode } from './ast';

export class CheckerError extends Error {
    constructor(msg: string, node: Node) {
        super(`[Checker] ${msg} (Line ${(node as any).line || '?'})`);
        this.name = 'CheckerError';
    }
}

type AkariType = 'number' | 'string' | 'boolean' | 'nothing' | 'any';

const DANGEROUS_NAMES = new Set([
    'process', 'require', 'global', 'globalThis', 'module', 
    'exports', 'eval', 'Function', 'Object', 'Reflect',
    'constructor', 'prototype', '__proto__', '__defineGetter__'
]);

const BUILTINS = new Set([
    'toText', 'toNumber', 'kind', 'sqrt', 'pow', 'abs', 
    'floor', 'ceil', 'round', 'min', 'max', 'random'
]);

export class Checker {
    private scopes: Map<string, { kind: 'let' | 'mut', type: AkariType }>[];
    private allowedFunctions: Set<string>;
    private userFunctions: Set<string>;

    constructor(allowedFunctions: string[] = []) {
        this.scopes = [new Map()];
        this.allowedFunctions = new Set(allowedFunctions);
        this.userFunctions = new Set();
    }

    public check(ast: Node[]): void {
        for (const node of ast) {
            this.checkNode(node);
        }
    }

    private getScope() {
        return this.scopes[this.scopes.length - 1];
    }

    private lookup(name: string) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            if (this.scopes[i].has(name)) return this.scopes[i].get(name);
        }
        return undefined;
    }

    private checkNode(node: Node): AkariType {
        if (!node) return 'nothing';

        switch (node.type) {
            case 'number': return 'number';
            case 'string': return 'string';
            case 'boolean': return 'boolean';
            case 'nothing': return 'nothing';

            case 'variable': {
                const varNode = node as VariableNode;
                if (DANGEROUS_NAMES.has(varNode.name)) {
                    throw new CheckerError(`Security violation: variable '${varNode.name}' is forbidden.`, node);
                }
                const info = this.lookup(varNode.name);
                if (!info) throw new CheckerError(`Variable '${varNode.name}' is not declared.`, node);
                return info.type;
            }

            case 'assignment': {
                const valueType = this.checkNode(node.value);
                if (DANGEROUS_NAMES.has(node.name)) {
                    throw new CheckerError(`Security violation: variable '${node.name}' is forbidden.`, node);
                }
                if (node.isDeclaration) {
                    if (this.getScope().has(node.name)) {
                        throw new CheckerError(`Variable '${node.name}' already declared in this scope.`, node);
                    }
                    this.getScope().set(node.name, { kind: node.isMut ? 'mut' : 'let', type: valueType });
                    return valueType;
                } else {
                    const info = this.lookup(node.name);
                    if (!info) throw new CheckerError(`Cannot assign to undeclared variable '${node.name}'.`, node);
                    if (info.kind === 'let') {
                        throw new CheckerError(`Cannot assign to immutable variable '${node.name}'. Use 'mut' to declare it.`, node);
                    }
                    // Type check strict à la réassignation (optionnel mais plus sûr)
                    if (info.type !== 'any' && valueType !== 'any' && info.type !== valueType) {
                         throw new CheckerError(`Cannot assign ${valueType} to variable '${node.name}' of type ${info.type}.`, node);
                    }
                    return valueType;
                }
            }

            case 'table_literal': {
                const literal = node as TableLiteralNode;
                for (const entry of literal.entries) {
                    // On vérifie que la clé n'est pas dangereuse (ex: { "constructor": ... })
                    if (DANGEROUS_NAMES.has(entry.key)) {
                         throw new CheckerError(`Security violation: property '${entry.key}' is forbidden in table.`, node);
                    }
                    this.checkNode(entry.value);
                }
                return 'any';
            }

            case 'binary': {
                const left = this.checkNode(node.left);
                const right = this.checkNode(node.right);
                
                if (node.operator === '+') {
                    if (left === 'any' || right === 'any') return 'any';
                    if (left !== right) {
                        throw new CheckerError(`Cannot add ${left} and ${right}.`, node);
                    }
                    return left;
                }
                
                if (['==', '!=', '<', '>', '<=', '>='].includes(node.operator)) {
                    return 'boolean';
                }
                
                if (['&&', '||'].includes(node.operator)) {
                    if ((left !== 'boolean' && left !== 'any') || (right !== 'boolean' && right !== 'any')) {
                        throw new CheckerError(`Logical operator '${node.operator}' requires booleans, got ${left} and ${right}.`, node);
                    }
                    return 'boolean';
                }
                
                return 'any';
            }

            case 'unary': {
                const argType = this.checkNode(node.argument);
                if (node.operator === '!') {
                    if (argType !== 'boolean' && argType !== 'any') throw new CheckerError(`Operator '!' requires a boolean, got ${argType}.`, node);
                    return 'boolean';
                }
                if (node.operator === '-') {
                    if (argType !== 'number' && argType !== 'any') throw new CheckerError(`Operator '-' requires a number, got ${argType}.`, node);
                    return 'number';
                }
                return 'any';
            }

            case 'function_call': {
                const callNode = node as FunctionCallNode;
                if (DANGEROUS_NAMES.has(callNode.name)) {
                    throw new CheckerError(`Security violation: function '${callNode.name}' is forbidden.`, node);
                }
                
                const isBuiltin = BUILTINS.has(callNode.name);
                const isExposed = this.allowedFunctions.has(callNode.name);
                const isUserDefined = this.userFunctions.has(callNode.name);

                if (!isBuiltin && !isExposed && !isUserDefined) {
                    throw new CheckerError(`Function '${callNode.name}' is not allowed in this sandbox.`, node);
                }

                for (const arg of callNode.args) this.checkNode(arg);
                return 'any';
            }

            case 'function_def': {
                if (DANGEROUS_NAMES.has(node.name)) {
                    throw new CheckerError(`Security violation: function name '${node.name}' is forbidden.`, node);
                }
                this.userFunctions.add(node.name);
                this.getScope().set(node.name, { kind: 'let', type: 'any' });

                this.scopes.push(new Map());
                for (const param of node.params) {
                    if (DANGEROUS_NAMES.has(param)) {
                        throw new CheckerError(`Security violation: parameter '${param}' is forbidden.`, node);
                    }
                    this.getScope().set(param, { kind: 'let', type: 'any' });
                }
                
                for (const stmt of node.body) this.checkNode(stmt);
                this.scopes.pop();
                return 'nothing';
            }

            case 'table_access': {
                const tableNode = node as TableAccessNode;
                if (DANGEROUS_NAMES.has(tableNode.key)) {
                    throw new CheckerError(`Security violation: property '${tableNode.key}' is forbidden.`, node);
                }
                this.checkNode(tableNode.target);
                return 'any';
            }

            case 'if': {
                const condType = this.checkNode(node.condition);
                // STRICT : La condition d'un if DOIT être un booléen (ou any)
                if (condType !== 'boolean' && condType !== 'any') {
                    throw new CheckerError(`If condition must be a boolean, got ${condType}.`, node);
                }

                this.scopes.push(new Map());
                for (const stmt of node.body) this.checkNode(stmt);
                this.scopes.pop();

                this.scopes.push(new Map());
                for (const stmt of node.else) this.checkNode(stmt);
                this.scopes.pop();
                return 'nothing';
            }

            case 'while': {
                const condType = this.checkNode(node.condition);
                // STRICT : La condition d'un while DOIT être un booléen (ou any)
                if (condType !== 'boolean' && condType !== 'any') {
                    throw new CheckerError(`While condition must be a boolean, got ${condType}.`, node);
                }

                this.scopes.push(new Map());
                for (const stmt of node.body) this.checkNode(stmt);
                this.scopes.pop();
                return 'nothing';
            }

            case 'for': {
                const startType = this.checkNode(node.start);
                const endType = this.checkNode(node.end);
                
                if ((startType !== 'number' && startType !== 'any') || (endType !== 'number' && endType !== 'any')) {
                     throw new CheckerError(`For loop bounds must be numbers, got ${startType} and ${endType}.`, node);
                }

                this.scopes.push(new Map());
                this.getScope().set(node.varName, { kind: 'let', type: 'number' });
                for (const stmt of node.body) this.checkNode(stmt);
                this.scopes.pop();
                return 'nothing';
            }

            case 'for_in': {
                this.checkNode(node.collection);
                this.scopes.push(new Map());
                this.getScope().set(node.varName, { kind: 'let', type: 'any' });
                for (const stmt of node.body) this.checkNode(stmt);
                this.scopes.pop();
                return 'nothing';
            }

            case 'return': {
                if (node.value) this.checkNode(node.value);
                return 'nothing';
            }

            case 'break':
            case 'continue':
                return 'nothing';

            default:
                return 'any';
        }
    }
}