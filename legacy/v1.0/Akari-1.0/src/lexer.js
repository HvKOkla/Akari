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

// ---------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------

class LexerError extends Error {
    constructor(msg, line, column, suggestion = '') {
        super();
        this.name = 'LexerError';
        this.msg = msg;
        this.line = line || '?';
        this.column = column || '?';
        this.suggestion = suggestion;
    }

    toString() {
        let s = `❌ Erreur lexicale : ${this.msg}`;
        s += `\n→ Ligne ${this.line}, colonne ${this.column}`;
        if (this.suggestion) s += `\n→ ${this.suggestion}`;
        return s;
    }
}

// ---------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------

const KEYWORDS = Object.freeze({
    'import':  'import',
    'def':     'def',
    'end':     'end',
    'return':  'return',
    'if':      'if',
    'else':    'else',
    'for':     'for',
    'in':      'in',
    'while':   'while',
    'stop':    'stop',
    'skip':    'skip',
    'try':     'try',
    'catch':   'catch',
    'true':    'true',
    'false':   'false',
    'nothing': 'nothing',
    'let':     'let',
    'mut':     'mut'
});

// Tokens à deux caractères (ordre important : les plus longs d'abord)
const TWO_CHAR_TOKENS = new Set([
    '==', '!=', '>=', '<=', '&&', '||', '..'
]);

// Tokens à un caractère
const SINGLE_CHAR_TOKENS = new Set([
    ':', '(', ')', '=', ',',
    '+', '-', '*', '/', '%',
    '>', '<', '!',
    '[', ']', '.'
]);

const MAX_IDENTIFIER_LENGTH = 255;

// ---------------------------------------------------------------------
// Helpers caractères
// ---------------------------------------------------------------------

function isDigit(ch) {
    return ch >= '0' && ch <= '9';
}

function isHexDigit(ch) {
    return (ch >= '0' && ch <= '9') ||
           (ch >= 'a' && ch <= 'f') ||
           (ch >= 'A' && ch <= 'F');
}

function isLetter(ch) {
    return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

function isIdentStart(ch) {
    return isLetter(ch) || ch === '_';
}

function isIdentPart(ch) {
    return isLetter(ch) || isDigit(ch) || ch === '_';
}

function isWhitespace(ch) {
    return ch === ' ' || ch === '\t' || ch === '\r';
}

// ---------------------------------------------------------------------
// Lexer
// ---------------------------------------------------------------------

function tokenize(code) {
    if (typeof code !== 'string') {
        throw new LexerError(
            `Le code source doit être une chaîne, reçu : ${typeof code}`,
            '?', '?',
            'Vérifiez la source passée au lexer.'
        );
    }

    const tokens = [];
    const length = code.length;
    let i = 0;
    let line = 1;
    let col = 1;

    // Accès sûr au caractère courant
    function peek(offset = 0) {
        const idx = i + offset;
        return idx >= 0 && idx < length ? code[idx] : '';
    }

    // Avance d'un caractère, met à jour ligne/colonne
    function advance() {
        const ch = code[i];
        i++;
        if (ch === '\n') {
            line++;
            col = 1;
        } else {
            col++;
        }
        return ch;
    }

    // Avance de n caractères
    function advanceN(n) {
        for (let k = 0; k < n; k++) advance();
    }

    // -----------------------------------------------------------------
    // Sous-lecteurs
    // -----------------------------------------------------------------

    function readNumber() {
        const startLine = line;
        const startCol = col;
        let raw = '';

        // Détection préfixe hex / binaire / octal
        if (peek() === '0') {
            const next = peek(1).toLowerCase();
            if (next === 'x') {
                raw += advance(); // 0
                raw += advance(); // x
                if (!isHexDigit(peek())) {
                    throw new LexerError(
                        `Littéral hexadécimal invalide : '${raw}'`,
                        startLine, startCol,
                        'Format attendu : 0x suivi de chiffres hexadécimaux.'
                    );
                }
                while (isHexDigit(peek()) || peek() === '_') {
                    if (peek() !== '_') raw += peek();
                    advance();
                }
                return {
                    type: 'number',
                    value: parseInt(raw.slice(2), 16),
                    line: startLine, col: startCol
                };
            }
            if (next === 'b') {
                raw += advance();
                raw += advance();
                if (peek() !== '0' && peek() !== '1') {
                    throw new LexerError(
                        `Littéral binaire invalide : '${raw}'`,
                        startLine, startCol,
                        'Format attendu : 0b suivi de 0 et 1.'
                    );
                }
                while (peek() === '0' || peek() === '1' || peek() === '_') {
                    if (peek() !== '_') raw += peek();
                    advance();
                }
                return {
                    type: 'number',
                    value: parseInt(raw.slice(2), 2),
                    line: startLine, col: startCol
                };
            }
            if (next === 'o') {
                raw += advance();
                raw += advance();
                if (peek() < '0' || peek() > '7') {
                    throw new LexerError(
                        `Littéral octal invalide : '${raw}'`,
                        startLine, startCol,
                        'Format attendu : 0o suivi de chiffres 0-7.'
                    );
                }
                while ((peek() >= '0' && peek() <= '7') || peek() === '_') {
                    if (peek() !== '_') raw += peek();
                    advance();
                }
                return {
                    type: 'number',
                    value: parseInt(raw.slice(2), 8),
                    line: startLine, col: startCol
                };
            }
        }

        // Décimal classique
        let hasDigits = false;
        while (isDigit(peek()) || peek() === '_') {
            if (peek() !== '_') {
                raw += peek();
                hasDigits = true;
            }
            advance();
        }

        // Partie fractionnaire
        if (peek() === '.' && isDigit(peek(1))) {
            raw += advance(); // .
            while (isDigit(peek()) || peek() === '_') {
                if (peek() !== '_') raw += peek();
                advance();
            }
        }

        // Notation scientifique
        if (peek() === 'e' || peek() === 'E') {
            let exp = '';
            let j = 1;
            if (peek(j) === '+' || peek(j) === '-') {
                exp += peek(j);
                j++;
            }
            if (!isDigit(peek(j))) {
                throw new LexerError(
                    `Exposant scientifique invalide après '${raw}'.`,
                    startLine, startCol,
                    'Format attendu : 1e5, 1e-5, 1e+5.'
                );
            }
            raw += advance(); // e
            if (peek() === '+' || peek() === '-') raw += advance();
            while (isDigit(peek())) raw += advance();
        }

        if (!hasDigits) {
            throw new LexerError(
                `Nombre invalide : '${raw}'`,
                startLine, startCol,
                'Un nombre doit contenir au moins un chiffre.'
            );
        }

        const value = Number(raw);
        if (!Number.isFinite(value)) {
            throw new LexerError(
                `Nombre hors limite : '${raw}'`,
                startLine, startCol,
                'Le nombre dépasse les capacités de JavaScript.'
            );
        }

        return {
            type: 'number',
            value,
            line: startLine, col: startCol
        };
    }

    function readIdentifierOrKeyword() {
        const startLine = line;
        const startCol = col;
        let ident = '';

        while (isIdentPart(peek())) {
            ident += peek();
            advance();
        }

        if (ident.length > MAX_IDENTIFIER_LENGTH) {
            throw new LexerError(
                `Identifiant trop long (${ident.length} caractères, max ${MAX_IDENTIFIER_LENGTH}).`,
                startLine, startCol,
                'Raccourcissez le nom.'
            );
        }

        if (Object.prototype.hasOwnProperty.call(KEYWORDS, ident)) {
            return {
                type: KEYWORDS[ident],
                value: ident,
                line: startLine, col: startCol
            };
        }

        return {
            type: 'identifier',
            value: ident,
            line: startLine, col: startCol
        };
    }

    function readString(quote) {
        const startLine = line;
        const startCol = col;
        advance(); // consomme la quote

        let str = '';

        while (peek() !== quote) {
            if (peek() === '') {
                throw new LexerError(
                    `Chaîne non fermée (ouverte ligne ${startLine}, colonne ${startCol}).`,
                    startLine, startCol,
                    `Fermez avec ${quote}.`
                );
            }

            if (peek() === '\n') {
                // Les chaînes multi-lignes ne sont pas autorisées par défaut
                throw new LexerError(
                    'Retour à la ligne dans une chaîne.',
                    line, col,
                    'Utilisez \\n pour un saut de ligne.'
                );
            }

            if (peek() === '\\') {
                advance(); // consomme le backslash
                const esc = peek();
                switch (esc) {
                    case 'n':  str += '\n'; advance(); break;
                    case 't':  str += '\t'; advance(); break;
                    case 'r':  str += '\r'; advance(); break;
                    case '0':  str += '\0'; advance(); break;
                    case '\\': str += '\\'; advance(); break;
                    case '"':  str += '"';  advance(); break;
                    case "'":  str += "'";  advance(); break;
                    case 'u': {
                        advance(); // u
                        let hex = '';
                        for (let k = 0; k < 4; k++) {
                            if (!isHexDigit(peek())) {
                                throw new LexerError(
                                    `Séquence unicode invalide : \\u${hex}`,
                                    line, col,
                                    'Format attendu : \\uXXXX (4 chiffres hex).'
                                );
                            }
                            hex += peek();
                            advance();
                        }
                        str += String.fromCharCode(parseInt(hex, 16));
                        break;
                    }
                    default:
                        throw new LexerError(
                            `Séquence d'échappement inconnue : \\${esc}`,
                            line, col,
                            'Échappements valides : \\n \\t \\r \\0 \\\\ \\" \\\' \\uXXXX'
                        );
                }
                continue;
            }

            str += peek();
            advance();
        }

        advance(); // consomme la quote fermante

        return {
            type: 'string',
            value: str,
            line: startLine, col: startCol
        };
    }

    function readComment() {
        // Deux formes : '#' et '//'
        if (peek() === '/' && peek(1) === '/') {
            advanceN(2);
        } else {
            advance(); // '#'
        }

        while (peek() !== '\n' && peek() !== '') {
            advance();
        }
        // Le '\n' sera consommé par la boucle principale
    }

    function readTwoCharOrSingle() {
        const startLine = line;
        const startCol = col;
        const two = peek() + peek(1);

        if (TWO_CHAR_TOKENS.has(two)) {
            advanceN(2);
            return { type: two, value: two, line: startLine, col: startCol };
        }

        const one = peek();
        if (SINGLE_CHAR_TOKENS.has(one)) {
            advance();
            return { type: one, value: one, line: startLine, col: startCol };
        }

        return null;
    }

    // -----------------------------------------------------------------
    // Boucle principale
    // -----------------------------------------------------------------

    while (i < length) {
        const ch = peek();

        // Espaces et retours à la ligne
        if (isWhitespace(ch)) {
            advance();
            continue;
        }

        if (ch === '\n') {
            advance();
            continue;
        }

        // Commentaires
        if (ch === '#' || (ch === '/' && peek(1) === '/')) {
            readComment();
            continue;
        }

        // Nombres
        if (isDigit(ch)) {
            tokens.push(readNumber());
            continue;
        }

        // Identifiants et mots-clés
        if (isIdentStart(ch)) {
            tokens.push(readIdentifierOrKeyword());
            continue;
        }

        // Chaînes
        if (ch === '"' || ch === "'") {
            tokens.push(readString(ch));
            continue;
        }

        // Opérateurs et ponctuation
        const opToken = readTwoCharOrSingle();
        if (opToken) {
            tokens.push(opToken);
            continue;
        }

        // Caractère inconnu
        throw new LexerError(
            `Caractère inconnu : '${ch}' (code U+${ch.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`,
            line, col,
            'Ce symbole n\'est pas utilisé en Akari.'
        );
    }

    // Token EOF final (utile pour le parser)
    tokens.push({
        type: 'EOF',
        value: 'EOF',
        line, col
    });

    return tokens;
}

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { tokenize, LexerError };
} else {
    window.tokenize = LexerError;
    window.LexerError = LexerError;
}