/*
 * Akari Programming Language Engine
 * Copyright (c) 2026 [HvK Okla]
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 */

if (typeof require !== 'undefined') {
    var { parse } = require('./core/Parser.js');
    var {
        runSafetyChecker,
        CompileError,
        AKARI_TYPES,
        MAX_ALLOCATION_BYTES,
        MAX_LOOP_ITERATIONS
    } = require('./core/safety_checker.js');
    var { buildRuntime } = require('./runtime/js_runtime.js');
}

// ---------------------------------------------------------------------
// Générateur de code
// ---------------------------------------------------------------------

function transpile(ast) {
    runSafetyChecker(ast);

    let output = buildRuntime();

    function indent(code, level = 1) {
        const pad = '    '.repeat(level);
        return code.split('\n').map(l => (l ? pad + l : l)).join('\n');
    }

    function emitStatement(node) {
        return transpileNode(node, false);
    }

    function emitIndexAccess(node) {
        const target = transpileNode(node.target, true);
        const idx = transpileNode(node.index, true);
        return `__akariIndex(${target}, ${idx}, ${JSON.stringify(node.target.type || 'expr')})`;
    }

    function transpileNode(node, isExpression = false) {
        if (!node) return '';

        switch (node.type) {

            case 'number':
            case 'boolean':
                return String(node.value);

            case 'string':
                return JSON.stringify(node.value);

            case 'nothing':
                return 'null';

            case 'list': {
                const elements = node.elements.map(e => transpileNode(e, true)).join(', ');
                return `[${elements}]`;
            }

            case 'table': {
                const entries = node.entries.map(e =>
                    `${JSON.stringify(e.key)}: ${transpileNode(e.value, true)}`
                ).join(', ');
                return `({ ${entries} })`;
            }

            case 'table_access': {
                const target = transpileNode(node.target, true);
                return `${target}.${node.key}`;
            }

            case 'table_assignment': {
                const target = transpileNode(node.target, true);
                const value = transpileNode(node.value, true);
                return `${target}.${node.key} = ${value};\n`;
            }

            case 'variable':
                return node.name;

            case 'unary':
                return `(${node.operator}${transpileNode(node.argument, true)})`;

            case 'binary':
                return `(${transpileNode(node.left, true)} ${node.operator} ${transpileNode(node.right, true)})`;

            case 'index_access':
                return emitIndexAccess(node);

            case 'index_assignment': {
                function emitRawTarget(n) {
                    if (n.type === 'variable') return n.name;
                    if (n.type === 'index_access') {
                        return `${emitRawTarget(n.target)}[${transpileNode(n.index, true)}]`;
                    }
                    if (n.type === 'table_access') {
                        return `${emitRawTarget(n.target)}.${n.key}`;
                    }
                    return transpileNode(n, true);
                }
                const rawTarget = emitRawTarget(node.target);
                const value = transpileNode(node.value, true);
                return `${rawTarget} = ${value};\n`;
            }

            case 'assignment': {
                const rhs = transpileNode(node.value, true);
                if (node.isDeclaration === true) {
                    const kw = node.isMut ? 'let' : 'const';
                    return `${kw} ${node.name} = ${rhs};\n`;
                }
                return `${node.name} = ${rhs};\n`;
            }

            case 'function_call': {
                const args = node.args.map(a => transpileNode(a, true)).join(', ');
                const call = `${node.name}(${args})`;
                return isExpression ? call : call + ';\n';
            }

            case 'function_def': {
                const params = node.params.map(p => (typeof p === 'string' ? p : p.name)).join(', ');
                const body = node.body.map(emitStatement).join('');
                return `function ${node.name}(${params}) {\n${indent(body)}}\n`;
            }

            case 'return': {
                if (node.value) return `return ${transpileNode(node.value, true)};\n`;
                return 'return;\n';
            }

            case 'if': {
                const cond = transpileNode(node.condition, true);

                if (isExpression) {
                    const thenExpr = node.body.length > 0
                        ? transpileNode(node.body[node.body.length - 1], true)
                        : 'null';
                    const elseExpr = (node.else && node.else.length > 0)
                        ? transpileNode(node.else[node.else.length - 1], true)
                        : 'null';
                    return `(${cond} ? ${thenExpr} : ${elseExpr})`;
                }

                let code = `if (${cond}) {\n`;
                code += indent(node.body.map(emitStatement).join(''));
                code += '}';
                if (node.else && node.else.length > 0) {
                    code += ' else {\n';
                    code += indent(node.else.map(emitStatement).join(''));
                    code += '}';
                }
                return code + '\n';
            }

            case 'for': {
                const varName = node.varName;
                const start = transpileNode(node.start, true);
                const end   = transpileNode(node.end, true);

                let code = `{\n`;
                code += `    const __akariForStart = ${start};\n`;
                code += `    const __akariForEnd = ${end};\n`;
                code += `    __akariCheckLoop(__akariForStart, __akariForEnd, 1);\n`;
                code += `    if (__akariForStart > __akariForEnd) {\n`;
                code += `        throw new Error("[Akari For] Début (" + __akariForStart + ") > fin (" + __akariForEnd + ").");\n`;
                code += `    }\n`;
                code += `    for (let ${varName} = __akariForStart; ${varName} <= __akariForEnd; ${varName}++) {\n`;
                code += indent(node.body.map(emitStatement).join(''), 2);
                code += `    }\n`;
                code += `}\n`;
                return code;
            }

            // ✅ NOUVEAU : boucle sur collection
            case 'for_in': {
                const varName = node.varName;
                const collection = transpileNode(node.collection, true);

                let code = `{\n`;
                code += `    const __akariIter = ${collection};\n`;
                code += `    if (__akariIter && typeof __akariIter[Symbol.iterator] === "function") {\n`;
                code += `        for (const ${varName} of __akariIter) {\n`;
                code += indent(node.body.map(emitStatement).join(''), 3);
                code += `        }\n`;
                code += `    } else if (__akariIter && typeof __akariIter.length === "number") {\n`;
                code += `        for (let __akariIdx = 0; __akariIdx < __akariIter.length; __akariIdx++) {\n`;
                code += `            const ${varName} = __akariIter[__akariIdx];\n`;
                code += indent(node.body.map(emitStatement).join(''), 3);
                code += `        }\n`;
                code += `    } else {\n`;
                code += `        throw new Error("[Akari For-In] La valeur n'est pas itérable.");\n`;
                code += `    }\n`;
                code += `}\n`;
                return code;
            }

            case 'while': {
                let code = `{\n`;
                code += `    let __akariWhileGuard = 0;\n`;
                code += `    while (${transpileNode(node.condition, true)}) {\n`;
                code += `        if (++__akariWhileGuard > __AKARI_MAX_ITER) {\n`;
                code += `            throw new Error("[Akari While] Boucle trop longue.");\n`;
                code += `        }\n`;
                code += indent(node.body.map(emitStatement).join(''), 2);
                code += `    }\n`;
                code += `}\n`;
                return code;
            }

            case 'try': {
                if (isExpression) {
                    const tryLast = node.body.length > 0
                        ? transpileNode(node.body[node.body.length - 1], true)
                        : 'null';
                    const catchLast = node.catchBody.length > 0
                        ? transpileNode(node.catchBody[node.catchBody.length - 1], true)
                        : 'null';

                    let expr = `(() => {\n`;
                    expr += `    try {\n`;
                    expr += indent(node.body.slice(0, -1).map(emitStatement).join(''), 2);
                    expr += `        return ${tryLast};\n`;
                    expr += `    } catch (${node.errorVar || '_err'}) {\n`;
                    expr += indent(node.catchBody.slice(0, -1).map(emitStatement).join(''), 2);
                    expr += `        return ${catchLast};\n`;
                    expr += `    }\n`;
                    expr += `})()`;
                    return expr;
                }

                let code = `try {\n`;
                code += indent(node.body.map(emitStatement).join(''));
                code += `} catch (${node.errorVar || '_err'}) {\n`;
                code += indent(node.catchBody.map(emitStatement).join(''));
                code += `}\n`;
                return code;
            }

            case 'break':    return 'break;\n';
            case 'continue': return 'continue;\n';

            case 'import':
                return '';

            default:
                throw new CompileError(
                    `Nœud AST non supporté : '${node.type}'.`,
                    node.line, node.column,
                    'Bug interne du transpileur.'
                );
        }
    }

    if (!Array.isArray(ast)) {
        throw new CompileError(
            "L'AST doit être un tableau.",
            '?', '?',
            'Le parser a probablement retourné un objet invalide.'
        );
    }

    for (const statement of ast) {
        const code = transpileNode(statement, false);
        if (!code) continue;
        output += code;
    }

    return output;
}

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { transpile, CompileError };
} else {
    window.transpile = transpile;
    window.CompileError = CompileError;
}