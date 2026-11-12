/*
 * Akari Programming Language Engine — SQL Backend
 * (Experimental)
 * 
 * This backend transpiles Akari AST to SQL SELECT queries.
 * It is designed for SaaS rule engines (filtering data safely).
 */

class SQLCompileError extends Error {
    constructor(msg, node) {
        super(msg);
        this.name = 'SQLCompileError';
        this.line = node ? node.line : '?';
    }
    toString() {
        return `❌ [SQL Compile Error] ${this.message} (Line ${this.line})`;
    }
}

function transpileToSQL(ast) {
    let tableName = null;
    let selectCols = "*";
    let whereClauses = [];

    // Fonction récursive pour parcourir l'AST
    function walk(node) {
        if (!node) return;

        // 1. Détection intelligente de la table (for x in users: ...)
        if (node.type === 'for_in') {
            if (node.collection && node.collection.type === 'variable') {
                tableName = node.collection.name;
            } else {
                throw new SQLCompileError("SQL backend: 'for ... in' must iterate over a table name (identifier).", node);
            }
            for (const stmt of node.body) walk(stmt);
            return;
        }

        // 2. Gestion des conditions (if)
        if (node.type === 'if') {
            const condition = walk(node.condition);
            if (condition) whereClauses.push(condition);
            
            for (const stmt of node.body) walk(stmt);
            if (node.else) {
                for (const stmt of node.else) walk(stmt);
            }
            return;
        }

        // 3. Gestion du return
        if (node.type === 'return') {
            if (node.value && node.value.type === 'variable') {
                selectCols = node.value.name;
            } else if (node.value && node.value.type === 'table_access') {
                selectCols = `${node.value.target.name}.${node.value.key}`;
                // Si on voit user.name, on devine que la table s'appelle "users"
                if (!tableName) tableName = node.value.target.name + "s";
            } else if (node.value) {
                throw new SQLCompileError("SQL backend: 'return' only supports a column name or table.column.", node);
            }
            return;
        }

        // Blocs fonction : on parcourt le corps (les fonctions ne produisent pas de SQL)
        if (node.type === 'function_def') {
            for (const stmt of node.body) walk(stmt);
            return;
        }
        if (node.type === 'assignment' && node.isDeclaration) {
            // let/mut en tete de script : ignore pour la generation SQL
            return;
        }

        // 4. Gestion des expressions
        if (node.type === 'binary') {
            const left = walk(node.left);
            const right = walk(node.right);
            let op = node.operator;

            // Si on voit user.age > 18, on devine la table
            if (!tableName && node.left.type === 'table_access') {
                tableName = node.left.target.name + "s";
            }

            if (op === '==') op = '=';
            if (op === '&&') op = 'AND';
            if (op === '||') op = 'OR';
            if (!['=', '!=', '<', '>', '<=', '>=', 'AND', 'OR', '+', '-', '*', '/', '%'].includes(op)) {
                throw new SQLCompileError(`SQL backend: operator '${node.operator}' is not supported.`, node);
            }

            return `${left} ${op} ${right}`;
        }

        if (node.type === 'unary') {
            if (node.operator === '!') return `NOT (${walk(node.argument)})`;
            if (node.operator === '-') return `-(${walk(node.argument)})`;
            throw new SQLCompileError(`SQL backend: unary operator '${node.operator}' is not supported.`, node);
        }

        if (node.type === 'variable') return node.name;
        if (node.type === 'table_access') {
            if (node.target.type !== 'variable') {
                throw new SQLCompileError("SQL backend: only simple table.column access is supported.", node);
            }
            if (!tableName) tableName = node.target.name + "s";
            return `${node.target.name}.${node.key}`;
        }
        if (node.type === 'number') return String(node.value);
        if (node.type === 'string') return `'${node.value.replace(/'/g, "''")}'`;
        if (node.type === 'boolean') return node.value ? 'TRUE' : 'FALSE';
        if (node.type === 'nothing') return 'NULL';

        throw new SQLCompileError(`SQL backend: node type '${node.type}' is not supported.`, node);
    }

    // On parcourt l'AST
    for (const stmt of ast) {
        walk(stmt);
    }

    // Si on n'a pas trouvé de table, on met une table par défaut
    if (!tableName) tableName = "my_table";

    // On construit la requête finale
    let sql = `SELECT ${selectCols} FROM ${tableName}`;
    if (whereClauses.length > 0) {
        sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    sql += ';';

    return sql;
}

module.exports = Object.freeze({
    transpileToSQL,
    SQLCompileError
});