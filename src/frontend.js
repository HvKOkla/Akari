/*
 * Akari Programming Language Engine — Frontend
 * (Lexer + Parser)
 * 
 * FROZEN: This file is part of the frozen engine.
 * TOLERANCE ZERO: Strict parsing, no silent failures.
 */

// --- LEXER ---
class LexerError extends Error {
    constructor(msg, line, column, hint = '') {
        super(msg);
        this.name = 'LexerError';
        this.line = line || '?';
        this.column = column || '?';
        this.hint = hint;
    }
    toString() {
        let s = `❌ Lexical error: ${this.message}`;
        s += `\n→ Line ${this.line}, column ${this.column}`;
        if (this.hint) s += `\n→ Hint: ${this.hint}`;
        return s;
    }
}

const KEYWORDS = Object.freeze({
    'import': 'import', 'def': 'def', 'end': 'end', 'return': 'return',
    'if': 'if', 'else': 'else', 'for': 'for', 'in': 'in', 'while': 'while',
    'stop': 'stop', 'skip': 'skip', 'try': 'try', 'catch': 'catch',
    'true': 'true', 'false': 'false', 'nothing': 'nothing', 'let': 'let', 'mut': 'mut'
});

const TWO_CHAR_TOKENS = new Set(['==', '!=', '>=', '<=', '&&', '||', '..']);
const SINGLE_CHAR_TOKENS = new Set([':', '(', ')', '=', ',', '+', '-', '*', '/', '%', '>', '<', '!', '[', ']', '.', '{', '}']);

function tokenize(code) {
    if (typeof code !== 'string') throw new LexerError('Source code must be a string.');
    const tokens = [];
    const length = code.length;
    let i = 0, line = 1, col = 1;

    function peek(offset = 0) { const idx = i + offset; return idx >= 0 && idx < length ? code[idx] : ''; }
    function advance() { const ch = code[i]; i++; if (ch === '\n') { line++; col = 1; } else { col++; } return ch; }
    function advanceN(n) { for (let k = 0; k < n; k++) advance(); }

    function readNumber() {
        const startLine = line, startCol = col;
        let raw = '';
        if (peek() === '0') {
            const next = peek(1).toLowerCase();
            if (next === 'x') { raw += advance() + advance(); while (/[0-9a-fA-F_]/.test(peek())) { if (peek() !== '_') raw += peek(); advance(); } return { type: 'number', value: parseInt(raw.slice(2), 16), line: startLine, col: startCol }; }
            if (next === 'b') { raw += advance() + advance(); while (/[01_]/.test(peek())) { if (peek() !== '_') raw += peek(); advance(); } return { type: 'number', value: parseInt(raw.slice(2), 2), line: startLine, col: startCol }; }
        }
        while (/[0-9_]/.test(peek())) { if (peek() !== '_') raw += peek(); advance(); }
        if (peek() === '.' && /[0-9]/.test(peek(1))) { raw += advance(); while (/[0-9_]/.test(peek())) { if (peek() !== '_') raw += peek(); advance(); } }
        return { type: 'number', value: Number(raw), line: startLine, col: startCol };
    }

    function readIdentifier() {
        const startLine = line, startCol = col;
        let ident = '';
        while (/[a-zA-Z0-9_]/.test(peek())) { ident += peek(); advance(); }
        if (KEYWORDS[ident]) return { type: KEYWORDS[ident], value: ident, line: startLine, col: startCol };
        return { type: 'identifier', value: ident, line: startLine, col: startCol };
    }

    function readString(quote) {
        const startLine = line, startCol = col;
        advance();
        let str = '';
        while (peek() !== quote) {
            if (peek() === '') throw new LexerError('Unterminated string.', startLine, startCol);
            if (peek() === '\\') { advance(); const esc = peek(); if (esc === 'n') str += '\n'; else if (esc === 't') str += '\t'; else str += esc; advance(); continue; }
            str += peek(); advance();
        }
        advance();
        return { type: 'string', value: str, line: startLine, col: startCol };
    }

    while (i < length) {
        const ch = peek();
        if (/[ \t\r\n]/.test(ch)) { advance(); continue; }
        if (ch === '#') { while (peek() !== '\n' && peek() !== '') advance(); continue; }
        if (/[0-9]/.test(ch)) { tokens.push(readNumber()); continue; }
        if (/[a-zA-Z_]/.test(ch)) { tokens.push(readIdentifier()); continue; }
        if (ch === '"' || ch === "'") { tokens.push(readString(ch)); continue; }
        
        const two = peek() + peek(1);
        if (TWO_CHAR_TOKENS.has(two)) { advanceN(2); tokens.push({ type: two, value: two, line, col }); continue; }
        if (SINGLE_CHAR_TOKENS.has(ch)) { advance(); tokens.push({ type: ch, value: ch, line, col }); continue; }
        throw new LexerError(`Unknown character: '${ch}'`, line, col);
    }
    tokens.push({ type: 'EOF', value: 'EOF', line, col });
    return Object.freeze(tokens); // FROZEN
}

// --- PARSER ---
class ParseError extends Error {
    constructor(msg, line, col) { super(msg); this.name = 'ParseError'; this.line = line; this.column = col; }
    toString() {
        return `❌ [ParseError] ${this.message}\n  --> Line ${this.line}, Column ${this.column}`;
    }
}

const MAX_NESTING_DEPTH = 500;

function parse(source) {
    const tokens = tokenize(source);
    let pos = 0;
    let depth = 0;

    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }
    function expect(type, hint = '') {
        const tok = peek();
        if (tok.type !== type) {
            throw new ParseError(`Expected '${type}', got '${tok.type}'.`, tok.line, tok.col, hint);
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

    function parseStatement() {
        const tok = peek();
        
        if (tok.type === 'let' || tok.type === 'mut') {
            next();
            const nameTok = next();
            if (nameTok.type !== 'identifier') throw new ParseError(`Expected identifier, got '${nameTok.type}'.`, nameTok.line, nameTok.col);
            expect('=', "Did you forget the '=' sign?");
            return { type: 'assignment', name: nameTok.value, isMut: tok.type === 'mut', isDeclaration: true, value: parseExpression(), line: tok.line, column: tok.col };
        }
        
        if (tok.type === 'import') {
            next();
            const pathTok = next();
            if (pathTok.type !== 'string') throw new ParseError(`Expected string after 'import', got '${pathTok.type}'.`, pathTok.line, pathTok.col);
            return { type: 'import', path: pathTok.value, line: tok.line, column: tok.col };
        }

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

        if (tok.type === 'if') {
            next();
            const condition = parseExpression();
            expect(':', "Did you forget ':' after 'if'?");
            
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

        // --- NOUVEAU : Gestion du for ---
        if (tok.type === 'for') {
            next();
            const nameTok = expect('identifier');
            expect('in');
            const start = parseExpression();
            expect('..');
            const end = parseExpression();
            expect(':');
            
            enterBlock();
            const body = [];
            while (peek().type !== 'end' && peek().type !== 'EOF') body.push(parseStatement());
            expect('end', "Did you forget 'end' to close the for loop?");
            exitBlock();

            return { type: 'for', varName: nameTok.value, start, end, body };
        }

        // --- NOUVEAU : Gestion du while ---
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

        // --- NOUVEAU : Gestion du return ---
        if (tok.type === 'return') {
            next();
            // Si on est juste avant 'end', on retourne "nothing"
            const nextTok = peek();
            if (nextTok.type === 'end' || nextTok.type === 'EOF') {
                return { type: 'return', value: null, line: tok.line, column: tok.col };
            }
            return { type: 'return', value: parseExpression(), line: tok.line, column: tok.col };
        }

        return parseExpression();
    }

    function parseExpression() {
        return parseBinary(0);
    }

    const PRECEDENCE = {
        '||': 1,
        '&&': 2,
        '==': 3, '!=': 3,
        '<': 4, '>': 4, '<=': 4, '>=': 4,
        '+': 5, '-': 5,
        '*': 6, '/': 6, '%': 6
    };

    function parseBinary(minPrecedence) {
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

    function parseUnary() {
        const tok = peek();
        if (tok.type === '-' || tok.type === '!') {
            next();
            const argument = parseUnary();
            return { type: 'unary', operator: tok.type, argument, line: tok.line, column: tok.col };
        }
        return parsePrimary();
    }

    function parsePrimary() {
        const tok = next();
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
                return { type: 'function_call', name: tok.value, args, line: tok.line, column: tok.col };
            }
            return { type: 'variable', name: tok.value, line: tok.line, column: tok.col };
        }
        
        throw new ParseError(`Unexpected token: '${tok.type}'.`, tok.line, tok.col, "Check for syntax errors.");
    }

    const ast = [];
    while (peek().type !== 'EOF') ast.push(parseStatement());
    return Object.freeze(ast); 
}
module.exports = Object.freeze({ tokenize, parse, LexerError, ParseError });