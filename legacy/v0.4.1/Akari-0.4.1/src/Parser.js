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
// Limites de sécurité (anti-DoS, anti-stack-overflow)
// ---------------------------------------------------------------------

const LIMITS = Object.freeze({
    MAX_SOURCE_LENGTH:   5 * 1024 * 1024,   // 5 MB de code
    MAX_TOKENS:          500_000,           // tokens max
    MAX_EXPR_DEPTH:      256,               // profondeur d'expression
    MAX_BLOCK_DEPTH:     64,                // profondeur de blocs
    MAX_PARAMS:          32,                // paramètres par fonction
    MAX_BLOCK_STMTS:     10_000,            // statements par bloc
    MAX_INDEX_DEPTH:     8                  // a[0][1][2]...
});

// Types de tokens qui peuvent démarrer une expression.
const EXPRESSION_STARTERS = new Set([
    'number', 'string', 'identifier',
    'true', 'false', 'nothing',
    '(', '-', '!'
]);

function parse(code) {
    // ------------------------------------------------------------------
    // Sécurité : type + taille
    // ------------------------------------------------------------------

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

    // Compteur de profondeur d'expression (reset à chaque statement)
    let exprDepth = 0;
    // Compteur de profondeur de blocs
    let blockDepth = 0;

    // ------------------------------------------------------------------
    // Helpers de lecture
    // ------------------------------------------------------------------

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
    // Expressions (précédence correcte)
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
    // Postfix : gère les accès indexés a[0], a[0][1], etc.
    // ------------------------------------------------------------------

    function parsePostfix() {
        let expr = parsePrimary();

        let depth = 0;
        while (peek().type === '[') {
            depth++;
            if (depth > LIMITS.MAX_INDEX_DEPTH) {
                throw new ParseError(
                    `Trop d'index imbriqués (max ${LIMITS.MAX_INDEX_DEPTH}).`,
                    peek().line, peek().col,
                    'Simplifiez l\'accès.'
                );
            }

            const bracketToken = next(); // '['
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
        }

        return expr;
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

    function parseForStatement(forToken) {
        const varToken = expect('identifier', 'loop variable name expected');
        expect('in', 'missing "in" in for loop');
        const start = parseExpression();
        expect('..', 'missing ".." in for range');
        const end = parseExpression();
        expect(':', 'missing colon after for loop');

        const body = parseBlock(new Set(['end']));
        expect('end', 'missing "end" to close for loop');

        return {
            type: 'for',
            varName: varToken.value,
            start,
            end,
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

                // Réassignation simple : x = expr
                if (nextToken.type === '=') {
                    next(); // ident
                    next(); // '='
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

                // Appel de fonction : foo(...)
                if (nextToken.type === '(') {
                    next(); // ident
                    const call = parseFunctionCall(token);
                    // Une expression seule n'est pas un statement : on
                    // accepte uniquement l'appel de fonction.
                    return call;
                }

                // ✅ NOUVEAU : assignation indexée a[i] = expr
                if (nextToken.type === '[') {
                    return parseIndexAssignmentStatement();
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
    // Assignation indexée :  a[i] = expr
    // ------------------------------------------------------------------

    function parseIndexAssignmentStatement() {
        // On consomme l'identifiant puis parse le postfix complet
        // pour récupérer le nœud index_access.
        const identToken = next(); // ident
        let target = {
            type: 'variable',
            name: identToken.value,
            line: identToken.line,
            column: identToken.col
        };

        // Gère les chaînes a[0][1][2]
        let depth = 0;
        while (peek().type === '[') {
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

            target = {
                type: 'index_access',
                target,
                index,
                line: bracketToken.line,
                column: bracketToken.col
            };
        }

        expect('=', 'missing "=" after indexed target');
        const value = parseExpression();

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