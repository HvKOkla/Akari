/*
 * Akari Programming Language Engine — Frontend
 * (Lexer + Parser)
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
    return tokens;
}

// --- PARSER ---
class ParseError extends Error {
    constructor(msg, line, col) { super(msg); this.name = 'ParseError'; this.line = line; this.column = col; }
}

function parse(source) {
    const tokens = tokenize(source);
    let pos = 0;
    function peek() { return tokens[pos]; }
    function next() { return tokens[pos++]; }

    function parseStatement() {
        const tok = peek();
        if (tok.type === 'let' || tok.type === 'mut') {
            next(); const name = next().value; next(); // '='
            return { type: 'assignment', name, isMut: tok.type === 'mut', isDeclaration: true, value: parseExpression(), line: tok.line, column: tok.col };
        }
        if (tok.type === 'def') {
            next(); const name = next().value; next(); // '('
            const params = [];
            while (peek().type !== ')') { params.push(next().value); if (peek().type === ',') next(); }
            next(); next(); // ')' et ':'
            const body = [];
            while (peek().type !== 'end' && peek().type !== 'EOF') body.push(parseStatement());
            next(); // 'end'
            return { type: 'function_def', name, params, body };
        }
        if (tok.type === 'if') {
            next(); const condition = parseExpression(); next(); // ':'
            const body = [];
            while (peek().type !== 'end' && peek().type !== 'else' && peek().type !== 'EOF') body.push(parseStatement());
            const elseBody = [];
            if (peek().type === 'else') { next(); next(); while (peek().type !== 'end' && peek().type !== 'EOF') elseBody.push(parseStatement()); }
            next(); // 'end'
            return { type: 'if', condition, body, else: elseBody };
        }
        // Fallback : expression
        return parseExpression();
    }

    // --- NOUVEAU : Parseur d'expressions avec priorités ---
    function parseExpression() {
        return parseBinary(0);
    }

    // Priorités des opérateurs (plus le chiffre est grand, plus l'opérateur est prioritaire)
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
            
            // Si l'opérateur n'existe pas ou n'est pas assez prioritaire, on s'arrête
            if (precedence === undefined || precedence < minPrecedence) break;

            next(); // On consomme l'opérateur
            const right = parseBinary(precedence + 1); // On parse le côté droit avec une priorité plus élevée (associativité à gauche)
            
            left = { type: 'binary', operator: op, left, right, line: opTok.line, column: opTok.col };
        }

        return left;
    }

    function parseUnary() {
        const tok = peek();
        if (tok.type === '-' || tok.type === '!') {
            next();
            const argument = parseUnary(); // Récursif pour gérer --x ou !!x
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
        
        // Gestion des parenthèses
        if (tok.type === '(') {
            const expr = parseExpression();
            next(); // ')' 
            return expr;
        }

        if (tok.type === 'identifier') {
            if (peek().type === '(') {
                next(); const args = [];
                while (peek().type !== ')') { args.push(parseExpression()); if (peek().type === ',') next(); }
                next(); return { type: 'function_call', name: tok.value, args, line: tok.line, column: tok.col };
            }
            return { type: 'variable', name: tok.value, line: tok.line, column: tok.col };
        }
        return { type: 'number', value: 0 };
    }

    const ast = [];
    while (peek().type !== 'EOF') ast.push(parseStatement());
    return ast;
}

module.exports = { tokenize, parse, LexerError, ParseError };
