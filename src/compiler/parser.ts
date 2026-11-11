// @ts-nocheck

import { tokenize } from './lexer';

export class ParseError extends Error {
    constructor(msg: string, line: number, col: number) { super(msg); this.name = 'ParseError'; this.line = line; this.column = col; }
    toString() {
        return `❌ [ParseError] ${this.message}\n  --> Line ${this.line}, Column ${this.column}`;
    }
}

const MAX_NESTING_DEPTH = 500;

export function parse(source: string): any[] {
    const tokens = tokenize(source);
    let pos = 0;
    let depth = 0;

    function peek(offset = 0) { const idx = pos + offset; return idx < tokens.length ? tokens[idx] : tokens[tokens.length - 1]; }
    function next() { return tokens[pos++]; }
    function expect(type: string, hint = '') {
        const tok = peek();
        if (tok.type !== type) {
            throw new ParseError(`Expected '${type}', got '${tok.type}'.`, tok.line, tok.col);
        }
        return next();
    }

    function enterBlock() {
        depth++;
        if (depth > MAX_NESTING_DEPTH) {
            throw new ParseError(`Maximum nesting depth exceeded (${MAX_NESTING_DEPTH}).`, peek().line, peek().col);
        }
    }
    function exitBlock() { depth--; }

    function parseStatement(): any {
        const tok = peek();
        
        // 1. Déclarations (let / mut)
        if (tok.type === 'let' || tok.type === 'mut') {
            const isMut = tok.type === 'mut';
            next();
            const nameTok = next();
            if (nameTok.type !== 'identifier') throw new ParseError(`Expected identifier, got '${nameTok.type}'.`, nameTok.line, nameTok.col);
            expect('=', "Did you forget the '=' sign?");
            const value = parseExpression();
            return { type: 'assignment', name: nameTok.value, isMut, isDeclaration: true, value, line: tok.line, column: tok.col };
        }
        
        // 2. Import (bloqué)
        if (tok.type === 'import') {
            next();
            const pathTok = next();
            if (pathTok.type !== 'string') throw new ParseError(`Expected string after 'import', got '${pathTok.type}'.`, pathTok.line, pathTok.col);
            return { type: 'import', path: pathTok.value, line: tok.line, column: tok.col };
        }

        // 3. Fonctions
        if (tok.type === 'def') {
            next();
            const nameTok = next();
            if (nameTok.type !== 'identifier') throw new ParseError(`Expected function name, got '${nameTok.type}'.`, nameTok.line, nameTok.col);
            expect('(');
            const params = [];
            while (peek().type !== ')') {
                const p = expect('identifier');
                params.push(p.value);
                if (peek().type === ',') next();
            }
            expect(')');
            expect(':');
            
            enterBlock();
            const body = [];
            while (peek().type !== 'end' && peek().type !== 'EOF') body.push(parseStatement());
            expect('end', "Did you forget 'end' to close the function?");
            exitBlock();

            return { type: 'function_def', name: nameTok.value, params, body };
        }

        // 4. Conditions
        if (tok.type === 'if') {
            next();
            const condition = parseExpression();
            if (peek().type === ':') { next(); } else { expect(':'); }
            
            enterBlock();
            const body = [];
            while (peek().type !== 'end' && peek().type !== 'else' && peek().type !== 'EOF') body.push(parseStatement());
            
            const elseBody = [];
            if (peek().type === 'else') {
                next();
                expect(':', "Did you forget ':' after 'else'?");
                while (peek().type !== 'end' && peek().type !== 'EOF') elseBody.push(parseStatement());
            }
            expect('end', "Did you forget 'end' to close the if?");
            exitBlock();

            return { type: 'if', condition, body, else: elseBody };
        }

        // 5. Boucles For
        if (tok.type === 'for') {
            next();
            const nameTok = expect('identifier');
            expect('in');
            const start = parseExpression();
            
            if (peek().type === '..') {
                next();
                const end = parseExpression();
                expect(':');
                
                enterBlock();
                const body = [];
                while (peek().type !== 'end' && peek().type !== 'EOF') body.push(parseStatement());
                expect('end', "Did you forget 'end' to close the for loop?");
                exitBlock();
                
                return { type: 'for', varName: nameTok.value, start, end, body };
            } else {
                expect(':');
                
                enterBlock();
                const body = [];
                while (peek().type !== 'end' && peek().type !== 'EOF') body.push(parseStatement());
                expect('end', "Did you forget 'end' to close the for loop?");
                exitBlock();
                
                return { type: 'for_in', varName: nameTok.value, collection: start, body };
            }
        }

        // 6. Boucles While
        if (tok.type === 'while') {
            next();
            const condition = parseExpression();
            expect(':');
            
            enterBlock();
            const body = [];
            while (peek().type !== 'end' && peek().type !== 'EOF') body.push(parseStatement());
            expect('end', "Did you forget 'end' to close the while loop?");
            exitBlock();

            return { type: 'while', condition, body };
        }

        // 7. Return
        if (tok.type === 'return') {
            next();
            const nextTok = peek();
            if (nextTok.type === 'end' || nextTok.type === 'EOF') {
                return { type: 'return', value: null, line: tok.line, column: tok.col };
            }
            return { type: 'return', value: parseExpression(), line: tok.line, column: tok.col };
        }

        // 8. Stop / Skip
        if (tok.type === 'stop') {
            next();
            return { type: 'break', line: tok.line, column: tok.col };
        }
        if (tok.type === 'skip') {
            next();
            return { type: 'continue', line: tok.line, column: tok.col };
        }

        // 9. Try / Catch (bloqué)
        if (tok.type === 'try' || tok.type === 'catch') {
            throw new ParseError(`'${tok.type}' is a reserved keyword but is not supported yet.`, tok.line, tok.col);
        }

        // 10. Assignations et appels de fonction
        // On parse une expression. Si c'est une assignation, le parseExpression s'en occupe.
        return parseExpression();
    }

    function parseExpression(): any {
        return parseAssignment();
    }

    // Nouveau : Gestion des assignations (x = 5 ou hero.hp = 5)
    function parseAssignment(): any {
        const expr = parseBinary(0);

        if (peek().type === '=') {
            const eqTok = next();
            
            // Si on a une variable à gauche
            if (expr.type === 'variable') {
                return { type: 'assignment', name: expr.name, isMut: true, isDeclaration: false, value: parseExpression(), line: eqTok.line, column: eqTok.col };
            }
            
            // Si on a un accès à une propriété (hero.hp = 10)
            if (expr.type === 'table_access') {
                return { type: 'table_assignment', target: expr, value: parseExpression(), line: eqTok.line, column: eqTok.col };
            }

            throw new ParseError("Invalid assignment target.", eqTok.line, eqTok.col);
        }

        return expr;
    }

    const PRECEDENCE = {
        '||': 1,
        '&&': 2,
        '==': 3, '!=': 3,
        '<': 4, '>': 4, '<=': 4, '>=': 4,
        '+': 5, '-': 5,
        '*': 6, '/': 6, '%': 6
    };

    function parseBinary(minPrecedence: number): any {
        let left = parseUnary();

        while (true) {
            const opTok = peek();
            const op = opTok.type;
            const precedence = PRECEDENCE[op];
            
            if (precedence === undefined || precedence < minPrecedence) break;

            next();
            const right = parseBinary(precedence + 1);
            
            left = { type: 'binary', operator: op, left, right, line: opTok.line, column: opTok.col };
        }

        return left;
    }

    function parseUnary(): any {
        const tok = peek();
        if (tok.type === '-' || tok.type === '!') {
            next();
            const argument = parseUnary();
            return { type: 'unary', operator: tok.type, argument, line: tok.line, column: tok.col };
        }
        return parsePrimary();
    }

    function parsePrimary(): any {
        const tok = next();

        // Tables
        if (tok.type === '{') {
            const entries = [];
            while (peek().type !== '}' && peek().type !== 'EOF') {
                const keyTok = next();
                let key = '';
                if (keyTok.type === 'string' || keyTok.type === 'identifier') {
                    key = keyTok.value;
                } else {
                    throw new ParseError(`Expected key in table, got '${keyTok.type}'.`, keyTok.line, keyTok.col);
                }
                
                expect(':', "Did you forget ':' in the table?");
                const value = parseExpression();
                entries.push({ key, value });
                
                if (peek().type === ',') next();
            }
            expect('}', "Did you forget '}' to close the table?");
            return { type: 'table_literal', entries, line: tok.line, column: tok.col };
        }

        if (tok.type === 'number' || tok.type === 'string') return { type: tok.type, value: tok.value, line: tok.line, column: tok.col };
        if (tok.type === 'true') return { type: 'boolean', value: true };
        if (tok.type === 'false') return { type: 'boolean', value: false };
        if (tok.type === 'nothing') return { type: 'nothing' };
        
        if (tok.type === '(') {
            enterBlock();
            const expr = parseExpression();
            expect(')', "Did you forget ')'?");
            exitBlock();
            return expr;
        }

        if (tok.type === 'identifier') {
            if (peek().type === '(') {
                next();
                const args = [];
                while (peek().type !== ')') {
                    args.push(parseExpression());
                    if (peek().type === ',') next();
                }
                next();
                const callNode = { type: 'function_call', name: tok.value, args, line: tok.line, column: tok.col };
                return parsePostfix(callNode);
            }
            const varNode = { type: 'variable', name: tok.value, line: tok.line, column: tok.col };
            return parsePostfix(varNode);
        }
        
        throw new ParseError(`Unexpected token: '${tok.type}'.`, tok.line, tok.col);
    }

    function parsePostfix(node: any): any {
        while (peek().type === '.') {
            const dotTok = next();
            const keyTok = expect('identifier');
            node = { type: 'table_access', target: node, key: keyTok.value, line: dotTok.line, column: dotTok.col };
        }
        return node;
    }

    const ast = [];
    while (peek().type !== 'EOF') ast.push(parseStatement());
    return Object.freeze(ast); 
}