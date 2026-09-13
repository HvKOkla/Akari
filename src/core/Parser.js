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
    var { tokenize } = require('./lexer.js');
}

class ParseError extends Error {
    constructor(msg, line, column, suggestion = '') {
        super();
        this.name = 'ParseError';
        this.msg = msg;
        this.line = line || '?';
        this.column = column || '?';
        this.suggestion = suggestion;
    }

    toString() {
        let s = `❌ Parse Error: ${this.msg}`;
        s += `\n→ Line ${this.line}, column ${this.column}`;
        if (this.suggestion) s += `\n→ ${this.suggestion}`;
        return s;
    }
}

// ---------------------------------------------------------------------
// Limites de sécurité
// ---------------------------------------------------------------------

const LIMITS = Object.freeze({
    MAX_SOURCE_LENGTH:   5 * 1024 * 1024,
    MAX_TOKENS:          500_000,
    MAX_EXPR_DEPTH:      256,
    MAX_BLOCK_DEPTH:     64,
    MAX_PARAMS:          32,
    MAX_BLOCK_STMTS:     10_000,
    MAX_INDEX_DEPTH:     8,
    MAX_LIST_LENGTH:     10_000,
    MAX_TABLE_ENTRIES:   10_000
});

const EXPRESSION_STARTERS = new Set([
    'number', 'string', 'identifier',
    'true', 'false', 'nothing',
    '(', '-', '!', '[', '{'
]);

function parse(code) {
    if (typeof code !== 'string') {
        throw new ParseError(
            `Le code source doit être une chaîne, reçu : ${typeof code}`,
            '?', '?',
            'Vérifiez la source passée au parser.'
        );
    }

    if (code.length > LIMITS.MAX_SOURCE_LENGTH) {
        throw new ParseError(
            `Source trop volumineuse (${code.length} octets, max ${LIMITS.MAX_SOURCE_LENGTH}).`,
            '?', '?',
            'Découpez en plusieurs modules.'
        );
    }

    const tokens = tokenize(code);

    if (tokens.length > LIMITS.MAX_TOKENS) {
        throw new ParseError(
            `Trop de tokens (${tokens.length}, max ${LIMITS.MAX_TOKENS}).`,
            '?', '?',
            'Simplifiez le fichier.'
        );
    }

    let pos = 0;
    let exprDepth = 0;
    let blockDepth = 0;

    function peek(offset = 0) {
        return tokens[pos + offset] || { type: 'EOF', value: 'EOF', line: '?', col: '?' };
    }

    function next() {
        return tokens[pos++] || { type: 'EOF', value: 'EOF', line: '?', col: '?' };
    }

    function isAtEnd() {
        return peek().type === 'EOF';
    }

    function expect(type, msg) {
        const token = next();
        if (token.type !== type) {
            const detail = msg || `expected '${type}', got '${token.value}'`;
            throw new ParseError(detail, token.line, token.col,
                `Did you mean to use '${type}'?`);
        }
        return token;
    }

    function canStartExpression(token) {
        return EXPRESSION_STARTERS.has(token.type);
    }

    function enterExpr() {
        exprDepth++;
        if (exprDepth > LIMITS.MAX_EXPR_DEPTH) {
            throw new ParseError(
                `Expression trop profonde (max ${LIMITS.MAX_EXPR_DEPTH}).`,
                peek().line, peek().col,
                'Découpez l\'expression en variables intermédiaires.'
            );
        }
    }

    function exitExpr() {
        exprDepth--;
    }

    function enterBlock() {
        blockDepth++;
        if (blockDepth > LIMITS.MAX_BLOCK_DEPTH) {
            throw new ParseError(
                `Blocs trop imbriqués (max ${LIMITS.MAX_BLOCK_DEPTH}).`,
                peek().line, peek().col,
                'Réduisez l\'imbrication.'
            );
        }
    }

    function exitBlock() {
        blockDepth--;
    }

    // ------------------------------------------------------------------
    // Expressions
    // ------------------------------------------------------------------

    function parseExpression() {
        enterExpr();
        try {
            return parseLogicalOr();
        } finally {
            exitExpr();
        }
    }

    function parseLogicalOr() {
        let left = parseLogicalAnd();
        while (peek().type === '||') {
            const op = next();
            const right = parseLogicalAnd();
            left = { type: 'binary', operator: op.value, left, right,
                     line: op.line, column: op.col };
        }
        return left;
    }

    function parseLogicalAnd() {
        let left = parseComparison();
        while (peek().type === '&&') {
            const op = next();
            const right = parseComparison();
            left = { type: 'binary', operator: op.value, left, right,
                     line: op.line, column: op.col };
        }
        return left;
    }

    function parseComparison() {
        let left = parseAddition();
        while (
            peek().type === '==' || peek().type === '!=' ||
            peek().type === '>'  || peek().type === '<'  ||
            peek().type === '>=' || peek().type === '<='
        ) {
            const op = next();
            const right = parseAddition();
            left = { type: 'binary', operator: op.value, left, right,
                     line: op.line, column: op.col };
        }
        return left;
    }

    function parseAddition() {
        let left = parseMultiplication();
        while (peek().type === '+' || peek().type === '-') {
            const op = next();
            const right = parseMultiplication();
            left = { type: 'binary', operator: op.value, left, right,
                     line: op.line, column: op.col };
        }
        return left;
    }

    function parseMultiplication() {
        let left = parseUnary();
        while (peek().type === '*' || peek().type === '/' || peek().type === '%') {
            const op = next();
            const right = parseUnary();
            left = { type: 'binary', operator: op.value, left, right,
                     line: op.line, column: op.col };
        }
        return left;
    }

    function parseUnary() {
        const token = peek();
        if (token.type === '-' || token.type === '!') {
            const op = next();
            const argument = parseUnary();
            return { type: 'unary', operator: op.value, argument,
                     line: op.line, column: op.col };
        }
        return parsePostfix();
    }

    // ------------------------------------------------------------------
    // Postfix : gère les accès a[0], a.x, a[0].x, etc.
    // ------------------------------------------------------------------

    function parsePostfix() {
        let expr = parsePrimary();

        let depth = 0;
        while (true) {
            if (peek().type === '[') {
                depth++;
                if (depth > LIMITS.MAX_INDEX_DEPTH) {
                    throw new ParseError(
                        `Trop d'index imbriqués (max ${LIMITS.MAX_INDEX_DEPTH}).`,
                        peek().line, peek().col,
                        'Simplifiez l\'accès.'
                    );
                }

                const bracketToken = next();
                if (peek().type === ']') {
                    throw new ParseError(
                        `Index vide '[]'.`,
                        peek().line, peek().col,
                        'Indiquez un index : a[0]'
                    );
                }

                const index = parseExpression();
                expect(']', 'missing closing bracket for index');

                expr = {
                    type: 'index_access',
                    target: expr,
                    index,
                    line: bracketToken.line,
                    column: bracketToken.col
                };
                continue;
            }

            if (peek().type === '.') {
                const dotToken = next();
                const keyToken = expect('identifier', 'property name expected after "."');

                expr = {
                    type: 'table_access',
                    target: expr,
                    key: keyToken.value,
                    line: dotToken.line,
                    column: dotToken.col
                };
                continue;
            }

            break;
        }

        return expr;
    }

    // ------------------------------------------------------------------
    // Listes
    // ------------------------------------------------------------------

    function parseList() {
        const bracketToken = next();

        const elements = [];

        if (peek().type === ']') {
            next();
            return {
                type: 'list',
                elements,
                line: bracketToken.line,
                column: bracketToken.col
            };
        }

        elements.push(parseExpression());

        while (peek().type === ',') {
            next();
            if (elements.length >= LIMITS.MAX_LIST_LENGTH) {
                throw new ParseError(
                    `Liste trop longue (max ${LIMITS.MAX_LIST_LENGTH}).`,
                    peek().line, peek().col,
                    'Découpez en plusieurs listes.'
                );
            }
            if (peek().type === ']') break;
            elements.push(parseExpression());
        }

        expect(']', 'missing closing bracket for list');

        return {
            type: 'list',
            elements,
            line: bracketToken.line,
            column: bracketToken.col
        };
    }

    // ------------------------------------------------------------------
    // Tables
    // ------------------------------------------------------------------

    function parseTable() {
        const braceToken = next();

        const entries = [];

        if (peek().type === '}') {
            next();
            return {
                type: 'table',
                entries,
                line: braceToken.line,
                column: braceToken.col
            };
        }

        {
            const keyToken = expect('identifier', 'table key expected');
            expect('=', 'missing "=" after table key');
            const value = parseExpression();
            entries.push({ key: keyToken.value, value });
        }

        while (peek().type === ',') {
            next();
            if (entries.length >= LIMITS.MAX_TABLE_ENTRIES) {
                throw new ParseError(
                    `Table trop longue (max ${LIMITS.MAX_TABLE_ENTRIES}).`,
                    peek().line, peek().col,
                    'Découpez en plusieurs tables.'
                );
            }
            if (peek().type === '}') break;

            const keyToken = expect('identifier', 'table key expected');
            expect('=', 'missing "=" after table key');
            const value = parseExpression();
            entries.push({ key: keyToken.value, value });
        }

        expect('}', 'missing closing brace for table');

        return {
            type: 'table',
            entries,
            line: braceToken.line,
            column: braceToken.col
        };
    }

    function parsePrimary() {
        const token = peek();

        if (token.type === 'number') {
            next();
            return { type: 'number', value: token.value, line: token.line, column: token.col };
        }

        if (token.type === 'string') {
            next();
            return { type: 'string', value: token.value, line: token.line, column: token.col };
        }

        if (token.type === 'true' || token.type === 'false') {
            next();
            return { type: 'boolean', value: token.type === 'true',
                     line: token.line, column: token.col };
        }

        if (token.type === 'nothing') {
            next();
            return { type: 'nothing', value: null, line: token.line, column: token.col };
        }

        if (token.type === '[') {
            return parseList();
        }

        if (token.type === '{') {
            return parseTable();
        }

        if (token.type === 'identifier') {
            next();
            if (peek().type === '(') {
                return parseFunctionCall(token);
            }
            return { type: 'variable', name: token.value, line: token.line, column: token.col };
        }

        if (token.type === '(') {
            next();
            const expr = parseExpression();
            expect(')', 'missing closing parenthesis');
            return expr;
        }

        throw new ParseError(
            `unexpected '${token.value}'`,
            token.line, token.col,
            'Expected a number, string, variable or expression.'
        );
    }

    function parseFunctionCall(nameToken) {
        expect('(', 'missing opening parenthesis');
        const args = [];
        if (peek().type !== ')') {
            args.push(parseExpression());
            while (peek().type === ',') {
                next();
                if (peek().type === ')') {
                    throw new ParseError(
                        'trailing comma in function call',
                        peek().line, peek().col,
                        'Remove the comma before the closing parenthesis.'
                    );
                }
                args.push(parseExpression());
            }
        }
        expect(')', 'missing closing parenthesis');
        return { type: 'function_call', name: nameToken.value, args,
                 line: nameToken.line, column: nameToken.col };
    }

    // ------------------------------------------------------------------
    // Blocs
    // ------------------------------------------------------------------

    function parseBlock(terminators) {
        enterBlock();
        try {
            const body = [];
            while (!terminators.has(peek().type) && !isAtEnd()) {
                if (body.length >= LIMITS.MAX_BLOCK_STMTS) {
                    throw new ParseError(
                        `Trop de statements dans un bloc (max ${LIMITS.MAX_BLOCK_STMTS}).`,
                        peek().line, peek().col,
                        'Découpez en fonctions.'
                    );
                }
                body.push(parseStatement());
            }
            if (isAtEnd() && !terminators.has('EOF')) {
                throw new ParseError(
                    `unexpected end of file, missing '${[...terminators].join("' or '")}'`,
                    peek().line, peek().col,
                    `Close the block with ${[...terminators].join(' or ')}.`
                );
            }
            return body;
        } finally {
            exitBlock();
        }
    }

    // ------------------------------------------------------------------
    // Statements
    // ------------------------------------------------------------------

    function parseVariableDeclaration(isMut, declToken) {
        const varToken = expect('identifier', 'variable name expected');
        expect('=', `missing "=" after variable name '${varToken.value}'`);
        const value = parseExpression();
        return {
            type: 'assignment',
            name: varToken.value,
            value,
            isMut,
            isDeclaration: true,
            line: declToken.line,
            column: declToken.col
        };
    }

    function parseIfStatement(ifToken) {
        const condition = parseExpression();
        expect(':', 'missing colon after if condition');

        const body = parseBlock(new Set(['else', 'end']));

        let elseBody = [];

        if (peek().type === 'else') {
            next();
            if (peek().type === 'if') {
                const nestedIfToken = next();
                elseBody = [parseIfStatement(nestedIfToken)];
            } else {
                expect(':', 'missing colon after else');
                elseBody = parseBlock(new Set(['end']));
            }
        }

        expect('end', 'missing "end" to close if statement');

        return {
            type: 'if',
            condition,
            body,
            else: elseBody,
            line: ifToken.line,
            column: ifToken.col
        };
    }

    // ------------------------------------------------------------------
    // For : deux formes
    //   1) for i in 1..5:      (intervalle)
    //   2) for x in collection: (collection)
    // ------------------------------------------------------------------
    function parseForStatement(forToken) {
        const varToken = expect('identifier', 'loop variable name expected');
        expect('in', 'missing "in" in for loop');

        // On parse la première expression
        const firstExpr = parseExpression();

        // Cas 1 : intervalle → on attend '..'
        if (peek().type === '..') {
            next(); // consomme '..'
            const end = parseExpression();
            expect(':', 'missing colon after for loop');

            const body = parseBlock(new Set(['end']));
            expect('end', 'missing "end" to close for loop');

            return {
                type: 'for',
                varName: varToken.value,
                start: firstExpr,
                end,
                body,
                line: forToken.line,
                column: forToken.col
            };
        }

        // Cas 2 : collection → on attend ':'
        expect(':', 'missing ":" after for ... in <collection>');

        const body = parseBlock(new Set(['end']));
        expect('end', 'missing "end" to close for loop');

        return {
            type: 'for_in',
            varName: varToken.value,
            collection: firstExpr,
            body,
            line: forToken.line,
            column: forToken.col
        };
    }

    function parseWhileStatement(whileToken) {
        const condition = parseExpression();
        expect(':', 'missing colon after while condition');

        const body = parseBlock(new Set(['end']));
        expect('end', 'missing "end" to close while loop');

        return {
            type: 'while',
            condition,
            body,
            line: whileToken.line,
            column: whileToken.col
        };
    }

    function parseTryStatement(tryToken) {
        expect(':', 'missing colon after try');

        const body = parseBlock(new Set(['catch', 'end']));

        let catchBody = [];
        let errorVar = 'error';

        if (peek().type === 'catch') {
            next();
            if (peek().type === 'identifier') {
                errorVar = next().value;
            }
            expect(':', 'missing colon after catch');
            catchBody = parseBlock(new Set(['end']));
        }

        expect('end', 'missing "end" to close try statement');

        return {
            type: 'try',
            body,
            errorVar,
            catchBody,
            line: tryToken.line,
            column: tryToken.col
        };
    }

    function parseDefStatement(defToken) {
        const nameToken = expect('identifier', 'function name expected');
        expect('(', 'missing opening parenthesis after function name');

        const params = [];
        const seenParams = new Set();

        if (peek().type !== ')') {
            let paramToken = expect('identifier', 'parameter name expected');
            if (seenParams.has(paramToken.value)) {
                throw new ParseError(
                    `duplicate parameter '${paramToken.value}'`,
                    paramToken.line, paramToken.col,
                    'Rename one of the parameters.'
                );
            }
            seenParams.add(paramToken.value);
            params.push(paramToken.value);

            while (peek().type === ',') {
                next();
                paramToken = expect('identifier', 'parameter name expected');
                if (seenParams.has(paramToken.value)) {
                    throw new ParseError(
                        `duplicate parameter '${paramToken.value}'`,
                        paramToken.line, paramToken.col,
                        'Rename one of the parameters.'
                    );
                }
                seenParams.add(paramToken.value);
                params.push(paramToken.value);

                if (params.length > LIMITS.MAX_PARAMS) {
                    throw new ParseError(
                        `Trop de paramètres (max ${LIMITS.MAX_PARAMS}).`,
                        paramToken.line, paramToken.col,
                        'Regroupez en buffer ou objet.'
                    );
                }
            }
        }
        expect(')', 'missing closing parenthesis');
        expect(':', 'missing colon after function definition');

        const body = parseBlock(new Set(['end']));
        expect('end', 'missing "end" to close function definition');

        return {
            type: 'function_def',
            name: nameToken.value,
            params,
            body,
            line: nameToken.line,
            column: nameToken.col
        };
    }

    function parseReturnStatement(returnToken) {
        let value = null;
        if (canStartExpression(peek())) {
            value = parseExpression();
        }
        return { type: 'return', value, line: returnToken.line, column: returnToken.col };
    }

    function parseStatement() {
        const token = peek();

        switch (token.type) {
            case 'import': {
                next();
                const pathToken = expect('string', 'expected a string path after import');
                return {
                    type: 'import',
                    path: pathToken.value,
                    line: token.line,
                    column: token.col
                };
            }

            case 'let':
                next();
                return parseVariableDeclaration(false, token);

            case 'mut':
                next();
                return parseVariableDeclaration(true, token);

            case 'def':
                next();
                return parseDefStatement(token);

            case 'if':
                next();
                return parseIfStatement(token);

            case 'for':
                next();
                return parseForStatement(token);

            case 'while':
                next();
                return parseWhileStatement(token);

            case 'try':
                next();
                return parseTryStatement(token);

            case 'stop':
                next();
                return { type: 'break', line: token.line, column: token.col };

            case 'skip':
                next();
                return { type: 'continue', line: token.line, column: token.col };

            case 'return':
                next();
                return parseReturnStatement(token);

            case 'identifier': {
                const nextToken = peek(1);

                if (nextToken.type === '=') {
                    next();
                    next();
                    const value = parseExpression();
                    return {
                        type: 'assignment',
                        name: token.value,
                        value,
                        isMut: false,
                        isDeclaration: false,
                        line: token.line,
                        column: token.col
                    };
                }

                if (nextToken.type === '(') {
                    next();
                    const call = parseFunctionCall(token);
                    return call;
                }

                if (nextToken.type === '[' || nextToken.type === '.') {
                    return parseAccessAssignmentStatement();
                }

                throw new ParseError(
                    `unexpected identifier '${token.value}'`,
                    token.line, token.col,
                    'An identifier alone is not a statement. Did you mean a function call or an assignment?'
                );
            }

            default:
                throw new ParseError(
                    `unexpected '${token.value}'`,
                    token.line, token.col,
                    'Check your syntax.'
                );
        }
    }

    // ------------------------------------------------------------------
    // Assignation indexée ou propriété
    // ------------------------------------------------------------------

    function parseAccessAssignmentStatement() {
        const identToken = next();
        let target = {
            type: 'variable',
            name: identToken.value,
            line: identToken.line,
            column: identToken.col
        };

        let depth = 0;
        while (peek().type === '[' || peek().type === '.') {
            depth++;
            if (depth > LIMITS.MAX_INDEX_DEPTH) {
                throw new ParseError(
                    `Trop d'accès imbriqués (max ${LIMITS.MAX_INDEX_DEPTH}).`,
                    peek().line, peek().col,
                    'Simplifiez l\'accès.'
                );
            }

            if (peek().type === '[') {
                const bracketToken = next();
                if (peek().type === ']') {
                    throw new ParseError(
                        `Index vide '[]'.`,
                        peek().line, peek().col,
                        'Indiquez un index : a[0]'
                    );
                }
                const index = parseExpression();
                expect(']', 'missing closing bracket for index');

                target = {
                    type: 'index_access',
                    target,
                    index,
                    line: bracketToken.line,
                    column: bracketToken.col
                };
            } else {
                const dotToken = next();
                const keyToken = expect('identifier', 'property name expected after "."');
                target = {
                    type: 'table_access',
                    target,
                    key: keyToken.value,
                    line: dotToken.line,
                    column: dotToken.col
                };
            }
        }

        expect('=', 'missing "=" after target');
        const value = parseExpression();

        if (target.type === 'table_access') {
            return {
                type: 'table_assignment',
                target: target.target,
                key: target.key,
                value,
                line: identToken.line,
                column: identToken.col
            };
        }

        return {
            type: 'index_assignment',
            target,
            value,
            line: identToken.line,
            column: identToken.col
        };
    }

    // ------------------------------------------------------------------
    // Programme
    // ------------------------------------------------------------------

    const ast = [];
    while (!isAtEnd()) {
        ast.push(parseStatement());
    }
    return ast;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parse, ParseError, LIMITS };
} else {
    window.parse = parse;
    window.ParseError = ParseError;
    window.AKARI_LIMITS = LIMITS;
}